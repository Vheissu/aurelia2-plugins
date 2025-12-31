import { DI } from '@aurelia/kernel';
import type { NormalizedQueryOptions, QueryKey, QueryStatus } from './types';

export interface QueryCacheEntry<T = unknown> {
  key: string;
  options: NormalizedQueryOptions<T>;
  data: T | null;
  error: unknown;
  status: QueryStatus;
  updatedAt: number;
  observers: Set<QueryObserver<T>>;
  fetchPromise?: Promise<T>;
  gcTimeout?: ReturnType<typeof setTimeout>;
}

export interface QueryObserver<T = unknown> {
  onEntryUpdate(entry: QueryCacheEntry<T>, stale: boolean): void;
}

const DEFAULT_STALE_TIME = 0;
const DEFAULT_CACHE_TIME = 5 * 60 * 1000;

export class QueryClient {
  private readonly entries = new Map<string, QueryCacheEntry<unknown>>();

  public getEntry<T>(key: string): QueryCacheEntry<T> | undefined {
    return this.entries.get(key) as QueryCacheEntry<T> | undefined;
  }

  public getOrCreateEntry<T>(key: string, options: NormalizedQueryOptions<T>): QueryCacheEntry<T> {
    const existing = this.getEntry<T>(key);
    if (existing) {
      existing.options = options;
      return existing;
    }

    const entry: QueryCacheEntry<T> = {
      key,
      options,
      data: null,
      error: null,
      status: 'idle',
      updatedAt: 0,
      observers: new Set(),
    };

    this.entries.set(key, entry as QueryCacheEntry<unknown>);
    return entry;
  }

  public subscribe<T>(entry: QueryCacheEntry<T>, observer: QueryObserver<T>): void {
    entry.observers.add(observer);
    if (entry.gcTimeout) {
      clearTimeout(entry.gcTimeout);
      entry.gcTimeout = undefined;
    }
    observer.onEntryUpdate(entry, this.isStale(entry, entry.options));
  }

  public unsubscribe<T>(entry: QueryCacheEntry<T>, observer: QueryObserver<T>): void {
    entry.observers.delete(observer);
    if (entry.observers.size === 0) {
      const cacheTime = entry.options.cacheTime ?? DEFAULT_CACHE_TIME;
      entry.gcTimeout = setTimeout(() => {
        this.entries.delete(entry.key);
      }, cacheTime);
    }
  }

  public async fetch<T>(entry: QueryCacheEntry<T>, options: NormalizedQueryOptions<T>, force = false): Promise<T> {
    if (entry.fetchPromise && !force) {
      return entry.fetchPromise;
    }

    entry.status = 'loading';
    entry.error = null;
    this.notify(entry);

    const fetchPromise = Promise.resolve()
      .then(() => options.fetch())
      .then((data) => {
        entry.data = data;
        entry.status = 'success';
        entry.updatedAt = Date.now();
        this.notify(entry);
        return data;
      })
      .catch((error) => {
        entry.error = error;
        entry.status = 'error';
        this.notify(entry);
        throw error;
      })
      .finally(() => {
        entry.fetchPromise = undefined;
      });

    entry.fetchPromise = fetchPromise;
    return fetchPromise;
  }

  public invalidate(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.updatedAt = 0;
    entry.status = entry.data == null ? 'idle' : entry.status;
    this.notify(entry);
  }

  public isStale<T>(entry: QueryCacheEntry<T>, options: NormalizedQueryOptions<T>): boolean {
    if (entry.updatedAt === 0) return true;
    const staleTime = options.staleTime ?? DEFAULT_STALE_TIME;
    return Date.now() - entry.updatedAt > staleTime;
  }

  public hashKey(key: QueryKey): string {
    if (typeof key === 'string') return key;
    return stableStringify(key);
  }

  public withDefaults<T>(options: Partial<NormalizedQueryOptions<T>> & { key: QueryKey; fetch: () => Promise<T> | T }): NormalizedQueryOptions<T> {
    return {
      key: options.key,
      fetch: options.fetch,
      enabled: options.enabled ?? true,
      staleTime: options.staleTime ?? DEFAULT_STALE_TIME,
      cacheTime: options.cacheTime ?? DEFAULT_CACHE_TIME,
    };
  }

  private notify<T>(entry: QueryCacheEntry<T>): void {
    const stale = this.isStale(entry, entry.options);
    for (const observer of entry.observers) {
      observer.onEntryUpdate(entry, stale);
    }
  }
}

export const IQueryClient = DI.createInterface<IQueryClient>('IQueryClient', x => x.singleton(QueryClient));
export interface IQueryClient extends QueryClient {}

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object') {
      if (seen.has(val as object)) {
        return '[Circular]';
      }
      seen.add(val as object);

      if (Array.isArray(val)) {
        return val;
      }

      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[key] = (val as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return val;
  });
}
