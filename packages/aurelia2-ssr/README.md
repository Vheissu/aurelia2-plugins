# aurelia2-ssr

Server-side rendering, prerendering, SEO, preboot, hydration, and document assembly utilities for Aurelia 2.

This package is designed to be usable today with Aurelia 2 apps while staying aligned with the public SSR primitives already present in Aurelia core:

- `Aurelia.hydrate(...)` for manifest-based client adoption
- `ISSRContext` for preserving Aurelia hydration markers during server rendering
- `ISSRScope` and related manifest types
- `hydrateSSRDefinition(...)` for client-side AOT SSR definition hydration
- `ServerLocationManager` from `@aurelia/router` for router-aware SSR

Aurelia core ships the hydration consumer but leaves manifest recording to
external tooling. `aurelia2-ssr` fills that gap: `renderAureliaToString(...)`
records the `ISSRScope` manifest from the live controller tree after each
render, `buildSsrDocument(...)` embeds it, and `hydrateAureliaSsr(...)` feeds
it back to `Aurelia.hydrate(...)` in the browser. `verifySsrHydration(...)`
re-hydrates the output on the server so a manifest that would bind the wrong
nodes fails the build instead of the user's page. Remount takeover stays
available for apps that prefer it.

Around those primitives the package ships the pipeline most apps end up
writing by hand: `prerenderSite(...)` renders every route (including dynamic
routes expanded from a CMS or filesystem) and writes pages, redirects, the 404
page, sitemap, robots.txt, and a report; `createSsrRequestHandler(...)` does the
same per request with caching, ETags, and adapters for Node and Web servers;
`aureliaSsr()` wires both into Vite; `ISsrState` and `ISsrHead` let components
transfer data to the client and set titles, meta, HTTP status, and redirects;
and the `aurelia2-ssr` CLI plus the `aurelia2-ssr/testing` entry cover CI.

## Install

```bash
npm install aurelia2-ssr jsdom
```

If your app uses the Aurelia router, also install `@aurelia/router`.

For Vite SSR builds, keep every Aurelia package on the same version and avoid
mixing multiple runtime identities. A common safe set is:

```bash
npm install aurelia @aurelia/router @aurelia/vite-plugin @aurelia/testing aurelia2-ssr jsdom
```

Pin the Aurelia packages to the same prerelease or stable version. If the server
bundle imports some resources from `aurelia` and the SSR package resolves
`@aurelia/runtime-html` from a different copy, server rendering can fail with
missing resource, DI, or compiled-definition errors.

## Quick Start

### 1. Describe the site

```ts
// ssr.config.ts
import { defineSsrConfig, notFoundRoute, redirectRoute } from 'aurelia2-ssr';

export default defineSsrConfig({
  origin: 'https://example.com',
  siteName: 'Example',
  rendering: { hostTagName: 'my-app', takeoverMode: 'hydrate' },
  output: { redirects: ['netlify'], cleanUrls: true },
  routes: [
    { path: '/', seo: { title: 'Example', description: 'A useful page description for search engines.', sitemap: { include: true } } },
    {
      path: '/blog/:slug',
      seo: { title: 'Blog', description: 'Posts from the Example team.', sitemap: { include: true } },
      // Dynamic routes expand at build time; return paths, params, or per-page overrides.
      expand: async () => (await fetchPosts()).map(post => ({ params: { slug: post.slug }, seo: { title: post.title } })),
    },
    redirectRoute('/old-blog', '/blog'),
    notFoundRoute(),
  ],
});
```

`defineSsrConfig` is an identity function that gives the file full type
inference, like Vite's `defineConfig`.

### 2. Export a server entry

```ts
// src/ssr-entry.ts
import { RouterConfiguration } from '@aurelia/router';
import { createRouterSettle } from 'aurelia2-ssr';
import { MyApp } from './my-app';

export const component = MyApp;
export const registrations = [RouterConfiguration.customize({ useUrlFragmentHash: false })];
export const settle = createRouterSettle();
```

The renderer registers `@aurelia/router`'s `ServerLocationManager` for the
current path automatically when the router package is installed, so no per-route
wiring is needed. `createRouterSettle()` resolves once the router has no
transition in flight, so redirects from `canLoad` and navigations queued during
startup are reflected in the HTML.

### 3. Prerender with Vite, the CLI, or a script

Vite plugin: server-rendered pages in `vite dev`, and a full prerender after
`vite build` using the built `index.html` and manifest.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import aurelia from '@aurelia/vite-plugin';
import { aureliaSsr } from 'aurelia2-ssr/vite';

