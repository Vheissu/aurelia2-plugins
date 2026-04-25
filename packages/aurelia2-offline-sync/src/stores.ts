import type { OfflineOperation, OfflineSyncStore } from './types';

export class MemoryOfflineSyncStore implements OfflineSyncStore {
  private operations: OfflineOperation[] = [];

  public async load(): Promise<OfflineOperation[]> {
    return this.operations.map((operation) => ({ ...operation }));
  }

  public async save(operations: OfflineOperation[]): Promise<void> {
    this.operations = operations.map((operation) => ({ ...operation }));
  }

  public async clear(): Promise<void> {
    this.operations = [];
  }
}

export class BrowserStorageOfflineSyncStore implements OfflineSyncStore {
  public constructor(private readonly key = 'aurelia2-offline-sync') {}

  public async load(): Promise<OfflineOperation[]> {
    const raw = globalThis.localStorage?.getItem(this.key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineOperation[];
    return parsed.map((operation) => ({ ...operation }));
  }

  public async save(operations: OfflineOperation[]): Promise<void> {
    globalThis.localStorage?.setItem(this.key, JSON.stringify(operations));
  }

  public async clear(): Promise<void> {
    globalThis.localStorage?.removeItem(this.key);
  }
}
