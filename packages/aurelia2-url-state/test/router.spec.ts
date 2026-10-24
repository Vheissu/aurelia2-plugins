import { createFixture } from '@aurelia/testing';
import { ICurrentRoute, IRouter, IRouterEvents, RouterConfiguration, route } from '@aurelia/router';
import { CustomElement, resolve } from 'aurelia';
import {
  AureliaUrlStateConfiguration,
  IUrlState,
  param,
  type UrlStateEvent,
  type UrlStateHandle,
} from '../src/index';
import { RouterUrlStateAdapter } from '../src/router';

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const url = () => `${location.pathname}${location.search}${location.hash}`;
const browserMove = async (move: () => void) => {
  await new Promise<void>((resolve) => {
    window.addEventListener('popstate', () => resolve(), { once: true });
    move();
  });
  await wait(5);
};

let counts: Record<string, number> = {};
const bump = (key: string) => (counts[key] = (counts[key] ?? 0) + 1);
const lifecycle = (name: string) => ({
  canLoad() {
    bump(`${name}.canLoad`);
    return true;
  },
  loading() {
    bump(`${name}.loading`);
  },
});

let lists: OrderList[] = [];
class OrderList {
  filters = { q: '', status: 'all' as 'all' | 'open' | 'closed', page: 1, tags: [] as string[] };
  params = {
    q: param.string({ debounce: 20 }),
    status: param.enum(['all', 'open', 'closed'] as const),
    page: param.int({ min: 1, history: 'push' }),
    tags: param.list(param.string()),
  };
  state: UrlStateHandle | null = null;
  events: UrlStateEvent[] = [];
  probes: string[] = [];
  readonly currentRoute = resolve(ICurrentRoute);
  constructor() {
    bump('list.ctor');
    lists.push(this);
  }
  canLoad = lifecycle('list').canLoad;
  loading = lifecycle('list').loading;
}
const OrderListElement = CustomElement.define(
  {
    name: 'order-list',
    template: `<section url-state="model.bind: filters; params.bind: params; handle.from-view: state"
      url-state-apply.trigger="events.push($event.detail)" url-state-commit.trigger="events.push($event.detail)"
      url-state-error.trigger="events.push($event.detail)">
      <route-probe value.bind="filters.status + '/' + filters.page" query.bind="currentRoute.query.toString()" log.bind="probes"></route-probe>
      \${filters.q}|\${filters.status}|\${filters.page}</section>`,
    dependencies: [
      CustomElement.define(
        { name: 'route-probe', template: '', bindables: ['value', 'query', 'log'] },
        class {
          value = '';
          query = '';
          log!: string[];
          attaching() {
            this.log.push(`${this.value} current-route:${this.query}`);
          }
        },
      ),
    ],
  },
  OrderList,
);

let details: OrderDetail[] = [];
class OrderDetail {
  view = { tab: 'summary' as 'summary' | 'history' };
  seen = '';
  handle!: UrlStateHandle;
  private readonly urlState = resolve(IUrlState);
  private readonly currentRoute = resolve(ICurrentRoute);
  constructor() {
    details.push(this);
  }
  binding() {
    this.handle = this.urlState.connect(this.view, { tab: param.enum(['summary', 'history']) });
    this.seen = `${this.view.tab} current-route:${this.currentRoute.query.toString()}`;
  }
  unbinding() {
    this.handle.dispose();
  }
}
const OrderDetailElement = CustomElement.define(
  { name: 'order-detail', template: 'detail ${view.tab}' },
  OrderDetail,
);

@route({
  routes: [
    { path: ['', 'list'], component: OrderListElement, title: 'List' },
    { path: 'detail/:id', component: OrderDetailElement, title: 'Detail' },
  ],
})
class OrdersShell {
  constructor() {
    bump('shell.ctor');
  }
  canLoad = lifecycle('shell').canLoad;
  loading = lifecycle('shell').loading;
}
const OrdersShellElement = CustomElement.define(
  { name: 'orders-shell', template: 'orders <au-viewport></au-viewport>' },
  OrdersShell,
);

let flats: Flat[] = [];
class Flat {
  view = { page: 1 };
  params = { page: param.int({ history: 'push' }) };
  constructor() {
    bump('flat.ctor');
    flats.push(this);
  }
}
const FlatElement = CustomElement.define(
  {
    name: 'flat-page',
    template: '<p url-state="model.bind: view; params.bind: params">${view.page}</p>',
  },
  Flat,
);

class SidePanel {
  constructor() {
    bump('side.ctor');
  }
  canLoad = lifecycle('side').canLoad;
  loading = lifecycle('side').loading;
}
const SidePanelElement = CustomElement.define({ name: 'side-panel', template: 'side' }, SidePanel);

