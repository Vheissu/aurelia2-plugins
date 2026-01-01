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
export { QueryClient, IQueryClient } from './query-client';
export type { QueryCacheEntry, QueryObserver as QueryClientObserver } from './query-client';
export { QueryResult } from './query-result';
export { QueryObserver } from './query-observer';
export { QueryBindingBehavior } from './query-binding-behavior';
export { QueryBindingCommand } from './query-binding-command';
export { AuQueryCustomElement } from './au-query';
