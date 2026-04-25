import { IContainer, IRegistry, Registration } from 'aurelia';
import { AuCommandPaletteCustomElement } from './au-command-palette';
import { CommandPaletteService, ICommandPaletteService } from './command-palette-service';
import type { CommandPaletteConfigurationOptions } from './types';

const DefaultComponents: IRegistry[] = [
  AuCommandPaletteCustomElement as unknown as IRegistry,
];

function createConfiguration(options: CommandPaletteConfigurationOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const service = container.get(ICommandPaletteService) as CommandPaletteService;
      service.configure(options);

      return container.register(
        Registration.instance(ICommandPaletteService, service),
        Registration.instance(CommandPaletteService, service),
        ...DefaultComponents
      );
    },
    configure(newOptions: CommandPaletteConfigurationOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaCommandPaletteConfiguration = createConfiguration();

export * from './types';
export * from './command-palette-service';
export * from './au-command-palette';
