import { createFixture } from '@aurelia/testing';
import { AureliaMediaConfiguration, IMediaService } from './../src/index';
import type { MediaChange } from './../src/index';

class FakeMediaQueryList implements MediaQueryList {
  public onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | null = null;
  public listeners: Array<(event: MediaQueryListEvent) => void> = [];

  public constructor(public readonly media: string, public matches: boolean) {}

  public addEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.push(listener);
  }

  public removeEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void): void {
    this.listeners = this.listeners.filter((entry) => entry !== listener);
  }

  public addListener(listener: (event: MediaQueryListEvent) => void): void {
    this.addEventListener('change', listener);
  }

  public removeListener(listener: (event: MediaQueryListEvent) => void): void {
    this.removeEventListener('change', listener);
  }

  public dispatchEvent(event: Event): boolean {
    for (const listener of this.listeners) {
      listener(event as MediaQueryListEvent);
    }
    return true;
  }

  public setMatches(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent({ matches, media: this.media } as MediaQueryListEvent);
  }
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('aurelia2-media', () => {
  const queries = new Map<string, FakeMediaQueryList>();
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    queries.clear();
    originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn((query: string) => {
      const existing = queries.get(query);
      if (existing) return existing;
      const created = new FakeMediaQueryList(query, false);
      queries.set(query, created);
      return created;
    }) as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  test('service observes matchMedia and disposes listeners', async () => {
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaMediaConfiguration]
    );

    await startPromise;

    const service = container.get(IMediaService);
    const callback = jest.fn();
    const handle = service.observe('(min-width: 900px)', callback);
    const media = queries.get('(min-width: 900px)') as FakeMediaQueryList;

    expect(callback).toHaveBeenCalledWith({ query: '(min-width: 900px)', matches: false, media });

    media.setMatches(true);
    expect(callback).toHaveBeenLastCalledWith({ query: '(min-width: 900px)', matches: true, media });

    handle.dispose();
    expect(media.listeners.length).toBe(0);

    await tearDown();
  });

  test('media attribute updates matches, class, hidden state, and event detail', async () => {
    const { appHost, component, startPromise, tearDown } = createFixture(
      `<section
        id="nav"
        media="query.bind: query; matches.two-way: matches; detail.two-way: latest; callback.bind: (change) => onMedia(change); class-name.bind: className; hide.bind: true"
        media-change.trigger="onEvent($event.detail)">
      </section>`,
      class App {
        public query = '(min-width: 900px)';
        public className = 'desktop';
        public matches = false;
        public latest: MediaChange | null = null;
        public callbackChange: MediaChange | null = null;
        public eventChange: MediaChange | null = null;

        public onMedia(change: MediaChange): void {
          this.callbackChange = change;
        }

        public onEvent(change: MediaChange): void {
          this.eventChange = change;
        }
      },
      [AureliaMediaConfiguration]
    );

    await startPromise;
    await flush();

    const nav = appHost.querySelector('#nav') as HTMLElement;
    const media = queries.get('(min-width: 900px)') as FakeMediaQueryList;

    expect(component.matches).toBe(false);
    expect(nav.hidden).toBe(true);

    media.setMatches(true);
    await flush();

    expect(component.matches).toBe(true);
    expect(component.latest?.matches).toBe(true);
    expect(component.callbackChange?.query).toBe('(min-width: 900px)');
    expect(component.eventChange?.matches).toBe(true);
    expect(nav.classList.contains('desktop')).toBe(true);
    expect(nav.hidden).toBe(false);

    await tearDown();
  });
});
