import { bindable, BindingMode, customAttribute, INode, resolve } from 'aurelia';
import { IResizeService } from './resize-service';
import type { ResizeCallback, ResizeChange, ResizeDispose } from './types';

@customAttribute({ name: 'resize', defaultProperty: 'callback' })
export class ResizeCustomAttribute {
  @bindable public callback: ResizeCallback | null = null;
  @bindable({ mode: BindingMode.twoWay }) public width = 0;
  @bindable({ mode: BindingMode.twoWay }) public height = 0;
  @bindable({ mode: BindingMode.twoWay }) public detail: ResizeChange | null = null;
  @bindable public box: ResizeObserverBoxOptions | null = null;
  @bindable public disabled = false;

  private readonly element = resolve(INode) as HTMLElement;
  private readonly resize = resolve(IResizeService);
  private disposable: ResizeDispose | null = null;
  private isAttached = false;

  public attached(): void {
    this.isAttached = true;
    this.restart();
  }

  public detached(): void {
    this.isAttached = false;
    this.stop();
  }

  public disabledChanged(): void {
    this.restart();
  }

  public boxChanged(): void {
    this.restart();
  }

  private restart(): void {
    if (!this.isAttached) return;
    this.stop();
    if (this.disabled) return;

    this.disposable = this.resize.observe(this.element, this.handleResize, this.box ?? undefined);
  }

  private stop(): void {
    this.disposable?.dispose();
    this.disposable = null;
  }

  private handleResize = (change: ResizeChange): void => {
    this.width = change.width;
    this.height = change.height;
    this.detail = change;
    this.callback?.(change);
    this.element.dispatchEvent(new CustomEvent('resize-change', {
      bubbles: true,
      detail: change,
    }));
  };
}
