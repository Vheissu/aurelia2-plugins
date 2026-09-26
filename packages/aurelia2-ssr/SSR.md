# Aurelia 2 SSR Guide

This guide explains how `aurelia2-ssr` is intended to be used by application teams and by framework/plugin authors who want a reliable SSR foundation for Aurelia 2.

## Design Goals

`aurelia2-ssr` is not just a prerender script. It aims to cover the full SSR lifecycle:

1. Render an Aurelia 2 app in a request-scoped DOM.
2. Preserve enough DOM structure for the client to take over safely.
3. Make SEO configuration explicit and testable per route.
4. Capture user input that happens before the client bundle has loaded.
5. Record the hydration manifest Aurelia core needs and hydrate through the public `Aurelia.hydrate(...)` API.
6. Verify on the server that the output actually hydrates, and keep a safe remount fallback for apps that prefer it.
7. Ship the surrounding pipeline: a prerender orchestrator with dynamic route expansion and static-host output (redirects, 404), a request-time handler with caching, a Vite plugin, and a CLI.
8. Transfer server data and component-set head data (title, meta, status, redirects) to the client instead of refetching or hard-coding them per route.
9. Document the edge cases that usually make SSR packages hard to adopt.

## Public Aurelia Core APIs Used

The published `2.0.0-rc.2` packages expose the hydration consumer side:

- `Aurelia.hydrate(...)`
- `ISSRContext`
- `ISSRManifest`, `ISSRScope`, `ISSRTemplateController`, and related type guards
- `adoptSSRView(...)` and `adoptSSRViews(...)`
- `hydrateSSRDefinition(...)`
- `ServerLocationManager` from `@aurelia/router`
- `IRendering.compile(...)`, `CustomElement.for(...)`, and the public controller
  tree (`children`, `viewModel`, `nodes`, `location`, `parent`)
- `ITemplateElementFactory` from `@aurelia/template-compiler`, re-implemented
  with a per-document cache (see "First Render Works, Later SSR Requests Fail")

The package uses those exported APIs directly and does not rely on private
source-only functions. Core's own comments say manifest *recording* lives in
external tooling, which is what `recordSsrManifest(...)` provides: it walks the
controller tree after `aurelia.start()` and emits the structure that
`Rendering.render`, the `if`/`repeat`/`with`/`switch` template controllers, and
the router's `RouteContext` read during hydration.

### How the manifest is recorded

For every custom element or synthetic view controller the recorder emits an
`ISSRScope`:

- `children` lists, in template-instruction order, each child custom element
  and template controller found in `controller.children`. Plain custom
  attributes are skipped because the renderer does not ask the manifest for
  them.
- Each template controller becomes `{ type, state?, views }`. Views are the
  controller's active `view`/`views`, each recorded as a scope with `nodeCount`
  equal to the number of sibling DOM nodes it owns between its `au-start` and
  `au-end` markers. `if` records `{ value }` so the client picks the same
  branch; `else` records an empty `views` list because the `if` owns its view.
- Containerless custom elements get a `nodeCount` as well.
- Controllers that were composed outside of template instructions, such as a
  routed component inside `<au-viewport>` or an `au-compose` result, are found
  through the DOM (`CustomElement.for(...)` with `parent` pointing at the
  owner) and appended by name, which is how the router locates them.

The recorder compares the number of recorded children with the compiled
template's child-creating instructions and reports `manifest_child_mismatch`
when they disagree. It also reports `manifest_empty_text_node` and
`manifest_adjacent_text_nodes` for view content that a browser would parse into
a different number of nodes than the server rendered, and `manifest_node_drift`
when the app mutated server DOM after render.

## Rendering Modes

Both modes below describe what happens for one route. `prerenderSite(...)`, the
`aurelia2-ssr` CLI, and the `aureliaSsr()` Vite plugin run the same steps for
every route and write the output; see "Prerender Pipeline" further down.
`createSsrRequestHandler(...)` runs them per request; see "Request-Time
Handler".

### Prerender With Remount Takeover

This is the safest mode for static marketing pages, SEO-heavy sites, and apps that do not yet emit Aurelia SSR manifests.

Server:

