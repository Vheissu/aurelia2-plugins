import type { StorageDriver } from '../types';

export interface IndexedDbOptions {
  dbName: string;
  storeName: string;
  version: number;
}

export class IndexedDbStorageDriver implements StorageDriver {
  private readonly dbPromise: Promise<IDBDatabase>;

  public constructor(private readonly options: IndexedDbOptions) {
    this.dbPromise = this.open();
  }

  public async getItem(key: string): Promise<string | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.options.storeName, 'readonly');
      const req = tx.objectStore(this.options.storeName).get(key);
      req.onsuccess = () => resolve((req.result as string) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  public async setItem(key: string, value: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.options.storeName, 'readwrite');
      const req = tx.objectStore(this.options.storeName).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async removeItem(key: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.options.storeName, 'readwrite');
      const req = tx.objectStore(this.options.storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async clear(): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.options.storeName, 'readwrite');
      const req = tx.objectStore(this.options.storeName).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async keys(): Promise<string[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.options.storeName, 'readonly');
      const store = tx.objectStore(this.options.storeName);
      if ('getAllKeys' in store) {
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(req.result.map(String));
        req.onerror = () => reject(req.error);
        return;
      }

      const keys: string[] = [];
      const cursor = store.openKeyCursor();
      cursor.onsuccess = () => {
        const result = cursor.result;
        if (result) {
          keys.push(String(result.key));
          result.continue();
        } else {
          resolve(keys);
        }
      };
      cursor.onerror = () => reject(cursor.error);
    });
  }

  private async open(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is not available in this environment.');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.options.dbName, this.options.version);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.options.storeName)) {
          db.createObjectStore(this.options.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
