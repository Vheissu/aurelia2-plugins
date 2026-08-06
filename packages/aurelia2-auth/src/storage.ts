import { DI, optional, resolve } from '@aurelia/kernel';
import { IWindow } from '@aurelia/runtime-html';
import type { AuthStorageName, IAuthConfigOptions, IAuthStorageLike } from './configuration';
import { IAuthOptions } from './configuration';

export interface IStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  clear(keys?: readonly string[]): void;
}

export const IStorage = DI.createInterface<IStorage>('IStorage', x => x.singleton(Storage));

export type ITransactionStorage = IStorage;
export const ITransactionStorage = DI.createInterface<ITransactionStorage>('ITransactionStorage');

export class MemoryStorage implements IAuthStorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }

  public clear(): void {
    this.values.clear();
  }
}

abstract class StorageBase implements IStorage {
  protected abstract readonly configuredStorage: AuthStorageName | IAuthStorageLike | undefined;
  protected readonly config: Readonly<IAuthConfigOptions> = resolve(IAuthOptions);
  protected readonly window: IWindow | undefined = resolve(optional(IWindow));
  private backend: IAuthStorageLike | null = null;

  public get(key: string): string | null {
    return this.getBackend().getItem(key);
  }

  public set(key: string, value: string): void {
    this.getBackend().setItem(key, value);
  }

  public remove(key: string): void {
    this.getBackend().removeItem(key);
  }

  public clear(keys: readonly string[] = []): void {
    for (const key of keys) this.remove(key);
  }

  /** Kept public for compatibility and focused adapter tests. */
  public _getStorage(type: AuthStorageName | IAuthStorageLike | undefined): IAuthStorageLike {
    if (type && typeof type === 'object') return type;
    if (type === 'memory' || type === undefined) return new MemoryStorage();

    const browserStorage = this.getBrowserStorage(type);
    if (browserStorage) return browserStorage;

    if (this.config.storageFallback === 'error') {
      throw new Error(`${type} is disabled or unavailable.`);
    }
    return new MemoryStorage();
  }

  private getBackend(): IAuthStorageLike {
    return this.backend ??= this._getStorage(this.configuredStorage);
  }

  private getBrowserStorage(type: Exclude<AuthStorageName, 'memory'>): IAuthStorageLike | null {
    if (!this.window) return null;
    try {
      const storage = type === 'localStorage'
        ? this.window.localStorage
        : this.window.sessionStorage;
      const probe = '__aurelia_auth_storage_probe__';
      storage.setItem(probe, probe);
      storage.removeItem(probe);
      return storage;
    } catch {
      return null;
    }
  }
}

export class Storage extends StorageBase {
  protected get configuredStorage(): AuthStorageName | IAuthStorageLike | undefined {
    return this.config.storage;
  }
}

export class TransactionStorage extends StorageBase implements ITransactionStorage {
  protected get configuredStorage(): AuthStorageName | IAuthStorageLike | undefined {
    return this.config.transactionStorage ?? this.config.storage;
  }
}
