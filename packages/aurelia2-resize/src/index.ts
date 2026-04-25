import { IContainer, IRegistry, Registration } from 'aurelia';
import { ResizeCustomAttribute } from './resize';
import { ResizeService, IResizeService } from './resize-service';
import type { ResizeConfigurationOptions } from './types';

const DefaultComponents: IRegistry[] = [
  ResizeCustomAttribute as unknown as IRegistry,
];

function createConfiguration(options: ResizeConfigurationOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const service = container.get(IResizeService) as ResizeService;
      service.configure(options);

      return container.register(
        Registration.instance(IResizeService, service),
        Registration.instance(ResizeService, service),
        ...DefaultComponents
      );
    },
    configure(newOptions: ResizeConfigurationOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaResizeConfiguration = createConfiguration();

export * from './types';
export * from './resize-service';
export * from './resize';
