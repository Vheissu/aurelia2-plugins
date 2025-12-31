# aurelia2-storage

Storage utilities for Aurelia 2 with multiple backends and a `persist` custom attribute.

## Install

```
npm install aurelia2-storage
```

## Usage

Register the plugin:

```ts
import { AureliaStorageConfiguration } from 'aurelia2-storage';

Aurelia.register(AureliaStorageConfiguration);
```

### Storage service

```ts
import { IStorage } from 'aurelia2-storage';

export class Example {
  constructor(@IStorage private readonly storage) {}
}
```

Backends supported: `memory`, `local`, `session`, `indexeddb`.

### `persist` custom attribute

```html
<input
  persist="key.bind: 'profile.name'; value.bind: name; storage.bind: 'local'; ttl.bind: 3600000"
/>
```

## Configuration

```ts
Aurelia.register(AureliaStorageConfiguration.configure({
  defaultBackend: 'local',
  prefix: 'app:',
  indexedDb: { dbName: 'my-app', storeName: 'kv' }
}));
```
