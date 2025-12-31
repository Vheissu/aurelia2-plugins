import { observable } from 'aurelia';
import type { QueryStatus } from './types';

export class QueryResult<T = unknown> {
  @observable public data: T | null = null;
  @observable public error: unknown = null;
  @observable public status: QueryStatus = 'idle';
  @observable public loading: boolean = false;
  @observable public stale: boolean = true;
  @observable public updatedAt: number = 0;

  private _refetch?: () => Promise<T>;
  private _invalidate?: () => void;

  public refetch(): Promise<T> | undefined {
    return this._refetch?.();
  }

  public invalidate(): void {
    this._invalidate?.();
  }

  public _setCallbacks(refetch: () => Promise<T>, invalidate: () => void): void {
    this._refetch = refetch;
    this._invalidate = invalidate;
  }

  public _apply(data: T | null, error: unknown, status: QueryStatus, stale: boolean, updatedAt: number): void {
    this.data = data;
    this.error = error;
    this.status = status;
    this.loading = status === 'loading';
    this.stale = stale;
    this.updatedAt = updatedAt;
  }

  public _reset(): void {
    this._apply(null, null, 'idle', true, 0);
  }
}
