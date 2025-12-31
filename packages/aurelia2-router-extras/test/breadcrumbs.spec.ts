import { createFixture } from '@aurelia/testing';
import { Registration } from '@aurelia/kernel';
import { IRouter, IRouterEvents } from '@aurelia/router';
import { AureliaRouterExtrasConfiguration, AuBreadcrumbsCustomElement, RouterExtras } from './../src/index';

function cleanupMeta(): void {
  document.querySelectorAll('meta[name], meta[property]').forEach((node) => node.remove());
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createNode(overrides: Partial<any> = {}) {
  return {
    children: [],
    instruction: { viewport: 'default' },
    title: null,
    params: null,
    data: {},
    computeAbsolutePath: () => '/path',
    component: { name: 'Component' },
    ...overrides,
  };
}

class RouterExtrasStub {
  public init() {}
  public breadcrumbs = [
    { title: 'Home', path: '/', params: null, data: {} },
    { title: 'Users', path: '/users', params: null, data: {} },
  ];
}

describe('aurelia2-router-extras', () => {
  afterEach(() => cleanupMeta());

  test('renders breadcrumbs from service by default', async () => {
    const { appHost, startPromise, tearDown } = createFixture(
      '<au-breadcrumbs></au-breadcrumbs>',
      class {},
      [
        AuBreadcrumbsCustomElement,
        Registration.singleton(RouterExtras, RouterExtrasStub),
      ]
    );

    await startPromise;

    const items = appHost.querySelectorAll('li');
    expect(items.length).toBe(2);

    await tearDown();
  });

  test('applies meta tags from route data on init', async () => {
    const leaf = {
      children: [],
      instruction: { viewport: 'default' },
      title: 'Users',
      params: {},
      data: {
        meta: {
          description: 'All users',
          'og:title': 'Users',
        },
      },
      computeAbsolutePath: () => '/users',
      component: { name: 'Users' },
    };

    const root = { children: [leaf] };
    const routerStub = { currentTr: { routeTree: { root } } };
    const eventsStub = { subscribe: () => ({ dispose() {} }) };

    const { startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [
        Registration.instance(IRouter, routerStub as unknown as IRouter),
        Registration.instance(IRouterEvents, eventsStub as unknown as IRouterEvents),
        AureliaRouterExtrasConfiguration,
      ]
    );

    await startPromise;

    expect(document.querySelector('meta[name=\"description\"]')?.getAttribute('content')).toBe('All users');
    expect(document.querySelector('meta[property=\"og:title\"]')?.getAttribute('content')).toBe('Users');

    await tearDown();
  });

  test('builds breadcrumbs from the primary viewport and resolves title fallback', async () => {
    const sidebar = createNode({
      instruction: { viewport: 'sidebar' },
      title: 'Sidebar',
      computeAbsolutePath: () => '/sidebar',
    });

    const primary = createNode({
      instruction: { viewport: 'default' },
      title: null,
      component: { name: 'Dashboard' },
      computeAbsolutePath: () => '/dashboard',
    });

    const root = { children: [sidebar, primary] };
    const routerStub = { currentTr: { routeTree: { root } } };
    const eventsStub = { subscribe: () => ({ dispose() {} }) };

    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [
        Registration.instance(IRouter, routerStub as unknown as IRouter),
        Registration.instance(IRouterEvents, eventsStub as unknown as IRouterEvents),
        AureliaRouterExtrasConfiguration,
      ]
    );

    await startPromise;

    const extras = container.get(RouterExtras);
    extras.updateFromRouteTree(root as any);

    expect(extras.breadcrumbs).toEqual([
      { title: 'Dashboard', path: '/dashboard', params: null, data: {} },
    ]);

    await tearDown();
  });

  test('dedupes meta entries and clears old tags on update', async () => {
    const child = createNode({
      title: 'Child',
      data: {
        meta: {
          description: 'Child description',
          'og:title': 'Child title',
        },
      },
      computeAbsolutePath: () => '/child',
    });

    const root = { children: [child] };
    const routerStub = { currentTr: { routeTree: { root } } };
    const eventsStub = { subscribe: () => ({ dispose() {} }) };

    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [
        Registration.instance(IRouter, routerStub as unknown as IRouter),
        Registration.instance(IRouterEvents, eventsStub as unknown as IRouterEvents),
        AureliaRouterExtrasConfiguration,
      ]
    );

    await startPromise;

    const extras = container.get(RouterExtras);
    extras.updateFromRouteTree(root as any);

    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Child description');
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Child title');

    const nextChild = createNode({
      title: 'Next',
      data: {
        meta: {
          description: 'Next description',
        },
      },
      computeAbsolutePath: () => '/next',
    });

    extras.updateFromRouteTree({ children: [nextChild] } as any);

    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Next description');
    expect(document.querySelector('meta[property="og:title"]')).toBeNull();

    await tearDown();
  });

  test('updates on navigation-end events', async () => {
    let navCallback: (() => void) | null = null;

    const first = createNode({
      title: 'First',
      computeAbsolutePath: () => '/first',
    });

    const second = createNode({
      title: 'Second',
      computeAbsolutePath: () => '/second',
    });

    const routerStub = { currentTr: { routeTree: { root: { children: [first] } } } };
    const eventsStub = {
      subscribe: (_event: string, callback: () => void) => {
        navCallback = callback;
        return { dispose() {} };
      }
    };

    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [
        Registration.instance(IRouter, routerStub as unknown as IRouter),
        Registration.instance(IRouterEvents, eventsStub as unknown as IRouterEvents),
        AureliaRouterExtrasConfiguration,
      ]
    );

    await startPromise;

    const extras = container.get(RouterExtras);
    expect(extras.breadcrumbs.map((crumb) => crumb.title)).toEqual(['First']);

    routerStub.currentTr.routeTree.root = { children: [second] } as any;
    navCallback?.();

    expect(extras.breadcrumbs.map((crumb) => crumb.title)).toEqual(['Second']);

    await tearDown();
  });

  test('reflects active state on breadcrumb links', async () => {
    const { component, appHost, startPromise, tearDown } = createFixture(
      '<au-breadcrumbs items.bind="items"></au-breadcrumbs>',
      class App {
        items = [
          { title: 'Home', path: '/', params: null, data: {}, active: false },
        ];
      },
      [
        AuBreadcrumbsCustomElement,
        Registration.singleton(RouterExtras, RouterExtrasStub),
      ]
    );

    await startPromise;

    const anchor = appHost.querySelector('a') as HTMLAnchorElement;
    expect(anchor.classList.contains('active')).toBe(false);
    expect(anchor.getAttribute('aria-current')).toBeNull();

    component.items[0].active = true;
    await flush();

    expect(anchor.classList.contains('active')).toBe(true);
    expect(anchor.getAttribute('aria-current')).toBe('page');

    await tearDown();
  });
});
