import { IContainer, Registration } from 'aurelia';
import { IOfflineSync, OfflineSyncService } from './offline-sync-service';
import type { OfflineSyncConfigurationOptions } from './types';

function createConfiguration(options: OfflineSyncConfigurationOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const service = container.get(IOfflineSync) as OfflineSyncService;
      service.configure(options);

      return container.register(
        Registration.instance(IOfflineSync, service),
        Registration.instance(OfflineSyncService, service)
      );
    },
    configure(newOptions: OfflineSyncConfigurationOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaOfflineSyncConfiguration = createConfiguration();

export * from './types';
export * from './offline-sync-service';
export * from './stores';
export * from './network';
