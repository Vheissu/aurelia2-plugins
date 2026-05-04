import { DI } from '@aurelia/kernel';
import { CustomElement } from 'aurelia';
import { ISSRContext } from '@aurelia/runtime-html';
import {
  analyzeSsrDocument,
  buildSsrDocument,
  canonicalUrlForRoute,
  collectManifestAssets,
  createMemoryStorage,
  createPrebootScript,
  createRobotsTxt,
  createServerContainer,
  createSitemapXml,
  createSsrReport,
  createSsrRouterRegistrations,
  finishSsrTakeover,
  installDomGlobals,
  outputFileForRoute,
  prepareSsrHostForTakeover,
  renderAureliaToString,
  serializeElementForSsr,
  shouldFailSsrBuild,
  uniqueSitemapRoutes,
  validateSsrConfig,
} from '../src';
import type { SsrRouteConfig, SsrSiteConfig } from '../src';

const site: SsrSiteConfig = {
  origin: 'https://example.com',
  siteName: 'Example',
  language: 'en-AU',
  themeColor: '#111111',
  defaultOgImage: '/og.png',
  organization: {
    name: 'Example Pty Ltd',
    logo: '/logo.svg',
    sameAs: ['https://example.social/example'],
  },
  rendering: {
    hostTagName: 'ssr-app',
    stripAureliaMarkers: false,
  },
  preboot: {
    enabled: true,
    replayAfterMs: 10,
  },
  assets: {
    modulePreload: true,
    manifestStyles: true,
    priorityImagePreload: true,
    dnsPrefetch: ['//cdn.example.com'],
    preconnect: [{ href: 'https://api.example.com', crossorigin: true }],
    globalPreloads: [{ href: '/fonts/app.woff2', as: 'font', type: 'font/woff2', crossorigin: true }],
    styles: [{ id: 'critical-css', content: 'body{color:#111}' }],
    scripts: [{ id: 'analytics', src: 'https://cdn.example.com/a.js', strategy: 'body-end', defer: true }],
  },
  diagnostics: {
    budgets: {
      descriptionMinLength: 40,
      duplicateHostMaxCount: 1,
    },
  },
};

const homeRoute: SsrRouteConfig = {
  path: '/',
  seo: {
    title: 'Home page for Example',
    description: 'A useful home page description for search engines and social previews.',
    sitemap: { include: true, priority: 1, changefreq: 'weekly' },
    jsonLd: [{ '@type': 'BreadcrumbList', itemListElement: [] }],
  },
  priority: {
    level: 'critical',
    moduleIds: ['src/home.ts'],
    images: [{ href: '/hero.webp', fetchPriority: 'high' }],
  },
};

const aliasRoute: SsrRouteConfig = {
  path: '/start',
  seo: {
    title: 'Start',
    description: 'Alias page with canonical route.',
    canonicalPath: '/',
    sitemap: { include: false },
  },
};

describe('aurelia2-ssr routes and diagnostics', () => {
  test('normalizes output files, canonicals, sitemap, and robots', () => {
    expect(outputFileForRoute(homeRoute)).toBe('index.html');
    expect(outputFileForRoute({ ...homeRoute, path: '/docs/getting-started' })).toBe('docs/getting-started.html');
    expect(canonicalUrlForRoute(aliasRoute, site)).toBe('https://example.com/');
    expect(uniqueSitemapRoutes([homeRoute, aliasRoute])).toEqual([homeRoute]);
    expect(createSitemapXml([homeRoute], site, new Date('2026-01-02T00:00:00Z'))).toContain('<loc>https://example.com/</loc>');
    expect(createRobotsTxt(site)).toContain('Sitemap: https://example.com/sitemap.xml');
  });

  test('validates SEO and route mistakes before rendering', () => {
    const validation = validateSsrConfig({
      ...site,
      routes: [
        homeRoute,
        { ...homeRoute, path: '/', seo: { title: '', description: '' } },
        { ...homeRoute, path: 'relative' },
      ],
    });

    expect(validation.errors).toEqual(expect.arrayContaining([
      '/: duplicate route path',
      '/: missing seo.title',
      '/: missing seo.description',
      'relative: route path must start with /',
    ]));
  });

  test('creates build reports and honors fail thresholds', () => {
    const diagnostics = [{ severity: 'error' as const, code: 'missing_title', message: 'Missing title' }];
    const report = createSsrReport(site, [{
      path: '/',
      mode: 'prerender',
      status: 200,
      canonicalUrl: 'https://example.com/',
      priority: 'critical',
      renderMs: 25,
      htmlBytes: 1200,
      appHtmlBytes: 500,
      title: 'Home',
      descriptionLength: 80,
      h1Count: 1,
      diagnostics,
    }], new Date('2026-01-02T00:00:00Z'));

    expect(report.summary.errors).toBe(1);
    expect(shouldFailSsrBuild(site, diagnostics)).toBe(true);
  });
});

