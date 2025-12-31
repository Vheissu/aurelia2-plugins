import { bindable, BindingMode, customElement } from 'aurelia';
import { resolve } from '@aurelia/kernel';
import template from './au-query.html';
import { IQueryClient, QueryClient } from './query-client';
import { QueryObserver } from './query-observer';
import { QueryResult } from './query-result';
import type { QueryDefinition } from './types';

@customElement({
  name: 'au-query',
  template,
})
export class AuQueryCustomElement {
  @bindable({ primary: true }) public query: QueryDefinition | null = null;
  @bindable({ mode: BindingMode.twoWay }) public result: QueryResult | null = null;

  private readonly client: QueryClient;
  private observer: QueryObserver | null = null;

  public constructor() {
    this.client = resolve(IQueryClient) as QueryClient;
  }

  public binding(): void {
    if (this.result == null) {
      this.result = new QueryResult();
    }
    this.observer = new QueryObserver(this.client, this.result);
    this.observer.setOptions(this.query);
  }

  public queryChanged(newValue: QueryDefinition | null): void {
    this.observer?.setOptions(newValue);
  }

  public resultChanged(newValue: QueryResult | null): void {
    if (!newValue) return;
    this.observer?.dispose();
    this.observer = new QueryObserver(this.client, newValue);
    this.observer.setOptions(this.query);
  }

  public detached(): void {
    this.observer?.dispose();
  }
}
