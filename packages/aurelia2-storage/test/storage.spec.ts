import { createFixture } from '@aurelia/testing';
import { AureliaStorage, AureliaStorageConfiguration, IStorage } from './../src/index';

describe('aurelia2-storage', () => {
  test('stores and retrieves values in memory backend', async () => {
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaStorageConfiguration.configure({ defaultBackend: 'memory' })]
    );

    await startPromise;
    const storage = container.get(IStorage);
    expect(container.get(AureliaStorage)).toBe(storage);

    await storage.set('name', 'Dwayne');
    const value = await storage.get('name');

    expect(value).toBe('Dwayne');

    await storage.remove('name');
    const removed = await storage.get('name');

    expect(removed).toBeNull();

    await tearDown();
  });

  test('expires values after ttl', async () => {
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaStorageConfiguration.configure({ defaultBackend: 'memory' })]
    );

    await startPromise;
    const storage = container.get(IStorage);

    const now = Date.now();
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now);

    await storage.set('temp', 'value', { ttl: 1000 });
    expect(await storage.get('temp')).toBe('value');

    spy.mockReturnValue(now + 1001);
    expect(await storage.get('temp')).toBeNull();

    spy.mockRestore();

    await tearDown();
  });

  test('persist attribute hydrates bound value', async () => {
    const fixture = createFixture(
      `<input persist="key.bind: 'username'; value.bind: name">`,
      class App {
        name = '';
      },
      [AureliaStorageConfiguration.configure({ defaultBackend: 'memory' })],
      false
    );

    const storage = fixture.container.get(IStorage);
    await storage.set('username', 'Dwayne');

    await fixture.start();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fixture.component.name).toBe('Dwayne');

    await fixture.tearDown();
  });

  test('clears only keys under the configured prefix', async () => {
    const fixture = await createFixture('<div></div>', {}, [
      AureliaStorageConfiguration.configure({ defaultBackend: 'local', prefix: 'storage-spec:' }),
    ]).started;
    const storage = fixture.container.get(IStorage);
    localStorage.setItem('other-app:setting', 'keep');
    try {
      await storage.set('name', 'Dwayne');
      expect(await storage.keys()).toEqual(['name']);

      await storage.clear();
      expect(await storage.keys()).toEqual([]);
      expect(localStorage.getItem('other-app:setting')).toBe('keep');
    } finally {
      localStorage.removeItem('other-app:setting');
      await fixture.tearDown();
    }
  });

  test('cancels pending persisted writes when the attribute unbinds', async () => {
    const fixture = await createFixture(
      '<input persist="key: username; value.bind: name; delay.bind: 500">',
      { name: '' },
      [AureliaStorageConfiguration],
    ).started;
    const storage = fixture.container.get(IStorage);

    jest.useFakeTimers();
    try {
      fixture.component.name = 'saved';
      await jest.advanceTimersByTimeAsync(500);
      expect(await storage.get('username')).toBe('saved');

      fixture.component.name = 'pending';
      await fixture.tearDown();
      await jest.advanceTimersByTimeAsync(500);
      expect(await storage.get('username')).toBe('saved');
    } finally {
      jest.useRealTimers();
    }
  });
});
