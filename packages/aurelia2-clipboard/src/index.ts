import { IContainer, IRegistry, Registration } from 'aurelia';
import { ClipboardService, IClipboardService } from './clipboard-service';
import { CopyCustomAttribute } from './copy';
import type { ClipboardConfigurationOptions } from './types';

const DefaultComponents: IRegistry[] = [
  CopyCustomAttribute as unknown as IRegistry,
];

function createConfiguration(options: ClipboardConfigurationOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const service = container.get(IClipboardService) as ClipboardService;
      service.configure(options);

      return container.register(
        Registration.instance(IClipboardService, service),
        Registration.instance(ClipboardService, service),
        ...DefaultComponents
      );
    },
    configure(newOptions: ClipboardConfigurationOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaClipboardConfiguration = createConfiguration();

export * from './types';
export * from './clipboard-service';
export * from './copy';
