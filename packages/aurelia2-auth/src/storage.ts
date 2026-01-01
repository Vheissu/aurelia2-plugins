import { DI, inject, optional } from '@aurelia/kernel';
import { IAuthConfigOptions, IAuthOptions } from './configuration';
import { IWindow } from '@aurelia/runtime-html';

export const IStorage = DI.createInterface<IStorage>(
  "IStorage",
  (x) => x.singleton(Storage)
);
export type IStorage = Storage;

class MemoryStorage {
  private readonly store = new Map<string, string>();

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key) ?? null : null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }

  removeItem(key: string) {
    this.store.delete(key);
  }
}

@inject(IAuthOptions, optional(IWindow))
export class Storage {
  private storage;

  constructor(readonly config: IAuthConfigOptions, readonly window?: IWindow) {
    this.storage = this._getStorage(this.config.storage);
  }

  get(key) {
    return this.storage.getItem(key);
  }

  set(key, value) {
    return this.storage.setItem(key, value);
  }

  remove(key) {
    return this.storage.removeItem(key);
  }

  _getStorage(type) {
    if (type && typeof type === 'object') {
      return type;
    }

    if (type === 'memory') {
      return new MemoryStorage();
    }

    if (!this.window) {
      return new MemoryStorage();
    }

    if (type === 'localStorage') {
      try {
        if ('localStorage' in this.window && this.window.localStorage !== null) {
          return this.window.localStorage;
        }
      } catch (error) {
        throw new Error('Local Storage is disabled or unavailable.');
      }
      throw new Error('Local Storage is disabled or unavailable.');
    } else if (type === 'sessionStorage') {
      try {
        if (
          'sessionStorage' in this.window &&
          this.window.sessionStorage !== null
        ) {
          return this.window.sessionStorage;
        }
      } catch (error) {
        throw new Error('Session Storage is disabled or unavailable.');
      }
      throw new Error('Session Storage is disabled or unavailable.');
    }

    throw new Error('Invalid storage type specified: ' + type);
  }
}
