import { DI } from '@aurelia/kernel';
import type { StorageConfigOptions } from './types';

const defaultOptions: Required<StorageConfigOptions> = {
  defaultBackend: 'memory',
  prefix: '',
  indexedDb: {
    dbName: 'aurelia2-storage',
    storeName: 'keyval',
    version: 1,
  },
};

export class StorageConfig {
  public options: Required<StorageConfigOptions> = { ...defaultOptions, indexedDb: { ...defaultOptions.indexedDb } };

  public configure(options?: StorageConfigOptions): void {
    if (!options) return;
    this.options = {
      ...this.options,
      ...options,
      indexedDb: {
        ...this.options.indexedDb,
        ...options.indexedDb,
      },
    };
  }
}

export const IStorageConfig = DI.createInterface<IStorageConfig>('IStorageConfig', x => x.singleton(StorageConfig));
export interface IStorageConfig extends StorageConfig {}
