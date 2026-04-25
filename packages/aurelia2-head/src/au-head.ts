import { bindable, customElement, resolve } from 'aurelia';
import { IHeadManager } from './head-manager';
import type {
  HeadAttributes,
  HeadHandle,
  HeadLinkDefinition,
  HeadMetaInput,
  HeadState,
} from './types';

const identity = <T>(value: T): T => value;

@customElement({
  name: 'au-head',
  template: '',
})
export class AuHeadCustomElement {
  @bindable public title: string | null = null;
  @bindable public titleTemplate: string | null = null;
  @bindable({ set: identity }) public meta: HeadMetaInput = null;
  @bindable({ set: identity }) public links: HeadLinkDefinition[] | null = null;
  @bindable({ set: identity }) public htmlAttrs: HeadAttributes | null = null;
  @bindable({ set: identity }) public bodyAttrs: HeadAttributes | null = null;

  private readonly head = resolve(IHeadManager);
  private handle: HeadHandle | null = null;
  private isBound = false;

  public binding(): void {
    this.isBound = true;
    this.sync();
  }

  public detaching(): void {
    this.dispose();
  }

  public detached(): void {
    this.dispose();
  }

  public unbinding(): void {
    this.dispose();
  }

  private dispose(): void {
    this.handle?.dispose();
    this.handle = null;
    this.isBound = false;
  }

  public titleChanged(): void {
    this.sync();
  }

  public titleTemplateChanged(): void {
    this.sync();
  }

  public metaChanged(): void {
    this.sync();
  }

  public linksChanged(): void {
    this.sync();
  }

  public htmlAttrsChanged(): void {
    this.sync();
  }

  public bodyAttrsChanged(): void {
    this.sync();
  }

  private sync(): void {
    if (!this.isBound) return;

    const state: HeadState = {
      title: this.title,
      titleTemplate: this.titleTemplate,
      meta: this.meta,
      links: this.links,
      htmlAttrs: this.htmlAttrs,
      bodyAttrs: this.bodyAttrs,
    };

    if (this.handle) {
      this.handle.update(state);
      return;
    }

    this.handle = this.head.apply(state);
  }
}
