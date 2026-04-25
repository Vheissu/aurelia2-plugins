import { createFixture } from '@aurelia/testing';
import { AureliaIntersectionConfiguration, IIntersectionService, normalizeThreshold } from './../src/index';
import type { IntersectionChange } from './../src/index';

type ObserverCallback = IntersectionObserverCallback;

class FakeIntersectionObserver implements IntersectionObserver {
  public static instances: FakeIntersectionObserver[] = [];
  public readonly root: Element | Document | null;
  public readonly rootMargin: string;
  public readonly thresholds: ReadonlyArray<number>;
  public observed: Element[] = [];
  public disconnected = false;

  public constructor(
    private readonly callback: ObserverCallback,
    options: IntersectionObserverInit = {}
  ) {
    this.root = options.root ?? null;
    this.rootMargin = options.rootMargin ?? '0px';
    this.thresholds = Array.isArray(options.threshold)
      ? options.threshold
      : [options.threshold ?? 0];
    FakeIntersectionObserver.instances.push(this);
  }

  public observe(target: Element): void {
    this.observed.push(target);
  }

  public unobserve(target: Element): void {
    this.observed = this.observed.filter((entry) => entry !== target);
  }

  public disconnect(): void {
    this.disconnected = true;
    this.observed = [];
  }

  public takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  public emit(target: Element, visible: boolean, ratio = visible ? 1 : 0): void {
    this.callback([createEntry(target, visible, ratio)], this);
  }
}

function createEntry(target: Element, visible: boolean, ratio: number): IntersectionObserverEntry {
  const rect = target.getBoundingClientRect();
  return {
    boundingClientRect: rect,
    intersectionRatio: ratio,
    intersectionRect: rect,
    isIntersecting: visible,
    rootBounds: null,
    target,
    time: Date.now(),
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('aurelia2-intersection', () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: FakeIntersectionObserver,
    });
  });

  afterEach(() => {
    delete (globalThis as any).IntersectionObserver;
  });

  test('normalizes threshold strings', () => {
    expect(normalizeThreshold('0, 0.5, 1')).toEqual([0, 0.5, 1]);
    expect(normalizeThreshold('0.25')).toBe(0.25);
    expect(normalizeThreshold('')).toBeUndefined();
  });

  test('service observes elements and forwards visibility changes', async () => {
    const { container, appHost, startPromise, tearDown } = createFixture(
      '<div id="target"></div>',
      class {},
      [AureliaIntersectionConfiguration.configure({ rootMargin: '100px 0px', threshold: 0.5 })]
    );

    await startPromise;

    const target = appHost.querySelector('#target') as HTMLElement;
    const service = container.get(IIntersectionService);
    const callback = jest.fn();
    const handle = service.observe(target, callback);

    const observer = FakeIntersectionObserver.instances[0];
    expect(observer.rootMargin).toBe('100px 0px');
    expect(observer.thresholds).toEqual([0.5]);
    expect(observer.observed).toEqual([target]);

    observer.emit(target, true, 0.75);

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      target,
      visible: true,
      ratio: 0.75,
    }));

    handle.dispose();
    expect(observer.disconnected).toBe(true);

    await tearDown();
  });

  test('intersect attribute updates two-way visible state and dispatches events', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<div
        id="target"
        intersect="callback.bind: (change) => onIntersect(change); visible.two-way: visible; detail.two-way: latest; threshold: 0.25"
        intersection-change.trigger="onEvent($event.detail)">
      </div>`,
      class App {
        public visible = false;
        public latest: IntersectionChange | null = null;
        public callbackChange: IntersectionChange | null = null;
        public eventChange: IntersectionChange | null = null;

        public onIntersect(change: IntersectionChange): void {
          this.callbackChange = change;
        }

        public onEvent(change: IntersectionChange): void {
          this.eventChange = change;
        }
      },
      [AureliaIntersectionConfiguration]
    );

    await startPromise;

    const target = appHost.querySelector('#target') as HTMLElement;
    const observer = FakeIntersectionObserver.instances[0];
    observer.emit(target, true, 0.5);
    await flush();

    expect(component.visible).toBe(true);
    expect(component.latest?.ratio).toBe(0.5);
    expect(component.callbackChange?.visible).toBe(true);
    expect(component.eventChange?.target).toBe(target);

    await tearDown();
  });

  test('intersect once disconnects after the first visible entry', async () => {
    const { appHost, startPromise, tearDown } = createFixture(
      '<div id="target" intersect="once.bind: true"></div>',
      class {},
      [AureliaIntersectionConfiguration]
    );

    await startPromise;

    const target = appHost.querySelector('#target') as HTMLElement;
    const observer = FakeIntersectionObserver.instances[0];
    observer.emit(target, false, 0);
    expect(observer.disconnected).toBe(false);

    observer.emit(target, true, 1);
    expect(observer.disconnected).toBe(true);

    await tearDown();
  });
});
