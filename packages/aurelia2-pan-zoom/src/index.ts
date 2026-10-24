import {
  bindable,
  BindingMode,
  customElement,
  IContainer,
  IEffect,
  INode,
  IObservation,
  queueTask,
  resolve,
} from 'aurelia';

export interface Point {
  x: number;
  y: number;
}
export interface Transform extends Point {
  scale: number;
}
export interface ViewportBounds {
  width: number;
  height: number;
  contentWidth: number;
  contentHeight: number;
  minScale: number;
  maxScale: number;
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function constrain(transform: Transform, bounds: ViewportBounds): Transform {
  if (
    !Object.values(bounds).every((v) => Number.isFinite(v) && v > 0) ||
    bounds.minScale > bounds.maxScale ||
    ![transform.x, transform.y, transform.scale].every(Number.isFinite)
  )
    throw new Error('Invalid viewport dimensions or transform');
  const scale = clamp(transform.scale, bounds.minScale, bounds.maxScale);
  const width = bounds.contentWidth * scale;
  const height = bounds.contentHeight * scale;
  return {
    scale,
    x:
      width <= bounds.width
        ? (bounds.width - width) / 2
        : clamp(transform.x, bounds.width - width, 0),
    y:
      height <= bounds.height
        ? (bounds.height - height) / 2
        : clamp(transform.y, bounds.height - height, 0),
  };
}
export function zoomAt(
  transform: Transform,
  scale: number,
  point: Point,
  bounds: ViewportBounds,
): Transform {
  if (
    !Number.isFinite(scale) ||
    !Number.isFinite(transform.scale) ||
    transform.scale <= 0 ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y)
  )
    throw new Error('Invalid zoom transform or anchor');
  const next = clamp(scale, bounds.minScale, bounds.maxScale);
  return constrain(
    {
      scale: next,
      x: point.x - ((point.x - transform.x) * next) / transform.scale,
      y: point.y - ((point.y - transform.y) * next) / transform.scale,
    },
    bounds,
  );
}
@customElement({
  name: 'au-pan-zoom',
  template: `<div ref="viewport" tabindex="0" role="region" aria-label.bind="label"
  style="position:relative;overflow:hidden;width:100%;height:100%" touch-action.style="disabled ? 'auto' : 'none'"
  pointerdown.trigger="pointerdown($event)" pointermove.trigger="pointermove($event)" pointerup.trigger="pointerup($event)" pointercancel.trigger="pointerup($event)" lostpointercapture.trigger="pointerup($event)" keydown.trigger="keydown($event)">
  <div transform.style="'translate(' + transform.x + 'px,' + transform.y + 'px) scale(' + transform.scale + ')'"
    width.style="contentWidth + 'px'" height.style="contentHeight + 'px'" style="transform-origin:0 0"><au-slot></au-slot></div>
</div>`,
})
export class AuPanZoom {
  @bindable({ mode: BindingMode.twoWay }) transform: Transform = { x: 0, y: 0, scale: 1 };
  @bindable contentWidth = 1000;
  @bindable contentHeight = 1000;
  @bindable minScale = 0.1;
  @bindable maxScale = 8;
  @bindable label = 'Pan and zoom canvas';
  @bindable({ set: (value) => value === true || value === '' || value === 'true' }) disabled =
    false;
  viewport!: HTMLElement;
  private readonly host = resolve(INode) as HTMLElement;
  private pointers = new Map<number, Point>();
  private readonly observation = resolve(IObservation);
  private effect?: IEffect;
  private observer?: ResizeObserver;
  private attachedView = false;
  private limitsQueued = false;
  private readonly wheel = (event: WheelEvent) => {
    if (this.disabled || !event.ctrlKey || event.defaultPrevented) return;
    event.preventDefault();
    const delta =
      event.deltaY *
      (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.viewport.clientHeight : 1);
    this.set(
      zoomAt(
        this.transform,
        this.transform.scale * Math.exp(-clamp(delta, -500, 500) / 300),
        this.local(event),
        this.bounds(),
      ),
    );
  };
  attached(): void {
    this.attachedView = true;
    this.viewport.addEventListener('wheel', this.wheel, { passive: false });
    const Observer = this.host.ownerDocument.defaultView?.ResizeObserver;
    if (Observer) {
      this.observer = new Observer(() => this.refresh());
      this.observer.observe(this.viewport);
    }
    this.refresh();
    this.effect = this.observation.watch(
      this,
      (vm) => [vm.transform.x, vm.transform.y, vm.transform.scale],
      () => this.refresh(),
      { immediate: false },
    );
  }
  private bounds(): ViewportBounds {
    const rect = this.viewport.getBoundingClientRect();
    return {
      width: Math.max(1, this.viewport.clientWidth || rect.width),
      height: Math.max(1, this.viewport.clientHeight || rect.height),
      contentWidth: Number(this.contentWidth),
      contentHeight: Number(this.contentHeight),
      minScale: Number(this.minScale),
      maxScale: Number(this.maxScale),
    };
  }
  refresh(): void {
    if (this.attachedView) this.set(constrain(this.transform, this.bounds()));
  }
  contentWidthChanged(): void {
    this.refresh();
  }
  contentHeightChanged(): void {
    this.refresh();
  }
  minScaleChanged(): void {
    this.refreshLimits();
  }
  maxScaleChanged(): void {
    this.refreshLimits();
  }
  private refreshLimits(): void {
    if (!this.attachedView || this.limitsQueued) return;
    this.limitsQueued = true;
    queueTask(() => {
      this.limitsQueued = false;
      this.refresh();
    });
  }
  transformChanged(): void {
    this.refresh();
  }
  disabledChanged(): void {
    if (this.disabled) this.releasePointers();
  }
  private set(value: Transform): void {
    if (
      value.x === this.transform.x &&
      value.y === this.transform.y &&
      value.scale === this.transform.scale
    )
      return;
    this.transform = value;
    this.host.dispatchEvent(
      new CustomEvent('pan-zoom-change', { bubbles: true, detail: { ...value } }),
    );
  }
  private local(point: { clientX: number; clientY: number }): Point {
    const rect = this.viewport.getBoundingClientRect();
    const scaleX = rect.width ? (this.viewport.offsetWidth || rect.width) / rect.width : 1;
    const scaleY = rect.height ? (this.viewport.offsetHeight || rect.height) / rect.height : 1;
    return {
      x: (point.clientX - rect.left) * scaleX - this.viewport.clientLeft,
      y: (point.clientY - rect.top) * scaleY - this.viewport.clientTop,
    };
  }
  screenToWorld(point: Point): Point {
    return {
      x: (point.x - this.transform.x) / this.transform.scale,
      y: (point.y - this.transform.y) / this.transform.scale,
    };
  }
  clientToWorld(point: { clientX: number; clientY: number }): Point {
    return this.screenToWorld(this.local(point));
  }
  worldToScreen(point: Point): Point {
    return {
      x: point.x * this.transform.scale + this.transform.x,
      y: point.y * this.transform.scale + this.transform.y,
    };
  }
  fit(): void {
    const bounds = this.bounds();
    const scale = Math.min(
      bounds.width / bounds.contentWidth,
      bounds.height / bounds.contentHeight,
    );
    this.set(constrain({ x: 0, y: 0, scale }, bounds));
  }
  pointerdown(event: PointerEvent): void {
    if (
      this.disabled ||
      event.button !== 0 ||
      event.defaultPrevented ||
      this.pointers.size >= 2 ||
      event
        .composedPath()
        .some(
          (target) =>
            target instanceof this.host.ownerDocument.defaultView!.Element &&
            (target as Element).closest(
              'button,input,textarea,select,a,label,summary,[role="button"],[contenteditable]:not([contenteditable="false"]),[data-pan-zoom-ignore]',
            ),
        )
    )
      return;
    event.preventDefault();
    this.pointers.set(event.pointerId, this.local(event));
    this.viewport.setPointerCapture?.(event.pointerId);
    this.viewport.focus();
  }
  pointermove(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId) || this.disabled) return;
    const before = [...this.pointers.values()];
    const previous = this.pointers.get(event.pointerId)!;
    const point = this.local(event);
    this.pointers.set(event.pointerId, point);
    const after = [...this.pointers.values()];
    if (after.length === 1)
      this.set(
        constrain(
          {
            ...this.transform,
            x: this.transform.x + point.x - previous.x,
            y: this.transform.y + point.y - previous.y,
          },
          this.bounds(),
        ),
      );
    else if (after.length === 2) {
      const distance = (p: Point[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const midpoint = (p: Point[]) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
      const oldMid = midpoint(before);
      const newMid = midpoint(after);
      const oldDistance = distance(before);
      if (oldDistance === 0) return;
      const bounds = this.bounds();
      const scale = clamp(
        (this.transform.scale * distance(after)) / oldDistance,
        bounds.minScale,
        bounds.maxScale,
      );
      this.set(
        constrain(
          {
            scale,
            x: newMid.x - ((oldMid.x - this.transform.x) * scale) / this.transform.scale,
            y: newMid.y - ((oldMid.y - this.transform.y) * scale) / this.transform.scale,
          },
          bounds,
        ),
      );
    }
  }
  pointerup(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    if (this.viewport.hasPointerCapture?.(event.pointerId))
      this.viewport.releasePointerCapture(event.pointerId);
  }
  keydown(event: KeyboardEvent): void {
    if (
      this.disabled ||
      event.defaultPrevented ||
      event.isComposing ||
      event.target !== this.viewport ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const directions: Record<string, Point> = {
      ArrowLeft: { x: 40, y: 0 },
      ArrowRight: { x: -40, y: 0 },
      ArrowUp: { x: 0, y: 40 },
      ArrowDown: { x: 0, y: -40 },
    };
    const direction = Object.hasOwn(directions, event.key) ? directions[event.key] : undefined;
    const bounds = this.bounds();
    if (direction)
      this.set(
        constrain(
          {
            ...this.transform,
            x: this.transform.x + direction.x,
            y: this.transform.y + direction.y,
          },
          bounds,
        ),
      );
    else if (['+', '=', '-'].includes(event.key))
      this.set(
        zoomAt(
          this.transform,
          this.transform.scale * (event.key === '-' ? 0.8 : 1.25),
          { x: bounds.width / 2, y: bounds.height / 2 },
          bounds,
        ),
      );
    else if (event.key === '0') this.fit();
    else return;
    event.preventDefault();
  }
  private releasePointers(): void {
    for (const id of this.pointers.keys())
      if (this.viewport?.hasPointerCapture?.(id)) this.viewport.releasePointerCapture(id);
    this.pointers.clear();
  }
  detaching(): void {
    this.attachedView = false;
    this.effect?.stop();
    this.effect = undefined;
    this.observer?.disconnect();
    this.observer = undefined;
    this.viewport.removeEventListener('wheel', this.wheel);
    this.releasePointers();
  }
}
export const AureliaPanZoomConfiguration = {
  register(container: IContainer) {
    return container.register(AuPanZoom);
  },
};
