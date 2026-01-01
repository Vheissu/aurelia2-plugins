# aurelia2-query

A lightweight query + caching plugin for Aurelia 2. It provides:
- a `.query` binding command
- a `query` binding behavior (`& query`)
- a headless `<au-query>` custom element
- a singleton `QueryClient` for cache + fetch orchestration

## Install

```
npm install aurelia2-query
```

## Register

```ts
import { AureliaQueryConfiguration } from 'aurelia2-query';

Aurelia.register(AureliaQueryConfiguration);
```

## Quick start (headless element)

```html
<au-query query.bind="userQuery" result.bind="result">
  <div if.bind="result.loading">Loading...</div>
  <div if.bind="result.error">Something went wrong.</div>
  <pre if.bind="result.data">${result.data}</pre>
</au-query>
```

```ts
export class Page {
  userId = 42;

  get userQuery() {
    return {
      key: ['user', this.userId],
      fetch: () => api.user(this.userId),
      staleTime: 60_000,
    };
  }

  result = null;
}
```

## Query options

A query definition can be either a function or a full options object.

```ts
import type { QueryOptions } from 'aurelia2-query';

const options: QueryOptions<User> = {
  key: ['user', userId],
  fetch: () => api.user(userId),
  enabled: true,
  staleTime: 60_000,
  cacheTime: 5 * 60_000,
};
```

- `key`: `string | readonly unknown[]` used for caching.
- `fetch`: async or sync function returning data.
- `enabled`: when `false`, no fetch happens until `refetch()`.
- `staleTime`: how long data is considered fresh (ms).
- `cacheTime`: how long unused cache entries survive (ms).

If you pass a function as the query definition, the key defaults to the function name
(or `"query"` if unnamed).

## `.query` binding command

Use this on any bindable to create and assign a `QueryResult` while binding a
query definition.

```html
<result-host result.query="query"></result-host>
```

```ts
class App {
  query = { key: ['users'], fetch: () => api.users() };
}
```

You can also bind an inline object:

```html
<div result.query="{ key: ['users', page], fetch: () => api.users(page) }"></div>
```

Under the hood this uses the `query` binding behavior.

## `& query` binding behavior

If you prefer explicit behavior usage:

```html
<div result.bind="queryDef & query"></div>
```

## `<au-query>` custom element

`<au-query>` is a headless element that simply creates a `QueryResult` and manages
the query lifecycle. Use it when you want a dedicated place to declare query state.

Bindings:
- `query.bind` (primary): a query definition
- `result.bind`: the `QueryResult` instance (auto-created if omitted)

## `QueryResult`

A `QueryResult` instance exposes:
- `data`, `error`, `status`, `loading`, `stale`, `updatedAt`
- `refetch()` to force a new fetch
- `invalidate()` to mark cache stale

## `QueryClient`

Inject the client if you need manual control:

```ts
import { IQueryClient } from 'aurelia2-query';

export class Example {
  constructor(@IQueryClient private readonly client) {}
}
```

Key methods:
- `fetch(entry, options, force?)`
- `invalidate(key)`
- `getEntry(key)` / `getOrCreateEntry(key, options)`

## Notes

- Keys are hashed via stable JSON stringification. Object keys are sorted to keep
  hashes deterministic.
- When `enabled: false`, the query is created but does not fetch until `refetch()`.
