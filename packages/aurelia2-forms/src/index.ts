import { IContainer, IRegistry } from '@aurelia/kernel';
import { AuFormCustomElement } from './au-form';
import { AuFieldCustomAttribute } from './au-field';

const DefaultComponents: IRegistry[] = [
  AuFormCustomElement as unknown as IRegistry,
  AuFieldCustomAttribute as unknown as IRegistry,
];

export const AureliaFormsConfiguration: IRegistry = {
  register(container: IContainer): IContainer {
    return container.register(...DefaultComponents);
  }
};

export * from './form-controller';
export * from './field-state';
export * from './validators';
export * from './au-form';
export * from './au-field';
