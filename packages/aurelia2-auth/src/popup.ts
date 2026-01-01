import { DI, inject, optional } from '@aurelia/kernel';
import { IAuthConfigOptions, IAuthOptions } from './configuration';
import { parseQueryString, extend, forEach } from './auth-utilities';
import { IWindow } from '@aurelia/runtime-html';

export const IPopup = DI.createInterface<IPopup>(
  "IPopup",
  (x) => x.singleton(Popup)
);
export type IPopup = Popup;

@inject(IAuthOptions, optional(IWindow))
export class Popup {
  protected popupWindow = null;
  protected polling;
  protected url;

  constructor(readonly config: IAuthConfigOptions, private window?: IWindow) {
    this.popupWindow = null;
    this.polling = null;
    this.url = '';
  }

  open(url, windowName, options, redirectUri) {
    this.url = url;
    let optionsString = this.stringifyOptions(
      this.prepareOptions(options || {})
    );
    if (!this.window) {
      throw new Error('Popup requires a browser window instance.');
    }
    this.popupWindow = this.window.open(url, windowName, optionsString);
    if (this.popupWindow && this.popupWindow.focus) {
      this.popupWindow.focus();
    }

    return this;
  }

  eventListener(redirectUri) {
    let promise = new Promise((resolve, reject) => {
      this.popupWindow.addEventListener('loadstart', (event) => {
        if (event.url.indexOf(redirectUri) !== 0) {
          return;
        }

        if (!this.window) {
          reject({
            data: 'No window available',
          });
          return;
        }

        let parser = this.window.document.createElement('a');
        parser.href = event.url;

        if (parser.search || parser.hash) {
          let queryParams = parser.search.substring(1).replace(/\/$/, '');
          let hashParams = parser.hash.substring(1).replace(/\/$/, '');
          let hash = parseQueryString(hashParams);
          let qs = parseQueryString(queryParams);
          
          extend(qs, hash);

          // @ts-expect-error
          if (qs.error) {
            reject({
              // @ts-expect-error
              error: qs.error,
            });
          } else {
            resolve(qs);
          }

          this.popupWindow.close();
        }
      });

      this.popupWindow.addEventListener('exit', () => {
        reject({
          data: 'Provider Popup was closed',
        });
      });

      this.popupWindow.addEventListener('loaderror', () => {
        throw new Error('Authorization Failed');
      });
    });
    return promise;
  }

  pollPopup() {
    let promise = new Promise((resolve, reject) => {
      this.polling = setInterval(() => {
        try {
          if (!this.window) {
            clearInterval(this.polling);
            reject({
              data: 'No window available',
            });
            return;
          }

          let documentOrigin = this.window.location.host;
          let popupWindowOrigin = this.popupWindow.location.host;

          if (
            popupWindowOrigin === documentOrigin &&
            (this.popupWindow.location.search || this.popupWindow.location.hash)
          ) {
            let queryParams = this.popupWindow.location.search
              .substring(1)
              .replace(/\/$/, '');
            let hashParams = this.popupWindow.location.hash
              .substring(1)
              .replace(/[\/$]/, '');
            let hash = parseQueryString(hashParams);
            let qs: { error?: string; } = parseQueryString(queryParams);

            extend(qs, hash);

            if (qs.error) {
              reject({
                error: qs.error,
              });
            } else {
              resolve(qs);
            }

            this.popupWindow.close();
            clearInterval(this.polling);
          }
        } catch (error) {
          // no-op
        }

        if (!this.popupWindow) {
          clearInterval(this.polling);
          reject({
            data: 'Provider Popup Blocked',
          });
        } else if (this.popupWindow.closed) {
          clearInterval(this.polling);
          reject({
            data: 'Problem poll popup',
          });
        }
      }, 35);
    });
    return promise;
  }

  prepareOptions(options: any) {
    let width = options.width || 500;
    let height = options.height || 500;
    if (!this.window) {
      return extend({ width, height }, options);
    }

    return extend(
      {
        width: width,
        height: height,
        left: this.window.screenX + (this.window.outerWidth - width) / 2,
        top: this.window.screenY + (this.window.outerHeight - height) / 2.5,
      },
      options
    );
  }

  stringifyOptions(options) {
    let parts = [];
    forEach(options, function (value: string, key: string) {
      parts.push(key + '=' + value);
    });
    return parts.join(',');
  }
}
