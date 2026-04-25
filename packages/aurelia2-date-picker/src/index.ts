import { IContainer, IRegistry, Registration } from 'aurelia';
import { AuDatePickerCustomElement } from './au-date-picker';
import { DatePickerService, IDatePickerService } from './date-picker-service';
import type { DatePickerConfigurationOptions } from './types';

const DefaultComponents: IRegistry[] = [
  AuDatePickerCustomElement as unknown as IRegistry,
];

function createConfiguration(options: DatePickerConfigurationOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const service = container.get(IDatePickerService) as DatePickerService;
      service.configure(options);

      return container.register(
        Registration.instance(IDatePickerService, service),
        Registration.instance(DatePickerService, service),
        ...DefaultComponents
      );
    },
    configure(newOptions: DatePickerConfigurationOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaDatePickerConfiguration = createConfiguration();

export * from './types';
export * from './date-picker-service';
export * from './au-date-picker';
