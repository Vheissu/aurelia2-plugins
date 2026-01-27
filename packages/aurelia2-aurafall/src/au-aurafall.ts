import { bindable, customElement, watch } from 'aurelia';
import template from './au-aurafall.template';
import { buildSpaces, computeColumnCount, computeItemWidth, selectVisibleSpaces } from './waterfall-layout';
import type { PaddingOption, PreloadScreenCount, SpaceOption } from './types';

// Important: use a non-noop coercer to avoid noop identity mismatches when
// different Aurelia entry points are optimized separately by Vite/Vitest.
const identity = <T>(value: T): T => value;

interface IdleDeadline {
  readonly didTimeout: boolean;
  timeRemaining(): number;
}

type IdleRequestCallback = (deadline: IdleDeadline) => void;
type IdleRequestOptions = { timeout?: number };

@customElement({
  name: 'au-aurafall',
  template,
  dependencies: [],
})
export class AuAurafallCustomElement {
  private host: HTMLElement | null = null;
  private contentWidth = 0;
  private columnCount = 0;
  private columnsTop: number[] = [];
  private itemSpaces: SpaceOption[] = [];
  private scrollOffset = 0;
  private contentOffset = 0;
  private viewportHeight = 0;
  private pendingLayout = false;
  private pendingScroll = false;
  private cacheValid = false;
  private isAttached = false;
  private isVisible = true;
  private idleHandle?: number;
  private resizeObserver?: ResizeObserver;
  private containerResizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private scrollContainer: HTMLElement | Window | null = null;
  private debugScrollEvents = 0;
  private debugRenderCycles = 0;
  private debugLastRenderCount = 0;
  private debugLastRenderMs = 0;
  private debugLastLayoutMs = 0;

  @bindable({ set: identity }) public virtual = true;
  @bindable({ set: identity }) public rowKey = 'id';
  @bindable({ set: identity }) public enableCache = true;
  @bindable({ set: identity }) public gap = 15;
  @bindable({ set: identity }) public padding: PaddingOption = 15;
  @bindable({ set: identity }) public preloadScreenCount: PreloadScreenCount = [0, 0];
  @bindable({ set: identity }) public itemMinWidth = 220;
  @bindable({ set: identity }) public maxColumnCount = 10;
  @bindable({ set: identity }) public minColumnCount = 2;
  @bindable({ set: identity }) public items: unknown[] = [];
  @bindable({ set: identity })
  public calcItemHeight: (item: unknown, itemWidth: number) => number = () => 250;
  @bindable({ set: identity }) public scrollTarget?: HTMLElement | Window | 'window';
  @bindable({ set: identity }) public useIdleLayout = true;
  @bindable({ set: identity }) public idleLayoutThreshold = 120;
  @bindable({ set: identity }) public idleLayoutTimeout = 200;
  @bindable({ set: identity }) public debug = false;

  public content?: HTMLDivElement;
  public itemRenderList: SpaceOption[] = [];
  public itemWidth = 0;
  public contentHeight = 0;

  public attached(): void {
    this.isAttached = true;
    this.ensureHost();
    this.bindScrollContainer();
    this.bindIntersectionObserver();
    this.bindResizeObservers();
    this.updateContentWidth();
    this.updateScrollMetrics(true);
    this.scheduleLayout();
  }

  public detached(): void {
    this.isAttached = false;
    this.unbindScrollContainer();
    this.disconnectObservers();
  }

  public scrollTargetChanged(): void {
    if (!this.isAttached) return;
    this.bindScrollContainer();
    this.bindIntersectionObserver();
    this.updateScrollMetrics(true);
    this.updateRenderList();
  }

  public itemsChanged(): void {
    this.cacheValid = false;
    this.scheduleLayout();
  }

  @watch((x: AuAurafallCustomElement) => x.items?.length)
  protected handleItemsLengthChanged(): void {
    this.scheduleLayout();
  }

