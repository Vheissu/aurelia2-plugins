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
  public static get(name: string): string | null {
    const cookies = this.all();
    return Object.hasOwn(cookies, name) ? cookies[name] : null;
  }

  public static set(name: string, value: string | null, options: OptionsInterface = {}): void {
    let cookie = `${this.encode(name)}=${this.encode(value ?? '')}`;
    let expires = options.expires;
    if (value === null) {
      expires = new Date(0);
    } else if (!expires && Number.isFinite(options.expiry)) {
      expires = new Date(Date.now() + options.expiry * 60 * 60 * 1000);
    }

    if (options.path) cookie += `; path=${options.path}`;
    if (options.domain) cookie += `; domain=${options.domain}`;
    if (expires) cookie += `; expires=${expires.toUTCString()}`;
    if (options.secure) cookie += '; secure';
    if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
    document.cookie = cookie;
  }

  public static delete(name: string, domain?: string, path?: string): void {
    this.set(name, null, { domain, path });
  }

  public static all(): Record<string, string> {
    return this.parse(document.cookie);
  }

  public static parse(value: string): Record<string, string> {
    const entries: [string, string][] = [];
    for (const pair of value.split(';')) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      const separator = trimmed.indexOf('=');
      const key = this.decode(separator === -1 ? trimmed : trimmed.slice(0, separator));
      if (key === null) continue;
      const value = separator === -1 ? '' : this.decode(trimmed.slice(separator + 1));
      entries.push([key, value ?? '']);
    }
    return Object.fromEntries(entries);
  }

  public static encode(value: string): string | null {
    try {
      return encodeURIComponent(value);
    } catch {
      return null;
    }
  }

  public static decode(value: string): string | null {
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
}
