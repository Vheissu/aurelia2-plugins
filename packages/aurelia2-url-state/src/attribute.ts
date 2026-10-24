import { bindable, BindingMode, customAttribute, INode, IPlatform, resolve } from 'aurelia';
import { IUrlState, type UrlParams, type UrlStateEvent, type UrlStateHandle } from './url-state.js';

const identity = <T>(value: T): T => value;
const eventNames = {
  apply: 'url-state-apply',
  commit: 'url-state-commit',
  error: 'url-state-error',
} as const;

/**
 * `<section url-state="model.bind: filters; params.bind: params">`
 *
 * Connects in `binding`, so URL values reach the model before the view attaches, and disposes in
 * `unbinding`, which cancels pending writes. Dispatches bubbling `url-state-apply`,
 * `url-state-commit` and `url-state-error` events whose `detail` is the `UrlStateEvent`.
 */
@customAttribute('url-state')
export class UrlStateCustomAttribute {
  @bindable({ set: identity }) model: object | null = null;
  @bindable({ set: identity }) params: UrlParams<object> | null = null;
  /** The active handle, for `handle.from-view: state`. */
  @bindable({ mode: BindingMode.fromView, set: identity }) handle: UrlStateHandle | null = null;

  private readonly host = resolve(INode) as HTMLElement;
  private readonly platform = resolve(IPlatform);
  private readonly urlState = resolve(IUrlState);
  private active = false;

  binding(): void {
    this.active = true;
    this.connect();
  }

  modelChanged(): void {
    if (this.active) this.connect();
  }

  paramsChanged(): void {
    if (this.active) this.connect();
  }

  unbinding(): void {
    this.active = false;
    this.disconnect();
  }

  private connect(): void {
    this.disconnect();
    const { model, params } = this;
    if (model === null || model === undefined || params === null || params === undefined) return;
    this.handle = this.urlState.connect(model, params, {
      listener: (event) => this.dispatch(event),
    });
  }

  private disconnect(): void {
    this.handle?.dispose();
    this.handle = null;
  }

  private dispatch(event: UrlStateEvent): void {
    this.host.dispatchEvent(
      new this.platform.CustomEvent(eventNames[event.type], { bubbles: true, detail: event }),
    );
  }
}
