import { CustomElement, resolve } from 'aurelia';
import { DI } from '@aurelia/kernel';
import {
  ISsrHead,
  ISsrRoute,
  ISsrState,
  SsrState,
  cacheControl,
  collectSsrRedirects,
  createMemorySsrCache,
  createNetlifyRedirects,
  createNodeSsrMiddleware,
  createSsrFetchInterceptor,
  createSsrRedirectFiles,
  createSsrRequestHandler,
  createVercelConfig,
  defineSsrConfig,
  expandSsrRoutes,
  fillSsrPath,
  formatSsrDiagnosticsForGitHub,
  formatSsrReport,
  formatSsrReportMarkdown,
  hashString,
  hydrateAureliaSsr,
  matchSsrRoute,
  notFoundRoute,
  outputFileForRoute,
  prerenderSite,
  redirectRoute,
  registerClientSsrState,
  renderAureliaToString,
  SsrTemplateElementFactory,
  ssrData,
  type SsrDomEnvironment,
  type SsrOutputFile,
  type SsrRouteConfig,
} from '../src';
import { IPlatform, Registration } from '@aurelia/kernel';
import { parseArgs, runCli } from '../src/cli';
import { aureliaSsr } from '../src/vite';
import { assertSsrHydrates, expectSsrHydration, manifestSnapshot, renderSsrForTest } from '../src/testing';

const HOST = 'ssr-pipe-app';

class PipeAppModel {
  public readonly state = resolve(ISsrState);
  public readonly head = resolve(ISsrHead);
  public readonly route = resolve(ISsrRoute);
  public items: string[] = [];
  public loads = 0;

  public async binding(): Promise<void> {
    this.items = await ssrData(this.state, 'items', async () => {
      this.loads++;
      return ['alpha', 'beta'];
    });

    const slug = this.route?.params?.slug;
    if (this.route?.path === '/about') {
      this.head.setTitle('About from component').setMeta({ name: 'author', content: 'Component' }).addJsonLd({ '@type': 'AboutPage' });
    }
    if (slug === 'missing') {
      this.head.setStatus(404);
    }
    if (slug === 'moved') {
      this.head.redirect('/blog/hello', 301);
    }
  }
}

const PipeApp = CustomElement.define({
  name: HOST,
  template: '<h1>${route ? route.path : "no route"}</h1><ul><li repeat.for="item of items">${item}</li></ul>',
}, PipeAppModel);

const site = defineSsrConfig({
  origin: 'https://example.com',
  siteName: 'Example',
  rendering: { hostTagName: HOST, takeoverMode: 'hydrate' },
  preboot: { enabled: false },
  diagnostics: { budgets: { descriptionMinLength: 5 } },
  output: { redirects: ['netlify', 'vercel'] },
  cache: { maxAge: 0, sMaxAge: 60 },
  routes: [
    { path: '/', seo: { title: 'Home', description: 'Home page description', sitemap: { include: true, priority: 1 } } },
    { path: '/about', cache: { ttlMs: 60_000, sMaxAge: 120 }, seo: { title: 'About', description: 'About page description', sitemap: { include: true } } },
    {
      path: '/blog/:slug',
      seo: { title: 'Blog', description: 'Blog post description', sitemap: { include: true } },
      expand: () => [{ params: { slug: 'hello' }, seo: { title: 'Hello post' } }, '/blog/world'],
    },
    { path: '/products/:id', mode: 'server', seo: { title: 'Product', description: 'Product description' } },
    { path: '/legacy/:id', seo: { title: 'Legacy', description: 'Legacy description' } },
    redirectRoute('/old', '/about'),
    notFoundRoute(),
  ] satisfies SsrRouteConfig[],
});

const template = `<!doctype html><html><head><script type="module" src="/main.js"></script></head><body><${HOST}></${HOST}></body></html>`;

function sharedEnvironment(): SsrDomEnvironment {
  document.body.innerHTML = `<${HOST}></${HOST}>`;
  return { window, document, close: () => undefined };
}

