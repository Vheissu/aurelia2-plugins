import { DI } from '@aurelia/kernel';
import { extend, forEach, joinUrl, status } from './auth-utilities';
import { IStorage } from './storage';
import { IPopup } from './popup';
import { IAuthConfigOptions, IAuthOptions } from './configuration';
import { IHttpClient, json } from '@aurelia/fetch-client';

export const IOAuth1 = DI.createInterface<IOAuth1>("IOAuth1", x => x.singleton(OAuth1));
export type IOAuth1 = OAuth1;

export class OAuth1 {
  protected defaults;
  protected popupInstance;

  constructor(
    @IStorage readonly storage: IStorage,
    @IPopup readonly popup: IPopup,
    @IHttpClient readonly http: IHttpClient,
    @IAuthOptions readonly config: IAuthConfigOptions
  ) {
    this.defaults = {
      url: null,
      name: null,
      popupOptions: null,
      redirectUri: null,
      authorizationEndpoint: null,
    };
  }

  open(options, userData) {
    // @ts-expect-error
    let current = extend({}, this.defaults, options);
    let serverUrl = this.config.baseUrl
      ? joinUrl(this.config.baseUrl, current.url)
      : current.url;

    if (this.config.platform !== 'mobile') {
      this.popupInstance = this.popup.open(
        '',
        current.name,
        current.popupOptions,
        current.redirectUri
      );
    }
    return this.http
      .fetch(serverUrl, {
        method: 'post',
      })
      .then(status)
      .then((response) => {
        if (this.config.platform === 'mobile') {
          this.popupInstance = this.popup.open(
            [
              current.authorizationEndpoint,
              this.buildQueryString(response),
            ].join('?'),
            current.name,
            current.popupOptions,
            current.redirectUri
          );
        } else {
          this.popupInstance.popupWindow.location = [
            current.authorizationEndpoint,
            this.buildQueryString(response),
          ].join('?');
        }

        let popupListener =
          this.config.platform === 'mobile'
            ? this.popup.eventListener(current.redirectUri)
            : this.popup.pollPopup();
        return popupListener.then((result) =>
          this.exchangeForToken(result, userData, current)
        );
      });
  }

  exchangeForToken(oauthData, userData, current) {
    // @ts-expect-error
    let data = extend({}, userData, oauthData);
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

  buildQueryString(obj) {
    let str = [];
    // @ts-expect-error
    forEach(
      obj,
      (value: string | number | boolean, key: string | number | boolean) =>
        str.push(encodeURIComponent(key) + '=' + encodeURIComponent(value))
    );
    return str.join('&');
  }
}
