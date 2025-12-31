import type { NormalizedQueryOptions, QueryDefinition, QueryOptions } from './types';
import type { QueryCacheEntry, QueryObserver as IQueryObserver } from './query-client';
import { QueryClient } from './query-client';
import { QueryResult } from './query-result';

export class QueryObserver<T = unknown> implements IQueryObserver<T> {
  private entry: QueryCacheEntry<T> | null = null;
  private options: NormalizedQueryOptions<T> | null = null;
  private key: string | null = null;

  public constructor(
    private readonly client: QueryClient,
    private readonly result: QueryResult<T>
  ) {
    this.result._setCallbacks(
      () => this.refetch(),
      () => this.invalidate()
    );
  }

  public setOptions(definition: QueryDefinition<T> | null): void {
    if (!definition) {
      this.detach();
      this.result._reset();
      return;
    }

    const normalized = normalizeOptions(definition, this.client);
    const key = this.client.hashKey(normalized.key);

    if (this.key !== key) {
      this.detach();
    }

    this.key = key;
    this.options = normalized;
    this.entry = this.client.getOrCreateEntry(key, normalized);
    this.client.subscribe(this.entry, this);

    if (normalized.enabled && this.client.isStale(this.entry, normalized)) {
      void this.client.fetch(this.entry, normalized);
    }
  }

  public onEntryUpdate(entry: QueryCacheEntry<T>, stale: boolean): void {
    this.result._apply(entry.data ?? null, entry.error, entry.status, stale, entry.updatedAt);
  }

  public refetch(): Promise<T> {
    if (!this.entry || !this.options) {
      return Promise.resolve(null as T);
    }
    return this.client.fetch(this.entry, this.options, true);
  }

  public invalidate(): void {
    if (!this.entry) return;
    this.client.invalidate(this.entry.key);
  }

  public dispose(): void {
    this.detach();
  }

  private detach(): void {
    if (!this.entry) return;
    this.client.unsubscribe(this.entry, this);
    this.entry = null;
    this.options = null;
    this.key = null;
  }
}

function normalizeOptions<T>(definition: QueryDefinition<T>, client: QueryClient): NormalizedQueryOptions<T> {
  if (typeof definition === 'function') {
    return client.withDefaults({
      key: definition.name || 'query',
      fetch: definition,
    });
  }

  const options = definition as QueryOptions<T>;
  if (!options.fetch) {
    throw new Error('Query options must include a fetch function.');
  }

  return client.withDefaults({
    key: options.key ?? (options.fetch.name || 'query'),
    fetch: options.fetch,
    enabled: options.enabled,
    staleTime: options.staleTime,
    cacheTime: options.cacheTime,
  });
}
