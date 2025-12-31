import { AureliaStorage } from './../src/storage';
import { StorageConfig } from './../src/storage-config';

describe('aurelia2-storage', () => {
  test('stores and retrieves values in memory backend', async () => {
    const config = new StorageConfig();
    config.configure({ defaultBackend: 'memory' });

    const storage = new AureliaStorage(config);

    await storage.set('name', 'Dwayne');
    const value = await storage.get('name');

    expect(value).toBe('Dwayne');

    await storage.remove('name');
    const removed = await storage.get('name');

    expect(removed).toBeNull();
  });
});
