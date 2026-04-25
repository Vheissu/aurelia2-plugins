import { DI } from 'aurelia';
import { BrowserNetworkStatusProvider } from './network';
import { BrowserStorageOfflineSyncStore } from './stores';
import type {
  NetworkStatusProvider,
  OfflineEnqueueOptions,
  OfflineOperation,
  OfflineOperationStatus,
  OfflineSyncConfigurationOptions,
  OfflineSyncDispose,
  OfflineSyncEvent,
  OfflineSyncHandler,
  OfflineSyncListener,
  OfflineSyncStore,
} from './types';

export class OfflineSyncService {
  public options: Required<OfflineSyncConfigurationOptions> = createDefaultOptions();

  private operations: OfflineOperation[] = [];
  private handlers = new Map<string, OfflineSyncHandler>();
  private listeners = new Set<OfflineSyncListener>();
  private networkSubscription: OfflineSyncDispose | null = null;
  private syncing = false;

  public configure(options: OfflineSyncConfigurationOptions = {}): void {
    this.networkSubscription?.dispose();
    this.options = {
      ...createDefaultOptions(options.storageKey),
      ...options,
    };

    this.networkSubscription = this.options.network.subscribe((online) => {
      if (online && this.options.autoSync) {
        void this.sync();
      }
    });

    void this.hydrate();
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

  public async hydrate(): Promise<OfflineOperation[]> {
    this.operations = await this.options.store.load();
    return this.getOperations();
  }

  public async enqueue<TPayload = unknown>(
    type: string,
    payload: TPayload,
    options: OfflineEnqueueOptions = {}
  ): Promise<OfflineOperation<TPayload>> {
    const now = Date.now();
    const existing = options.dedupeKey
      ? this.operations.find((operation) => operation.dedupeKey === options.dedupeKey && operation.status !== 'synced')
      : undefined;

    if (existing) {
      existing.payload = payload;
      existing.status = 'queued';
      existing.updatedAt = now;
      existing.error = undefined;
      await this.persist();
      this.emit({ type: 'queued', operation: existing });
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

    if (this.options.autoSync && this.options.network.isOnline()) {
      void this.sync();
    }

    return operation;
  }

  public async sync(): Promise<OfflineOperation[]> {
    if (this.syncing || !this.options.network.isOnline()) {
      return this.getOperations();
    }

    this.syncing = true;
    try {
      for (const operation of this.operations.filter((entry) => shouldSync(entry, this.options.maxAttempts))) {
        const handler = this.handlers.get(operation.type);
        if (!handler) continue;

        operation.status = 'syncing';
        operation.updatedAt = Date.now();
        this.emit({ type: 'sync-started', operation });
        await this.persist();

        try {
          await handler.handle(operation);
          operation.status = 'synced';
          operation.error = undefined;
          operation.updatedAt = Date.now();
          this.emit({ type: 'synced', operation });
        } catch (error) {
          operation.status = 'failed';
          operation.attempts += 1;
          operation.error = stringifyError(error);
          operation.updatedAt = Date.now();
          this.emit({ type: 'failed', operation, error });
        }

        await this.persist();
      }

      if (this.options.removeSynced) {
        this.operations = this.operations.filter((operation) => operation.status !== 'synced');
        await this.persist();
      }

      if (this.operations.every((operation) => operation.status === 'synced')) {
        this.emit({ type: 'drained' });
      }

      return this.getOperations();
    } finally {
      this.syncing = false;
    }
  }

  public getOperations(status?: OfflineOperationStatus): OfflineOperation[] {
    const operations = status
      ? this.operations.filter((operation) => operation.status === status)
      : this.operations;
    return operations.map((operation) => ({ ...operation }));
  }

  public async remove(id: string): Promise<void> {
    this.operations = this.operations.filter((operation) => operation.id !== id);
    await this.persist();
  }

  public async clear(): Promise<void> {
    this.operations = [];
    await this.options.store.clear();
  }

  public onEvent(listener: OfflineSyncListener): OfflineSyncDispose {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  private async persist(): Promise<void> {
    await this.options.store.save(this.operations);
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