```ts
const render = await renderAureliaToString({
  window,
  component: MyApp,
  site: ssrSite,
  route,
  settle: 50,
});
```

Client:

```ts
const host = prepareSsrHostForTakeover({ selector: 'my-app', mode: 'remount' });

if (!host) {
  throw new Error('App host was not found.');
}

Aurelia
  .app(MyApp)
  .start()
  .then(() => finishSsrTakeover());
```

This clears the server-rendered host before Aurelia mounts. That avoids duplicate homepages, duplicate nav, and broken event handlers caused by mounting a second app under an existing prerendered tree.

Keep the client boot shape the SPA already uses. For Aurelia Router apps that
normally start with `.app(MyApp)`, switching to `.app({ host, component:
MyApp })` can leave `<au-viewport>` inactive after remount. Use the returned
host to verify/clear SSR markup, but let Aurelia keep its normal root-component
startup path.

#### Avoiding Remount Flicker

Remount takeover clears the SSR host synchronously. In an app that fetches route
data again during client startup, users can see the SSR page disappear and a
loading state appear before the client route finishes. Keep an inert copy of the
SSR HTML visible while Aurelia remounts into the real host:

```ts
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

const host = prepareSsrHostForTakeover({ selector: 'my-app', mode: 'remount' }) ?? existingHost;

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

Use `aria-hidden` on the placeholder so assistive technology does not see two
copies of the page. Hide the real host with `visibility: hidden` rather than
`display: none` so browser-only widgets that measure layout during startup do
not see zero-width containers. Remove the placeholder before calling
`finishSsrTakeover()` so preboot replays against the client DOM.

### Manifest Hydration

Use this when you want the server DOM adopted in place: no flash, no duplicated
content, and the same node identities the user already sees.

Server:

```ts
const render = await renderAureliaToString({
  window,
  component: MyApp,
  site: ssrSite,
  route: {
    ...route,
    render: { takeoverMode: 'hydrate', verifyHydration: true },
  },
});

const documentResult = buildSsrDocument({ template, site: ssrSite, route, render });
```

`takeoverMode: 'hydrate'` keeps Aurelia's marker comments (`stripAureliaMarkers`
must stay off; the renderer reports `hydrate_requires_markers` otherwise),
records the manifest into `render.ssrScope`, and makes `buildSsrDocument(...)`
embed it as `<script type="application/json" id="aurelia-ssr-manifest">`. The
manifest is only embedded for hydrating routes; remount routes do not pay for
it. Set `includeManifest` on `buildSsrDocument(...)` to override.

Client:

```ts
import { hydrateAureliaSsr } from 'aurelia2-ssr';

const { root, aurelia } = await hydrateAureliaSsr({
  component: MyApp,
  hostSelector: 'my-app',
  registrations: [RouterConfiguration.customize({ useUrlFragmentHash: false })],
});
```

`hydrateAureliaSsr(...)` reads the embedded manifest (or
`window.__AURELIA_SSR_MANIFEST__`), reads a serialized AOT definition from
`#aurelia-ssr-definition` when one is present, calls `Aurelia.hydrate(...)`,
and runs `finishSsrTakeover()`. Pass `ssrScope` explicitly to use a manifest
from another source, or `aurelia` to reuse an instance you created with the
`aurelia` package.

Aurelia core's `hydrate()` activates the app root itself and returns it. It does
not register a composition root, so calling `aurelia.start()` afterwards throws
AUR0770. Keep the returned `root`, and call `stop()` (which deactivates and
disposes it) when the app should go away. Runtime-compiled definitions hydrate
fine as long as the client compiles the same templates the server did.

Hydration is stricter than remounting. The HTML, marker comments, compiled
definition, and manifest must agree, or Aurelia binds the wrong nodes or falls
back to a fresh render. Run `verifySsrHydration(...)` (or set `verifyHydration`)
in prerender scripts and CI:

```ts
const verification = await verifySsrHydration({
  window,
  component: MyApp,
  appHtml: render.appHtml,
  ssrScope: render.ssrScope!,
  registrations,
});

if (!verification.ok) {
  console.error(verification.diagnostics);
}
```

