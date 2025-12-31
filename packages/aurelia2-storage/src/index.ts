import { IContainer, IRegistry, Registration } from '@aurelia/kernel';
import { AureliaStorage, IStorage } from './storage';
import { StorageConfig, IStorageConfig } from './storage-config';
import { PersistCustomAttribute } from './persist';
import type { StorageConfigOptions } from './types';

const DefaultComponents: IRegistry[] = [
  PersistCustomAttribute as unknown as IRegistry,
];

function createConfiguration(options?: StorageConfigOptions) {
  return {
    register(container: IContainer): IContainer {
      const config = container.get(IStorageConfig) as StorageConfig;
      config.configure(options);

      return container.register(
        Registration.instance(IStorageConfig, config),
        Registration.singleton(AureliaStorage, AureliaStorage),
        IStorage,
        ...DefaultComponents
      );
    },
    configure(newOptions?: StorageConfigOptions) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaStorageConfiguration = createConfiguration({});

export * from './types';
export * from './storage';
export * from './storage-config';
export * from './persist';
