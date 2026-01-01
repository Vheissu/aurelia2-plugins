import { DI, inject, optional } from '@aurelia/kernel';
import { IStorage } from './storage';
import { joinUrl, isObject, isString } from './auth-utilities';
import { IAuthOptions, IAuthConfigOptions } from './configuration';
import { IWindow } from '@aurelia/runtime-html';

export const IAuthentication = DI.createInterface<IAuthentication>(
  "IAuthentication",
  (x) => x.singleton(Authentication)
);

export interface IAuthentication extends Authentication {}

@inject(IStorage, IAuthOptions, optional(IWindow))
export class Authentication {
  private tokenName;
  private idTokenName;
  private refreshTokenName;
  private initialUrl;

  constructor(
    readonly storage: IStorage,
    readonly config: IAuthConfigOptions,
    readonly window?: IWindow
  ) {
    this.storage = storage;
    const tokenName = this.config.tokenName ?? 'token';
    const idTokenName = this.config.idTokenName ?? 'id_token';
    const refreshTokenName = this.config.refreshTokenName ?? 'refresh_token';

    this.tokenName = this.config.tokenPrefix
      ? this.config.tokenPrefix + '_' + tokenName
      : tokenName;
    this.idTokenName = this.config.tokenPrefix
      ? this.config.tokenPrefix + '_' + idTokenName
      : idTokenName;
    this.refreshTokenName = this.config.tokenPrefix
      ? this.config.tokenPrefix + '_' + refreshTokenName
      : refreshTokenName;
  }

  getLoginRoute() {
    return this.config.loginRoute;
  }

  getLoginRedirect() {
    return this.initialUrl || this.config.loginRedirect;
  }

  getLoginUrl() {
    return this.config.baseUrl
      ? joinUrl(this.config.baseUrl, this.config.loginUrl)
      : this.config.loginUrl;
  }

  getSignupUrl() {
    return this.config.baseUrl
      ? joinUrl(this.config.baseUrl, this.config.signupUrl)
      : this.config.signupUrl;
  }

  getProfileUrl() {
    return this.config.baseUrl
      ? joinUrl(this.config.baseUrl, this.config.profileUrl)
      : this.config.profileUrl;
  }

  getRefreshUrl() {
    return this.config.baseUrl
      ? joinUrl(this.config.baseUrl, this.config.refreshUrl)
      : this.config.refreshUrl;
  }

  getToken() {
    return this.storage.get(this.tokenName);
  }

  getRefreshToken() {
    return this.storage.get(this.refreshTokenName);
  }

  getPayload() {
    let token = this.storage.get(this.tokenName);
    return this.decomposeToken(token);
  }

  decomposeToken(token) {
    if (!token || token.split('.').length !== 3) {
      return null;
    }

    let base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

    try {
      const decoded = this.decodeBase64(base64);
      if (!decoded) {
        return null;
      }
      return JSON.parse(decoded);
    } catch (error) {
      return null;
    }
  }

  private decodeBase64(value: string): string | null {
    const atobFn =
      this.window?.atob || (typeof globalThis !== 'undefined' ? globalThis.atob : undefined);
    if (atobFn) {
      return decodeURIComponent(escape(atobFn(value)));
    }

    // Node.js fallback
    const bufferCtor = (globalThis as typeof globalThis & {
      Buffer?: { from: (input: string, encoding?: string) => { toString: (encoding: string) => string } };
    }).Buffer;
    if (bufferCtor) {
      return bufferCtor.from(value, 'base64').toString('utf8');
    }

    return null;
  }

  setInitialUrl(url) {
    this.initialUrl = url;
  }

