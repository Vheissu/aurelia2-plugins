import { DI } from 'aurelia';
import { BrowserNetworkStatusProvider } from './network';
import { BrowserStorageOfflineSyncStore } from './stores';
import type {
  OfflineEnqueueOptions,
  OfflineOperation,
  OfflineOperationStatus,
  OfflineSyncConfigurationOptions,
  OfflineSyncDispose,
  OfflineSyncEvent,
  OfflineSyncHandler,
  OfflineSyncListener,
} from './types';

export class OfflineSyncService {
  public options: Required<OfflineSyncConfigurationOptions> = createDefaultOptions();

  private operations: OfflineOperation[] = [];
  private handlers = new Map<string, OfflineSyncHandler>();
  private listeners = new Set<OfflineSyncListener>();
  private networkSubscription: OfflineSyncDispose | null = null;
  private hydration?: Promise<OfflineOperation[]>;
  private writes = Promise.resolve();
  private syncing: Promise<OfflineOperation[]> | null = null;
  private syncRequested = false;

  public configure(options: OfflineSyncConfigurationOptions = {}): void {
    this.networkSubscription?.dispose();
    this.options = {
      ...createDefaultOptions(options.storageKey),
      ...options,
    };

    void this.hydrate().catch(() => {
      // Queue operations surface load failures to callers.
    });
    this.networkSubscription = this.options.network.subscribe((online) => {
      if (online) this.requestAutoSync();
    });
  }

  public registerHandler<TPayload = unknown>(type: string, handler: OfflineSyncHandler<TPayload>): OfflineSyncDispose {
    this.handlers.set(type, handler as OfflineSyncHandler);
    return {
      dispose: () => {
        if (this.handlers.get(type) === handler) {
          this.handlers.delete(type);
        }
      },
    };
  }

  public hydrate(): Promise<OfflineOperation[]> {
    const store = this.options.store;
    const hydration = this.writes.then(() => store.load()).then((operations) => {
      if (this.hydration === hydration) {
        this.operations = operations.map((operation) => ({
          ...operation,
          status: operation.status === 'syncing' ? 'queued' : operation.status,
        }));
      }
      return this.getOperations();
    });
    this.hydration = hydration;
    return hydration;
  }

  public async enqueue<TPayload = unknown>(
    type: string,
    payload: TPayload,
    options: OfflineEnqueueOptions = {}
  ): Promise<OfflineOperation<TPayload>> {
    await this.waitForHydration();
    const now = Date.now();
    const existing = options.dedupeKey
      ? this.operations.find((operation) =>
        operation.type === type &&
        operation.dedupeKey === options.dedupeKey &&
        (operation.status === 'queued' || operation.status === 'failed')
      )
      : undefined;

    if (existing) {
      existing.payload = payload;
      existing.status = 'queued';
      existing.attempts = 0;
      existing.updatedAt = now;
      existing.error = undefined;
      await this.persist();
      this.emit({ type: 'queued', operation: existing });
      this.requestAutoSync();
      return existing as OfflineOperation<TPayload>;
    }

    const operation: OfflineOperation<TPayload> = {
      id: options.id ?? createId(),
      type,
      payload,
      status: 'queued',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      dedupeKey: options.dedupeKey,
    };

    this.operations.push(operation as OfflineOperation);
    await this.persist();
    this.emit({ type: 'queued', operation: operation as OfflineOperation });

    this.requestAutoSync();

    return operation;
  }

  public sync(): Promise<OfflineOperation[]> {
    if (this.syncing) return this.syncing;
    if (!this.options.network.isOnline()) return Promise.resolve(this.getOperations());

    this.syncing = this.syncOperations().finally(() => {
      this.syncing = null;
      if (this.syncRequested) {
        this.syncRequested = false;
        this.requestAutoSync();
      }
    });
    return this.syncing;
  }