It hydrates the serialized HTML in a scratch element with the real
`Aurelia.hydrate()` path and reports:

- `hydration_nodes_replaced`: server nodes were detached, so Aurelia re-rendered
  instead of adopting
- `hydration_nodes_added`: a template controller fell back to a fresh render,
  which the user would see as duplicated content
- `hydration_manifest_mismatch`: the hydrated controller tree differs from the
  manifest
- `hydration_html_changed` (warning): server and client state produced
  different HTML

Not every template controller hydrates in core yet. `promise` views are
re-rendered on the client (core documents this), `portal` moves its view out of
the host and is reported as `manifest_portal_unsupported`, and `au-slot`
projections are rendered fresh. Shadow DOM hosts serialize as Declarative
Shadow DOM but `Aurelia.hydrate()` adopts light DOM only, so use remount for
shadow-rooted roots.

## Router SSR

For routed apps, use Aurelia core's server location manager:

```ts
import { RouterConfiguration } from '@aurelia/router';
import { createSsrRouterRegistrations } from 'aurelia2-ssr';

const routerRegistrations = await createSsrRouterRegistrations({
  path: request.url,
  baseHref: '/',
});

await renderAureliaToString({
  window,
  component: MyApp,
  registrations: [
    RouterConfiguration.customize({ useUrlFragmentHash: false }),
    ...routerRegistrations,
  ],
});
```

This keeps browser-only `history`, `location`, and `popstate` behavior out of server rendering while allowing the router to resolve the current path.

`renderAureliaToString(...)` does this for you when `@aurelia/router` can be
loaded (`router: 'auto'`, the default): it registers a `ServerLocationManager`
for the route path plus the window's query string. Set `router: false` to opt
out, `router: true` to get a `router_unavailable` warning when the package is
missing, or `router: { path, baseHref }` to override the values. Explicit
registrations passed in `registrations` still win because they are registered
after the automatic one.

`aurelia.start()` awaits the initial navigation, but `canLoad` redirects and
`router.load()` calls made during startup queue another transition. Use
`createRouterSettle()` as the `settle` function (or call
`waitForRouterIdle(container)` from your own settle function) so the serialized
HTML and manifest reflect the final route:

```ts
await renderAureliaToString({
  window,
  component: MyApp,
  registrations: [RouterConfiguration.customize({ useUrlFragmentHash: false }), ...routerRegistrations],
  settle: createRouterSettle(),
});
```

Routed components are recorded under their `<au-viewport>` scope by name, which
is what the router's `RouteContext` looks up when hydrating.

## SEO Model

SEO is route-level configuration by design. A page should not need to boot the client bundle before search engines can see:

- `<title>`
- `<meta name="description">`
- canonical URL
- robots policy
- Open Graph tags
- Twitter card tags
- JSON-LD
- sitemap inclusion and priority

Example:

```ts
{
  path: '/pricing',
  seo: {
    title: 'Pricing - Example',
    description: 'Compare plans and choose the right account for your team.',
    canonicalPath: '/pricing',
    robots: 'index,follow',
    openGraph: {
      image: '/og/pricing.png',
      type: 'website',
    },
    sitemap: {
      include: true,
      priority: 0.8,
      changefreq: 'weekly',
    },
    jsonLd: [
      {
        '@type': 'FAQPage',
        mainEntity: [],
      },
    ],
  },
}
```

Diagnostics check missing title/description, title length, description length, missing canonical, missing h1, duplicate hosts, render time, and HTML byte budgets.

## Assets, CSS Modules, and Styles

`buildSsrDocument(...)` can consume a Vite manifest. Route `priority.moduleIds` are resolved recursively:

```ts
priority: {
  moduleIds: ['src/home.ts'],
}
```

The package injects:

- `modulepreload` links for the route entry and its imports
- stylesheet links for `css` entries, including CSS modules emitted by Vite
- priority image preloads
- route-level and global preloads
- dns-prefetch and preconnect links

For critical CSS:

```ts
assets: {
  styles: [
    { id: 'critical-css', content: 'body{color:#111}', precedence: 'critical' },
    { href: '/assets/app.css' },
  ],
}
```

