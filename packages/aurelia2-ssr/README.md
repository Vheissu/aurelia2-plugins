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

await Aurelia
  .app({ host: host as HTMLElement, component: MyApp })
  .start();

finishSsrTakeover();
```

Use `mode: 'hydrate'` with `hydrateAureliaSsr(...)` when you have a matching `ISSRScope` manifest and AOT-ready definitions.

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
- Takeover: remount fallback for prerendered HTML and true `Aurelia.hydrate(...)` support when a core-compatible manifest is available
- Shadow DOM: open shadow roots serialize to Declarative Shadow DOM templates
- Browser values: request-scoped `window`, `document`, storage, animation frame, matchMedia, ResizeObserver, IntersectionObserver, and global restore helpers
- Diagnostics: route validation, duplicate host detection, SEO budget checks, render/html byte budgets, and build-fail decisions

For the full guide, see [SSR.md](./SSR.md).