  @watch((x: AuAurafallCustomElement) => x.calcItemHeight)
  protected handleCalcItemHeightChanged(): void {
    this.invalidateLayout();
  }

  @watch((x: AuAurafallCustomElement) => x.gap)
  protected handleGapChanged(): void {
    this.invalidateLayout();
  }

  @watch((x: AuAurafallCustomElement) => x.itemMinWidth)
  protected handleItemMinWidthChanged(): void {
    this.invalidateLayout();
  }

  @watch((x: AuAurafallCustomElement) => x.maxColumnCount)
  protected handleMaxColumnCountChanged(): void {
    this.invalidateLayout();
  }

  @watch((x: AuAurafallCustomElement) => x.minColumnCount)
  protected handleMinColumnCountChanged(): void {
    this.invalidateLayout();
  }

  @watch((x: AuAurafallCustomElement) => x.preloadScreenCount?.join(','))
  protected handlePreloadChanged(): void {
    this.updateRenderList();
  }

  public virtualChanged(): void {
    this.updateRenderList();
  }

  public withItemSpaces(cb: (spaces: readonly SpaceOption[]) => Promise<void> | void): void {
    cb(Object.freeze([...this.itemSpaces]));
  }

  public refreshLayout(): void {
    this.updateContentWidth();
    this.updateScrollMetrics(true);
    this.recalculateSpaces();
  }

  public get contentStyle(): string {
    const padding = this.formatPadding(this.padding);
    return `position: relative; will-change: height; height: ${this.contentHeight}px; padding: ${padding};`;
  }

  public itemStyle(space: SpaceOption): string {
    return `width: ${this.itemWidth}px; height: ${space.height}px; transform: translate3d(${space.left}px, ${space.top}px, 0); contain-intrinsic-size: ${this.itemWidth}px ${space.height}px;`;
  }

  public getSpaceKey(space: SpaceOption): unknown {
    const item = space.item as Record<string, unknown> | null | undefined;
    if (item && this.rowKey && item[this.rowKey] != null) {
      return item[this.rowKey];
    }
    return space.index;
  }

  private bindResizeObservers(): void {
    if (!this.content || typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect?.width ?? this.measureContentWidth();
      if (width !== this.contentWidth) {
        this.contentWidth = width;
        this.invalidateLayout();
      }
    });

    this.resizeObserver.observe(this.content);

    const container = this.scrollContainer;
    if (container instanceof HTMLElement) {
      this.containerResizeObserver = new ResizeObserver(() => {
        this.updateScrollMetrics(true);
        this.updateRenderList();
      });
      this.containerResizeObserver.observe(container);
    }

