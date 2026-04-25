# aurelia2-media

`matchMedia` helpers for Aurelia 2. Use it for responsive behavior that belongs in view-model state rather than CSS alone.

## Install

```bash
npm install aurelia2-media
```

## Register

```ts
import { AureliaMediaConfiguration } from 'aurelia2-media';

Aurelia.register(AureliaMediaConfiguration);
```

## Usage

```html
<nav
  media="query: (min-width: 900px); matches.two-way: desktop; class-name: desktop-nav"
  media-change.trigger="layoutChanged($event.detail)">
  ...
</nav>
```

The `media` attribute supports `query`, two-way `matches`, two-way `detail`, `callback`, `class-name`, `hide`, and `disabled`.

```ts
import { IMediaService } from 'aurelia2-media';
import { resolve } from 'aurelia';

export class LayoutShell {
  private readonly media = resolve(IMediaService);

  attached() {
    this.handle = this.media.observe('(prefers-reduced-motion: reduce)', change => {
      this.reducedMotion = change.matches;
    });
  }
}
```

This package targets Aurelia 2 `>=2.0.0-rc.1`.
