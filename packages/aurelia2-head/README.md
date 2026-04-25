# aurelia2-head

Head management for Aurelia 2 apps. It covers the common React Helmet/Vue Meta use case: route or component scoped document titles, meta tags, canonical/preload links, and `<html>`/`<body>` attributes with automatic cleanup.

## Install

```bash
npm install aurelia2-head
```

## Register

```ts
import { AureliaHeadConfiguration } from 'aurelia2-head';

Aurelia.register(
  AureliaHeadConfiguration.configure({
    defaultTitle: 'My app',
    titleTemplate: '%s · My app',
  })
);
```

## Component Usage

```html
<au-head
  title="Dashboard"
  meta.bind="{
    description: 'Team activity and account health',
    'og:title': 'Dashboard'
  }"
  links.bind="[
    { rel: 'canonical', href: canonicalUrl },
    { rel: 'preload', href: heroImage, as: 'image' }
  ]"
  html-attrs.bind="{ lang: locale }"
  body-attrs.bind="{ 'data-section': 'dashboard' }">
</au-head>
```

When the component is detached, its head state is removed and the next remaining state is rendered.

## Service Usage

```ts
import { IHeadManager } from 'aurelia2-head';
import { resolve } from 'aurelia';

export class ProductPage {
  private readonly head = resolve(IHeadManager);
  private handle = this.head.apply({
    title: 'Red jacket',
    meta: {
      description: 'A lightweight jacket for travel.',
      'og:title': 'Red jacket',
    },
  });

  detaching() {
    this.handle.dispose();
  }
}
```

## API

- `HeadManager.apply(state, owner?)` applies a scoped state and returns a disposable handle.
- `HeadManager.setTitle(title, template?, owner?)` updates a title scope.
- `HeadManager.clear(owner?)` clears one owner or all managed head state.
- `<au-head>` exposes `title`, `title-template`, `meta`, `links`, `html-attrs`, and `body-attrs`.

This package targets Aurelia 2 `>=2.0.0-rc.1`.