For Shadow DOM components, open shadow roots are serialized as Declarative Shadow DOM:

```html
<template shadowrootmode="open" shadowrootserializable>
  <style>:host{display:block}</style>
  ...
</template>
```

Readable `adoptedStyleSheets` are copied into a `<style data-aurelia-ssr-adopted>` element. Cross-origin or unreadable stylesheet rules are skipped with an optional warning callback.

Closed shadow roots cannot be inspected by normal DOM APIs. If a component uses closed Shadow DOM, expose SSR-friendly light DOM or provide explicit server-rendered markup.

## Third-Party Scripts

Scripts can be configured with ordering strategies:

- `head-start`
- `head-end`
- `before-preboot`
- `before-client`
- `after-client`
- `body-end`

Example:

```ts
assets: {
  scripts: [
    {
      id: 'analytics',
      src: 'https://cdn.example.com/analytics.js',
      strategy: 'body-end',
      defer: true,
      integrity: 'sha384-...',
      crossorigin: 'anonymous',
    },
  ],
}
```

Inline scripts receive the configured nonce:

```ts
security: {
  nonce: request.cspNonce,
}
```

Keep third-party scripts out of the critical path where possible. Use `before-client` only for code that must exist before Aurelia starts.

## Preboot

Preboot records user activity before Aurelia takes over:

- input/change values
- checkbox and radio checked state
- selection range where supported
- focus
- submits
- clicks
- optional keydown

It replays values after `finishSsrTakeover()`:

```ts
finishSsrTakeover();
```

Use stable selectors for important fields:

```html
<input data-ssr-key="signup-email" value.bind="email">
```

The selector fallback order is configurable and defaults to `data-ssr-key`, `id`, `name`, and `aria-label`.

## Browser Globals and Request Isolation

Server rendering often breaks when app code touches browser values:

- `window`
- `document`
- `navigator`
- `location`
- `localStorage`
- `sessionStorage`
- `requestAnimationFrame`
- `matchMedia`
- `ResizeObserver`
- `IntersectionObserver`

Use `installDomGlobals(window)` for request-scoped rendering. It installs DOM globals, provides safe server shims where needed, and returns a restore function:

```ts
const restore = installDomGlobals(window);
try {
  await render();
} finally {
  restore();
}
```

`renderAureliaToString(...)` uses `install-and-restore` by default. This prevents one request's DOM, storage, URL, or user state from leaking into the next render.

## Common Edge Cases

### Vite Runtime Identity Split

Cause: the SSR bundle resolves `aurelia` and `@aurelia/*` through different
versions or physical module paths. Aurelia resources, DI interfaces, and
compiled definitions are identity-sensitive, so the server renderer can fail
even though the browser build works.

Fix:

- keep `aurelia`, `@aurelia/*`, `@aurelia/vite-plugin`, and `@aurelia/testing`
  pinned to the same version
- verify with `npm ls aurelia @aurelia/runtime-html @aurelia/kernel @aurelia/router`
- if Vite still splits the SSR runtime, alias `aurelia` in the SSR config to a
  server-only shim that re-exports the primitives your app uses from
  `@aurelia/kernel`, `@aurelia/runtime`, and `@aurelia/runtime-html`

Example:

```ts
// src/ssr/aurelia-shim.ts
export { resolve } from '@aurelia/kernel';
export { IObserverLocator } from '@aurelia/runtime';
export { Aurelia, bindable, INode } from '@aurelia/runtime-html';
export { Aurelia as default } from '@aurelia/runtime-html';
```

Use the shim only for the server bundle. The browser bundle can keep normal
top-level `aurelia` imports.

### First Render Works, Later SSR Requests Fail

Symptom: the first route renders, every later route (in a fresh jsdom window)
fails with `AUR0757` (`rendering_mismatch_length`, "0 targets"), or a routed
page renders empty.

Cause: `@aurelia/template-compiler`'s `TemplateElementFactory` caches parsed
template elements in a module-level map keyed by the markup string. The second
window receives template nodes owned by the first window's document; they fail
the `instanceof p.Node` check in `Rendering.createNodes`, are treated as a
string, and produce a template with no targets.

