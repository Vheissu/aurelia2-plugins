import { IContainer, IRegistry, Registration } from 'aurelia';
import { MediaCustomAttribute } from './media';
import { MediaService, IMediaService } from './media-service';
import type { MediaConfigurationOptions } from './types';

const DefaultComponents: IRegistry[] = [
  MediaCustomAttribute as unknown as IRegistry,
];

function createConfiguration(options: MediaConfigurationOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const service = container.get(IMediaService) as MediaService;
      service.configure(options);

      return container.register(
        Registration.instance(IMediaService, service),
        Registration.instance(MediaService, service),
        ...DefaultComponents
      );
    },
    configure(newOptions: MediaConfigurationOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaMediaConfiguration = createConfiguration();

export * from './types';
export * from './media-service';
export * from './media';
