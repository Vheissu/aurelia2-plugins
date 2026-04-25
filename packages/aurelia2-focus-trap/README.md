# aurelia2-focus-trap

Focus trapping for Aurelia 2 modals, drawers, popovers, command palettes, and other overlay UI.

## Install

```bash
npm install aurelia2-focus-trap
```

## Register

```ts
import { AureliaFocusTrapConfiguration } from 'aurelia2-focus-trap';

Aurelia.register(AureliaFocusTrapConfiguration);
```

## Usage

```html
<div
  role="dialog"
  aria-modal="true"
  focus-trap="active.bind: open; initial-focus: [data-autofocus]"
  focus-trap-escape.trigger="close()">
  <button data-autofocus>Cancel</button>
  <button>Confirm</button>
</div>
```

The attribute traps `Tab`/`Shift+Tab`, optionally focuses an initial control, returns focus on deactivate, and can deactivate on Escape.

This package targets Aurelia 2 `>=2.0.0-rc.1`.
