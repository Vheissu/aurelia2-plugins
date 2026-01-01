import { DI, Registration } from '@aurelia/kernel';
import { IAuthOptions } from '../src/configuration';
import { Storage } from '../src/storage';

describe('Storage', () => {
  test('memory storage read/write', () => {
    const container = DI.createContainer();
    container.register(
      Registration.instance(IAuthOptions, {
        storage: 'memory',
      })
    );

    const storage = container.invoke(Storage);

    storage.set('token', 'value');
    expect(storage.get('token')).toBe('value');

    storage.remove('token');
    expect(storage.get('token')).toBeNull();
  });

  test('custom storage instance is used', () => {
    const custom = {
      getItem: jest.fn(() => 'custom'),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };

    const container = DI.createContainer();
    container.register(
      Registration.instance(IAuthOptions, {
        storage: custom,
      })
    );

    const storage = container.invoke(Storage);

    expect(storage.get('token')).toBe('custom');
    expect(custom.getItem).toHaveBeenCalledWith('token');
    storage.set('token', 'value');
    expect(custom.setItem).toHaveBeenCalledWith('token', 'value');
    storage.remove('token');
    expect(custom.removeItem).toHaveBeenCalledWith('token');
  });
});
