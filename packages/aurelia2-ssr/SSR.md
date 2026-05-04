# Aurelia 2 SSR Guide

This guide explains how `aurelia2-ssr` is intended to be used by application teams and by framework/plugin authors who want a reliable SSR foundation for Aurelia 2.

## Design Goals

`aurelia2-ssr` is not just a prerender script. It aims to cover the full SSR lifecycle:

1. Render an Aurelia 2 app in a request-scoped DOM.
2. Preserve enough DOM structure for the client to take over safely.
3. Make SEO configuration explicit and testable per route.
4. Capture user input that happens before the client bundle has loaded.
5. Support a proper hydration path using Aurelia core APIs when a manifest is available.
6. Provide a safe remount fallback for current apps that do not yet have a public manifest recorder.
7. Document the edge cases that usually make SSR packages hard to adopt.

## Public Aurelia Core APIs Used

The local Aurelia core checkout contains several hydration pieces. In the published `2.0.0-rc.1` packages, the usable public surface includes:

- `Aurelia.hydrate(...)`
- `ISSRContext`
- `ISSRManifest`, `ISSRScope`, `ISSRTemplateController`, and related type guards
- `adoptSSRView(...)` and `adoptSSRViews(...)`
- `hydrateSSRDefinition(...)`
- `ServerLocationManager` from `@aurelia/router`

The package uses those exported APIs directly. It does not rely on private source-only functions. Manifest recording is still treated as an adapter point because the core comments reference `recordManifest()`, but that recorder is not shipped as a stable public API in the installed packages used by this monorepo.

## Rendering Modes

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

Use this when your build/server pipeline can provide:

- Server HTML that preserved Aurelia marker comments
- An `ISSRScope` tree that matches the rendered controller tree
- AOT-ready component definitions, or a serialized SSR definition hydrated with `hydrateSSRDefinition(...)`

Client:

```ts
await hydrateAureliaSsr({
  host: document.querySelector('my-app')!,
  component: MyApp,
  ssrScope: window.__AURELIA_SSR_MANIFEST__,
});
```

Server rendering should preserve Aurelia markers:

```ts
createServerContainer(window, registrations, true);
```

or through `renderAureliaToString(...)`:

```ts
await renderAureliaToString({
  window,
  component: MyApp,
  route: {
    ...route,
    render: { preserveMarkers: true, takeoverMode: 'hydrate' },
  },
});
```

Hydration is stricter than remounting. The HTML, marker comments, compiled definition, and manifest must agree. If they do not, Aurelia should fail loudly rather than silently binding the wrong node.

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

Cause: a long-running request-time SSR server is reusing one Vite-built module
graph for many routed renders. Some routed app shapes can leave compiled route
module or resource-definition state behind after `aurelia.stop(true)`.

Fix: run the app render in an isolated worker thread or short-lived process, and
cache only static assets such as `index.html`, the Vite manifest, and the server
entry URL in the parent server. Treat a worker timeout or render diagnostic as a
soft failure and return the SPA shell.

This is usually unnecessary for static prerender scripts, but request-time SSR
should include a smoke test that renders several public routes sequentially from
the built server bundle.

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

## Minimal Prerender Script Shape

```ts
import fs from 'node:fs/promises';
import { createJSDOMEnvironment, buildSsrDocument, renderAureliaToString } from 'aurelia2-ssr';
import { MyApp } from './src/my-app';
import { ssrSite } from './src/ssr.config';

const template = await fs.readFile('dist/index.html', 'utf8');
const manifest = JSON.parse(await fs.readFile('dist/.vite/manifest.json', 'utf8'));

for (const route of ssrSite.routes ?? []) {
  const env = await createJSDOMEnvironment({
    html: '<!doctype html><html><head><base href="/"></head><body><my-app></my-app></body></html>',
    url: new URL(route.path, ssrSite.origin).toString(),
  });

  try {
    const render = await renderAureliaToString({
      window: env.window,
      component: MyApp,
      site: ssrSite,
      route,
    });
    const page = buildSsrDocument({ template, site: ssrSite, route, render, manifest });
    await fs.writeFile(`dist/${route.path === '/' ? 'index' : route.path.slice(1)}.html`, page.html);
  } finally {
    env.close();
  }
}
```

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

This package uses Jest coverage for those areas in `test/ssr.spec.ts`.
