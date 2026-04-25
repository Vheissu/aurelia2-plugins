import { IContainer, IRegistry, Registration } from 'aurelia';
import { FocusTrapCustomAttribute } from './focus-trap';
import { FocusTrapService, IFocusTrapService } from './focus-trap-service';
import type { FocusTrapConfigurationOptions } from './types';

const DefaultComponents: IRegistry[] = [
  FocusTrapCustomAttribute as unknown as IRegistry,
];

function createConfiguration(options: FocusTrapConfigurationOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const service = container.get(IFocusTrapService) as FocusTrapService;
      service.configure(options);

      return container.register(
        Registration.instance(IFocusTrapService, service),
        Registration.instance(FocusTrapService, service),
        ...DefaultComponents
      );
    },
    configure(newOptions: FocusTrapConfigurationOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaFocusTrapConfiguration = createConfiguration();

export * from './types';
export * from './focus-trap-service';
export * from './focus-trap';
