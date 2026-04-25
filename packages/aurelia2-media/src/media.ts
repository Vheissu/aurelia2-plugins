import { bindable, BindingMode, customAttribute, INode, resolve } from 'aurelia';
import { IMediaService } from './media-service';
import type { MediaCallback, MediaChange, MediaDispose } from './types';

@customAttribute({ name: 'media', defaultProperty: 'query' })
export class MediaCustomAttribute {
  @bindable public query = '';
  @bindable({ mode: BindingMode.twoWay }) public matches = false;
  @bindable({ mode: BindingMode.twoWay }) public detail: MediaChange | null = null;
  @bindable public callback: MediaCallback | null = null;
  @bindable public className: string | null = null;
  @bindable public hide = false;
  @bindable public disabled = false;

  private readonly element = resolve(INode) as HTMLElement;
  private readonly media = resolve(IMediaService);
  private disposable: MediaDispose | null = null;
  private isAttached = false;

  public attached(): void {
    this.isAttached = true;
    this.restart();
  }

  public detached(): void {
    this.isAttached = false;
    this.stop();
  }

  public queryChanged(): void {
    this.restart();
  }

  public disabledChanged(): void {
    this.restart();
  }

  public classNameChanged(): void {
    this.applyState();
  }

  public hideChanged(): void {
    this.applyState();
  }

  private restart(): void {
    if (!this.isAttached) return;
    this.stop();

    if (this.disabled) {
      this.applyDisabledState();
      return;
    }

    this.disposable = this.media.observe(this.query, this.handleChange);
  }

  private stop(): void {
    this.disposable?.dispose();
    this.disposable = null;
  }

  private handleChange = (change: MediaChange): void => {
    this.matches = change.matches;
    this.detail = change;
    this.callback?.(change);
    this.applyState();
    this.element.dispatchEvent(new CustomEvent('media-change', {
      bubbles: true,
      detail: change,
    }));
  };

  private applyState(): void {
    if (this.className) {
      this.element.classList.toggle(this.className, this.matches);
    }

    if (this.hide) {
      this.element.hidden = !this.matches;
    }
  }

  private applyDisabledState(): void {
    if (this.className) {
      this.element.classList.remove(this.className);
    }
  }
}
