import { createFixture, TestContext } from '@aurelia/testing';
import {
  CustomElement,
  IObserverLocator,
  IPlatform,
  Registration,
  resolve,
  type IDisposable,
} from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import {
  AureliaUrlStateConfiguration,
  HistoryUrlStateAdapter,
  IUrlState,
  IUrlStateAdapter,
  MemoryUrlStateAdapter,
  param,
  UrlStateError,
  type HistoryMode,
  type UrlStateAdapter,
  type UrlStateAdapterEvent,
  type UrlStateEvent,
  type UrlStateHandle,
} from '../src/index';
import { filterParam, sampleFilter } from './filter-document';

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const url = () => `${location.pathname}${location.search}${location.hash}`;
const popstate = (move: () => void) =>
  new Promise<void>((resolve) => {
    window.addEventListener('popstate', () => setTimeout(resolve, 0), { once: true });
    move();
  });

type Status = 'all' | 'open' | 'closed';
const orderParams = () => ({
  q: param.string({ debounce: 30 }),
  status: param.enum(['all', 'open', 'closed'] as const),
  page: param.int({ min: 1, history: 'push' }),
  tags: param.list(param.string()),
});
class Orders {
  filters = { q: '', status: 'all' as Status, page: 1, tags: [] as string[] };
  params = orderParams();
  state: UrlStateHandle | null = null;
  events: UrlStateEvent[] = [];
  probes: unknown[] = [];
  record(event: CustomEvent<UrlStateEvent>) {
    this.events.push(event.detail);
  }
}
// Records the bound model value a sibling element sees while the url-state view is attaching.
const Probe = CustomElement.define(
  { name: 'url-probe', template: '', bindables: ['value', 'log'] },
  class {
    value: unknown;
    log!: unknown[];
    attaching() {
      this.log.push(this.value);
    }
  },
);
const ordersTemplate = `<section if.bind="!hidden" url-state="model.bind: filters; params.bind: params; handle.from-view: state"
  url-state-apply.trigger="record($event)" url-state-commit.trigger="record($event)" url-state-error.trigger="record($event)">
  <b>\${filters.q}</b><url-probe value.bind="filters.tags" log.bind="probes"></url-probe><i>\${filters.status}/\${filters.page}/\${filters.tags.join(',')}</i>
</section>`;

function ordersFixture(registrations: unknown[] = [AureliaUrlStateConfiguration]) {
  return createFixture(
    ordersTemplate,
    class extends Orders {
      hidden = false;
    },
    [Probe, ...registrations],
  );
}

class DeferredAdapter implements UrlStateAdapter {
  search = '';
  busy = false;
  writes: {
    search: string;
    mode: HistoryMode;
    settle(ok?: boolean): void;
    fail(error: unknown): void;
  }[] = [];
  private listeners = new Set<(event: UrlStateAdapterEvent) => void>();
  read() {
    return this.search;
  }
  write(search: string, mode: HistoryMode) {
    return new Promise<boolean>((resolve, reject) =>
      this.writes.push({
        search,
        mode,
        settle: (ok = true) => {
          if (ok) this.search = search;
          resolve(ok);
        },
        fail: reject,
      }),
    );
  }
  subscribe(listener: (event: UrlStateAdapterEvent) => void): IDisposable {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }
  emit(type: UrlStateAdapterEvent['type'], search?: string) {
    if (search !== undefined) this.search = search;
    for (const listener of this.listeners) listener({ type });
  }
}

