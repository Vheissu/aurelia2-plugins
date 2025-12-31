export type QueryKey = string | readonly unknown[];

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface QueryOptions<T = unknown> {
  key: QueryKey;
  fetch: () => Promise<T> | T;
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
}

export interface NormalizedQueryOptions<T = unknown> {
  key: QueryKey;
  fetch: () => Promise<T> | T;
  enabled: boolean;
  staleTime: number;
  cacheTime: number;
}

export type QueryDefinition<T = unknown> = QueryOptions<T> | (() => Promise<T> | T);
