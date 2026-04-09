import { DI } from 'aurelia';

export const IAureliaCookie = DI.createInterface<IAureliaCookie>('IAureliaCookie', x => x.singleton(AureliaCookie));
export interface IAureliaCookie extends AureliaCookie {}

export interface OptionsInterface {
  expires?: Date;
  expiry?: number;
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export class AureliaCookie {
  /**
  *
  * Get a cookie by its name
  */
  public static get(name: string): string | null {
      let cookies: Record<string, string> = this.all();

      if (cookies && cookies[name]) {
          return cookies[name];
      }

      return null;
  }

  /**
  * Set a cookie
  */
  static set(name: string, value: string, options: OptionsInterface = {}) {
      let str = `${this.encode(name)}=${this.encode(value)}`;

      if (value === null) {
          options.expiry = -1;
      }

      /**
      * Expiry date in hours
      */
      if (options?.expiry && options.expiry >= 0 && !options.expires) {
          let expires = new Date();

          expires.setHours(expires.getHours() + options.expiry);
          options.expires = expires;
      }

      if (options?.path) {
          str += `; path=${options.path}`;
      }

      if (options?.domain) {
          str += `; domain=${options.domain}`;
      }

      if (options?.expires) {
          str += `; expires=${options.expires.toUTCString()}`;
      }

      if (options?.secure) {
          str += '; secure';
      }

      if (options?.sameSite) {
          str += `; SameSite=${options.sameSite}`;
      }

      document.cookie = str;
  }

  /**
  * Deletes a cookie by setting its expiry date in the past
  */
  static delete(name: string, domain?: string, path?: string) {
      let cookieString = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;`;

      if (domain) {
          cookieString += `; domain=${domain}`;
      }

      if (path) {
          cookieString += `; path=${path}`;
      }

      document.cookie = cookieString;
  }

  /**
  * Get all set cookies and return an array
  */
  static all(): Record<string, string> {
      return this.parse(document.cookie);
  }

  static parse(str: string): Record<string, string> {
      let obj: Record<string, string> = {};
      let pairs: string[] = str.split(/ *; */);
      let pair: string[];

      if (pairs[0] === '') {
          return obj;
      }

      for (let i = 0; i < pairs.length; ++i) {
          pair = pairs[i].split('=');
          const key = this.decode(pair[0]);
          const value = pair[1] !== undefined ? this.decode(pair[1]) : null;
          if (key !== null) {
              obj[key] = value ?? '';
          }
      }

      return obj;
  }

  static encode(value: string) {
      try {
          return encodeURIComponent(value);
      } catch (e) {
          return null;
      }
  }

  static decode(value: string): string | null {
      try {
          return decodeURIComponent(value);
      } catch (e) {
          return null;
      }
  }
}