describe('routes: matching, expansion, and output files', () => {
  test('matches static, param, optional, and wildcard routes with precedence', () => {
    const routes: SsrRouteConfig[] = [
      { path: '/docs/*', seo: { title: 'a', description: 'b' } },
      { path: '/docs/:section/:page?', seo: { title: 'a', description: 'b' } },
      { path: '/docs/intro', seo: { title: 'a', description: 'b' } },
    ];

    expect(matchSsrRoute('/docs/intro', routes)?.route.path).toBe('/docs/intro');
    expect(matchSsrRoute('/docs/guide', routes)?.params).toEqual({ section: 'guide' });
    expect(matchSsrRoute('/docs/guide/two?x=1', routes)?.params).toEqual({ section: 'guide', page: 'two' });
    expect(matchSsrRoute('/docs/a/b/c', routes)?.params).toEqual({ '*': 'a/b/c' });
    expect(matchSsrRoute('/nope', routes)).toBeNull();
    expect(fillSsrPath('/blog/:slug/:page?', { slug: 'hi there', page: 2 })).toBe('/blog/hi%20there/2');
  });

  test('expands dynamic routes and reports unexpanded patterns', async () => {
    const result = await expandSsrRoutes(site.routes!);
    const paths = result.routes.map(route => route.path);

    expect(paths).toEqual(['/', '/about', '/blog/hello', '/blog/world', '/products/:id', '/old', '/404']);
    expect(result.routes.find(route => route.path === '/blog/hello')).toMatchObject({
      params: { slug: 'hello' },
      seo: { title: 'Hello post', description: 'Blog post description' },
    });
    expect(result.routes.find(route => route.path === '/blog/world')?.params).toEqual({ slug: 'world' });
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: 'route_needs_expansion', path: '/legacy/:id' })]);
  });

  test('supports clean URLs and explicit file names', () => {
    expect(outputFileForRoute('/about', { cleanUrls: true })).toBe('about/index.html');
    expect(outputFileForRoute('/about')).toBe('about.html');
    expect(outputFileForRoute('/feed.xml')).toBe('feed.xml');
    expect(outputFileForRoute('/', { cleanUrls: true })).toBe('index.html');
  });
});

describe('template factory', () => {
  test('caches parsed templates per document so a second window parses its own copy', () => {
    const otherDocument = document.implementation.createHTMLDocument('other');
    const markup = '<template><div class="x">${a}</div></template>';

    const first = DI.createContainer().register(Registration.instance(IPlatform, { document })).get(SsrTemplateElementFactory);
    const second = DI.createContainer().register(Registration.instance(IPlatform, { document: otherDocument })).get(SsrTemplateElementFactory);

    const a = first.createTemplate(markup);
    const b = first.createTemplate(markup);
    const c = second.createTemplate(markup);

    // Template contents live in each document's inert template document, so
    // compare against those rather than the documents themselves.
    const inertOf = (doc: Document) => doc.createElement('template').content.ownerDocument;
    expect(a).not.toBe(b);
    expect(a.content.ownerDocument === inertOf(document)).toBe(true);
    expect(c.content.ownerDocument === inertOf(otherDocument)).toBe(true);
    expect(inertOf(document) === inertOf(otherDocument)).toBe(false);
    expect(c.content.firstElementChild?.className).toBe('x');
    expect(first.createTemplate('<p>one</p><p>two</p>').content.childElementCount).toBe(2);
  });
});

describe('redirect and 404 output', () => {
  test('emits platform redirect files and redirect pages', () => {
    const rules = collectSsrRedirects(site.routes!);
    expect(rules).toEqual([{ from: '/old', to: '/about', status: 301 }]);
    expect(createNetlifyRedirects(rules, { notFoundFile: '404.html' })).toBe('/old /about 301\n/* /404.html 404\n');
    expect(createNetlifyRedirects(rules, { spaFallback: true })).toContain('/* /index.html 200');
    expect(JSON.parse(createVercelConfig(rules, { cleanUrls: true }))).toEqual({
      cleanUrls: true,
      redirects: [{ source: '/old', destination: '/about', permanent: true }],
    });

    const files = createSsrRedirectFiles(site.routes!, site);
    expect(files.map(file => file.path)).toEqual(['_redirects', 'vercel.json', 'old.html']);
    expect(files.at(-1)?.contents).toContain('<meta http-equiv="refresh" content="0; url=/about">');
  });
});