  private async syncOperations(): Promise<OfflineOperation[]> {
    await this.waitForHydration();
    const options = this.options;
    for (const operation of this.operations.filter((entry) => shouldSync(entry, options.maxAttempts))) {
      if (options !== this.options || !options.network.isOnline()) break;
      const handler = this.handlers.get(operation.type);
      if (!handler || !this.operations.includes(operation)) continue;

      const previousStatus = operation.status;
      operation.status = 'syncing';
      operation.updatedAt = Date.now();
      try {
        this.emit({ type: 'sync-started', operation });
        await this.persist();
      } catch (error) {
        operation.status = previousStatus;
        throw error;
      }
      if (options !== this.options || !this.operations.includes(operation)) continue;
      if (!options.network.isOnline()) {
        operation.status = previousStatus;
        await this.persist();
        break;
      }

      let failure: { error: unknown } | undefined;
      try {
        await handler.handle(operation);
      } catch (error) {
        failure = { error };
      }
      if (options !== this.options || !this.operations.includes(operation)) continue;

      operation.updatedAt = Date.now();
      if (failure) {
        operation.status = 'failed';
        operation.attempts += 1;
        operation.error = stringifyError(failure.error);
        this.emit({ type: 'failed', operation, error: failure.error });
      } else {
        operation.status = 'synced';
        operation.error = undefined;
        this.emit({ type: 'synced', operation });
      }
      await this.persist();
    }

    if (options !== this.options) return this.getOperations();

    if (options.removeSynced && this.operations.some((operation) => operation.status === 'synced')) {
      this.operations = this.operations.filter((operation) => operation.status !== 'synced');
      await this.persist();
    }
    if (this.operations.every((operation) => operation.status === 'synced')) {
      this.emit({ type: 'drained' });
    }
    return this.getOperations();
  }

  public getOperations(status?: OfflineOperationStatus): OfflineOperation[] {
    const operations = status
      ? this.operations.filter((operation) => operation.status === status)
      : this.operations;
    return operations.map((operation) => ({ ...operation }));
  }

  public async remove(id: string): Promise<void> {
    await this.waitForHydration();
    this.operations = this.operations.filter((operation) => operation.id !== id);
    await this.persist();
  }

  public async clear(): Promise<void> {
    await this.waitForHydration();
    this.operations = [];
    const store = this.options.store;
    await this.write(() => store.clear());
  }

  public onEvent(listener: OfflineSyncListener): OfflineSyncDispose {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  private async waitForHydration(): Promise<void> {
    do {
      const hydration = this.hydration ?? this.hydrate();
      try {
        await hydration;
      } catch (error) {
        if (this.hydration === hydration) throw error;
      }
      if (this.hydration === hydration) return;
    } while (true);
  }

  private async persist(): Promise<void> {
    const store = this.options.store;
    const operations = this.getOperations();
    await this.write(() => store.save(operations));
  }

  private write(callback: () => Promise<void>): Promise<void> {
    const writing = this.writes.then(callback);
    this.writes = writing.catch(() => {});
    return writing;
  }

  private requestAutoSync(): void {
    if (!this.options.autoSync || !this.options.network.isOnline()) return;
    if (this.syncing) {
      this.syncRequested = true;
      return;
    }
    void this.sync().catch((error: unknown) => {
      this.emit({ type: 'failed', error });
    });
  }

  private emit(event: OfflineSyncEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export const IOfflineSync = DI.createInterface<IOfflineSync>('IOfflineSync', (x) => x.singleton(OfflineSyncService));
export interface IOfflineSync extends OfflineSyncService {}

function createDefaultOptions(storageKey = 'aurelia2-offline-sync'): Required<OfflineSyncConfigurationOptions> {
  return {
    store: new BrowserStorageOfflineSyncStore(storageKey),
    network: new BrowserNetworkStatusProvider(),
    storageKey,
    maxAttempts: 3,
    removeSynced: true,
    autoSync: true,
  };
}

function shouldSync(operation: OfflineOperation, maxAttempts: number): boolean {
  return (operation.status === 'queued' || operation.status === 'failed') && operation.attempts < maxAttempts;
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createId(): string {
  return `offline_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
