import type { StorageDriver } from '../types';

export class WebStorageDriver implements StorageDriver {
  public constructor(private readonly storage: Storage) {}

  public async getItem(key: string): Promise<string | null> {
    return this.storage.getItem(key);
  }

  public async setItem(key: string, value: string): Promise<void> {
    this.storage.setItem(key, value);
  }

  public async removeItem(key: string): Promise<void> {
    this.storage.removeItem(key);
  }

  public async clear(): Promise<void> {
    this.storage.clear();
  }

  public async keys(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key != null) {
        keys.push(key);
      }
    }
    return keys;
  }
}
