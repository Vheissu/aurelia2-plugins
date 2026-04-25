import { IContainer, IRegistry, Registration } from 'aurelia';
import { IntersectCustomAttribute } from './intersect';
import { IntersectionService, IIntersectionService } from './intersection-service';
import type { IntersectionConfigurationOptions } from './types';

const DefaultComponents: IRegistry[] = [
  IntersectCustomAttribute as unknown as IRegistry,
];

function createConfiguration(options: IntersectionConfigurationOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const service = container.get(IIntersectionService) as IntersectionService;
      service.configure(options);

      return container.register(
        Registration.instance(IIntersectionService, service),
        Registration.instance(IntersectionService, service),
        ...DefaultComponents
      );
    },
    configure(newOptions: IntersectionConfigurationOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaIntersectionConfiguration = createConfiguration();

export * from './types';
export * from './intersection-service';
export * from './intersect';
