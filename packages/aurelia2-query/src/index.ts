import { IContainer, IRegistry } from '@aurelia/kernel';
import { QueryBindingCommand } from './query-binding-command';
import { QueryBindingBehavior } from './query-binding-behavior';
import { AuQueryCustomElement } from './au-query';
import { IQueryClient } from './query-client';

const DefaultComponents: IRegistry[] = [
  IQueryClient as unknown as IRegistry,
  QueryBindingCommand as unknown as IRegistry,
  QueryBindingBehavior as unknown as IRegistry,
  AuQueryCustomElement as unknown as IRegistry,
];

export const AureliaQueryConfiguration: IRegistry = {
  register(container: IContainer): IContainer {
    return container.register(...DefaultComponents);
  }
};

export * from './types';
export * from './query-client';
export * from './query-result';
export * from './query-observer';
export * from './query-binding-behavior';
export * from './query-binding-command';
export * from './au-query';
