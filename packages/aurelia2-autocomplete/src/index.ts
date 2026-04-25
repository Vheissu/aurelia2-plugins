import { IContainer, IRegistry, Registration } from 'aurelia';
import { AuAutocompleteCustomElement } from './au-autocomplete';
import { AutocompleteService, IAutocompleteService } from './autocomplete-service';
import type { AutocompleteConfigurationOptions } from './types';

const DefaultComponents: IRegistry[] = [
  AuAutocompleteCustomElement as unknown as IRegistry,
];

function createConfiguration(options: AutocompleteConfigurationOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const service = container.get(IAutocompleteService) as AutocompleteService;
      service.configure(options);

      return container.register(
        Registration.instance(IAutocompleteService, service),
        Registration.instance(AutocompleteService, service),
        ...DefaultComponents
      );
    },
    configure(newOptions: AutocompleteConfigurationOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaAutocompleteConfiguration = createConfiguration();

export * from './types';
export * from './autocomplete-service';
export * from './au-autocomplete';