export default defineConfig({
  build: { manifest: true },
  plugins: [aurelia(), aureliaSsr({ entry: 'src/ssr-entry.ts', config: 'ssr.config.ts' })],
});
```

CLI (Node 22.18+ loads TypeScript config and entry files directly):

```bash
npx vite build
npx aurelia2-ssr prerender --config ssr.config.ts --entry src/ssr-entry.ts --out dist
npx aurelia2-ssr check --config ssr.config.ts --entry src/ssr-entry.ts --out dist --format github
```

`prerender` writes every page plus `sitemap.xml`, `robots.txt`, `404.html`,
redirect files, and `ssr-report.json`, and exits non-zero when diagnostics
exceed the site's thresholds. `check` renders and hydration-verifies every
route without writing files, so it fits a CI job.

Script, when you need full control:

```ts
import fs from 'node:fs/promises';
import { prerenderSite } from 'aurelia2-ssr';
import site from './ssr.config';
import { MyApp } from './src/my-app';

const result = await prerenderSite({
  site,
  component: MyApp,
  template: await fs.readFile('dist/index.html', 'utf8'),
  manifest: JSON.parse(await fs.readFile('dist/.vite/manifest.json', 'utf8')),
  outDir: 'dist',
  render: { settle: createRouterSettle() },
});

if (result.failed) {
  process.exit(1);
}
```

### 4. Take over on the client

```ts
import { hydrateAureliaSsr } from 'aurelia2-ssr';
import { MyApp } from './my-app';

const { root } = await hydrateAureliaSsr({
  component: MyApp,
  registrations: [RouterConfiguration.customize({ useUrlFragmentHash: false })],
});
```

`hydrateAureliaSsr(...)` reads the embedded manifest and state, calls Aurelia
core's `Aurelia.hydrate(...)`, and runs `finishSsrTakeover()` so preboot
replays. For remount mode instead, keep the SPA bootstrap you already have:

```ts
import Aurelia from 'aurelia';
import { prepareSsrHostForTakeover, finishSsrTakeover, registerClientSsrState } from 'aurelia2-ssr';
import { MyApp } from './my-app';

prepareSsrHostForTakeover({ selector: 'my-app', mode: 'remount' });

const au = new Aurelia();
registerClientSsrState(au.container);
await au.app(MyApp).start();
finishSsrTakeover();
```

Keep the same `.app(...)` form your SPA already uses. For router apps that
boot with `.app(MyApp)`, do not switch to `.app({ host, component: MyApp })`
just for SSR takeover; doing so can leave the initial viewport inactive.

## Data Transfer and Component Head Data

Server renders usually load data that the client then loads again. `ISsrState`
carries values from the render to the browser: anything set on the server is
embedded as `<script type="application/json" id="aurelia-ssr-state">`, and the
client store starts with that data.

```ts
import { resolve } from 'aurelia';
import { ISsrHead, ISsrRoute, ISsrState, ssrData } from 'aurelia2-ssr';

export class ProductPage {
  private readonly state = resolve(ISsrState);
  private readonly head = resolve(ISsrHead);
  private readonly route = resolve(ISsrRoute);
  product?: Product;

  async binding() {
    const id = this.route?.params?.id;
    this.product = await ssrData(this.state, `product:${id}`, () => this.api.product(id));

    if (!this.product) {
      this.head.setStatus(404);
      return;
    }

    this.head
      .setTitle(`${this.product.name} – Example`)
      .setDescription(this.product.summary)
      .setMeta({ property: 'og:image', content: this.product.image })
      .addJsonLd({ '@type': 'Product', name: this.product.name });
  }
}
```

`ssrData(...)` runs the loader on the server and records the result; on the
client it returns the embedded value and skips the loader. `ISsrHead` values are
layered over the route's static SEO in the document, `setStatus(404)` becomes
the HTTP status (and writes `404.html` during prerendering), and
`head.redirect('/new', 301)` turns the response into a redirect. On the client
the same service edits the live document, so it also works for SPA navigation.
`ISsrRoute` exposes the current route config and `params`.

For apps using `@aurelia/fetch-client`, `createSsrFetchInterceptor(state)`
records GET responses during the render and replays them in the browser without
changing component code.

## Request-Time SSR

```ts
import http from 'node:http';
import { createNodeSsrMiddleware, createSsrRequestHandler } from 'aurelia2-ssr';

const handler = createSsrRequestHandler({
  site,
  component: MyApp,
  template,
  manifest,
  fallback: 'spa',
  render: request => ({
    registrations: [RouterConfiguration.customize({ useUrlFragmentHash: false }), ApiConfiguration.forRequest(request)],
    settle: createRouterSettle(),
  }),
});

