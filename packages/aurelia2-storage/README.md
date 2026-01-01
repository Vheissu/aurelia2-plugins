# aurelia2-storage

Storage utilities for Aurelia 2 with multiple backends and a `persist` custom attribute.

## Install

```
npm install aurelia2-storage
```

## Register

```ts
import { AureliaStorageConfiguration } from 'aurelia2-storage';

Aurelia.register(AureliaStorageConfiguration);
```

## Storage service

Inject `IStorage` to access the unified storage API:

```ts
import { IStorage } from 'aurelia2-storage';

export class Example {
  constructor(@IStorage private readonly storage) {}

  async load() {
    const value = await this.storage.get('profile');
  }
}
```

### API

- `get<T>(key, options?) => Promise<T | null>`
- `set<T>(key, value, options?) => Promise<void>`
- `remove(key, options?) => Promise<void>`
- `clear(options?) => Promise<void>`
- `keys(options?) => Promise<string[]>`
- `registerDriver(type, driver)`
- `configure(options)`

### Options

```ts
interface StorageOptions {
  storage?: 'memory' | 'local' | 'session' | 'indexeddb';
  ttl?: number; // ms
}
```

- `ttl` stores an expiry timestamp; expired entries are removed on read.

### Backends

- `memory` (always available)
- `local` (browser localStorage)
- `session` (browser sessionStorage)
- `indexeddb` (browser IndexedDB)

Backends are registered only when available in the current environment.

## Configuration

```ts
Aurelia.register(AureliaStorageConfiguration.configure({
  defaultBackend: 'local',
  prefix: 'app:',
  indexedDb: {
    dbName: 'my-app',
    storeName: 'kv',
    version: 1
  }
}));
```

- `defaultBackend` is used when no `storage` option is provided.
- `prefix` is prepended to all keys.
- `indexedDb` config controls the database name + store.

## `persist` custom attribute

`persist` hydrates a value from storage and writes back on change.

```html
<input
  persist="key.bind: 'profile.name'; value.bind: name; storage.bind: 'local'; ttl.bind: 3600000; delay.bind: 300"
/>
```

Bindings:
- `key` (primary)
- `value` (two-way)
- `storage` (backend)
- `ttl` (ms)
- `delay` (ms) debounce before writing

On bind, `persist` reads the value and updates `value` before any writes occur.
