import { bindable, BindingMode, customElement, IContainer, INode, resolve } from 'aurelia';

export interface PaneLimits {
  min: number;
  max: number;
}
/** Over-constrained panes share the available space proportionally. */
export function paneLimits(available: number, minFirst: number, minSecond: number): PaneLimits {
  if (![available, minFirst, minSecond].every((n) => Number.isFinite(n) && n >= 0))
    throw new Error('Pane sizes must be finite and non-negative');
  if (minFirst + minSecond > available) {
    const size = (available * minFirst) / (minFirst + minSecond);
    return { min: size, max: size };
  }
  return { min: minFirst, max: available - minSecond };
}
let nextId = 0;
@customElement({
  name: 'au-split-pane',
  template: `<div ref="layout" style="display:flex;width:100%;height:100%;overflow:hidden" flex-direction.style="orientation === 'horizontal' ? 'row' : 'column'">
  <div id.bind="firstId" style="min-width:0;min-height:0;overflow:auto;flex-shrink:0;flex-grow:0" flex-basis.style="firstSize + 'px'"><au-slot name="first"></au-slot></div>
  <div ref="separator" role="separator" tabindex.bind="disabled ? -1 : 0" aria-label.bind="label" aria-controls.bind="firstId"
    aria-orientation.bind="orientation === 'horizontal' ? 'vertical' : 'horizontal'" aria-valuenow.bind="Math.round(ratio * 100)" aria-valuemin.bind="minPercent" aria-valuemax.bind="maxPercent"
    aria-disabled.bind="disabled ? 'true' : null" style="flex:0 0 8px;touch-action:none;user-select:none;background:rgba(127,127,127,.3)"
    cursor.style="disabled ? 'default' : orientation === 'horizontal' ? 'col-resize' : 'row-resize'"
    pointerdown.trigger="pointerdown($event)" pointermove.trigger="pointermove($event)" pointerup.trigger="pointerup($event)" pointercancel.trigger="pointercancel($event)" lostpointercapture.trigger="pointerup($event)" keydown.trigger="keydown($event)"></div>
  <div style="min-width:0;min-height:0;overflow:auto;flex:1 1 0"><au-slot name="second"></au-slot></div>
</div>`,
})
export class AuSplitPane {
  @bindable({ mode: BindingMode.twoWay }) ratio = 0.5;
  @bindable orientation: 'horizontal' | 'vertical' = 'horizontal';
  @bindable minFirst = 80;
  @bindable minSecond = 80;
  @bindable step = 10;
  @bindable label = 'Resize panes';
  @bindable({ set: (value) => value === true || value === '' || value === 'true' }) disabled =
    false;
  firstSize = 0;
  minPercent = 0;
  maxPercent = 100;
  readonly firstId = `au-pane-${++nextId}`;
  readonly Math = Math;
  layout!: HTMLElement;
  separator!: HTMLElement;
  private readonly host = resolve(INode) as HTMLElement;
  private available = 0;
  private limits: PaneLimits = { min: 0, max: 0 };
  private active = false;
  private observer?: ResizeObserver;
  private drag?: { pointer: number; coordinate: number; last: number; size: number; ratio: number };
  attached(): void {
    this.active = true;
    const Observer = this.host.ownerDocument.defaultView?.ResizeObserver;
    if (Observer) {
      this.observer = new Observer(() => this.refresh());
      this.observer.observe(this.layout);
    }
    this.refresh();
  }
  refresh(): void {
    if (!this.active) return;
    if (!['horizontal', 'vertical'].includes(this.orientation))
      throw new Error('Invalid split orientation');
    if (!Number.isFinite(Number(this.step)) || Number(this.step) <= 0)
      throw new Error('Resize step must be positive');
    const rect = this.layout.getBoundingClientRect();
    const previousAvailable = this.available;
    this.available = Math.max(
      0,
      (this.orientation === 'horizontal'
        ? this.layout.clientWidth || rect.width
        : this.layout.clientHeight || rect.height) - 8,
    );
    this.limits = paneLimits(this.available, Number(this.minFirst), Number(this.minSecond));
    this.minPercent = this.available ? Math.round((this.limits.min / this.available) * 100) : 0;
    this.maxPercent = this.available ? Math.round((this.limits.max / this.available) * 100) : 100;
    if (!Number.isFinite(Number(this.ratio))) throw new Error('Pane ratio must be finite');
    this.apply(Number(this.ratio) * this.available, false);
    if (this.drag && this.available !== previousAvailable) {
      this.drag.size = this.firstSize;
      this.drag.coordinate = this.drag.last;
    }
  }
  ratioChanged(): void {
    this.refresh();
  }
  orientationChanged(): void {
    this.cancelDrag();
    this.refresh();
  }
  minFirstChanged(): void {
    this.refresh();
  }
  minSecondChanged(): void {
    this.refresh();
  }
  stepChanged(): void {
    this.refresh();
  }
  disabledChanged(): void {
    if (this.disabled) this.cancelDrag();
  }
  private apply(size: number, notify = true): void {
    this.firstSize = Math.max(this.limits.min, Math.min(this.limits.max, size));
    if (this.available > 0) this.ratio = this.firstSize / this.available;
    if (notify) this.emit('pane-resize');
  }
  private emit(name: string): void {
    this.host.dispatchEvent(
      new CustomEvent(name, {
        bubbles: true,
        detail: {
          ratio: this.ratio,
          first: this.firstSize,
          second: this.available - this.firstSize,
        },
      }),
    );
  }
  private coordinate(event: PointerEvent): number {
    const rect = this.layout.getBoundingClientRect();
    if (this.orientation === 'horizontal')
      return (
        event.clientX * (rect.width ? (this.layout.offsetWidth || rect.width) / rect.width : 1)
      );
    return (
      event.clientY * (rect.height ? (this.layout.offsetHeight || rect.height) / rect.height : 1)
    );
  }
  private sign(): number {
    return this.orientation === 'horizontal' &&
      this.host.ownerDocument.defaultView!.getComputedStyle(this.layout).direction === 'rtl'
      ? -1
      : 1;
  }
  pointerdown(event: PointerEvent): void {
    if (this.disabled || event.button !== 0 || event.defaultPrevented || this.drag) return;
    event.preventDefault();
    this.drag = {
      pointer: event.pointerId,
      coordinate: this.coordinate(event),
      last: this.coordinate(event),
      size: this.firstSize,
      ratio: this.ratio,
    };
    this.separator.setPointerCapture?.(event.pointerId);
    this.separator.focus();
  }
  pointermove(event: PointerEvent): void {
    if (this.drag?.pointer !== event.pointerId) return;
    this.drag.last = this.coordinate(event);
    this.apply(this.drag.size + (this.drag.last - this.drag.coordinate) * this.sign());
  }
  pointerup(event: PointerEvent): void {
    if (this.drag?.pointer !== event.pointerId) return;
    this.release();
    this.emit('pane-resize-end');
  }
  pointercancel(event: PointerEvent): void {
    if (this.drag?.pointer === event.pointerId) this.cancelDrag();
  }
  private release(): void {
    const id = this.drag?.pointer;
    this.drag = undefined;
    if (id !== undefined && this.separator.hasPointerCapture?.(id))
      this.separator.releasePointerCapture(id);
  }
  private cancelDrag(): void {
    if (this.drag) {
      const ratio = this.drag.ratio;
      this.release();
      this.apply(ratio * this.available);
    }
  }
  keydown(event: KeyboardEvent): void {
    if (
      this.disabled ||
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const backward = this.orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    const forward = this.orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    if (event.key === 'Home') this.apply(this.limits.min);
    else if (event.key === 'End') this.apply(this.limits.max);
    else if (event.key === backward || event.key === forward)
      this.apply(
        this.firstSize +
          (event.key === forward ? 1 : -1) *
            Number(this.step) *
            (event.shiftKey ? 10 : 1) *
            this.sign(),
      );
    else if (event.key === 'Escape' && this.drag) this.cancelDrag();
    else return;
    event.preventDefault();
    this.emit('pane-resize-end');
  }
  detaching(): void {
    this.active = false;
    this.observer?.disconnect();
    this.observer = undefined;
    this.release();
  }
}
export const AureliaSplitPaneConfiguration = {
  register(container: IContainer) {
    return container.register(AuSplitPane);
  },
};