describe('aurelia2-ssr document rendering', () => {
  test('injects SEO, structured data, resource hints, CSS modules, scripts, preboot, and context', () => {
    const result = buildSsrDocument({
      template: '<html><head><script type="module" src="/main.js"></script></head><body><ssr-app></ssr-app></body></html>',
      route: homeRoute,
      site,
      render: {
        appHtml: '<ssr-app><h1>Hello</h1><p>Server rendered.</p></ssr-app>',
        path: '/',
        timings: { renderMs: 20 },
      },
      manifest: {
        'src/home.ts': {
          file: 'assets/home.123.js',
          css: ['assets/home.123.css'],
          imports: ['src/shared.ts'],
        },
        'src/shared.ts': {
          file: 'assets/shared.123.js',
          css: ['assets/shared.123.css'],
        },
      },
      now: new Date('2026-01-02T00:00:00Z'),
    });

    expect(result.html).toContain('<html lang="en-AU" data-aurelia-ssr-prerendered="">');
    expect(result.document.title).toBe(homeRoute.seo.title);
    expect(result.document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(homeRoute.seo.description);
    expect(result.document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://example.com/');
    expect(result.document.querySelector('link[rel="preconnect"]')?.getAttribute('crossorigin')).toBe('');
    expect(result.document.querySelector('link[rel="modulepreload"][href="/assets/home.123.js"]')).toBeTruthy();
    expect(result.document.querySelector('link[rel="stylesheet"][href="/assets/home.123.css"]')).toBeTruthy();
    expect(result.document.querySelector('link[rel="preload"][as="image"]')?.getAttribute('fetchpriority')).toBe('high');
    expect(result.document.querySelector('style#critical-css')?.textContent).toContain('body{color:#111}');
    expect(result.document.querySelector('script[data-aurelia-ssr-preboot]')?.textContent).toContain('__AURELIA_SSR_PREBOOT__');
    expect(result.document.querySelector('script#analytics')?.getAttribute('defer')).toBe('');
    expect(result.document.querySelector('script[type="application/ld+json"]')?.textContent).toContain('BreadcrumbList');
    expect(result.document.querySelector('#aurelia-ssr-context')?.textContent).toContain('"path":"/"');
    expect(result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([]);
  });

  test('detects duplicated app hosts after document assembly', () => {
    const result = buildSsrDocument({
      template: '<html><head></head><body><ssr-app></ssr-app><ssr-app></ssr-app></body></html>',
      route: homeRoute,
      site,
      render: {
        appHtml: '<ssr-app><h1>Hello</h1></ssr-app>',
        path: '/',
      },
    });

    expect(analyzeSsrDocument(result, homeRoute, site, { appHtml: result.html, path: '/' }))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'duplicate_host' }),
      ]));
  });

  test('collects Vite manifest scripts and CSS module styles recursively', () => {
    const assets = collectManifestAssets(['src/home.ts'], {
      'src/home.ts': {
        file: 'assets/home.js',
        css: ['assets/home.module.css'],
        imports: ['src/chunk.ts'],
      },
      'src/chunk.ts': {
        file: 'assets/chunk.js',
        css: ['assets/chunk.css'],
      },
    });

    expect(assets.scripts).toEqual(['/assets/home.js', '/assets/chunk.js']);
    expect(assets.styles).toEqual(['/assets/home.module.css', '/assets/chunk.css']);
  });
});

