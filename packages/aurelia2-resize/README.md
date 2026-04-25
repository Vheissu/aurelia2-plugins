# aurelia2-resize

ResizeObserver utilities for Aurelia 2. Useful for responsive panels, charts, virtualized lists, container-aware components, and anything that needs element size rather than viewport size.

## Install

```bash
npm install aurelia2-resize
```

## Register

```ts
import { AureliaResizeConfiguration } from 'aurelia2-resize';

Aurelia.register(
  AureliaResizeConfiguration.configure({
    box: 'content-box',
  })
);
```

## Usage

```html
<section
  resize="width.two-way: panelWidth; height.two-way: panelHeight; callback.bind: (change) => resized(change)"
  resize-change.trigger="trackResize($event.detail)">
  ...
</section>
```

The attribute exposes two-way `width`, `height`, and `detail` bindables and dispatches `resize-change`.

This package targets Aurelia 2 `>=2.0.0-rc.1`.
