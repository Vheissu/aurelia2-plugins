import { IContainer, IRegistry, Registration } from 'aurelia';
import { AuWizardCustomElement } from './au-wizard';
import { WizardService, IWizardService } from './wizard-service';
import type { WizardConfigurationOptions } from './types';

const DefaultComponents: IRegistry[] = [
  AuWizardCustomElement as unknown as IRegistry,
];

function createConfiguration(options: WizardConfigurationOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const service = container.get(IWizardService) as WizardService;
      service.configure(options);

      return container.register(
        Registration.instance(IWizardService, service),
        Registration.instance(WizardService, service),
        ...DefaultComponents
      );
    },
    configure(newOptions: WizardConfigurationOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaWizardConfiguration = createConfiguration();

export * from './types';
export * from './wizard-service';
export * from './au-wizard';