Fix: `createServerContainer(...)` registers `SsrTemplateElementFactory`, whose
cache is scoped per `document`, so one jsdom per route or per request works.
`renderAureliaToString`, `prerenderSite`, and `createSsrRequestHandler` all go
through it. If you build your own container, register
`createSsrTemplateFactoryRegistration()` before `StandardConfiguration`.

Request-time renders are still serialized by `createSsrRequestHandler(...)`
because DOM globals and the Aurelia platform are process-wide; scale with
processes or worker threads rather than concurrent renders in one process.

### Duplicate Page After SSR

Cause: the client mounted into a host that still contained prerendered markup.

Fix: use remount takeover if you do not have a manifest:

```ts
prepareSsrHostForTakeover({ selector: 'my-app', mode: 'remount' });
```

### SSR Page Flickers or Shows a Loader During Takeover

Cause: remount takeover correctly clears the SSR host before Aurelia starts, but
the client route refetches async data and renders its loading state before the
data returns.

Fix: preserve an inert copy of the SSR host beside the real host, hide the real
host while it remounts, then remove the copy and restore the real host after
`Aurelia.start()` resolves and before `finishSsrTakeover()` replays preboot. Test
with delayed API responses in a real browser so the handoff is visible.

### Blank Viewport After Client Takeover

Cause: the app changed its client bootstrap shape while adding SSR, commonly
from `.app(MyApp)` to `.app({ host, component: MyApp })`. Some routed apps rely
on the original root-component startup path for initial viewport activation.

Fix: keep the same `.app(...)` form that worked before SSR. In remount mode,
call `prepareSsrHostForTakeover(...)` before start to clear prerendered markup,
then call `finishSsrTakeover()` only after `start()` resolves.

### Fastify Root Returns 403

Cause: `@fastify/static` can treat `/` as a directory request when registered
with `index: false`, returning 403 before the SSR fallback runs.

Fix: register an explicit `GET /` SSR/app route before `@fastify/static`, or
serve `index.html` through the static plugin and reserve the fallback for
non-file app routes. Keep missing asset requests as real 404s so stale hashed
assets do not return app HTML.

### Hydration Throws AUR0770 (No Composition Root)

Cause: the client called `aurelia.start()` after `aurelia.hydrate(...)`.
`hydrate()` activates the root directly and returns it; there is nothing for
`start()` to start.

Fix: use `hydrateAureliaSsr(...)` or keep the `IAppRoot` that `hydrate()`
returns, and tear it down with `root.deactivate()` and `root.dispose()`.

### Hydration Duplicates a List or Binds the Wrong Element

Cause: the number of DOM nodes the browser parsed differs from what the server
rendered. Empty text interpolations (`${maybeEmpty}`) and adjacent text nodes at
the top level of a template controller view are the usual culprits: the
browser drops or merges them, so `nodeCount` no longer matches.

Fix: wrap the interpolation in an element, or render a non-empty placeholder.
The recorder reports `manifest_empty_text_node` and
`manifest_adjacent_text_nodes`, and `verifySsrHydration(...)` catches the
resulting `hydration_nodes_added` before the page ships.

### Hamburger or Other Event Handlers Do Not Work

Cause: server HTML exists, but Aurelia did not bind that DOM. In remount mode, clear the SSR host before starting Aurelia. In hydrate mode, ensure marker comments and manifest scopes match.

### Code Reads `window` At Import Time

Move browser reads behind lifecycle hooks or inject an adapter. If you cannot change the dependency, render with DOM globals installed before loading the server entry.

### Browser-Only Widgets Log Errors During SSR

Canvas, chart, map, editor, and media libraries often expect browser APIs that
JSDOM does not implement. Do not instantiate those libraries while
`window.__MY_APP_SSR_RENDERING__` or another app SSR flag is true. Server-render
the surrounding HTML and useful data, then initialise the widget from
`attached()` in the browser. This is usually an app integration issue, not an SSR
package failure.

### `localStorage` During SSR

Use the package's memory storage shim or provide a request-specific storage implementation. Do not share one global storage instance across requests.

### Shadow DOM Styling Missing

Open shadow roots can be serialized. Closed roots cannot. Constructable stylesheets are included only when rules are readable.