describe('state transfer and head service', () => {
  test('server render captures ISsrState, ISsrHead, and ISsrRoute; document embeds them', async () => {
    sharedEnvironment();
    const render = await renderAureliaToString({
      window,
      component: PipeApp,
      site,
      route: site.routes![1],
    });

    expect(render.state).toEqual({ items: ['alpha', 'beta'] });
    expect(render.head?.title).toBe('About from component');
    expect(render.head?.meta).toEqual([{ name: 'author', content: 'Component' }]);
    expect(render.appHtml).toContain('<h1><!--au-->/about</h1>');

    const { buildSsrDocument } = await import('../src/document');
    const page = buildSsrDocument({ template, route: site.routes![1], site, render });
    expect(page.document.title).toBe('About from component');
    expect(page.document.querySelector('meta[name="author"]')?.getAttribute('content')).toBe('Component');
    expect(page.document.querySelector('script[type="application/ld+json"]')?.textContent).toContain('AboutPage');
    expect(JSON.parse(page.document.getElementById('aurelia-ssr-state')!.textContent!)).toEqual({ items: ['alpha', 'beta'] });
  });

  test('client reads embedded state so ssrData skips the loader, and hydration registers it', async () => {
    sharedEnvironment();
    const render = await renderAureliaToString({ window, component: PipeApp, site, route: site.routes![0] });
    const { buildSsrDocument } = await import('../src/document');
    const page = buildSsrDocument({ template, route: site.routes![0], site, render });

    document.documentElement.innerHTML = page.document.documentElement.innerHTML;
    document.documentElement.setAttribute('data-aurelia-ssr-prerendered', '');

    const clientState = SsrState.fromDocument();
    expect(clientState.isServer).toBe(false);
    expect(clientState.get('items')).toEqual(['alpha', 'beta']);

    let loaderCalls = 0;
    const value = await ssrData(clientState, 'items', () => {
      loaderCalls++;
      return ['fresh'];
    }, { consume: true });
    expect(value).toEqual(['alpha', 'beta']);
    expect(loaderCalls).toBe(0);
    expect(clientState.has('items')).toBe(false);
    expect(await ssrData(clientState, 'items', () => ['fresh'])).toEqual(['fresh']);

    const container = DI.createContainer();
    expect(registerClientSsrState(container)?.get('items')).toEqual(['alpha', 'beta']);
    expect(registerClientSsrState(container)).toBeNull();

    const hydration = await hydrateAureliaSsr({ component: PipeApp, hostSelector: HOST });
    try {
      const viewModel = hydration.root.controller.viewModel as PipeAppModel;
      expect(viewModel.loads).toBe(0);
      expect(viewModel.items).toEqual(['alpha', 'beta']);
      expect(viewModel.route?.path).toBe('/');
      expect(hydration.host.innerHTML).toContain('<li><!--au-->alpha</li>');
    } finally {
      await hydration.stop();
    }
  });

  test('fetch interceptor records on the server and replays on the client', async () => {
    class FakeHeaders {
      private readonly map = new Map<string, string>();
      public constructor(init: Record<string, string> | [string, string][] = {}) {
        for (const [name, value] of Array.isArray(init) ? init : Object.entries(init)) {
          this.map.set(name.toLowerCase(), value);
        }
      }
      public forEach(callback: (value: string, name: string) => void): void {
        this.map.forEach(callback);
      }
      public get(name: string): string | null {
        return this.map.get(name.toLowerCase()) ?? null;
      }
    }
    class FakeResponse {
      public readonly headers: FakeHeaders;
      public constructor(private readonly body: string, public readonly init: { status?: number; statusText?: string; headers?: [string, string][] } = {}) {
        this.headers = new FakeHeaders(init.headers ?? []);
      }
      public get status(): number { return this.init.status ?? 200; }
      public get statusText(): string { return this.init.statusText ?? 'OK'; }
      public get ok(): boolean { return this.status >= 200 && this.status < 300; }
      public clone(): FakeResponse { return new FakeResponse(this.body, this.init); }
      public async text(): Promise<string> { return this.body; }
    }
    const previousResponse = (globalThis as { Response?: unknown }).Response;
    (globalThis as { Response?: unknown }).Response = FakeResponse;

    try {
      const serverState = SsrState.forServer();
      const server = createSsrFetchInterceptor(serverState);
      const request = { method: 'GET', url: 'https://api.example.com/items' } as Request;
      const response = new FakeResponse('[1,2]', { headers: [['content-type', 'application/json']] }) as unknown as Response;

      expect(server.request(request)).toBe(request);
      expect(await server.response(response, request)).toBe(response);
      expect(serverState.get('fetch:GET:https://api.example.com/items')).toMatchObject({ status: 200, body: '[1,2]' });

      const clientState = new SsrState(serverState.toJSON(), false);
      const client = createSsrFetchInterceptor(clientState);
      const replayed = client.request(request) as unknown as FakeResponse;
      expect(replayed).toBeInstanceOf(FakeResponse);
      expect(await replayed.text()).toBe('[1,2]');
      expect(replayed.headers.get('content-type')).toBe('application/json');
      expect(client.request(request)).toBe(request);
    } finally {
      (globalThis as { Response?: unknown }).Response = previousResponse;
    }
  });
});

