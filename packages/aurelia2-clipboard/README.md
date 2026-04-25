# aurelia2-clipboard

Clipboard helpers for Aurelia 2 apps. It provides a DI service and a `copy` custom attribute for the common "copy invite link", "copy API token", and "copy code snippet" flows.

## Install

```bash
npm install aurelia2-clipboard
```

## Register

```ts
import { AureliaClipboardConfiguration } from 'aurelia2-clipboard';

Aurelia.register(
  AureliaClipboardConfiguration.configure({
    preferNative: true,
    trim: true,
  })
);
```

## Attribute Usage

```html
<button
  copy="text.bind: inviteUrl; success.bind: copied"
  clipboard-copy.trigger="showCopied($event.detail.result)">
  Copy invite link
</button>

<input id="coupon" value.bind="couponCode">
<button copy="selector: #coupon">Copy coupon</button>
```

## Service Usage

```ts
import { IClipboardService } from 'aurelia2-clipboard';
import { resolve } from 'aurelia';

export class ShareLink {
  private readonly clipboard = resolve(IClipboardService);

  async copy(url: string) {
    await this.clipboard.copy(url);
  }
}
```

## API

- `ClipboardService.copy(text, options?)`
- `ClipboardService.read()`
- `ClipboardService.isSupported()`
- `copy` attribute bindables: `text`, `selector`, `event`, `disabled`, `prevent-default`, `trim`, `success`, and `error`
- DOM events: `clipboard-copy` and `clipboard-error`

This package targets Aurelia 2 `>=2.0.0-rc.1`.
