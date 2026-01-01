export type StorageBackend = 'memory' | 'local' | 'session' | 'indexeddb';

export interface StorageOptions {
  storage?: StorageBackend;
  ttl?: number;
}

export interface IndexedDbOptions {
  dbName: string;
  storeName: string;
  version: number;
}

export interface StorageDriver {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

export interface StorageConfigOptions {
  defaultBackend?: StorageBackend;
  prefix?: string;
  indexedDb?: Partial<IndexedDbOptions>;
}

export interface ResolvedStorageConfigOptions {
  defaultBackend: StorageBackend;
  prefix: string;
  indexedDb: IndexedDbOptions;
}

export interface StoredValue<T = unknown> {
  value: T;
  expiresAt?: number;
}
