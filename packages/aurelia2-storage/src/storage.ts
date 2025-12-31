import { DI, inject } from '@aurelia/kernel';
import type { StorageBackend, StorageConfigOptions, StorageDriver, StorageOptions, StoredValue } from './types';
import { StorageConfig, IStorageConfig } from './storage-config';
import { MemoryStorageDriver } from './drivers/memory';
import { WebStorageDriver } from './drivers/web-storage';
import { IndexedDbStorageDriver } from './drivers/indexeddb';

@inject(IStorageConfig)
export class AureliaStorage {
  private readonly drivers = new Map<StorageBackend, StorageDriver>();

  public constructor(private readonly config: StorageConfig) {
    this.registerDriver('memory', new MemoryStorageDriver());

    if (typeof window !== 'undefined' && window.localStorage) {
      this.registerDriver('local', new WebStorageDriver(window.localStorage));
    }

    if (typeof window !== 'undefined' && window.sessionStorage) {
      this.registerDriver('session', new WebStorageDriver(window.sessionStorage));
    }

    if (typeof indexedDB !== 'undefined') {
      this.registerDriver(
        'indexeddb',
        new IndexedDbStorageDriver(this.config.options.indexedDb)
      );
    }
  }

  public configure(options: StorageConfigOptions): void {
    this.config.configure(options);
  }

  public registerDriver(type: StorageBackend, driver: StorageDriver): void {
    this.drivers.set(type, driver);
  }

  public async get<T>(key: string, options: StorageOptions = {}): Promise<T | null> {
    const driver = this.getDriver(options.storage);
    const raw = await driver.getItem(this.withPrefix(key));
    if (!raw) return null;

    const stored = this.deserialize<T>(raw);
    if (stored?.expiresAt && stored.expiresAt <= Date.now()) {
      await driver.removeItem(this.withPrefix(key));
      return null;
    }

    return stored?.value ?? null;
  }

  public async set<T>(key: string, value: T, options: StorageOptions = {}): Promise<void> {
    const driver = this.getDriver(options.storage);
    const expiresAt = options.ttl ? Date.now() + options.ttl : undefined;
    const payload: StoredValue<T> = { value, expiresAt };
    await driver.setItem(this.withPrefix(key), JSON.stringify(payload));
  }

  public async remove(key: string, options: StorageOptions = {}): Promise<void> {
    const driver = this.getDriver(options.storage);
    await driver.removeItem(this.withPrefix(key));
  }

  public async clear(options: StorageOptions = {}): Promise<void> {
    const driver = this.getDriver(options.storage);
    await driver.clear();
  }

  public async keys(options: StorageOptions = {}): Promise<string[]> {
    const driver = this.getDriver(options.storage);
    const keys = await driver.keys();
    const prefix = this.config.options.prefix;
    if (!prefix) return keys;
    return keys
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length));
  }

  private getDriver(backend?: StorageBackend): StorageDriver {
    const type = backend ?? this.config.options.defaultBackend;
    const driver = this.drivers.get(type);
    if (!driver) {
      throw new Error(`Storage backend not available: ${type}`);
    }
    return driver;
  }

  private withPrefix(key: string): string {
    return `${this.config.options.prefix ?? ''}${key}`;
  }

  private deserialize<T>(raw: string): StoredValue<T> | null {
    try {
      const parsed = JSON.parse(raw) as StoredValue<T>;
      if (!parsed || typeof parsed !== 'object' || !('value' in parsed)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}

export const IStorage = DI.createInterface<IStorage>('IStorage', x => x.singleton(AureliaStorage));
export interface IStorage extends AureliaStorage {}

export function createStorage(config: StorageConfig): AureliaStorage {
  const storage = new AureliaStorage(config);
  storage.configure(config.options);
  return storage;
}

export { IStorageConfig } from './storage-config';