    window.addEventListener('resize', this.handleWindowResize, { passive: true });
  }

  private disconnectObservers(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.containerResizeObserver?.disconnect();
    this.containerResizeObserver = undefined;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    this.cancelIdle();
    window.removeEventListener('resize', this.handleWindowResize);
  }

  private bindScrollContainer(): void {
    this.unbindScrollContainer();
    this.scrollContainer = this.resolveScrollContainer();
    if (this.scrollContainer) {
      this.scrollContainer.addEventListener('scroll', this.handleScroll, { passive: true });
      this.scrollContainer.addEventListener('scrollend', this.handleScrollEnd, { passive: true });
    }
  }

  private unbindScrollContainer(): void {
    if (!this.scrollContainer) return;
    this.scrollContainer.removeEventListener('scroll', this.handleScroll);
    this.scrollContainer.removeEventListener('scrollend', this.handleScrollEnd);
    this.scrollContainer = null;
  }

  private resolveScrollContainer(): HTMLElement | Window {
    if (this.scrollTarget === 'window') return window;
    if (this.scrollTarget instanceof Window) return this.scrollTarget;
    if (this.scrollTarget instanceof HTMLElement) return this.scrollTarget;

    this.ensureHost();
    return this.host ?? window;
  }

  private handleScroll = (): void => {
    if (!this.isVisible) return;
    if (this.pendingScroll) return;
    if (this.debug) {
      this.debugScrollEvents += 1;
    }
    this.pendingScroll = true;

    this.requestFrame(() => {
      this.pendingScroll = false;
      this.updateScrollMetrics(false);
      this.updateRenderList();
    });
  };

  private handleWindowResize = (): void => {
    this.updateScrollMetrics(true);
    this.updateRenderList();
  };

  private handleScrollEnd = (): void => {
    if (!this.debug) return;
    const metrics = {
      scrollEvents: this.debugScrollEvents,
      renderCycles: this.debugRenderCycles,
      lastRenderCount: this.debugLastRenderCount,
      lastRenderMs: this.debugLastRenderMs,
      lastLayoutMs: this.debugLastLayoutMs,
      scrollOffset: this.scrollOffset,
      viewportHeight: this.viewportHeight,
    };
    console.debug('[au-aurafall] scrollend', metrics);
    this.debugScrollEvents = 0;
    this.debugRenderCycles = 0;
  };

  private updateContentWidth(): void {
    const width = this.measureContentWidth();
    if (width !== this.contentWidth) {
      this.contentWidth = width;
      this.invalidateLayout();
    }
  }

  private measureContentWidth(): number {
    if (!this.content) return 0;
    let width = this.content.clientWidth;
    if (!width && typeof window !== 'undefined') {
      const styleWidth = window.getComputedStyle(this.content).width;
      const parsed = Number.parseFloat(styleWidth);
      if (!Number.isNaN(parsed)) {
        width = parsed;
      }
    }
    return width;
  }

  private updateScrollMetrics(forceMeasure: boolean): void {
    if (!this.content) return;

    if (this.scrollContainer instanceof HTMLElement) {
      const container = this.scrollContainer;
      if (forceMeasure) {
        const containerRect = container.getBoundingClientRect();
        const contentRect = this.content.getBoundingClientRect();
        this.contentOffset = contentRect.top - containerRect.top + container.scrollTop;
        this.viewportHeight = container.clientHeight || this.getFallbackHeight(container);
      }
      this.scrollOffset = container.scrollTop - this.contentOffset;
      return;
    }

    const scrollY = typeof window !== 'undefined' ? (window.scrollY || window.pageYOffset || 0) : 0;
    if (forceMeasure) {
      const contentRect = this.content.getBoundingClientRect();
      this.contentOffset = contentRect.top + scrollY;
      const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
      this.viewportHeight = viewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 0);
    }
    this.scrollOffset = scrollY - this.contentOffset;
  }

  private getFallbackHeight(container: HTMLElement): number {
    if (!container) return 0;
    const styleHeight = window.getComputedStyle(container).height;
    const parsed = Number.parseFloat(styleHeight);
    if (!Number.isNaN(parsed)) return parsed;
    return container.clientHeight;
  }

  private scheduleLayout(): void {
    if (this.pendingLayout) return;
    this.pendingLayout = true;

    const run = (): void => {
      this.pendingLayout = false;
      this.recalculateSpaces();
    };

    if (this.shouldUseIdleLayout()) {
      this.requestIdle(run, this.idleLayoutTimeout);
      return;
    }

    queueMicrotask(run);
  }

  private invalidateLayout(): void {
    this.cacheValid = false;
    this.scheduleLayout();
  }

  private recalculateSpaces(): void {
    const start = this.debug ? this.now() : 0;
    const nextColumnCount = computeColumnCount(
      this.contentWidth,
      this.itemMinWidth,
      this.maxColumnCount,
      this.minColumnCount
    );
    const nextItemWidth = computeItemWidth(this.contentWidth, nextColumnCount, this.gap);

    if (nextColumnCount !== this.columnCount) {
      this.columnCount = nextColumnCount;
      this.cacheValid = false;
    }

    if (nextItemWidth !== this.itemWidth) {
      this.itemWidth = nextItemWidth;
      this.cacheValid = false;
    }

    if (!nextColumnCount || !this.items.length || !nextItemWidth) {
      this.itemSpaces = [];
      this.itemRenderList = [];
      this.columnsTop = new Array(nextColumnCount).fill(0);
      this.contentHeight = 0;
      return;
    }

    const useCache =
      this.enableCache &&
      this.cacheValid &&
      this.itemSpaces.length > 0 &&
      this.items.length > this.itemSpaces.length;

    const startIndex = useCache ? this.itemSpaces.length : 0;

    const { spaces, columnsTop } = buildSpaces({
      items: this.items,
      itemWidth: this.itemWidth,
      columnCount: this.columnCount,
      gap: this.gap,
      calcItemHeight: this.calcItemHeight,
      startIndex,
      previousSpaces: useCache ? this.itemSpaces : undefined,
      columnsTop: useCache ? this.columnsTop : undefined,
    });

    this.itemSpaces = spaces;
    this.columnsTop = columnsTop;
    this.contentHeight = Math.max(0, ...columnsTop);
    this.cacheValid = true;

    this.updateRenderList();
    if (this.debug) {
      this.debugLastLayoutMs = this.now() - start;
    }
  }

  private updateRenderList(): void {
    if (!this.itemSpaces.length) {
      this.itemRenderList = [];
      return;
    }

    if (!this.isVisible) {
      this.itemRenderList = [];
      return;
    }

    if (!this.virtual || this.viewportHeight <= 0) {
      this.itemRenderList = this.itemSpaces.slice();
      return;
    }

    const start = this.debug ? this.now() : 0;
    this.itemRenderList = selectVisibleSpaces(
      this.itemSpaces,
      this.scrollOffset,
      this.viewportHeight,
      this.preloadScreenCount
    );
    if (this.debug) {
      this.debugRenderCycles += 1;
      this.debugLastRenderCount = this.itemRenderList.length;
      this.debugLastRenderMs = this.now() - start;
    }
  }

  private formatPadding(value: PaddingOption): string {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `${value}px`;
    }
    if (value == null) return '0px';
    return String(value);
  }

  private requestFrame(cb: () => void): void {
    const raf = globalThis.requestAnimationFrame?.bind(globalThis);
    if (raf) {
      raf(() => cb());
    } else {
      globalThis.setTimeout(() => cb(), 16);
    }
  }

  private shouldUseIdleLayout(): boolean {
    if (!this.useIdleLayout) return false;
    if (this.items.length < this.idleLayoutThreshold) return false;
    return typeof globalThis.requestIdleCallback === 'function';
  }

  private requestIdle(cb: () => void, timeout: number): void {
    const ric = (globalThis as { requestIdleCallback?: (c: IdleRequestCallback, o?: IdleRequestOptions) => number })
      .requestIdleCallback;
    if (!ric) {
      queueMicrotask(cb);
      return;
    }
    this.cancelIdle();
    this.idleHandle = ric(() => cb(), { timeout });
  }

  private cancelIdle(): void {
    const cancel = (globalThis as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
    if (this.idleHandle != null && cancel) {
      cancel(this.idleHandle);
    }
    this.idleHandle = undefined;
  }

  private now(): number {
    const perf = globalThis.performance;
    if (perf?.now) return perf.now();
    return Date.now();
  }

  private bindIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.ensureHost();
    if (!this.host) return;

    this.intersectionObserver?.disconnect();
    const root =
      this.scrollContainer instanceof HTMLElement && this.scrollContainer !== this.host
        ? this.scrollContainer
        : null;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const wasVisible = this.isVisible;
        this.isVisible = entry.isIntersecting;
        if (this.isVisible && !wasVisible) {
          this.updateScrollMetrics(true);
          this.updateRenderList();
        }
      },
      { root }
    );

    this.intersectionObserver.observe(this.host);
  }

  private ensureHost(): void {
    if (this.host) return;
    const controller = (this as unknown as { $controller?: { host?: HTMLElement } }).$controller;
    if (controller?.host) {
      this.host = controller.host;
    }
  }
}
