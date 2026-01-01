import { DI, inject } from '@aurelia/kernel';
import { IHttpClient, json } from '@aurelia/fetch-client';
import {
  extend,
  forEach,
  isFunction,
  isString,
  joinUrl,
  camelCase,
  status,
} from './auth-utilities';
import { IStorage } from './storage';
import { IPopup } from './popup';
import { IAuthConfigOptions, IAuthOptions } from './configuration';
import { IAuthentication } from './authentication';

export const IOAuth2 = DI.createInterface<IOAuth2>("IOAuth2", x => x.singleton(OAuth2));
export type IOAuth2 = OAuth2;

@inject(IStorage, IPopup, IAuthentication, IHttpClient, IAuthOptions)
export class OAuth2 {
  protected defaults;

  constructor(
    readonly storage: IStorage,
    readonly popup: IPopup,
    readonly auth: IAuthentication,
    readonly http: IHttpClient,
    readonly config: IAuthConfigOptions
  ) {
    this.defaults = {
      url: null,
      name: null,
      state: null,
      scope: null,
      scopeDelimiter: null,
      redirectUri: null,
      popupOptions: null,
      authorizationEndpoint: null,
      responseParams: null,
      requiredUrlParams: null,
      optionalUrlParams: null,
      defaultUrlParams: ['response_type', 'client_id', 'redirect_uri'],
      responseType: 'code',
      pkce: undefined,
      pkceMethod: 'S256',
    };
  }

  async open(options, userData) {
    let current = extend({}, this.defaults, options);
    current.responseType = current.responseType ?? this.defaults.responseType;
    const responseType = String(current.responseType ?? '').toLowerCase();
    const usesCodeFlow = responseType.includes('code');
    const usePkce =
      usesCodeFlow && (current.pkce ?? this.config.pkce ?? false);

    //state handling
    let stateName = current.name + '_state';

    if (isFunction(current.state)) {
      this.storage.set(stateName, current.state());
    } else if (isString(current.state)) {
      this.storage.set(stateName, current.state);
    }

    //nonce handling
    let nonceName = current.name + '_nonce';

    if (isFunction(current.nonce)) {
      this.storage.set(nonceName, current.nonce());
    } else if (isString(current.nonce)) {
      this.storage.set(nonceName, current.nonce);
    }

    if (usePkce) {
      await this.setupPkce(current);
    }

    let url =
      current.authorizationEndpoint + '?' + this.buildQueryString(current);

    let openPopup;
    if (this.config.platform === 'mobile') {
      openPopup = this.popup
        .open(url, current.name, current.popupOptions, current.redirectUri)
        .eventListener(current.redirectUri);
    } else {
      openPopup = this.popup
        .open(url, current.name, current.popupOptions, current.redirectUri)
        .pollPopup();
    }

    return openPopup.then((oauthData) => {
      if (oauthData.state && oauthData.state !== this.storage.get(stateName)) {
        return Promise.reject('OAuth 2.0 state parameter mismatch.');
      }

      if (
        String(current.responseType ?? '')
          .toUpperCase()
          .indexOf('TOKEN') !== -1
      ) {
        //meaning implicit flow or hybrid flow
        if (!this.verifyIdToken(oauthData, current.name)) {
          return Promise.reject('OAuth 2.0 Nonce parameter mismatch.');
        }

        return oauthData;
      }

      return this.exchangeForToken(oauthData, userData, current); //responseType is authorization code only (no token nor id_token)
    });
  }

  verifyIdToken(oauthData, providerName) {
    let idToken = oauthData && oauthData[this.config.responseIdTokenProp];
    if (!idToken) return true;
    let idTokenObject = this.auth.decomposeToken(idToken);
    if (!idTokenObject) return true;
    let nonceFromToken = idTokenObject.nonce;
    if (!nonceFromToken) return true;
    let nonceInStorage = this.storage.get(providerName + '_nonce');
    if (nonceFromToken !== nonceInStorage) {
      return false;
    }
    return true;
  }

