import { bindingBehavior } from 'aurelia';
import type { Scope } from '@aurelia/runtime';
import type { IBinding } from '@aurelia/runtime-html';
import { IQueryClient, QueryClient } from './query-client';
import { QueryObserver } from './query-observer';
import { QueryResult } from './query-result';
import type { QueryDefinition } from './types';

interface QueryBindingState {
  result: QueryResult;
  observer: QueryObserver;
  originalUpdateTarget: (value: unknown) => void;
}

const stateMap = new WeakMap<IBinding, QueryBindingState>();

@bindingBehavior('query')
export class QueryBindingBehavior {
  public bind(_scope: Scope, binding: IBinding): void {
    if (stateMap.has(binding)) return;

    const client = binding.get(IQueryClient) as QueryClient;
    const result = new QueryResult();
    const observer = new QueryObserver(client, result);

    const targetBinding = binding as unknown as { updateTarget?: (value: unknown) => void };
    if (typeof targetBinding.updateTarget !== 'function') {
      return;
    }

    const originalUpdateTarget = targetBinding.updateTarget.bind(binding);

    targetBinding.updateTarget = (value: QueryDefinition | null) => {
      observer.setOptions(value as QueryDefinition | null);
      originalUpdateTarget(result);
    };

    stateMap.set(binding, { result, observer, originalUpdateTarget });
  }

  public unbind(_scope: Scope, binding: IBinding): void {
    const state = stateMap.get(binding);
    if (!state) return;

    state.observer.dispose();
    (binding as unknown as { updateTarget?: (value: unknown) => void }).updateTarget = state.originalUpdateTarget;
    stateMap.delete(binding);
  }
}