### Async Data

SSR should wait for route data explicitly. Use a route-level `settle` function or pass `settleMs` as a fallback. Prefer explicit app-level data readiness over arbitrary sleeps.

## Prerender Pipeline

`prerenderSite(...)` is the one-call version of the per-route steps above:

1. validate the config (`validateSsrConfig`) and expand dynamic routes
   (`expandSsrRoutes`), reporting `route_needs_expansion` for `:param` routes
   without an `expand()` hook;
2. for every prerender route: create a DOM (`createJSDOMEnvironment` by
   default), `renderAureliaToString`, `buildSsrDocument`, `createRouteReport`;
3. write the page (`about.html`, or `about/index.html` with
   `output.cleanUrls`), copy routes with `status: 404` to `404.html`, and emit
   redirect pages plus platform files (`_redirects`, `vercel.json`, nginx,
   `.htaccess`, JSON) for routes with `redirectTo` or components that called
   `head.redirect(...)`;
4. write `sitemap.xml`, `robots.txt`, and `ssr-report.json`, then return the
   files, per-route results, report, diagnostics, and `failed` per
   `shouldFailSsrBuild`.

```ts
import fs from 'node:fs/promises';
import { createRouterSettle, formatSsrReport, prerenderSite } from 'aurelia2-ssr';
import site from './ssr.config';
import { MyApp } from './src/my-app';

const result = await prerenderSite({
  site,
  component: MyApp,
  template: await fs.readFile('dist/index.html', 'utf8'),
  manifest: JSON.parse(await fs.readFile('dist/.vite/manifest.json', 'utf8')),
  outDir: 'dist',
  only: process.argv.slice(2),          // optional subset of paths
  render: { settle: createRouterSettle() },
  onRoute: route => console.log(route.ok ? '✔' : '✖', route.path, `${route.durationMs}ms`),
});

console.log(formatSsrReport(result.report));
process.exitCode = result.failed ? 1 : 0;
```

Pass `write` to redirect output (S3, a zip, an in-memory map in tests), and
`createEnvironment` to supply your own DOM. Keep `concurrency` at `1` unless
`globalStrategy` is `'none'`; the orchestrator warns otherwise.

### Dynamic routes

```ts
{
  path: '/blog/:slug',
  seo: { title: 'Blog', description: '...' },
  expand: async () => {
    const posts = await cms.posts();
    return posts.map(post => ({
      params: { slug: post.slug },
      seo: { title: post.title, description: post.excerpt, sitemap: { include: true, lastmod: post.updatedAt } },
      data: { postId: post.id },
    }));
  },
}
```

Expansions can be plain paths (`'/blog/hello'`), `params` filled into the
pattern, or partial route overrides. Expanded routes carry `params`, which
components read through `ISsrRoute`.

### CLI

```bash
aurelia2-ssr prerender --config ssr.config.ts --entry src/ssr-entry.ts --out dist
aurelia2-ssr check --config ssr.config.ts --entry src/ssr-entry.ts --out dist --format github
aurelia2-ssr report dist/ssr-report.json --format markdown >> "$GITHUB_STEP_SUMMARY"
```

The entry module exports `component` (or a default export) plus optional
`registrations`, `settle`, `configureAurelia`, `beforeStart`, and `afterStart`.
`check` turns on `verifyHydration` for every route and writes nothing. Node
22.18+ loads `.ts` files natively; older versions need `node --import tsx`.

### Vite plugin

```ts
import { aureliaSsr } from 'aurelia2-ssr/vite';

plugins: [
  aurelia(),
  aureliaSsr({
    entry: 'src/ssr-entry.ts',
    config: 'ssr.config.ts',
    dev: { fallback: 'render' },        // vite dev renders every HTML request
    prerender: { only: ['/'] },          // options forwarded to prerenderSite
  }),
],
```

In `vite dev` the plugin adds a post middleware that loads the entry and config
through `ssrLoadModule` on every request (so edits apply), renders the route,
and serves the document through `transformIndexHtml`. After `vite build` it
starts a nested Vite server in middleware mode to load the entry, then runs
`prerenderSite` against the built `index.html` and `.vite/manifest.json` in
`build.outDir`, prints the report, and fails the build when diagnostics exceed
the thresholds. Enable `build.manifest` to get modulepreload and CSS injection.

