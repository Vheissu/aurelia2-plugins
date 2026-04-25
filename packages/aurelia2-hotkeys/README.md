# aurelia2-hotkeys

Keyboard shortcut helpers for Aurelia 2. Use it for command palettes, save shortcuts, admin tools, games, and keyboard-first interfaces.

## Install

```bash
npm install aurelia2-hotkeys
```

## Register

```ts
import { AureliaHotkeysConfiguration } from 'aurelia2-hotkeys';

Aurelia.register(
  AureliaHotkeysConfiguration.configure({
    target: 'document',
    event: 'keydown',
  })
);
```

## Attribute Usage

```html
<button
  hotkey="keys: meta+k, ctrl+k; callback.bind: (event, combo) => openPalette(combo); click.bind: true"
  hotkey-trigger.trigger="trackShortcut($event.detail.combo)">
  Command palette
</button>
```

Use `target: element` for scoped shortcuts that only fire when the host has focus.

## Service Usage

```ts
import { IHotkeyService } from 'aurelia2-hotkeys';
import { resolve } from 'aurelia';

export class Editor {
  private readonly hotkeys = resolve(IHotkeyService);

  attached() {
    this.saveHandle = this.hotkeys.register({
      keys: ['meta+s', 'ctrl+s'],
      callback: () => this.save(),
    });
  }

  detaching() {
    this.saveHandle.dispose();
  }
}
```

This package targets Aurelia 2 `>=2.0.0-rc.1`.