describe('aurelia2-ssr Shadow DOM, preboot, and browser shims', () => {
  test('serializes Shadow DOM as declarative shadow DOM and preserves adopted stylesheet content', () => {
    const host = document.createElement('x-card');
    host.setAttribute('tone', 'dark');
    host.attachShadow({ mode: 'open' });
    host.shadowRoot!.innerHTML = '<style>:host{display:block}</style><span>Shadow content</span>';

    const html = serializeElementForSsr(host, {
      shadowDom: {
        serialize: true,
        includeSerializableAttribute: true,
      },
      stripAureliaMarkers: true,
    });

    expect(html).toContain('<x-card tone="dark">');
    expect(html).toContain('<template shadowrootmode="open" shadowrootserializable>');
    expect(html).toContain('<span>Shadow content</span>');
  });

  test('strips Aurelia marker comments only when configured', () => {
    const host = document.createElement('div');
    host.append(document.createComment('au-start'));
    host.append(document.createElement('span'));
    host.append(document.createComment('au-end'));

    expect(serializeElementForSsr(host, { stripAureliaMarkers: true })).toBe('<div><span></span></div>');
    expect(serializeElementForSsr(host, { stripAureliaMarkers: false })).toContain('<!--au-start-->');
  });

  test('captures input before takeover and replays it after remount', async () => {
    delete window.__AURELIA_SSR_PREBOOT__;
    document.documentElement.setAttribute('data-aurelia-ssr-prerendered', '');
    document.body.innerHTML = '<form id="authForm"><input id="emailInput" name="email" value=""></form>';

    window.eval(createPrebootScript({ replayAfterMs: 10 }));

    const prerenderedInput = document.querySelector<HTMLInputElement>('#emailInput')!;
    prerenderedInput.value = 'artist@example.com';
    prerenderedInput.dispatchEvent(new Event('input', { bubbles: true }));

    document.body.innerHTML = '<form id="authForm"><input id="emailInput" name="email" value=""></form>';
    finishSsrTakeover();

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(document.querySelector<HTMLInputElement>('#emailInput')?.value).toBe('artist@example.com');
    expect(document.documentElement.hasAttribute('data-aurelia-taken-over')).toBe(true);
  });

  test('clears prerendered host only for remount takeover', () => {
    document.documentElement.setAttribute('data-aurelia-ssr-prerendered', '');
    document.body.innerHTML = '<ssr-app><h1>Server copy</h1></ssr-app>';

    const hydratedHost = prepareSsrHostForTakeover({ selector: 'ssr-app', mode: 'hydrate' });
    expect(hydratedHost?.innerHTML).toContain('Server copy');

    const remountHost = prepareSsrHostForTakeover({ selector: 'ssr-app', mode: 'remount' });
    expect(remountHost?.innerHTML).toBe('');
    expect(remountHost?.hasAttribute('data-aurelia-ssr-cleared')).toBe(true);
  });

  test('installs and restores browser globals without leaking request state', () => {
    const previousValue = (globalThis as Record<string, unknown>).__SSR_TEST_GLOBAL__;
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const fakeWindow = iframe.contentWindow!;
    (fakeWindow as Window & Record<string, unknown>).__SSR_TEST_GLOBAL__ = 'request-local';
    const restore = installDomGlobals(fakeWindow, {
      keys: ['__SSR_TEST_GLOBAL__'],
      includeAnimationFrame: false,
      includeMatchMedia: false,
      includeObservers: false,
      includeStorage: false,
    });

    try {
      expect((globalThis as Record<string, unknown>).__SSR_TEST_GLOBAL__).toBe('request-local');
    } finally {
      restore();
      iframe.remove();
      expect((globalThis as Record<string, unknown>).__SSR_TEST_GLOBAL__).toBe(previousValue);
    }
  });

  test('memory storage behaves like browser storage for server-only code', () => {
    const storage = createMemoryStorage();
    storage.setItem('theme', 'dark');

    expect(storage.getItem('theme')).toBe('dark');
    expect(storage.key(0)).toBe('theme');
    storage.removeItem('theme');
    expect(storage.length).toBe(0);
  });
});

describe('aurelia2-ssr Aurelia core integration', () => {
  test('registers shipped ISSRContext so Aurelia preserves hydration markers on the server', () => {
    const container = DI.createContainer();
    const { container: serverContainer } = createServerContainer(window, [], true, container);

    expect(serverContainer.get(ISSRContext)).toEqual({ preserveMarkers: true });
  });

  test('can render a real Aurelia component to HTML', async () => {
    const SsrApp = CustomElement.define({
      name: 'ssr-app',
      template: '<template><h1>${message}</h1><input value.bind="message"></template>',
    }, class {
      public message = 'Hello from Aurelia';
    });

    document.body.innerHTML = '<ssr-app></ssr-app>';

    const result = await renderAureliaToString({
      window,
      component: SsrApp,
      site,
      route: homeRoute,
      settle: 0,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.appHtml).toContain('<ssr-app>');
    expect(result.appHtml).toContain('Hello from Aurelia');
    expect(result.appHtml).toContain('<!--au');
  });

  test('provides an optional router registration backed by Aurelia core ServerLocationManager', async () => {
    const registrations = await createSsrRouterRegistrations({ path: '/products/123?tab=details' });

    expect(registrations.length).toBe(1);
  });
});
