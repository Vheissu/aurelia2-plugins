import { IAuthConfigOptions, IAuthOptions } from './configuration';
import { parseQueryString, extend, forEach } from './auth-utilities';

export class Popup {
  protected popupWindow = null;
  protected polling;
  protected url;

  constructor(@IAuthOptions readonly config: IAuthConfigOptions) {
    this.popupWindow = null;
    this.polling = null;
    this.url = '';
  }

  open(url, windowName, options, redirectUri) {
    this.url = url;
    let optionsString = this.stringifyOptions(
      this.prepareOptions(options || {})
    );
    this.popupWindow = window.open(url, windowName, optionsString);
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

        let parser = document.createElement('a');
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
          let documentOrigin = document.location.host;
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

    return extend(
      {
        width: width,
        height: height,
        left: window.screenX + (window.outerWidth - width) / 2,
        top: window.screenY + (window.outerHeight - height) / 2.5,
      },
      options
    );
  }

  stringifyOptions(options) {
    let parts = [];
    // @ts-expect-error
    forEach(options, function (value: string, key: string) {
      parts.push(key + '=' + value);
    });
    return parts.join(',');
  }
}
