# aurelia2-intersection

IntersectionObserver utilities for Aurelia 2. It gives Aurelia apps the common `react-intersection-observer`/Vue visibility-observer pattern for lazy loading, infinite scroll sentinels, analytics visibility tracking, and reveal-on-view behavior.

## Install

```bash
npm install aurelia2-intersection
```

## Register

```ts
import { AureliaIntersectionConfiguration } from 'aurelia2-intersection';

Aurelia.register(
  AureliaIntersectionConfiguration.configure({
    rootMargin: '200px 0px',
    threshold: 0.25,
  })
);
```

## Attribute Usage

```html
<img
  src.bind="visible ? imageUrl : placeholder"
  intersect="visible.two-way: visible; once.bind: true">

<div
  class="feed-sentinel"
  intersect="callback.bind: (change) => loadMore(change); root-margin: 400px 0px">
</div>
```

The attribute dispatches an `intersection-change` DOM event whose detail contains `{ target, entry, visible, ratio }`.

## Service Usage

```ts
import { IIntersectionService } from 'aurelia2-intersection';
import { resolve } from 'aurelia';

export class LazyPanel {
  private readonly intersections = resolve(IIntersectionService);
  private dispose: (() => void) | null = null;

  attached() {
    const handle = this.intersections.observe(this.element, (change) => {
      if (change.visible) {
        this.load();
      }
    });
    this.dispose = () => handle.dispose();
  }

  detaching() {
    this.dispose?.();
  }
}
```

## API

- `IntersectionService.observe(element, callback, options?)`
- `IntersectionService.isSupported()`
- `intersect` bindables: `callback`, `visible`, `detail`, `once`, `disabled`, `root`, `root-margin`, and `threshold`

This package targets Aurelia 2 `>=2.0.0-rc.1`.