@route({
  title: 'Shop',
  routes: [
    { path: 'orders', component: OrdersShellElement, title: 'Orders' },
    { path: 'flat', component: FlatElement },
    { path: 'side', component: SidePanelElement },
    { path: 'other', component: CustomElement.define({ name: 'other-page', template: 'other' }) },
  ],
})
class Shop {
  shell = { density: 'cozy' as 'cozy' | 'compact' };
  shellParams = { density: param.enum(['cozy', 'compact']) };
}

async function start(path: string) {
  if (!document.querySelector('base')) {
    const base = document.createElement('base');
    base.href = '/';
    document.head.append(base);
  }
  history.replaceState(null, '', path);
  const fixture = createFixture(
    `<header url-state="model.bind: shell; params.bind: shellParams">\${shell.density}</header>
     <au-viewport name="main"></au-viewport><au-viewport name="aside" default="side"></au-viewport>`,
    Shop,
    [
      RouterConfiguration.customize({ basePath: '/' }),
      AureliaUrlStateConfiguration.configure({ adapter: RouterUrlStateAdapter }),
    ],
  );
  await fixture.startPromise;
  await wait(5);
  const router = fixture.container.get(IRouter);
  const urlState = fixture.container.get(IUrlState);
  const navigations: string[] = [];
  fixture.container
    .get(IRouterEvents)
    .subscribe('au:router:navigation-start', (event) =>
      navigations.push(`${event.trigger}:${event.instructions.toPath()}`),
    );
  const settle = async () => {
    await wait(0);
    await urlState.settled();
    await wait(5);
  };
  return { ...fixture, tearDown: () => fixture.tearDown(), router, urlState, navigations, settle };
}

