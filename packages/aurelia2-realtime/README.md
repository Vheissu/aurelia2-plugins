# aurelia2-realtime

Realtime channel infrastructure for Aurelia 2 apps. It gives applications a small channel API over a transport abstraction, queued outbound messages while disconnected, status listeners, and reconnect handling.

```ts
import { AureliaRealtimeConfiguration } from 'aurelia2-realtime';

Aurelia.register(AureliaRealtimeConfiguration.configure({
  url: 'wss://example.com/realtime',
  reconnect: true,
  queueWhileDisconnected: true,
}));
```

```ts
const realtime = container.get(IRealtime);

await realtime.connect();

const subscription = realtime.subscribe('orders', (message) => {
  console.log(message.type, message.payload);
});

await realtime.publish('orders', 'order.updated', { id: 'ord_123' });

subscription.dispose();
```

The transport is replaceable, so apps can use WebSocket, SSE, test doubles, or platform-specific realtime clients while keeping the same app-facing channel API.
