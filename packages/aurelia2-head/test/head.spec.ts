import { createFixture } from '@aurelia/testing';
import { AureliaHeadConfiguration, IHeadManager, normalizeMeta } from './../src/index';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function cleanupHead(): void {
  document.title = '';
  document.documentElement.removeAttribute('lang');
  document.body.removeAttribute('data-section');
  document.head.querySelectorAll('[data-aurelia-head]').forEach((node) => node.remove());
}

describe('aurelia2-head', () => {
  afterEach(() => cleanupHead());

  test('normalizes object meta entries into name and property tags', () => {
    expect(normalizeMeta({
      description: 'A page',
      'og:title': 'Open graph title',
      robots: null,
    })).toEqual([
      { name: 'description', content: 'A page' },
      { property: 'og:title', content: 'Open graph title' },
    ]);
  });

  test('stacks scoped head state and restores previous entries when disposed', async () => {
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaHeadConfiguration.configure({ defaultTitle: 'App', titleTemplate: '%s | App' })]
    );

    await startPromise;

    const head = container.get(IHeadManager);
    const parent = head.apply({
      title: 'Home',
      meta: { description: 'Home page' },
      bodyAttrs: { 'data-section': 'home' },
    });
    const child = head.apply({
      title: 'Users',
      meta: {
        description: 'Users page',
        'og:title': 'Users',
      },
      links: [{ rel: 'canonical', href: 'https://example.com/users' }],
      htmlAttrs: { lang: 'en-AU' },
    });

    expect(document.title).toBe('Users | App');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Users page');
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Users');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://example.com/users');
    expect(document.documentElement.getAttribute('lang')).toBe('en-AU');
    expect(document.body.getAttribute('data-section')).toBe('home');

    child.dispose();

    expect(document.title).toBe('Home | App');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Home page');
    expect(document.querySelector('meta[property="og:title"]')).toBeNull();
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.documentElement.getAttribute('lang')).toBeNull();

    parent.dispose();

    expect(document.title).toBe('App | App');
    expect(document.querySelector('meta[name="description"]')).toBeNull();
    expect(document.body.getAttribute('data-section')).toBeNull();

    await tearDown();
  });

  test('au-head renders bound state and removes it on detach', async () => {
    const { component, startPromise, tearDown } = createFixture(
      `<au-head
        title.bind="title"
        meta.bind="meta"
        links.bind="links"
        html-attrs.bind="htmlAttrs"
        body-attrs.bind="bodyAttrs">
      </au-head>`,
      class App {
        public title = 'Dashboard';
        public meta = { description: 'Dashboard metrics' };
        public links = [{ rel: 'canonical', href: 'https://example.com/dashboard' }];
        public htmlAttrs = { lang: 'en' };
        public bodyAttrs = { 'data-section': 'dashboard' };
      },
      [AureliaHeadConfiguration.configure({ titleTemplate: '%s - Product' })]
    );

    await startPromise;

    expect(document.title).toBe('Dashboard - Product');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Dashboard metrics');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://example.com/dashboard');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.body.getAttribute('data-section')).toBe('dashboard');

    component.title = 'Reports';
    component.meta = { description: 'Reporting' };
    await flush();

    expect(document.title).toBe('Reports - Product');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Reporting');

    await tearDown();

    expect(document.querySelector('meta[name="description"]')).toBeNull();
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.documentElement.getAttribute('lang')).toBeNull();
    expect(document.body.getAttribute('data-section')).toBeNull();
  });
});