describe('url-state with the history adapter', () => {
  beforeEach(() => history.replaceState(null, '', '/'));

  it('applies URL values to the model before the view attaches and reports them', async () => {
    history.replaceState(null, '', '/orders?q=acme&status=open&page=3&tags=a&tags=b');
    const { component, appHost, startPromise, tearDown } = ordersFixture();
    await startPromise;
    expect(component.probes).toEqual([['a', 'b']]);
    expect(appHost.querySelector('b')!.textContent).toBe('acme');
    expect(appHost.querySelector('i')!.textContent).toBe('open/3/a,b');
    expect(component.events[0]).toMatchObject({ type: 'apply', source: 'connect', corrected: [] });
    expect(component.state!.keys).toEqual(['q', 'status', 'page', 'tags']);
    await tearDown();
  });

  it('debounces replace writes, omits defaults, keeps schema key order and unrelated keys, hash and history.state', async () => {
    history.replaceState({ scroll: 40 }, '', '/orders?utm_source=mail&x=%7E+y&flag#results');
    const { component, startPromise, tearDown } = ordersFixture();
    await startPromise;
    const before = history.length;
    component.filters.page = 1;
    component.filters.q = 'ac';
    component.filters.q = 'acme';
    component.filters.status = 'open';
    await wait(0);
    expect(url()).toBe('/orders?utm_source=mail&x=%7E+y&flag&status=open#results');
    await wait(15);
    expect(location.search).not.toContain('q=');
    await component.state!.settled();
    expect(url()).toBe('/orders?utm_source=mail&x=%7E+y&flag&q=acme&status=open#results');
    expect(history.length).toBe(before);
    expect(history.state).toEqual({ scroll: 40 });
    component.filters.status = 'all';
    component.filters.q = '';
    component.state!.flush();
    await component.state!.settled();
    expect(url()).toBe('/orders?utm_source=mail&x=%7E+y&flag#results');
    expect(
      component.events
        .filter((event) => event.type === 'commit')
        .map((event) => event.type === 'commit' && event.mode),
    ).toEqual(['replace', 'replace', 'replace']);
    await tearDown();
  });

  it('pushes for push keys, merges one tick into one navigation, flushes debounced text first and skips no-ops', async () => {
    const { component, startPromise, tearDown } = ordersFixture();
    await startPromise;
    const push = jest.spyOn(history, 'pushState');
    const replace = jest.spyOn(history, 'replaceState');
    try {
      const start = history.length;
      component.filters.status = 'closed';
      component.filters.page = 2;
      await component.state!.settled();
      expect(push).toHaveBeenCalledTimes(1);
      expect(replace).not.toHaveBeenCalled();
      expect(location.search).toBe('?status=closed&page=2');
      expect(history.length).toBe(start + 1);

      component.filters.q = 'acme';
      await wait(5);
      component.filters.page = 3;
      await component.state!.settled();
      expect(replace).toHaveBeenCalledTimes(1);
      expect(replace.mock.calls[0][2]).toBe('/?q=acme&status=closed&page=2');
      expect(push).toHaveBeenCalledTimes(2);
      expect(location.search).toBe('?q=acme&status=closed&page=3');

      component.filters.tags.push('x');
      component.filters.tags.pop();
      component.filters.status = 'open';
      component.filters.status = 'closed';
      await component.state!.settled();
      expect(push).toHaveBeenCalledTimes(2);
      expect(replace).toHaveBeenCalledTimes(1);
    } finally {
      push.mockRestore();
      replace.mockRestore();
    }
    await tearDown();
  });

  it('reconciles Back and Forward in one batch without writing back', async () => {
    const { component, container, startPromise, tearDown } = ordersFixture();
    await startPromise;
    component.filters.status = 'open';
    component.filters.page = 2;
    await component.state!.settled();
    component.filters.page = 3;
    component.filters.tags = ['t'];
    await component.state!.settled();
    expect(location.search).toBe('?status=open&page=3&tags=t');

    const { filters } = component;
    const seen: string[] = [];
    const watcher = { handleChange: () => seen.push(`${filters.page}:${filters.tags.join(',')}`) };
    const pageObserver = container.get(IObserverLocator).getObserver(filters, 'page');
    pageObserver.subscribe(watcher);
    const replace = jest.spyOn(history, 'replaceState');
    const push = jest.spyOn(history, 'pushState');
    try {
      await popstate(() => history.back());
      expect(filters).toMatchObject({ status: 'open', page: 2, tags: [] });
      // The page subscriber already sees the restored tags: both were assigned in one batch.
      expect(seen).toEqual(['2:']);
      await popstate(() => history.forward());
      expect(filters).toMatchObject({ page: 3, tags: ['t'] });
      await component.state!.settled();
      expect(replace).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
      expect(
        component.events.filter((event) => event.type === 'apply' && event.source === 'navigation'),
      ).toHaveLength(2);
    } finally {
      pageObserver.unsubscribe(watcher);
      replace.mockRestore();
      push.mockRestore();
    }
    await tearDown();
  });

  it('falls back to defaults for invalid or malformed values and corrects the URL with a replace', async () => {
    history.replaceState(
      null,
      '',
      `/?page=-4&status=bogus&q=%E0%A4%A&tags=ok&tags=&keep=%ZZ&q=second`,
    );
    const start = history.length;
    const { component, startPromise, tearDown } = ordersFixture();
    await startPromise;
    expect(component.filters).toEqual({ q: '�%A', status: 'all', page: 1, tags: ['ok'] });
    expect(component.events[0]).toMatchObject({
      type: 'apply',
      corrected: ['q', 'status', 'page', 'tags'],
    });
    await component.state!.settled();
    expect(location.search).toBe('?keep=%ZZ&q=%EF%BF%BD%25A&tags=ok');
    expect(history.length).toBe(start);
    await tearDown();
  });

  it('rejects duplicate ownership, reserved names and keys until the owner is disposed', async () => {
    const { container, component, startPromise, tearDown } = ordersFixture();
    await startPromise;
    const urlState = container.get(IUrlState);
    const other = { q: 'x' };
    expect(() => urlState.connect(other, { q: param.string() })).toThrow(/"q" is already owned/);
    expect(() =>
      urlState.connect(
        { a: '', b: '' },
        { a: param.string({ key: 'k' }), b: param.string({ key: 'k' }) },
      ),
    ).toThrow(/used by two params/);
    const pollutedParams = JSON.parse('{"__proto__": 1}') as Record<string, never>;
    expect(() => urlState.connect({}, pollutedParams)).toThrow(/reserved/);
    expect(() =>
      urlState.connect({ a: 1 }, { a: { parse() {}, serialize() {} } } as never),
    ).toThrow(/param\.\*\(\) builder/);
    expect(() => urlState.connect({ a: 'text' }, { a: param.int() })).toThrow(/not a valid int/);
    expect(() => urlState.connect(Object.freeze({ a: 1 }), { a: param.int() })).toThrow(/frozen/);

    history.replaceState(null, '', '/?constructor=1&__proto__=2&q=z');
    component.hidden = true;
    await wait(0);
    const handle = urlState.connect(other, { q: param.string() });
    expect(other.q).toBe('z');
    expect(({} as Record<string, unknown>).constructor).toBe(Object);
    other.q = 'y';
    await handle.settled();
    expect(location.search).toBe('?constructor=1&__proto__=2&q=y');
    handle.dispose();
    expect(handle.disposed).toBe(true);
    await tearDown();
  });

  it('cancels pending debounced writes when unbound and never writes afterwards', async () => {
    const { component, startPromise, tearDown } = ordersFixture();
    await startPromise;
    const state = component.state!;
    component.filters.q = 'typed';
    await wait(5);
    expect(state.pending).toBe(true);
    component.hidden = true;
    await wait(0);
    expect(state.disposed).toBe(true);
    expect(state.pending).toBe(false);
    await wait(50);
    expect(location.search).toBe('');
    await tearDown();
  });

  it('observes array mutation and re-subscribes when the list is replaced', async () => {
    const { component, startPromise, tearDown } = ordersFixture();
    await startPromise;
    const original = component.filters.tags;
    original.push('a', 'b');
    await component.state!.settled();
    expect(location.search).toBe('?tags=a&tags=b');
    original.splice(0, 1);
    await component.state!.settled();
    expect(location.search).toBe('?tags=b');
    component.filters.tags = ['z'];
    await component.state!.settled();
    original.push('ignored');
    component.filters.tags.push('y');
    await component.state!.settled();
    expect(location.search).toBe('?tags=z&tags=y');
    await tearDown();
  });

  it('reconnects when the bound model or params change, freeing the old keys', async () => {
    const { component, container, startPromise, tearDown } = ordersFixture();
    await startPromise;
    const first = component.state!;
    history.replaceState(null, '', '/?q=next&scope=team');
    (component.filters as Record<string, unknown>).scope = 'me';
    component.params = { ...orderParams(), scope: param.enum(['me', 'team']) } as never;
    await wait(0);
    expect(first.disposed).toBe(true);
    expect(component.state!.keys).toContain('scope');
    expect(component.filters).toMatchObject({ q: 'next', scope: 'team' });
    component.params = { q: param.string() } as never;
    await wait(0);
    expect(() =>
      container.get(IUrlState).connect({ page: 1 }, { page: param.int() }).dispose(),
    ).not.toThrow();
    await tearDown();
  });

  it('round-trips a validated filter-builder document through a custom param and rejects tampered JSON', async () => {
    const doc = sampleFilter();
    history.replaceState(null, '', `/?segment=${encodeURIComponent(JSON.stringify(doc))}`);
    const { component, startPromise, tearDown } = createFixture(
      '<div url-state="model.bind: view; params.bind: params"></div>',
      class {
        view = { segment: null as unknown };
        params = { segment: filterParam };
      },
      [AureliaUrlStateConfiguration],
    );
    await startPromise;
    expect(component.view.segment).toEqual(doc);
    const next = sampleFilter();
    next.root.combinator = 'any';
    component.view.segment = next;
    await wait(0);
    expect(new URLSearchParams(location.search).get('segment')).toBe(JSON.stringify(next));
    await tearDown();

    history.replaceState(
      null,
      '',
      `/?segment=${encodeURIComponent('{"version":1,"root":{"__proto__":{"x":1}}}')}&other=1`,
    );
    const second = createFixture(
      '<div url-state="model.bind: view; params.bind: params"></div>',
      class {
        view = { segment: null as unknown };
        params = { segment: filterParam };
      },
      [AureliaUrlStateConfiguration],
    );
    await second.startPromise;
    expect(second.component.view.segment).toBeNull();
    await wait(0);
    expect(location.search).toBe('?other=1');
    await second.tearDown();
  });

  it('reports serialize failures from scheduled writes, keeps the URL, and recovers on the next valid change', async () => {
    const { component, startPromise, tearDown } = createFixture(
      `<div url-state="model.bind: view; params.bind: params; handle.from-view: state" url-state-error.trigger="errors.push($event.detail.error)"></div>`,
      class {
        view = { sort: { by: 'name' } as { by: string } };
        errors: UrlStateError[] = [];
        state: UrlStateHandle | null = null;
        params = {
          sort: param.custom<{ by: string }>({
            parse: (raw) => ({ by: raw }),
            serialize: (value) => {
              if (value.by === 'boom') throw new Error('cannot encode');
              return value.by === 'object' ? (value as unknown as string) : value.by;
            },
            validate: (value): value is { by: string } =>
              typeof (value as { by?: unknown })?.by === 'string',
          }),
        };
      },
      [AureliaUrlStateConfiguration],
    );
    await startPromise;
    component.view.sort = { by: 'boom' };
    await component.state!.settled();
    component.view.sort = { by: 'object' };
    await component.state!.settled();
    component.view.sort = 5 as never;
    await component.state!.settled();
    expect(component.errors.map((error) => [error.code, error.keys])).toEqual([
      ['serialize', ['sort']],
      ['serialize', ['sort']],
      ['serialize', ['sort']],
    ]);
    expect(component.errors[0].message).toMatch(/cannot encode/);
    expect(component.errors[1].message).toMatch(/must return a string/);
    expect(component.errors[2].message).toMatch(/not a valid custom/);
    expect(component.state!.error).toBe(component.errors[2]);
    expect(location.search).toBe('');
    component.view.sort = { by: 'date' };
    await component.state!.settled();
    expect(location.search).toBe('?sort=date');
    expect(component.state!.error).toBeNull();
    await tearDown();
  });

  it('refuses to bypass a registered router unless explicitly allowed', async () => {
    const App = CustomElement.define({ name: 'no-routes', template: '' });
    let failure: unknown;
    let routed: ReturnType<typeof createFixture> | undefined;
    try {
      routed = createFixture('', App, [
        RouterConfiguration.customize({ historyStrategy: 'none' }),
        AureliaUrlStateConfiguration,
      ]);
      await routed.startPromise;
    } catch (error) {
      failure = error;
    }
    expect(String(failure)).toMatch(/router is registered/);
    await Promise.resolve(routed?.tearDown()).catch(() => undefined);
    const allowed = createFixture('', App, [
      RouterConfiguration.customize({ historyStrategy: 'none' }),
      AureliaUrlStateConfiguration.configure({ ignoreRouter: true }),
    ]);
    await allowed.startPromise;
    expect(allowed.container.get(IUrlStateAdapter)).toBeInstanceOf(HistoryUrlStateAdapter);
    await allowed.tearDown();
  });
});