  exchangeForToken(oauthData, userData, current) {
    let data = extend({}, userData, {
      code: oauthData.code,
      clientId: current.clientId,
      redirectUri: current.redirectUri,
    });

    if (oauthData.state) {
      data.state = oauthData.state;
    }

    const pkceVerifier = this.storage.get(current.name + '_pkce');
    if (pkceVerifier) {
      data.code_verifier = pkceVerifier;
      this.storage.remove(current.name + '_pkce');
    }

    forEach(
      current.responseParams,
      (param) => (data[param] = oauthData[param])
    );

    let exchangeForTokenUrl = this.config.baseUrl
      ? joinUrl(this.config.baseUrl, current.url)
      : current.url;

    let credentials: RequestCredentials = this.config.withCredentials
      ? 'include'
      : 'same-origin';

    return this.http
      .fetch(exchangeForTokenUrl, {
        method: 'post',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: json(data),
        credentials: credentials,
      })
      .then(status);
  }

  buildQueryString(current) {
    let keyValuePairs = [];
    let urlParams = [
      'defaultUrlParams',
      'requiredUrlParams',
      'optionalUrlParams',
    ];

    forEach(urlParams, (params) => {
      forEach(current[params], (paramName) => {
        let camelizedName = camelCase(paramName);
        let paramValue = isFunction(current[paramName])
          ? current[paramName]()
          : current[camelizedName];

        if (paramName === 'state') {
          let stateName = current.name + '_state';
          paramValue = encodeURIComponent(this.storage.get(stateName));
        }

        if (paramName === 'nonce') {
          let nonceName = current.name + '_nonce';
          paramValue = encodeURIComponent(this.storage.get(nonceName));
        }

        if (paramName === 'scope' && Array.isArray(paramValue)) {
          paramValue = paramValue.join(current.scopeDelimiter);

          if (current.scopePrefix) {
            paramValue = [current.scopePrefix, paramValue].join(
              current.scopeDelimiter
            );
          }
        }

        keyValuePairs.push([paramName, paramValue]);
      });
    });

    if (current.codeChallenge) {
      keyValuePairs.push(['code_challenge', current.codeChallenge]);
      keyValuePairs.push([
        'code_challenge_method',
        current.codeChallengeMethod || 'S256',
      ]);
    }

    return keyValuePairs.map((pair) => pair.join('=')).join('&');
  }

  private async setupPkce(current) {
    const method = (current.pkceMethod || this.config.pkceMethod || 'S256')
      .toString()
      .toUpperCase() === 'PLAIN'
      ? 'plain'
      : 'S256';
    const verifier = this.generatePkceVerifier();
    const challenge =
      method === 'plain'
        ? verifier
        : await this.createPkceChallenge(verifier);

    this.storage.set(current.name + '_pkce', verifier);
    current.codeChallenge = challenge;
    current.codeChallengeMethod = method;
  }

  private generatePkceVerifier(length = 64): string {
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const randomValues = this.getRandomValues(length);
    let result = '';

    for (let i = 0; i < length; i++) {
      result += charset.charAt(randomValues[i] % charset.length);
    }

    return result;
  }

  private getRandomValues(length: number): Uint8Array {
    const array = new Uint8Array(length);
    const crypto = this.getCrypto();
    if (crypto?.getRandomValues) {
      crypto.getRandomValues(array);
      return array;
    }

    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  }

  private async createPkceChallenge(verifier: string): Promise<string> {
    const crypto = this.getCrypto();
    if (!crypto?.subtle) {
      throw new Error('PKCE requires a secure crypto implementation.');
    }

    if (typeof TextEncoder === 'undefined') {
      throw new Error('PKCE requires TextEncoder support.');
    }

    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  private base64UrlEncode(buffer: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < buffer.length; i++) {
      binary += String.fromCharCode(buffer[i]);
    }

    const base64 = this.encodeBase64(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private encodeBase64(value: string): string {
    if (typeof btoa === 'function') {
      return btoa(value);
    }

    const bufferCtor = (globalThis as typeof globalThis & {
      Buffer?: { from: (input: string, encoding?: string) => { toString: (encoding: string) => string } };
    }).Buffer;
    if (bufferCtor) {
      return bufferCtor.from(value, 'binary').toString('base64');
    }

    throw new Error('No base64 encoder available.');
  }

  private getCrypto(): Crypto | null {
    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
      return globalThis.crypto;
    }

    return null;
  }
}