describe('prerenderSite', () => {
  test('renders every route and writes pages, redirects, 404, sitemap, robots, and report', async () => {
    const files: SsrOutputFile[] = [];
    const result = await prerenderSite({
      site,
      component: PipeApp,
      template,
      outDir: '/virtual/dist',
      write: (file, absolutePath) => {
        files.push(file);
        expect(absolutePath).toBe(`/virtual/dist/${file.path}`);
      },
      createEnvironment: () => sharedEnvironment(),
      now: new Date('2026-01-02T00:00:00Z'),
    });

    const byPath = Object.fromEntries(files.map(file => [file.path, file]));
    expect(Object.keys(byPath).sort()).toEqual([
      '404.html', '_redirects', 'about.html', 'blog/hello.html', 'blog/world.html', 'index.html',
      'old.html', 'robots.txt', 'sitemap.xml', 'ssr-report.json', 'vercel.json',
    ]);
    expect(byPath['404.html'].kind).toBe('page');
    expect(byPath['404.html'].contents).toContain('<title>Page not found</title>');
    expect(byPath['about.html'].contents).toContain('<title>About from component</title>');
    expect(byPath['blog/hello.html'].contents).toContain('<h1><!--au-->/blog/hello</h1>');
    expect(byPath['blog/hello.html'].contents).toContain('id="aurelia-ssr-state"');
    expect(byPath['blog/hello.html'].contents).toContain('"params":{"slug":"hello"}');
    expect(byPath['sitemap.xml'].contents).toContain('<loc>https://example.com/blog/world</loc>');
    expect(byPath['sitemap.xml'].contents).not.toContain('/old');
    expect(byPath['_redirects'].contents).toBe('/old /about 301\n/* /404.html 404\n');

    expect(result.routes.filter(route => route.kind === 'page').map(route => route.path)).toEqual(['/', '/about', '/blog/hello', '/blog/world', '/404']);
    expect(result.routes.find(route => route.path === '/products/:id')?.kind).toBe('skipped');
    expect(result.routes.find(route => route.path === '/old')?.kind).toBe('redirect');
    expect(result.report.summary.routes).toBe(5);
    expect(result.report.summary.errors).toBe(0);
    expect(result.diagnostics.map(d => d.code)).toContain('route_needs_expansion');
    expect(result.failed).toBe(false);

    const report = JSON.parse(byPath['ssr-report.json'].contents);
    expect(report.configDiagnostics).toEqual([expect.objectContaining({ code: 'route_needs_expansion' })]);
  });

  test('honours only, component redirects, and continueOnError', async () => {
    const files: SsrOutputFile[] = [];
    const result = await prerenderSite({
      site,
      component: PipeApp,
      template,
      routes: [
        ...site.routes!.filter(route => route.path === '/'),
        {
          path: '/blog/:slug',
          seo: { title: 'Blog', description: 'Blog description' },
          expand: () => [{ params: { slug: 'moved' } }, { params: { slug: 'moved' } }],
        },
      ],
      only: ['/blog/moved'],
      output: { sitemap: false, robots: false, report: false, redirects: ['json'] },
      write: file => {
        files.push(file);
      },
      createEnvironment: () => sharedEnvironment(),
    });

    expect(files.map(file => file.path).sort()).toEqual(['blog/moved.html', 'redirects.json']);
    expect(files.find(file => file.path === 'blog/moved.html')?.kind).toBe('redirect-page');
    expect(JSON.parse(files.find(file => file.path === 'redirects.json')!.contents)).toEqual([{ from: '/blog/moved', to: '/blog/hello', status: 301 }]);
    expect(result.routes).toHaveLength(1);
    expect(result.diagnostics.filter(d => d.code === 'route_duplicate_after_expansion')).toHaveLength(1);
  });
});

