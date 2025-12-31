# aurelia2-query

A lightweight query/caching plugin for Aurelia 2 with a `.query` binding command, a query binding behavior, and an `<au-query>` custom element.

## Install

```
npm install aurelia2-query
```

## Usage

Register the plugin:

```ts
import { AureliaQueryConfiguration } from 'aurelia2-query';

Aurelia.register(AureliaQueryConfiguration);
```

### `.query` binding command

```html
<div result.query="{ key: ['users', page], fetch: () => api.users(page), staleTime: 60000 }"></div>
```

This assigns a `QueryResult` to the `result` property.

### `<au-query>` custom element

```html
<au-query query.bind="{ key: ['user', id], fetch: () => api.user(id) }" result.bind="userQuery">
  <div if.bind="userQuery.loading">Loading...</div>
  <pre if.bind="userQuery.data">${userQuery.data}</pre>
</au-query>
```

### QueryResult shape

`QueryResult` exposes:
- `data`, `error`, `status`, `loading`, `stale`, `updatedAt`
- `refetch()` and `invalidate()`
