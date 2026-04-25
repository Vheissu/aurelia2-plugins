import { createFixture } from '@aurelia/testing';
import { AureliaResizeConfiguration, IResizeService } from './../src/index';
import type { ResizeChange } from './../src/index';

class FakeResizeObserver implements ResizeObserver {
  public static instances: FakeResizeObserver[] = [];
  public observed: Array<{ target: Element; options?: ResizeObserverOptions }> = [];
  public disconnected = false;

  public constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  public observe(target: Element, options?: ResizeObserverOptions): void {
    this.observed.push({ target, options });
  }

  public unobserve(target: Element): void {
    this.observed = this.observed.filter((entry) => entry.target !== target);
  }

  public disconnect(): void {
    this.disconnected = true;
    this.observed = [];
  }

  public emit(target: Element, width: number, height: number): void {
    this.callback([{
      target,
      contentRect: { width, height } as DOMRectReadOnly,
      contentBoxSize: [{ inlineSize: width, blockSize: height }] as ResizeObserverSize[],
    } as ResizeObserverEntry], this);
  }
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('aurelia2-resize', () => {
  beforeEach(() => {
    FakeResizeObserver.instances = [];
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: FakeResizeObserver,
    });
  });

  afterEach(() => {
    delete (globalThis as any).ResizeObserver;
  });

  test('service observes elements and reports size changes', async () => {
    const { container, appHost, startPromise, tearDown } = createFixture(
      '<section id="panel"></section>',
      class {},
      [AureliaResizeConfiguration.configure({ box: 'border-box' })]
    );

    await startPromise;

    const panel = appHost.querySelector('#panel') as HTMLElement;
    const service = container.get(IResizeService);
    const callback = jest.fn();
    const handle = service.observe(panel, callback);

    const observer = FakeResizeObserver.instances[0];
    expect(observer.observed[0]).toEqual({ target: panel, options: { box: 'border-box' } });

    observer.emit(panel, 320, 180);

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      target: panel,
      width: 320,
      height: 180,
    }));

    handle.dispose();
    expect(observer.disconnected).toBe(true);

    await tearDown();
  });

  test('resize attribute updates bound size and dispatches event', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<section
        id="panel"
        resize="width.two-way: width; height.two-way: height; detail.two-way: latest; callback.bind: (change) => onResize(change)"
        resize-change.trigger="onEvent($event.detail)">
      </section>`,
      class App {
        public width = 0;
        public height = 0;
        public latest: ResizeChange | null = null;
        public callbackChange: ResizeChange | null = null;
        public eventChange: ResizeChange | null = null;

        public onResize(change: ResizeChange): void {
          this.callbackChange = change;
        }

        public onEvent(change: ResizeChange): void {
          this.eventChange = change;
        }
      },
      [AureliaResizeConfiguration]
    );

    await startPromise;

    const panel = appHost.querySelector('#panel') as HTMLElement;
    FakeResizeObserver.instances[0].emit(panel, 640, 360);
    await flush();

    expect(component.width).toBe(640);
    expect(component.height).toBe(360);
    expect(component.latest?.target).toBe(panel);
    expect(component.callbackChange?.width).toBe(640);
    expect(component.eventChange?.height).toBe(360);

    await tearDown();
  });
});