http.createServer(createNodeSsrMiddleware(handler)).listen(3000);
```

The handler matches the request path against the routes (`:param` and `*`
patterns included), honours `redirectTo`, component-set status and redirects,
per-route `cache` policies (`Cache-Control`, in-memory TTL), and weak ETags with
`304` responses. Unmatched paths serve the SPA shell by default (`fallback:
'render'` and `'not-found'` are available). Renders run one at a time because
DOM globals are process-wide; cached, redirect, and shell responses do not wait.
`handleWebRequest(handler, request)` adapts Web `Request`/`Response` runtimes
(Hono, Bun, Deno, Cloudflare Workers), and `sendNodeResponse` covers Fastify or
Koa style servers.

## Client Takeover Details

### Avoid Flicker in Remount Mode

`mode: 'remount'` clears the server-rendered host before Aurelia starts. That is
correct for avoiding duplicate markup and dead event handlers, but apps that
refetch route data on startup can briefly show a blank or loading state. Keep an
inert copy of the SSR markup visible while the real host remounts:

```ts
import Aurelia from 'aurelia';
import { finishSsrTakeover, prepareSsrHostForTakeover } from 'aurelia2-ssr';
import { MyApp } from './my-app';

const ssrPrerendered = document.documentElement.hasAttribute('data-aurelia-ssr-prerendered');
const existingHost = document.querySelector<HTMLElement>('my-app');
const placeholder = ssrPrerendered && existingHost?.hasChildNodes()
  ? document.createElement('div')
  : null;
let originalHostStyle = '';

if (placeholder && existingHost) {
  placeholder.setAttribute('data-aurelia-ssr-placeholder', '');
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.style.display = 'contents';
  placeholder.innerHTML = existingHost.innerHTML;
  existingHost.before(placeholder);

  originalHostStyle = existingHost.getAttribute('style') ?? '';
  existingHost.style.position = 'absolute';
  existingHost.style.visibility = 'hidden';
  existingHost.style.pointerEvents = 'none';
  existingHost.style.inset = '0';
  existingHost.style.width = '100%';
}

const host = prepareSsrHostForTakeover({
  selector: 'my-app',
  mode: 'remount',
}) ?? existingHost;

if (!host) {
  throw new Error('App host was not found.');
}

function finishTakeover(): void {
  placeholder?.remove();

  if (existingHost) {
    if (originalHostStyle) {
      existingHost.setAttribute('style', originalHostStyle);
    } else {
      existingHost.removeAttribute('style');
    }
  }

  finishSsrTakeover();
}

Aurelia
  .app(MyApp)
  .start()
  .then(() => finishTakeover());
```

Use `visibility: hidden`, not `display: none`, on the real host so components
that measure layout during startup still see a real box. Remove the placeholder
before `finishSsrTakeover()` so preboot replays against the client DOM.

### Hydrate Instead of Remounting

Set the route (or site) takeover mode to `hydrate`. The renderer keeps Aurelia's
marker comments, records the manifest, and `buildSsrDocument(...)` embeds it as
`<script type="application/json" id="aurelia-ssr-manifest">`:

```ts
const render = await renderAureliaToString({
  window,
  component: MyApp,
  site: ssrSite,
  route: { ...route, render: { takeoverMode: 'hydrate', verifyHydration: true } },
});
```

On the client, hydrate the existing DOM instead of clearing it:

```ts
import { hydrateAureliaSsr } from 'aurelia2-ssr';
import { MyApp } from './my-app';

