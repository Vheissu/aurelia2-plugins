# aurelia2-offline-sync

Offline mutation queue and sync orchestration for Aurelia 2 applications. It is meant for commands such as saving drafts, submitting forms, acknowledging notifications, or posting comments when a user may lose connectivity.

```ts
import { AureliaOfflineSyncConfiguration } from 'aurelia2-offline-sync';

Aurelia.register(AureliaOfflineSyncConfiguration.configure({
  maxAttempts: 5,
  autoSync: true,
}));
```

```ts
const offline = container.get(IOfflineSync);

offline.registerHandler('comment.create', {
  async handle(operation) {
    await fetch('/api/comments', {
      method: 'POST',
      body: JSON.stringify(operation.payload),
    });
  },
});

await offline.enqueue('comment.create', { body: 'Still works offline' }, {
  dedupeKey: 'comment-draft-123',
});
```

The queue persists through the configured store, pauses while offline, retries failed operations up to `maxAttempts`, and can dedupe in-flight work by business key.