## Request-Time Handler

```ts
const handler = createSsrRequestHandler({
  site,
  component: MyApp,
  template,
  manifest,
  fallback: 'spa',           // or 'render' | 'not-found'
  onRenderError: 'spa',      // or 'error' (500 with the diagnostics)
  render: request => ({ registrations: [/* per-request services */], settle: createRouterSettle() }),
});

const response = await handler({ url: '/products/1?tab=specs', headers: request.headers });
// { status, headers, body, source: 'render' | 'cache' | 'redirect' | 'spa' | 'not-modified' | 'error', route, render, diagnostics }
```

Behaviour per request:

- `matchSsrRoute` picks the route (static beats `:param` beats `*`) and passes
  `params` to the render; unmatched paths follow `fallback`.
- `redirectTo` routes answer with `Location` (query string preserved);
  components can do the same with `head.redirect(to, status)`.
- `render.status` (from `head.setStatus(404)` or the route) becomes the HTTP
  status.
- `Cache-Control` comes from `site.cache` merged with `route.cache`
  (`maxAge`, `sMaxAge`, `staleWhileRevalidate`, `private`, `noStore`), and
  `cache.ttlMs` stores 200 responses in memory (`createMemorySsrCache`, or pass
  your own `SsrResponseCache`). `handler.invalidate(path?)` clears it.
- Weak ETags ignore the `renderedAt` timestamp, so repeated renders of the same
  content answer `304` to `If-None-Match`.
- Adapters: `createNodeSsrMiddleware(handler)` for `http`, Connect, and
  Express; `sendNodeResponse(res, response)` for Fastify/Koa raw responses; and
  `handleWebRequest(handler, request)` / `toWebResponse(response)` for Web
  runtimes.

## State Transfer and Component Head Data

`ISsrState` is a JSON-serializable key/value store. On the server
`renderAureliaToString` registers a fresh store per render and returns its
contents as `render.state`; `buildSsrDocument` embeds it as
`<script type="application/json" id="aurelia-ssr-state">`. On the client the
default resolver reads that script, `hydrateAureliaSsr` registers it, and
`registerClientSsrState(container)` does the same for remount bootstraps.

```ts
this.products = await ssrData(this.state, 'products', () => this.api.list());
```

`ssrData` runs the loader on the server and stores the result; in the browser it
returns the embedded value (set `consume: true` to drop it after the first read,
or `refresh: true` to bypass it). `createSsrFetchInterceptor(state)` does the
same for `@aurelia/fetch-client`: GET responses are recorded on the server and
replayed from the store on the client.

`ISsrHead` lets components set `title`, `description`, `canonical`, `robots`,
`lang`, meta, links, JSON-LD, `<html>`/`<body>` attributes, the HTTP status, and
redirects. The server render returns a snapshot in `render.head`, which
`buildSsrDocument` layers over the route's SEO config. On the client the same
service edits the live document immediately, so it doubles as a head manager
for SPA navigation. `ISsrRoute` resolves to the route being rendered (with
`params`, `data`, `status`) on the server and is rebuilt from the embedded
context script on the client.

## Testing Recommendations

At minimum, test:

- route validation and canonical URLs
- sitemap output
- document SEO tags
- CSS/modulepreload injection from your build manifest
- preboot input replay
- duplicate host diagnostics
- a real Aurelia server render for your root shell
- hydration/remount client startup path

`aurelia2-ssr/testing` covers the last two with `renderSsrForTest`,
`expectSsrHydration`, `assertSsrHydrates`, and `manifestSnapshot`, and works in
Jest and Vitest jsdom environments. Because Jest's jsdom lacks `TextEncoder`,
end-to-end checks that create additional jsdom windows (multi-route prerenders)
belong in a Node smoke test against the built package, for example
`aurelia2-ssr check` in CI.

This package's own coverage lives in `test/ssr.spec.ts`,
`test/hydration.spec.ts`, and `test/pipeline.spec.ts`.