const { root } = await hydrateAureliaSsr({
  component: MyApp,
  hostSelector: 'my-app',
  registrations: [RouterConfiguration.customize({ useUrlFragmentHash: false })],
});
```

`hydrateAureliaSsr(...)` reads the embedded manifest, calls
`Aurelia.hydrate(...)`, and then runs `finishSsrTakeover()` so preboot replays.
Aurelia core's `hydrate()` activates the app root directly and does not go
through `aurelia.start()`; use the returned `root` (or `stop()`) to tear the app
down. Adopted nodes keep their identity, so there is no flash and no duplicated
content, and bindings, `repeat`, `if`/`else`, `with`, `switch`, and routed
components stay live.

Hydration is stricter than remounting. Turn on `verifyHydration` (per route or
in `site.rendering`) during prerendering or in CI: it re-hydrates the serialized
HTML on the server with the real `Aurelia.hydrate()` path and reports
`hydration_nodes_added`, `hydration_nodes_replaced`, or
`hydration_manifest_mismatch` diagnostics when adoption would fail. The
recorder also flags templates whose output cannot survive an HTML round trip,
such as empty or adjacent top-level text nodes inside a template controller.

## Vite Import Identity

The package uses Aurelia core packages directly for SSR primitives. In normal npm
installs those are deduped with the top-level `aurelia` package, but Vite SSR
bundles can still create identity splits if dependencies are resolved through
different paths or versions.

Symptoms include:

- resources registered from `aurelia` not being visible to the server renderer
- `resolve(...)` or DI registrations behaving differently in the server bundle
- render failures that disappear after aliasing imports to one Aurelia runtime

Fixes:

- keep `aurelia`, `@aurelia/*`, `@aurelia/vite-plugin`, and `@aurelia/testing`
  on the same version
- check `npm ls aurelia @aurelia/runtime-html @aurelia/kernel @aurelia/router`
  for duplicates
- in the SSR Vite config, alias `aurelia` to a small server-only shim if your app
  needs one runtime source of truth:

```ts
// vite.ssr.config.ts
import { defineConfig } from 'vite';
import aurelia from '@aurelia/vite-plugin';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      aurelia: path.resolve('src/ssr/aurelia-shim.ts'),
    },
  },
  build: {
    ssr: 'src/entry-server.ts',
  },
  plugins: [
    aurelia({ useDev: false }),
  ],
});
```

```ts
// src/ssr/aurelia-shim.ts
export { resolve } from '@aurelia/kernel';
export { IObserverLocator } from '@aurelia/runtime';
export { Aurelia, bindable, INode } from '@aurelia/runtime-html';
export { Aurelia as default } from '@aurelia/runtime-html';
```

Only add the shim when you have confirmed an identity split. Apps that already
resolve one Aurelia runtime do not need it.

## Long-Running Servers

Rendering many routes or requests in one process used to fail after the first
render with `AUR0757` (`rendering_mismatch_length`, "0 targets"). The cause is in
Aurelia core: `@aurelia/template-compiler` caches parsed template elements in a
module-level map keyed by markup string, so a second DOM window received nodes
owned by the first. `createServerContainer(...)` now registers
`SsrTemplateElementFactory`, which caches per document, so a fresh jsdom per
route or per request works without worker isolation.

`createSsrRequestHandler(...)` serializes renders because `window`, `document`,
and the Aurelia platform are process-wide during a render. For CPU-bound sites,
scale with more processes rather than concurrent renders in one process, or keep
using the worker-thread pattern below and hand each worker its own handler.

```ts
// parent server
const worker = new Worker(new URL('./ssr-worker.js', import.meta.url), {
  workerData: { url, template, manifest },
});
```

```ts
// ssr-worker.ts
import { parentPort, workerData } from 'node:worker_threads';
import { createSsrRequestHandler } from 'aurelia2-ssr';

const handler = createSsrRequestHandler({ site, component: MyApp, template: workerData.template, manifest: workerData.manifest });
parentPort?.postMessage(await handler({ url: workerData.url }));
```

## Configuration

```ts
import type { SsrSiteConfig } from 'aurelia2-ssr';

export const ssrSite: SsrSiteConfig = {
  origin: 'https://example.com',
  siteName: 'Example',
  language: 'en',
  themeColor: '#111111',
  defaultOgImage: '/og.png',
  rendering: {
    hostTagName: 'my-app',
    takeoverMode: 'remount',
    settleMs: 50,
    timeoutMs: 5000,
    stripAureliaMarkers: false,
  },
  shadowDom: {
    serialize: true,
    includeSerializableAttribute: true,
    includeAdoptedStyleSheets: true,
  },
  preboot: {
    enabled: true,
    captureInput: true,
    captureSubmit: true,
    replayAfterMs: 250,
  },
  diagnostics: {
    failOnErrors: true,
    budgets: {
      renderMs: 1200,
      htmlBytes: 180000,
      titleMaxLength: 65,
      descriptionMinLength: 50,
      descriptionMaxLength: 170,
    },
  },
  output: {
    cleanUrls: true,           // about/index.html instead of about.html
    redirects: ['netlify'],    // also: cloudflare, vercel, nginx, apache, json
    notFoundFile: '404.html',
    spaFallback: false,
  },
  cache: { sMaxAge: 60, staleWhileRevalidate: 300 }, // request-time default
  routes: [
    {
      path: '/',
      seo: {
        title: 'Example home',
        description: 'A useful page description for search engines.',
        sitemap: { include: true, priority: 1, changefreq: 'weekly' },
      },
      priority: {
        level: 'critical',
        moduleIds: ['src/home.ts'],
        images: [{ href: '/hero.webp', fetchPriority: 'high' }],
      },
      cache: { ttlMs: 60_000 }, // keep the rendered response in memory for a minute
    },
    {
      path: '/docs/:slug',
      seo: { title: 'Docs', description: 'Documentation for Example.' },
      expand: () => ['/docs/install', { params: { slug: 'usage' }, seo: { title: 'Usage' } }],
    },
    { path: '/api/:id', mode: 'server', seo: { title: 'Item', description: 'Rendered per request.' } },
  ],
};
```

Route modes: `prerender` (default) is written at build time, `server` is left
to the request handler (and still listed in the sitemap), and `client` writes
the document shell with SEO tags but no rendered app.

## Testing

`aurelia2-ssr/testing` works in Jest and Vitest with a jsdom environment:

```ts
import { assertSsrHydrates, expectSsrHydration, manifestSnapshot, renderSsrForTest } from 'aurelia2-ssr/testing';

test('product page hydrates', async () => {
  const result = await expectSsrHydration(ProductPage, { registrations: [FakeApi] });
  expect(result.ok).toBe(true);
  expect(manifestSnapshot(result.ssrScope)).toMatchSnapshot();
});

test('renders the title on the server', async () => {
  const { appHtml, render } = await renderSsrForTest(ProductPage, { registrations: [FakeApi] });
  expect(appHtml).toContain('Example product');
  expect(render.head?.title).toBe('Example product – Example');
});
```

`assertSsrHydrates(...)` throws with the formatted diagnostics, which reads
well in CI logs. For reports, `formatSsrReport`, `formatSsrReportMarkdown`
(for `$GITHUB_STEP_SUMMARY`), and `formatSsrDiagnosticsForGitHub` (workflow
annotations) are exported from the main entry.

## What It Handles

- SEO-first document rendering: titles, descriptions, canonicals, robots, Open Graph, Twitter, JSON-LD, sitemap, and robots.txt helpers
- Route-level priority: modulepreload, CSS from Vite manifests, priority image preloads, global preloads, dns-prefetch, and preconnect
- CSS: global styles, inline critical CSS, linked stylesheets, CSS modules emitted in Vite manifests, Shadow DOM styles, and adopted stylesheets where the runtime exposes readable rules
- Third-party scripts: head/body placement strategies, async/defer, integrity, referrer policy, nonce support, and preboot-safe ordering
- Preboot: captures form input, checkbox state, selection, focus, submits, clicks, and optional keydown before Aurelia takes over
- Manifest recording: `recordSsrManifest(...)` walks the live controller tree and emits the `ISSRScope` tree Aurelia core hydrates from, including template controller views, `if` state, containerless node counts, and routed components under their viewport
- Takeover: true `Aurelia.hydrate(...)` support through `hydrateAureliaSsr(...)`, plus remount fallback for prerendered HTML and no-flicker remount guidance for async apps
- Verification: `verifySsrHydration(...)` re-hydrates the output on the server and reports adoption failures as diagnostics before they reach users
- Router: `createRouterSettle()` waits for redirects and follow-up navigations to finish before the HTML is serialized
- Shadow DOM: open shadow roots serialize to Declarative Shadow DOM templates
- Browser values: request-scoped `window`, `document`, storage, animation frame, matchMedia, ResizeObserver, IntersectionObserver, and global restore helpers
- Diagnostics: route validation, duplicate host detection, SEO budget checks, render/html byte budgets, and build-fail decisions
- Orchestration: `prerenderSite(...)` renders every route with `expand()` for dynamic paths, writes pages, `404.html`, redirect pages and platform redirect files (Netlify, Cloudflare, Vercel, nginx, Apache), sitemap, robots.txt, and the JSON report
- Request time: `createSsrRequestHandler(...)` with route matching, redirects, component status codes, cache policies, ETags, an in-memory response cache, and Node/Web adapters
- Data transfer: `ISsrState`, `ssrData(...)`, and a fetch-client interceptor so hydrated pages reuse server data instead of refetching
- Component head data: `ISsrHead` for titles, meta, links, JSON-LD, HTTP status, and redirects set by components; `ISsrRoute` for the active route and params
- Tooling: the `aureliaSsr()` Vite plugin (dev SSR middleware and post-build prerender), the `aurelia2-ssr` CLI (`prerender`, `check`, `report`), `defineSsrConfig`, and report formatters for terminals, Markdown, and GitHub annotations
- Testing: `aurelia2-ssr/testing` with `renderSsrForTest`, `expectSsrHydration`, `assertSsrHydrates`, and `manifestSnapshot`
- Multi-window safety: a per-document template factory that fixes Aurelia core's module-level template cache for one-jsdom-per-render servers

For the full guide, see [SSR.md](./SSR.md).
