import { DI, optional, resolve } from '@aurelia/kernel';
import { IWindow } from '@aurelia/runtime-html';
import type { IOAuthPopupOptions } from './configuration';
import { IAuthOptions } from './configuration';
import { AuthError } from './auth-error';

export interface IPopup {
  readonly popupWindow: Window | null;
  open(url: string, windowName: string, options?: IOAuthPopupOptions, redirectUri?: string): IPopup;
  pollPopup(timeoutMs?: number): Promise<string>;
  close(): void;
}

export const IPopup = DI.createInterface<IPopup>('IPopup', x => x.singleton(Popup));

export class Popup implements IPopup {
  private readonly config = resolve(IAuthOptions);
  private readonly window = resolve(optional(IWindow));
  private redirectUri = '';
  public popupWindow: Window | null = null;

  public open(
    url: string,
    windowName: string,
    options: IOAuthPopupOptions = {},
    redirectUri = '',
  ): this {
    if (!this.window) throw new Error('OAuth popups require a browser window.');
    this.redirectUri = redirectUri;
    const features = this.stringifyOptions(this.prepareOptions(options));
    this.popupWindow = this.window.open(url, windowName, features);
    if (!this.popupWindow) {
      throw new AuthError('oauth-popup-blocked', `The ${windowName} sign-in popup was blocked.`);
    }
    this.popupWindow.focus();
    return this;
  }

  public pollPopup(timeoutMs = this.config.popupTimeout ?? 5 * 60 * 1000): Promise<string> {
    const popup = this.popupWindow;
    if (!popup) {
      return Promise.reject(new AuthError('oauth-popup-blocked', 'The sign-in popup is not open.'));
    }

    const expected = this.redirectUri ? new URL(this.redirectUri, this.window?.location.href) : null;
    const startedAt = Date.now();

    return new Promise<string>((resolvePromise, reject) => {
      const finish = (callback: () => void): void => {
        clearInterval(interval);
        this.close();
        callback();
      };

      const interval = setInterval(() => {
        if (popup.closed) {
          finish(() => reject(new AuthError('oauth-cancelled', 'The sign-in popup was closed.')));
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          finish(() => reject(new AuthError('oauth-popup-timeout', 'The sign-in popup timed out.')));
          return;
        }

        try {
          const current = new URL(popup.location.href);
          if (expected && (current.origin !== expected.origin || current.pathname !== expected.pathname)) {
            return;
          }
          if (!current.search && !current.hash) return;
          finish(() => resolvePromise(current.toString()));
        } catch {
          // Cross-origin access is expected until the provider returns to the callback URI.
        }
      }, 100);
    });
  }

  public close(): void {
    if (this.popupWindow && !this.popupWindow.closed) this.popupWindow.close();
    this.popupWindow = null;
  }

  /** @deprecated Mobile WebView adapters should provide their own OAuth transport. */
  public eventListener(_redirectUri: string): Promise<never> {
    return Promise.reject(new Error('Mobile WebView OAuth requires a custom provider transport.'));
  }

  public prepareOptions(options: IOAuthPopupOptions): IOAuthPopupOptions {
    const width = options.width ?? 520;
    const height = options.height ?? 640;
    if (!this.window) return { width, height, ...options };
    return {
      popup: true,
      width,
      height,
      left: Math.round(this.window.screenX + (this.window.outerWidth - width) / 2),
      top: Math.round(this.window.screenY + (this.window.outerHeight - height) / 2),
      ...options,
    };
  }

  public stringifyOptions(options: IOAuthPopupOptions): string {
    return Object.entries(options)
      .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(',');
  }
}
