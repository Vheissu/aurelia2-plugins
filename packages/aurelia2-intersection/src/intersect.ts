import { bindable, BindingMode, customAttribute, INode, resolve } from 'aurelia';
import { IIntersectionService } from './intersection-service';
import type { IntersectionCallback, IntersectionChange, IntersectionDispose } from './types';

@customAttribute({ name: 'intersect', defaultProperty: 'callback' })
export class IntersectCustomAttribute {
  @bindable public callback: IntersectionCallback | null = null;
  @bindable({ mode: BindingMode.twoWay }) public visible = false;
  @bindable({ mode: BindingMode.twoWay }) public detail: IntersectionChange | null = null;
  @bindable public once = false;
  @bindable public disabled = false;
  @bindable public root: Element | null = null;
  @bindable public rootMargin: string | null = null;
  @bindable public threshold: number | number[] | string | null = null;

  private readonly element = resolve(INode) as HTMLElement;
  private readonly observer = resolve(IIntersectionService);
  private disposable: IntersectionDispose | null = null;
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

  public rootChanged(): void {
    this.restart();
  }

  public rootMarginChanged(): void {
    this.restart();
  }

  public thresholdChanged(): void {
    this.restart();
  }

  private restart(): void {
    if (!this.isAttached) return;
    this.stop();
    if (this.disabled) return;

    this.disposable = this.observer.observe(this.element, this.handleChange, {
      root: this.root,
      rootMargin: this.rootMargin ?? undefined,
      threshold: normalizeThreshold(this.threshold),
    });
  }

  private stop(): void {
    this.disposable?.dispose();
    this.disposable = null;
  }

  private handleChange = (change: IntersectionChange): void => {
    this.visible = change.visible;
    this.detail = change;
    this.callback?.(change);
    this.element.dispatchEvent(new CustomEvent('intersection-change', {
      bubbles: true,
      detail: change,
    }));

    if (this.once && change.visible) {
      this.stop();
    }
  };
}

export function normalizeThreshold(value: number | number[] | string | null): number | number[] | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'number') {
    return value;
  }

  const parts = value.split(',').map((part) => Number(part.trim())).filter((part) => !Number.isNaN(part));
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : parts;
}