describe('request-time handler', () => {
  const handler = createSsrRequestHandler({
    site,
    component: PipeApp,
    template,
    createEnvironment: () => sharedEnvironment(),
  });

  test('renders matched routes with cache headers and weak ETags', async () => {
    const response = await handler({ url: '/blog/world?utm=1' });
    expect(response.status).toBe(200);
    expect(response.source).toBe('render');
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.headers['cache-control']).toBe('public, max-age=0, s-maxage=60');
    expect(response.headers.etag).toMatch(/^W\/"[0-9a-f]+"$/u);
    expect(response.body).toContain('<h1><!--au-->/blog/world</h1>');
    expect(response.body).toContain('"params":{"slug":"world"}');

    const notModified = await handler({ url: '/blog/world?utm=1', headers: { 'if-none-match': response.headers.etag } });
    expect(notModified.status).toBe(304);
    expect(notModified.body).toBe('');
  });

  test('serves from the memory cache when a route sets ttlMs', async () => {
    await handler.invalidate();
    const first = await handler({ url: '/about' });
    const second = await handler({ url: '/about' });
    expect(first.source).toBe('render');
    expect(first.headers['cache-control']).toBe('public, max-age=0, s-maxage=120');
    expect(second.source).toBe('cache');
    expect(second.body).toBe(first.body);
    await handler.invalidate('/about');
    expect((await handler({ url: '/about' })).source).toBe('render');
  });

  test('handles config redirects, component redirects, component 404s, and fallbacks', async () => {
    const redirect = await handler({ url: '/old?keep=1' });
    expect(redirect.status).toBe(301);
    expect(redirect.headers.location).toBe('/about?keep=1');

    const moved = await handler({ url: '/blog/moved' });
    expect(moved.status).toBe(301);
    expect(moved.headers.location).toBe('/blog/hello');
    expect(moved.source).toBe('redirect');

    const missing = await handler({ url: '/blog/missing' });
    expect(missing.status).toBe(404);
    expect(missing.body).toContain('<h1><!--au-->/blog/missing</h1>');

    const spa = await handler({ url: '/nowhere' });
    expect(spa.status).toBe(200);
    expect(spa.source).toBe('spa');
    expect(spa.body).toBe(template);

    const notFound = createSsrRequestHandler({ site, component: PipeApp, template, fallback: 'not-found', createEnvironment: () => sharedEnvironment() });
    const page = await notFound({ url: '/nowhere' });
    expect(page.status).toBe(404);
    expect(page.body).toContain('<title>Page not found</title>');

    const post = await handler({ url: '/about', method: 'POST' });
    expect(post.status).toBe(405);
  });

  test('node middleware writes the response and defers assets to the next handler', async () => {
    const middleware = createNodeSsrMiddleware(handler);
    const headers: Record<string, string> = {};
    let body = '';
    const res = {
      statusCode: 0,
      setHeader: (name: string, value: string) => { headers[name] = value; },
      end: (chunk?: string) => { body = chunk ?? ''; },
    };

    let nextCalls = 0;
    await middleware({ url: '/assets/app.js', method: 'GET', headers: { accept: '*/*' } }, res, () => { nextCalls++; });
    expect(nextCalls).toBe(1);

    await middleware({ url: '/', method: 'GET', headers: { accept: 'text/html' } }, res, () => { nextCalls++; });
    expect(nextCalls).toBe(1);
    expect(res.statusCode).toBe(200);
    expect(headers['content-length']).toBe(String(Buffer.byteLength(body)));
    expect(body).toContain(`<${HOST}>`);
  });

  test('cache-control and hashing helpers', () => {
    expect(cacheControl({})).toBe('public, max-age=0, must-revalidate');
    expect(cacheControl({ noStore: true })).toBe('no-store');
    expect(cacheControl({ private: true, maxAge: 30, staleWhileRevalidate: 60 })).toBe('private, max-age=30, stale-while-revalidate=60');
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));

    const cache = createMemorySsrCache({ maxEntries: 1 });
    cache.set('/a', { status: 200, headers: {}, body: 'a', expiresAt: Date.now() + 1000 }, 1000);
    cache.set('/b', { status: 200, headers: {}, body: 'b', expiresAt: Date.now() + 1000 }, 1000);
    expect(cache.get('/a')).toBeUndefined();
    expect(cache.get('/b')?.body).toBe('b');
  });
});

