import { DI } from '@aurelia/kernel';
import { IAuthConfigOptions, IAuthOptions } from './configuration';

export const IStorage = DI.createInterface<IStorage>("IStorage", x => x.singleton(Storage));
export type IStorage = Storage;

export class Storage {
  private storage;

  constructor(@IAuthOptions readonly config: IAuthConfigOptions) {
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
    if (type === 'localStorage') {
      if ('localStorage' in window && window.localStorage !== null)
        return localStorage;
      throw new Error('Local Storage is disabled or unavailable.');
    } else if (type === 'sessionStorage') {
      if ('sessionStorage' in window && window.sessionStorage !== null)
        return sessionStorage;
      throw new Error('Session Storage is disabled or unavailable.');
    }

    throw new Error('Invalid storage type specified: ' + type);
  }
}
