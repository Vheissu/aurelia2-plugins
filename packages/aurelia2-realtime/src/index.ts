import { IContainer, Registration } from 'aurelia';
import { IRealtime, RealtimeService } from './realtime-service';
import type { RealtimeConfigurationOptions } from './types';

function createConfiguration(options: RealtimeConfigurationOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const service = container.get(IRealtime) as RealtimeService;
      service.configure(options);

      return container.register(
        Registration.instance(IRealtime, service),
        Registration.instance(RealtimeService, service)
      );
    },
    configure(newOptions: RealtimeConfigurationOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaRealtimeConfiguration = createConfiguration();

export * from './types';
export * from './realtime-service';
export * from './memory-transport';
export * from './websocket-transport';