describe('vite plugin', () => {
  test('serves server-rendered HTML through the dev middleware', async () => {
    const plugin = aureliaSsr({
      entry: 'src/ssr-entry.ts',
      config: 'ssr.config.ts',
      dev: { createEnvironment: () => sharedEnvironment() },
    });

    expect(plugin.apply?.({}, { command: 'serve', mode: 'development' })).toBe(true);
    expect(plugin.apply?.({}, { command: 'build', mode: 'production', isSsrBuild: true })).toBe(false);

    let middleware: ((req: unknown, res: unknown, next: (error?: unknown) => void) => void) | null = null;
    const server = {
      config: { root: '/app', command: 'serve' as const, mode: 'development', build: { outDir: 'dist' } },
      middlewares: { use: (handler: typeof middleware) => { middleware = handler; } },
      ssrLoadModule: async (url: string) => url === '/src/ssr-entry.ts' ? { default: PipeApp } : { default: site },
      transformIndexHtml: async (_url: string, html: string) => html.replace('</head>', '<meta name="dev" content="1"></head>'),
      close: async () => undefined,
    };

    const readFile = jest.fn(async () => template);
    jest.doMock('node:fs/promises', () => ({ readFile }), { virtual: true });

    const post = await plugin.configureServer!(server);
    expect(typeof post).toBe('function');
    (post as () => void)();
    expect(middleware).not.toBeNull();

    const headers: Record<string, string> = {};
    let body = '';
    const res = { statusCode: 0, setHeader: (name: string, value: string) => { headers[name] = value; }, end: (chunk?: string) => { body = chunk ?? ''; } };
    await new Promise<void>((resolveDone, reject) => {
      const finish = (error?: unknown) => (error ? reject(error) : resolveDone());
      const originalEnd = res.end;
      res.end = chunk => { originalEnd(chunk); resolveDone(); };
      middleware!({ url: '/about', method: 'GET', headers: { accept: 'text/html' } }, res, finish);
    });

    expect(readFile).toHaveBeenCalledWith('/app/index.html', 'utf8');
    expect(res.statusCode).toBe(200);
    expect(body).toContain('<meta name="dev" content="1">');
    expect(body).toContain('<title>About from component</title>');
    jest.dontMock('node:fs/promises');
  });

  test('skips prerendering when disabled or not building', async () => {
    const plugin = aureliaSsr({ entry: 'src/ssr-entry.ts', config: site, prerender: false });
    await plugin.configResolved!({ root: '/app', command: 'build', mode: 'production', build: { outDir: 'dist' } });
    await expect(plugin.closeBundle!()).resolves.toBeUndefined();
  });
});

