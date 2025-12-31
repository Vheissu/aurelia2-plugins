import { IContainer, IRegistry, Registration } from '@aurelia/kernel';
import { AppTask } from '@aurelia/runtime-html';
import { RouterExtras } from './router-extras';
import { AuBreadcrumbsCustomElement } from './au-breadcrumbs';

const DefaultComponents: IRegistry[] = [
  AuBreadcrumbsCustomElement as unknown as IRegistry,
];

export const AureliaRouterExtrasConfiguration: IRegistry = {
  register(container: IContainer): IContainer {
    return container.register(
      Registration.singleton(RouterExtras, RouterExtras),
      AppTask.hydrating(RouterExtras, (extras) => extras.init()),
      ...DefaultComponents
    );
  }
};

export * from './router-extras';
export * from './au-breadcrumbs';
export * from './types';
