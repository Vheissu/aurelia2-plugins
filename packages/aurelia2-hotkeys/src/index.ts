import { IContainer, IRegistry, Registration } from 'aurelia';
import { HotkeyCustomAttribute } from './hotkey';
import { HotkeyService, IHotkeyService } from './hotkey-service';
import type { HotkeyConfigurationOptions } from './types';

const DefaultComponents: IRegistry[] = [
  HotkeyCustomAttribute as unknown as IRegistry,
];

function createConfiguration(options: HotkeyConfigurationOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const service = container.get(IHotkeyService) as HotkeyService;
      service.configure(options);

      return container.register(
        Registration.instance(IHotkeyService, service),
        Registration.instance(HotkeyService, service),
        ...DefaultComponents
      );
    },
    configure(newOptions: HotkeyConfigurationOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaHotkeysConfiguration = createConfiguration();

export * from './types';
export * from './hotkey-service';
export * from './hotkey';