describe('testing helpers, report formatting, and CLI', () => {
  const SimpleApp = CustomElement.define({
    name: 'ssr-simple-app',
    template: '<h1>${title}</h1><p if.bind="show">yes</p>',
  }, class {
    public title = 'Simple';
    public show = true;
  });

  test('renderSsrForTest, expectSsrHydration, and manifestSnapshot', async () => {
    const rendered = await renderSsrForTest(SimpleApp, { document: true });
    expect(rendered.appHtml).toContain('<h1><!--au-->Simple</h1>');
    expect(rendered.html).toContain('<title>Test</title>');
    expect(rendered.errors).toEqual([]);

    const verification = await expectSsrHydration(SimpleApp);
    expect(verification.ok).toBe(true);
    expect(manifestSnapshot(verification.ssrScope)).toEqual({
      name: 'ssr-simple-app',
      children: [{ tc: 'if', state: { value: true }, views: [{ nodes: 1, children: [] }] }],
    });
    await expect(assertSsrHydrates(SimpleApp)).resolves.toMatchObject({ ok: true });
  });

  test('formats reports for terminals, GitHub, and markdown', () => {
    const report = {
      generatedAt: '2026-01-02T00:00:00.000Z',
      origin: 'https://example.com',
      routes: [{
        path: '/', mode: 'prerender', status: 200, canonicalUrl: 'https://example.com/', priority: 'normal', renderMs: 12,
        htmlBytes: 2048, appHtmlBytes: 512, title: 'Home', descriptionLength: 60, h1Count: 1,
        diagnostics: [{ severity: 'warning' as const, code: 'title_too_long', message: 'Title is long', path: '/' }],
      }],
      summary: { routes: 1, warnings: 1, errors: 0, totalHtmlBytes: 2048, slowestRouteMs: 12 },
    };
    const extra = [{ severity: 'error' as const, code: 'config_invalid', message: 'bad: thing', path: '/x' }];

    const text = formatSsrReport(report, extra);
    expect(text).toContain('▲ /');
    expect(text).toContain('warning title_too_long /: Title is long');
    expect(text).toContain('1 route, 0 errors, 1 warning, 2.0 kB HTML, slowest 12ms');
    expect(formatSsrDiagnosticsForGitHub([...report.routes[0].diagnostics, ...extra])).toBe(
      '::warning title=title_too_long /::Title is long\n::error title=config_invalid /x::bad%3A thing'.replace('bad%3A thing', 'bad: thing'),
    );
    expect(formatSsrReportMarkdown(report, extra)).toContain('| `/` | 200 | 12ms | 2.0 kB | Home | ⚠️ `title_too_long` |');
  });

  test('CLI parses arguments and prints a saved report', async () => {
    expect(parseArgs(['prerender', '--config', 'ssr.config.ts', '--out=dist', '--no-color', 'extra'])).toEqual({
      command: 'prerender',
      flags: { config: 'ssr.config.ts', out: 'dist', 'no-color': true },
      positional: ['extra'],
    });

    const fs = await import('node:fs/promises');
    const os = await import('node:os');
    const path = await import('node:path');
    const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'ssr-report-')), 'ssr-report.json');
    await fs.writeFile(file, JSON.stringify({
      generatedAt: '2026-01-02T00:00:00.000Z',
      origin: 'https://example.com',
      routes: [],
      summary: { routes: 0, warnings: 0, errors: 1, totalHtmlBytes: 0, slowestRouteMs: 0 },
      configDiagnostics: [{ severity: 'error', code: 'config_invalid', message: 'site.siteName is required' }],
    }));

    const chunks: string[] = [];
    const write = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      chunks.push(String(chunk));
      return true;
    });
    try {
      expect(await runCli(['report', file, '--format', 'github'])).toBe(1);
      expect(chunks.join('')).toContain('::error title=config_invalid::site.siteName is required');
      expect(await runCli([])).toBe(1);
      expect(chunks.join('')).toContain('aurelia2-ssr <command>');
    } finally {
      write.mockRestore();
    }
  });
});
