import { createFixture } from '@aurelia/testing';
import {
  AureliaOfflineSyncConfiguration,
  IOfflineSync,
  ManualNetworkStatusProvider,
  MemoryOfflineSyncStore,
  type OfflineOperation,
} from './../src/index';

describe('aurelia2-offline-sync', () => {
  test('enqueues, persists, and dedupes operations by business key', async () => {
    const store = new MemoryOfflineSyncStore();
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaOfflineSyncConfiguration.configure({
        store,
        network: new ManualNetworkStatusProvider(false),
        autoSync: false,
      })]
    );

    await startPromise;
    const offline = container.get(IOfflineSync);
    const events: string[] = [];
    offline.onEvent((event) => events.push(event.type));

    const first = await offline.enqueue('draft.save', { body: 'one' }, { dedupeKey: 'draft-1' });
    const second = await offline.enqueue('draft.save', { body: 'two' }, { dedupeKey: 'draft-1' });

    expect(second.id).toBe(first.id);
    expect(offline.getOperations()).toHaveLength(1);
    expect(offline.getOperations()[0].payload).toEqual({ body: 'two' });
    expect(await store.load()).toHaveLength(1);
    expect(events).toEqual(['queued', 'queued']);

    await tearDown();
  });

  test('pauses while offline, then syncs queued operations in order and removes successful work', async () => {
    const network = new ManualNetworkStatusProvider(false);
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaOfflineSyncConfiguration.configure({
        store: new MemoryOfflineSyncStore(),
        network,
        autoSync: false,
      })]
    );

    await startPromise;
    const offline = container.get(IOfflineSync);
    const handled: OfflineOperation[] = [];

    offline.registerHandler('comment.create', {
      handle(operation) {
        handled.push(operation);
      },
    });

    await offline.enqueue('comment.create', { body: 'first' }, { id: 'op-1' });
    await offline.enqueue('comment.create', { body: 'second' }, { id: 'op-2' });

    await offline.sync();
    expect(handled).toEqual([]);
    expect(offline.getOperations('queued')).toHaveLength(2);

    network.setOnline(true);
    await offline.sync();

    expect(handled.map((operation) => operation.id)).toEqual(['op-1', 'op-2']);
    expect(offline.getOperations()).toEqual([]);

    await tearDown();
  });

  test('keeps failed operations with attempts and stops after max attempts', async () => {
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaOfflineSyncConfiguration.configure({
        store: new MemoryOfflineSyncStore(),
        network: new ManualNetworkStatusProvider(true),
        autoSync: false,
        maxAttempts: 2,
      })]
    );

    await startPromise;
    const offline = container.get(IOfflineSync);
    const handler = jest.fn(() => {
      throw new Error('server unavailable');
    });

    offline.registerHandler('payment.capture', { handle: handler });
    await offline.enqueue('payment.capture', { id: 'pay-1' });

    await offline.sync();
    await offline.sync();
    await offline.sync();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(offline.getOperations()).toMatchObject([
      {
        status: 'failed',
        attempts: 2,
        error: 'server unavailable',
      },
    ]);

    await tearDown();
  });

  test('hydrates persisted operations from the configured store', async () => {
    const store = new MemoryOfflineSyncStore();
    await store.save([
      {
        id: 'persisted',
        type: 'profile.update',
        payload: { name: 'Aurelia' },
        status: 'queued',
        attempts: 0,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaOfflineSyncConfiguration.configure({
        store,
        network: new ManualNetworkStatusProvider(false),
        autoSync: false,
      })]
    );

    await startPromise;
    const offline = container.get(IOfflineSync);
    await offline.hydrate();

    expect(offline.getOperations()).toMatchObject([
      {
        id: 'persisted',
        type: 'profile.update',
        payload: { name: 'Aurelia' },
      },
    ]);

    await tearDown();
  });
});
