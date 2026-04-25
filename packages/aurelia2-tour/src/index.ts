import { IContainer, IRegistry, Registration } from 'aurelia';
import { AuTourCustomElement } from './au-tour';
import { TourService, ITourService } from './tour-service';
import type { TourConfigurationOptions } from './types';

const DefaultComponents: IRegistry[] = [
  AuTourCustomElement as unknown as IRegistry,
];

function createConfiguration(options: TourConfigurationOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const service = container.get(ITourService) as TourService;
      service.configure(options);

      return container.register(
        Registration.instance(ITourService, service),
        Registration.instance(TourService, service),
        ...DefaultComponents
      );
    },
    configure(newOptions: TourConfigurationOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaTourConfiguration = createConfiguration();

export * from './types';
export * from './tour-service';
export * from './au-tour';
