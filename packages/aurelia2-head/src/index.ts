import { IContainer, IRegistry, Registration } from 'aurelia';
import { AuHeadCustomElement } from './au-head';
import { HeadManager, IHeadManager } from './head-manager';
import type { HeadManagerOptions } from './types';

const DefaultComponents: IRegistry[] = [
  AuHeadCustomElement as unknown as IRegistry,
];

function createConfiguration(options: HeadManagerOptions = {}) {
  return {
    register(container: IContainer): IContainer {
      const manager = container.get(IHeadManager) as HeadManager;
      manager.configure(options);

      return container.register(
        Registration.instance(IHeadManager, manager),
        Registration.instance(HeadManager, manager),
        ...DefaultComponents
      );
    },
    configure(newOptions: HeadManagerOptions = {}) {
      return createConfiguration(newOptions);
    },
  };
}

export const AureliaHeadConfiguration = createConfiguration();

export * from './types';
export * from './head-manager';
export * from './au-head';