describe('url-state with injected adapters', () => {
  it('serializes asynchronous writes so concurrent models never clobber each other', async () => {
    const adapter = new DeferredAdapter();
    adapter.search = 'other=1';
    const { container, startPromise, tearDown } = createFixture('', class {}, [
      AureliaUrlStateConfiguration.configure({ adapter }),
    ]);
    await startPromise;
    const urlState = container.get(IUrlState);
    const a = { q: '' };
    const b = { sort: 'name', page: 1 };
    const ha = urlState.connect(a, { q: param.string() });
    const hb = urlState.connect(b, { sort: param.string(), page: param.int({ history: 'push' }) });
    a.q = 'one';
    await wait(0);
    expect(adapter.writes.map((write) => write.search)).toEqual(['other=1&q=one']);
    b.sort = 'date';
    await wait(0);
    a.q = 'two';
    await wait(0);
    expect(adapter.writes).toHaveLength(1);
    expect(ha.pending && hb.pending).toBe(true);
    adapter.writes[0].settle();
    await wait(0);
    expect(adapter.writes.map((write) => [write.search, write.mode])).toEqual([
      ['other=1&q=one', 'replace'],
      ['other=1&q=two&sort=date', 'replace'],
    ]);
    b.page = 2;
    await wait(0);
    adapter.writes[1].settle();
    await wait(0);
    expect(adapter.writes[2]).toMatchObject({
      search: 'other=1&q=two&sort=date&page=2',
      mode: 'push',
    });
    adapter.writes[2].settle();
    await urlState.settled();
    expect(ha.pending || hb.pending).toBe(false);
    await tearDown();
  });

  it('makes rejected and failed writes visible and restores the URL value in the model', async () => {
    const adapter = new DeferredAdapter();
    const { container, startPromise, tearDown } = createFixture('', class {}, [
      AureliaUrlStateConfiguration.configure({ adapter }),
    ]);
    await startPromise;
    const events: UrlStateEvent[] = [];
    const model = { page: 1 };
    const handle = container.get(IUrlState).connect(
      model,
      { page: param.int({ history: 'push' }) },
      {
        listener: (event) => events.push(event),
      },
    );
    model.page = 2;
    await wait(0);
    adapter.writes[0].settle(false);
    await wait(0);
    expect(handle.error).toMatchObject({ code: 'rejected', keys: ['page'], mode: 'push' });
    expect(model.page).toBe(1);
    model.page = 3;
    await wait(0);
    adapter.writes[1].fail(new Error('quota exceeded'));
    await wait(0);
    expect(handle.error).toMatchObject({ code: 'failed', keys: ['page'] });
    expect(handle.error!.cause).toEqual(new Error('quota exceeded'));
    expect(model.page).toBe(1);
    expect(
      events.map((event) => (event.type === 'apply' ? `apply:${event.source}` : event.type)),
    ).toEqual(['apply:connect', 'error', 'apply:revert', 'error', 'apply:revert']);
    await tearDown();
  });

  it('drops queued writes when another navigation starts, ignores edits until it ends, and lets the URL win', async () => {
    const adapter = new DeferredAdapter();
    const { container, startPromise, tearDown } = createFixture('', class {}, [
      AureliaUrlStateConfiguration.configure({ adapter }),
    ]);
    await startPromise;
    const model = { q: '', page: 1 };
    const handle = container
      .get(IUrlState)
      .connect(model, { q: param.string({ debounce: 20 }), page: param.int() });
    model.page = 2;
    await wait(0);
    model.page = 3;
    model.q = 'stale';
    await wait(0);
    adapter.emit('navigating');
    model.page = 9;
    adapter.writes[0].settle();
    await wait(30);
    expect(adapter.writes).toHaveLength(1);
    adapter.emit('navigated', 'page=5');
    expect(model).toEqual({ q: '', page: 5 });
    await handle.settled();
    expect(adapter.writes).toHaveLength(1);

    model.q = 'kept';
    await wait(0);
    adapter.emit('navigating');
    adapter.emit('cancelled');
    await wait(30);
    expect(adapter.writes[1].search).toBe('q=kept&page=5');
    adapter.writes[1].settle();
    await tearDown();
  });

  it('uses the model value as the default, copies snapshots and supports headless refresh and flush', async () => {
    const adapter = new MemoryUrlStateAdapter('?tags=x');
    const { container, startPromise, tearDown } = createFixture('', class {}, [
      AureliaUrlStateConfiguration.configure({ adapter }),
    ]);
    await startPromise;
    const urlState = container.get(IUrlState);
    const model = { tags: ['seed'], from: null as Date | null, q: 'base' };
    const handle = urlState.connect(model, {
      tags: param.list(param.string()),
      from: param.date(),
      q: param.string({ debounce: 1000 }),
    });
    expect(model.tags).toEqual(['x']);
    const snapshot = handle.snapshot();
    (snapshot.tags as string[]).push('mutated');
    expect(model.tags).toEqual(['x']);
    model.tags = ['seed'];
    model.from = new Date('2024-03-04T00:00:00Z');
    await handle.settled();
    expect(adapter.read()).toBe('from=2024-03-04');
    model.q = 'later';
    handle.flush();
    await handle.settled();
    expect(adapter.read()).toBe('from=2024-03-04&q=later');
    adapter.write('q=outside&tags=a', 'replace');
    handle.refresh();
    expect(model).toEqual({ tags: ['a'], from: null, q: 'outside' });
    model.tags.push('b');
    model.tags = ['seed'];
    expect(model.tags).toEqual(['seed']);
    adapter.go(0);
    adapter.navigate('?q=nav', 'push');
    expect(model).toEqual({ tags: ['seed'], from: null, q: 'nav' });
    expect(adapter.go(-1)).toBe(true);
    expect(model.q).toBe('outside');
    handle.dispose();
    await tearDown();
  });

  it('keeps ownership per app container and stays inert on a platform without history', async () => {
    const first = createFixture(
      '<p url-state="model.bind: m; params.bind: p">${m.q}</p>',
      class {
        m = { q: '' };
        p = { q: param.string() };
      },
      [AureliaUrlStateConfiguration.configure({ adapter: new MemoryUrlStateAdapter('q=one') })],
    );
    const second = createFixture(
      '<p url-state="model.bind: m; params.bind: p">${m.q}</p>',
      class {
        m = { q: '' };
        p = { q: param.string() };
      },
      [AureliaUrlStateConfiguration.configure({ adapter: new MemoryUrlStateAdapter('q=two') })],
    );
    await Promise.all([first.startPromise, second.startPromise]);
    expect([first.appHost.textContent, second.appHost.textContent]).toEqual(['one', 'two']);
    expect(first.container.get(IUrlState)).not.toBe(second.container.get(IUrlState));
    await first.tearDown();
    expect(() => second.container.get(IUrlState).connect({ q: '' }, { q: param.string() })).toThrow(
      /already owned/,
    );
    await second.tearDown();

    // The same platform without `window`, as on a server.
    const ctx = TestContext.create();
    const server = ctx.container.createChild();
    const windowless = Object.create(ctx.platform, { window: { value: undefined } }) as IPlatform;
    server.register(Registration.instance(IPlatform, windowless), AureliaUrlStateConfiguration);
    const adapter = server.get(IUrlStateAdapter) as HistoryUrlStateAdapter;
    expect(adapter.active).toBe(false);
    const before = url();
    const model = { q: 'ssr', page: 1 };
    const handle = server.get(IUrlState).connect(model, { q: param.string(), page: param.int() });
    model.page = 4;
    await handle.settled();
    expect(model).toEqual({ q: 'ssr', page: 4 });
    expect(url()).toBe(before);
    expect(handle.error).toBeNull();
    server.get(IUrlState).dispose();
    expect(handle.disposed).toBe(true);
  });

  it('constructs class adapters through DI so they can inject services', async () => {
    class Recorder extends MemoryUrlStateAdapter {
      readonly platform = resolve(IPlatform);
    }
    const { container, startPromise, tearDown } = createFixture('', class {}, [
      AureliaUrlStateConfiguration.configure({ adapter: Recorder }),
    ]);
    await startPromise;
    const adapter = container.get(IUrlStateAdapter) as Recorder;
    expect(adapter.platform).toBe(container.get(IPlatform));
    expect(() => AureliaUrlStateConfiguration.configure({ adapter: {} as never })).toThrow(
      /read, write and subscribe/,
    );
    await tearDown();
  });
});
