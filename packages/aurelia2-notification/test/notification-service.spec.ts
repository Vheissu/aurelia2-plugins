import { createFixture } from '@aurelia/testing';
import {
  AureliaNotificationConfiguration,
  INotificationService,
  type NotificationConfigOptions,
} from '../src/index';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createNotificationFixture(overrides: Partial<NotificationConfigOptions> = {}) {
  return createFixture(
    '<au-notification-host></au-notification-host>',
    class {},
    [
      AureliaNotificationConfiguration.configure({
        defaults: {
          autoDismiss: false,
          duration: 0,
        },
        animations: {
          enter: 0,
          exit: 0,
        },
        ...overrides,
      }),
    ]
  );
}

function getHostRoot(appHost: HTMLElement): ParentNode {
  const host = appHost.querySelector('au-notification-host') as HTMLElement | null;
  if (!host) {
    throw new Error('au-notification-host not found in fixture');
  }
  return host.shadowRoot ?? host;
}

describe('aurelia2-notification', () => {
  test('renders notifications in the host', async () => {
    const { appHost, container, startPromise, tearDown } = createNotificationFixture();

    await startPromise;
    const service = container.get(INotificationService);
    const ref = service.notify('Hello');

    await flush();

    const hostRoot = getHostRoot(appHost);
    const items = hostRoot.querySelectorAll('.au-notification');

    expect(ref.id).toBeDefined();
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('Hello');

    await tearDown();
  });

  test('honors maxItems with discard-oldest overflow', async () => {
    const { appHost, container, startPromise, tearDown } = createNotificationFixture({
      maxItems: 1,
      overflow: 'discard-oldest',
    });

    await startPromise;
    const service = container.get(INotificationService);

    service.notify('One');
    service.notify('Two');

    await flush();

    const hostRoot = getHostRoot(appHost);
    const items = hostRoot.querySelectorAll('.au-notification');

    expect(service.items).toHaveLength(1);
    expect(service.items[0].message).toBe('Two');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('Two');

    await tearDown();
  });

  test('queues notifications when overflow is queue', async () => {
    const { appHost, container, startPromise, tearDown } = createNotificationFixture({
      maxItems: 1,
      overflow: 'queue',
      maxQueue: 2,
    });

    await startPromise;
    const service = container.get(INotificationService);

    const first = service.notify('One');
    service.notify('Two');

    await flush();

    const hostRoot = getHostRoot(appHost);
    let items = hostRoot.querySelectorAll('.au-notification');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('One');

    service.dismiss(first.id, 'manual');
    await flush();

    items = hostRoot.querySelectorAll('.au-notification');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('Two');

    await tearDown();
  });

  test('dedupes notifications when enabled', async () => {
    const { appHost, container, startPromise, tearDown } = createNotificationFixture({
      dedupe: true,
    });

    await startPromise;
    const service = container.get(INotificationService);

    service.notify({ message: 'Hello', title: 'Greeting' });
    service.notify({ message: 'Hello', title: 'Greeting' });

    await flush();

    const hostRoot = getHostRoot(appHost);
    const items = hostRoot.querySelectorAll('.au-notification');
    const count = hostRoot.querySelector('.au-notification__count');

    expect(service.items).toHaveLength(1);
    expect(service.items[0].count).toBe(2);
    expect(items).toHaveLength(1);
    expect(count?.textContent).toContain('x2');

    await tearDown();
  });
});
