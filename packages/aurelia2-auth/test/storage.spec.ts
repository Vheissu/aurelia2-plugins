import { DI, Registration } from '@aurelia/kernel';
import { IWindow } from '@aurelia/runtime-html';
import { createDefaultAuthConfigOptions, mergeAuthConfigOptions } from '../src/base-config';
import { IAuthOptions } from '../src/configuration';
import {
  MemoryStorage,
  Storage,
  TransactionStorage,
} from '../src/storage';

describe('Authentication storage adapters', () => {
  test('falls back to one stable in-memory backend when browser storage is blocked', () => {
    const browserWindow = blockedStorageWindow();
    const storage = createStorage(Storage, browserWindow, {
      storage: 'localStorage',
      storageFallback: 'memory',
    });

    storage.set('access', 'token-1');
    storage.set('refresh', 'token-2');

    expect(storage.get('access')).toBe('token-1');
    expect(storage.get('refresh')).toBe('token-2');
    storage.clear(['access', 'refresh']);
    expect(storage.get('access')).toBeNull();
    expect(storage.get('refresh')).toBeNull();
  });

  test('can fail closed when configured browser storage is unavailable', () => {
    const storage = createStorage(Storage, blockedStorageWindow(), {
      storage: 'sessionStorage',
      storageFallback: 'error',
    });

    expect(() => storage.get('access')).toThrow('sessionStorage is disabled or unavailable.');
  });

  test('uses a dedicated transaction backend instead of the token backend', () => {
    const tokenBackend = new MemoryStorage();
    const transactionBackend = new MemoryStorage();
    const transactionStorage = createStorage(TransactionStorage, window, {
      storage: tokenBackend,
      transactionStorage: transactionBackend,
    });

    transactionStorage.set('oauth-state', 'transaction');

    expect(transactionBackend.getItem('oauth-state')).toBe('transaction');
    expect(tokenBackend.getItem('oauth-state')).toBeNull();
  });

  test('probes usable browser storage without leaving probe data behind', () => {
    const values = new Map<string, string>();
    const browserStorage = {
      getItem: jest.fn((key: string) => values.get(key) ?? null),
      setItem: jest.fn((key: string, value: string) => { values.set(key, value); }),
      removeItem: jest.fn((key: string) => { values.delete(key); }),
    };
    const browserWindow = {
      location: { origin: 'https://app.example' },
      localStorage: browserStorage,
      sessionStorage: browserStorage,
    } as unknown as Window;
    const storage = createStorage(Storage, browserWindow, { storage: 'localStorage' });

    storage.set('access', 'token');

    expect(browserStorage.setItem).toHaveBeenNthCalledWith(
      1,
      '__aurelia_auth_storage_probe__',
      '__aurelia_auth_storage_probe__',
    );
    expect(browserStorage.removeItem).toHaveBeenCalledWith('__aurelia_auth_storage_probe__');
    expect(values.has('__aurelia_auth_storage_probe__')).toBe(false);
    expect(storage.get('access')).toBe('token');
  });
});

function createStorage<T extends Storage | TransactionStorage>(
  Type: new () => T,
  browserWindow: Window,
  overrides: Parameters<typeof mergeAuthConfigOptions>[1],
): T {
  const container = DI.createContainer();
  const options = mergeAuthConfigOptions(
    createDefaultAuthConfigOptions(browserWindow),
    overrides,
  );
  container.register(
    Registration.instance(IWindow, browserWindow),
    Registration.instance(IAuthOptions, options),
  );
  return container.invoke(Type);
}

function blockedStorageWindow(): Window {
  const value = { location: { origin: 'https://app.example' } };
  Object.defineProperties(value, {
    localStorage: { get: () => { throw new Error('blocked'); } },
    sessionStorage: { get: () => { throw new Error('blocked'); } },
  });
  return value as unknown as Window;
}
