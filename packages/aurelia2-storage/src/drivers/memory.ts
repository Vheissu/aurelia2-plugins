import type { StorageDriver } from '../types';

export class MemoryStorageDriver implements StorageDriver {
  private readonly store = new Map<string, string>();

  public async getItem(key: string): Promise<string | null> {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  public async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  public async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  public async clear(): Promise<void> {
    this.store.clear();
  }

  public async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}