  setToken(response, redirect?) {
    const tokenName = this.config.tokenName ?? 'token';
    const idTokenName = this.config.idTokenName ?? 'id_token';
    const refreshTokenName = this.config.refreshTokenName ?? 'refresh_token';
    const responseTokenProp = this.config.responseTokenProp ?? tokenName;
    const responseIdTokenProp = this.config.responseIdTokenProp ?? idTokenName;
    const responseRefreshTokenProp =
      this.config.responseRefreshTokenProp ?? refreshTokenName;

    // access token handling
    let accessToken = response && response[responseTokenProp];
    let tokenToStore;

    if (accessToken) {
      if (isObject(accessToken) && isObject(accessToken.data)) {
        response = accessToken;
      } else if (isString(accessToken)) {
        tokenToStore = accessToken;
      }
    }

    if (!tokenToStore && response) {
      tokenToStore =
        this.config.tokenRoot && response[this.config.tokenRoot]
          ? response[this.config.tokenRoot][tokenName]
          : response[tokenName];
    }

    if (tokenToStore) {
      this.storage.set(this.tokenName, tokenToStore);
    }

    // id token handling
    let idToken = response && response[responseIdTokenProp];

    if (idToken) {
      this.storage.set(this.idTokenName, idToken);
    }

    // refresh token handling
    let refreshToken = response && response[responseRefreshTokenProp];

    if (!refreshToken && response) {
      refreshToken =
        this.config.refreshTokenRoot && response[this.config.refreshTokenRoot]
          ? response[this.config.refreshTokenRoot][refreshTokenName]
          : response[refreshTokenName];
    }

    if (refreshToken) {
      this.storage.set(this.refreshTokenName, refreshToken);
    }

    if (this.config.loginRedirect && !redirect) {
      this.window?.location && (this.window.location.href = this.getLoginRedirect());
    } else if (redirect && isString(redirect)) {
      if (this.window?.location && typeof encodeURI === 'function') {
        this.window.location.href = encodeURI(redirect);
      }
    }
  }

  removeToken() {
    this.storage.remove(this.tokenName);
  }

  removeIdToken() {
    this.storage.remove(this.idTokenName);
  }

  removeRefreshToken() {
    this.storage.remove(this.refreshTokenName);
  }

  clearTokens() {
    this.removeToken();
    this.removeIdToken();
    this.removeRefreshToken();
  }

  isTokenExpired(leewaySeconds = this.config.tokenExpirationLeeway ?? 0) {
    let token = this.storage.get(this.tokenName);

    if (!token || token.split('.').length !== 3) {
      return false;
    }

    let exp;
    try {
      let base64Url = token.split('.')[1];
      let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = this.decodeBase64(base64);
      if (!decoded) {
        return false;
      }
      exp = JSON.parse(decoded).exp;
    } catch (error) {
      return false;
    }

    if (!exp) {
      return false;
    }

    const now = Math.round(new Date().getTime() / 1000);
    return now + leewaySeconds >= exp;
  }

  isAuthenticated() {
    let token = this.storage.get(this.tokenName);

    // There's no token, so user is not authenticated.
    if (!token) {
      return false;
    }

    // There is a token, but in a different format. Return true.
    if (token.split('.').length !== 3) {
      return true;
    }

    let exp;
    try {
      let base64Url = token.split('.')[1];
      let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = this.decodeBase64(base64);
      if (!decoded) {
        return false;
      }
      exp = JSON.parse(decoded).exp;
    } catch (error) {
      return false;
    }

    if (exp) {
      const leeway = this.config.tokenExpirationLeeway ?? 0;
      return Math.round(new Date().getTime() / 1000) + leeway <= exp;
    }

    return true;
  }

  logout(redirect): Promise<void> {
    return new Promise((resolve) => {
      this.clearTokens();

      if (this.config.logoutRedirect && !redirect) {
        this.window?.location &&
          (this.window.location.href = this.config.logoutRedirect);
      } else if (isString(redirect)) {
        this.window?.location && (this.window.location.href = redirect);
      }

      resolve();
    });
  }

  get tokenInterceptor() {
    let config = this.config;
    let storage = this.storage;
    let auth = this;
    return {
      request(request) {
        if (auth.isAuthenticated() && config.httpInterceptor && config.authHeader) {
          let tokenName = config.tokenPrefix
            ? `${config.tokenPrefix}_${config.tokenName}`
            : config.tokenName;
          let token = storage.get(tokenName);

          if (config.authHeader && config.authToken) {
            token = `${config.authToken} ${token}`;
          }

          if (token) {
            request.headers.set(config.authHeader, token);
          }
        }
        return request;
      },
    };
  }
}
