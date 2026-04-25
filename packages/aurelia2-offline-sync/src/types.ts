export type OfflineOperationStatus = 'queued' | 'syncing' | 'synced' | 'failed';

export interface OfflineOperation<TPayload = unknown> {
  id: string;
  type: string;
  payload: TPayload;
  status: OfflineOperationStatus;
  attempts: number;
  createdAt: number;
  updatedAt: number;
  dedupeKey?: string;
  error?: string;
}

export interface OfflineEnqueueOptions {
  id?: string;
  dedupeKey?: string;
}

export interface OfflineSyncStore {
  load(): Promise<OfflineOperation[]>;
  save(operations: OfflineOperation[]): Promise<void>;
  clear(): Promise<void>;
}

export interface OfflineSyncHandler<TPayload = unknown> {
  handle(operation: OfflineOperation<TPayload>): Promise<void> | void;
}

export interface NetworkStatusProvider {
  isOnline(): boolean;
  subscribe(listener: (online: boolean) => void): OfflineSyncDispose;
}

export interface OfflineSyncDispose {
  dispose(): void;
}

export interface OfflineSyncEvent {
  type: 'queued' | 'sync-started' | 'synced' | 'failed' | 'drained';
  operation?: OfflineOperation;
  error?: unknown;
}

export type OfflineSyncListener = (event: OfflineSyncEvent) => void;

export interface OfflineSyncConfigurationOptions {
  store?: OfflineSyncStore;
  network?: NetworkStatusProvider;
  storageKey?: string;
  maxAttempts?: number;
  removeSynced?: boolean;
  autoSync?: boolean;
}