describe('url-state with @aurelia/router', () => {
  beforeEach(() => {
    counts = {};
    lists = [];
    details = [];
    flats = [];
  });

  it('writes query-only updates without recreating or reloading nested and sibling routes', async () => {
    const app = await start('/orders/list?utm=mail#results');
    const list = lists[0];
    const before = { ...counts };
    const title = document.title;
    const host = app.appHost.querySelector('order-list');
    const entries = history.length;
    list.filters.status = 'open';
    await app.settle();
    expect(url()).toBe('/orders@main/list+side@aside?utm=mail&status=open#results');
    expect(history.length).toBe(entries);
    list.filters.page = 2;
    await app.settle();
    expect(url()).toBe('/orders@main/list+side@aside?utm=mail&status=open&page=2#results');
    expect(history.length).toBe(entries + 1);
    expect(counts).toEqual(before);
    expect(before).toMatchObject({
      'shell.ctor': 1,
      'list.ctor': 1,
      'list.loading': 1,
      'side.ctor': 1,
      'side.loading': 1,
    });
    expect(app.appHost.querySelector('order-list')).toBe(host);
    expect(app.appHost.textContent).toContain('side');
    expect(document.title).toBe(title);
    expect(app.navigations).toEqual([
      'api:orders@main/list+side@aside',
      'api:orders@main/list+side@aside',
    ]);
    expect(app.router.routeTree.queryParams.toString()).toBe('utm=mail&status=open&page=2');
    await app.tearDown();
  });

  it('reads the incoming query while a routed component activates, before ICurrentRoute updates', async () => {
    const app = await start('/orders/list');
    await app.router.load('orders/list', { queryParams: { status: 'closed', page: '3' } });
    expect(lists[0].probes).toEqual(['all/1 current-route:']);
    expect(lists[0].filters).toMatchObject({ status: 'closed', page: 3 });
    await app.router.load('orders/detail/7', { queryParams: { tab: 'history' } });
    expect(details[0].seen).toBe('history current-route:status=closed&page=3');
    expect(app.appHost.textContent).toContain('detail history');
    await app.tearDown();

    const fresh = await start('/orders/list?status=open&page=4');
    expect(lists[lists.length - 1].probes).toEqual(['open/4 current-route:']);
    await fresh.tearDown();
  });

  it('reconciles Back and Forward, including popstates the router ignores, without echo navigations', async () => {
    const app = await start('/flat');
    const flat = flats[0];
    flat.view.page = 2;
    await app.settle();
    flat.view.page = 3;
    await app.settle();
    expect(url()).toBe('/flat@main+side@aside?page=3');
    const navigations = app.navigations.length;
    await browserMove(() => history.back());
    expect(url()).toBe('/flat@main+side@aside?page=2');
    expect(flat.view.page).toBe(2);
    await browserMove(() => history.back());
    expect(flat.view.page).toBe(1);
    await browserMove(() => history.forward());
    expect(flat.view.page).toBe(2);
    await app.settle();
    // The router skips these popstates because only the query changed; url-state still follows them.
    expect(app.navigations.length).toBe(navigations);
    expect(counts['flat.ctor']).toBe(1);
    flat.view.page = 5;
    await app.settle();
    expect(url()).toBe('/flat@main+side@aside?page=5');
    await app.tearDown();

    const nested = await start('/orders/list');
    const list = lists[0];
    list.filters.page = 2;
    await nested.settle();
    list.filters.tags.push('a');
    await nested.settle();
    await browserMove(() => history.back());
    expect(list.filters).toMatchObject({ page: 1, tags: [] });
    await browserMove(() => history.forward());
    expect(list.filters).toMatchObject({ page: 2, tags: ['a'] });
    await nested.settle();
    expect(url()).toBe('/orders@main/list+side@aside?page=2&tags=a');
    expect(counts['list.ctor']).toBe(1);
    expect(nested.navigations.filter((entry) => entry.startsWith('api')).length).toBe(2);
    await nested.tearDown();
  });

  it('updates a reused component from an external same-route navigation', async () => {
    const app = await start('/orders/list?status=open');
    const list = lists[0];
    await app.router.load('orders/list', { queryParams: { status: 'closed', q: 'acme' } });
    await app.settle();
    expect(list.filters).toMatchObject({ status: 'closed', q: 'acme' });
    expect(lists).toHaveLength(1);
    expect(app.appHost.textContent).toContain('acme|closed|1');
    expect(
      list.events
        .filter((event) => event.type === 'apply')
        .map((event) => event.type === 'apply' && event.source),
    ).toEqual(['connect', 'navigation']);
    await app.tearDown();
  });

  it('cancels pending writes when navigating away and never pulls the user back', async () => {
    const app = await start('/orders/list');
    const list = lists[0];
    const state = list.state!;
    list.filters.q = 'typed';
    await wait(5);
    expect(state.pending).toBe(true);
    await app.router.load('other');
    await wait(40);
    await app.settle();
    expect(state.disposed).toBe(true);
    expect(url()).toBe('/other@main+side@aside');
    expect(app.navigations).toEqual(['api:other']);
    await app.tearDown();
  });

  it('reports rejected and failed router navigations and restores the URL value', async () => {
    const app = await start('/orders/list?status=open');
    const list = lists[0];
    const load = jest.spyOn(app.router, 'load');
    load.mockResolvedValueOnce(false);
    list.filters.status = 'closed';
    await app.settle();
    expect(list.state!.error).toMatchObject({
      code: 'rejected',
      keys: ['status'],
      mode: 'replace',
    });
    expect(list.filters.status).toBe('open');
    load.mockRejectedValueOnce(new Error('guard exploded'));
    list.filters.page = 9;
    await app.settle();
    expect(list.state!.error).toMatchObject({ code: 'failed', keys: ['page'], mode: 'push' });
    expect(list.filters.page).toBe(1);
    expect(list.events.filter((event) => event.type === 'error')).toHaveLength(2);
    load.mockRestore();
    list.filters.status = 'closed';
    await app.settle();
    expect(url()).toBe('/orders@main/list+side@aside?status=closed');
    expect(list.state!.error).toBeNull();
    await app.tearDown();
  });

  it('shares one query between an app-shell model and a routed model without clobbering keys', async () => {
    const app = await start('/orders/list?density=compact&status=open');
    const shop = app.component;
    const list = lists[0];
    expect(shop.shell.density).toBe('compact');
    expect(app.appHost.querySelector('header')!.textContent).toBe('compact');
    shop.shell.density = 'cozy';
    list.filters.page = 2;
    await app.settle();
    expect(url()).toBe('/orders@main/list+side@aside?status=open&page=2');
    shop.shell.density = 'compact';
    await wait(0);
    list.filters.status = 'closed';
    await app.settle();
    expect(url()).toBe('/orders@main/list+side@aside?density=compact&status=closed&page=2');
    await app.tearDown();
  });

  it('reconnects after service disposal', async () => {
    const app = await start('/flat');
    app.urlState.dispose();
    const model = { page: 1 };
    app.urlState.connect(model, { page: param.int() });
    model.page = 4;
    await app.settle();
    expect(url()).toContain('page=4');
    await app.router.load('flat', { queryParams: { page: '6' } });
    await app.settle();
    expect(model.page).toBe(6);
    await app.tearDown();
  });

  it('requires RouterConfiguration', () => {
    const attempt = () =>
      createFixture('', class {}, [
        AureliaUrlStateConfiguration.configure({ adapter: RouterUrlStateAdapter }),
      ]);
    expect(attempt).toThrow(/needs RouterConfiguration/);
  });
});
