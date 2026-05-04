# aurelia2-ssr

Server-side rendering, prerendering, SEO, preboot, hydration, and document assembly utilities for Aurelia 2.

This package is designed to be usable today with Aurelia 2 apps while staying aligned with the public SSR primitives already present in Aurelia core:

- `Aurelia.hydrate(...)` for manifest-based client adoption
- `ISSRContext` for preserving Aurelia hydration markers during server rendering
- `ISSRScope` and related manifest types
- `hydrateSSRDefinition(...)` for client-side AOT SSR definition hydration
- `ServerLocationManager` from `@aurelia/router` for router-aware SSR

Where a complete manifest recorder is not publicly shipped yet, `aurelia2-ssr` gives you a safe remount takeover mode and a clean adapter path for plugging in a future public manifest generator.

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

Create a server entry that renders your root component:

```ts
import { RouterConfiguration } from '@aurelia/router';
import { renderAureliaToString, createSsrRouterRegistrations } from 'aurelia2-ssr';
import { MyApp } from './my-app';

export async function render(url: string, window: Window) {
  const routerRegistrations = await createSsrRouterRegistrations({ path: url });

  return renderAureliaToString({
    window,
    component: MyApp,
    registrations: [
      RouterConfiguration.customize({ useUrlFragmentHash: false }),
      ...routerRegistrations,
    ],
    settle: 50,
  });
}
```

Assemble the final HTML document:

```ts
import { buildSsrDocument, createPrebootScript } from 'aurelia2-ssr';

const documentResult = buildSsrDocument({
  template,
  site: ssrSite,
  route,
  render: await render(route.path, window),
  manifest: viteManifest,
  prebootScript: createPrebootScript(ssrSite.preboot),
});

return documentResult.html;
```

On the client, choose the takeover mode that matches your output:

```ts
import Aurelia from 'aurelia';
import { prepareSsrHostForTakeover, finishSsrTakeover } from 'aurelia2-ssr';
import { MyApp } from './my-app';

const host = prepareSsrHostForTakeover({
  selector: 'my-app',
  mode: 'remount',
});

if (!host) {
  throw new Error('App host was not found.');
}

Aurelia
  .app(MyApp)
  .start()
  .then(() => finishSsrTakeover());
```

Keep the same `.app(...)` form your SPA already uses. For router apps that
boot with `.app(MyApp)`, do not switch to `.app({ host, component: MyApp })`
just for SSR takeover; doing so can leave the initial viewport inactive. Use
`prepareSsrHostForTakeover(...)` to clear/check the host, then call
`finishSsrTakeover()` after Aurelia starts.

If your app already boots with an explicit host, keep that shape:

```ts
await Aurelia
  .app({ host, component: MyApp })
  .start();

finishSsrTakeover();
```

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

Use `mode: 'hydrate'` with `hydrateAureliaSsr(...)` when you have a matching `ISSRScope` manifest and AOT-ready definitions.

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

For prerendering, a single Node process rendering every route is usually fine.
For request-time SSR in a long-running API server, test multiple sequential
renders of routed pages against the production server bundle. Vite and Aurelia
may cache compiled route modules and resource definitions between renders, and
some app shapes currently need stronger isolation.

If the first SSR request succeeds but a later route fails with a compiled
definition or duplicate-resource error, run each SSR render in an isolated worker
thread or short-lived process while keeping the asset/template cache in the
parent server. The parent can fall back to the SPA shell if the worker times out
or returns diagnostics.

This pattern keeps request state, DOM globals, router state, and module caches
from leaking between users:

```ts
// parent server
const worker = new Worker(new URL('./ssr-worker.js', import.meta.url), {
  workerData: {
    entryUrl,
    url,
    origin,
    apiBase,
    template,
    manifest,
  },
});
```

```ts
// ssr-worker.ts
import { parentPort, workerData } from 'node:worker_threads';

try {
  const entry = await import(workerData.entryUrl);
  const result = await entry.renderPage(workerData.url, workerData);
  parentPort?.postMessage({ ok: true, result });
} catch (err) {
  parentPort?.postMessage({
    ok: false,
    error: {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    },
  });
}
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
    },
  ],
};
```

## What It Handles

- SEO-first document rendering: titles, descriptions, canonicals, robots, Open Graph, Twitter, JSON-LD, sitemap, and robots.txt helpers
- Route-level priority: modulepreload, CSS from Vite manifests, priority image preloads, global preloads, dns-prefetch, and preconnect
- CSS: global styles, inline critical CSS, linked stylesheets, CSS modules emitted in Vite manifests, Shadow DOM styles, and adopted stylesheets where the runtime exposes readable rules
- Third-party scripts: head/body placement strategies, async/defer, integrity, referrer policy, nonce support, and preboot-safe ordering
- Preboot: captures form input, checkbox state, selection, focus, submits, clicks, and optional keydown before Aurelia takes over
- Takeover: remount fallback for prerendered HTML, no-flicker remount guidance for async apps, and true `Aurelia.hydrate(...)` support when a core-compatible manifest is available
- Shadow DOM: open shadow roots serialize to Declarative Shadow DOM templates
- Browser values: request-scoped `window`, `document`, storage, animation frame, matchMedia, ResizeObserver, IntersectionObserver, and global restore helpers
- Diagnostics: route validation, duplicate host detection, SEO budget checks, render/html byte budgets, and build-fail decisions

For the full guide, see [SSR.md](./SSR.md).
