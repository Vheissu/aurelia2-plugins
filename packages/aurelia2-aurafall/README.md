# aurelia2-aurafall

A virtual waterfall (masonry) layout for Aurelia 2.

## Install

```bash
npm install aurelia2-aurafall
```

## Register

```ts
import { AureliaAurafallConfiguration } from 'aurelia2-aurafall';

Aurelia.register(AureliaAurafallConfiguration);
```

## Usage

```html
<au-aurafall
  items.bind="items"
  calc-item-height.bind="calcItemHeight"
  style="height: 600px; overflow: auto;"
>
  <template au-slot="item">
    <div class="card">
      <img src.bind="$host.item.src" alt.bind="$host.item.title" />
    </div>
  </template>
</au-aurafall>
```

```ts
public items = [
  { id: '1', src: '/images/1.jpg', height: 240 },
  { id: '2', src: '/images/2.jpg', height: 320 },
];

public calcItemHeight = (item: { height: number }): number => item.height;
```

## Properties

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `virtual` | `boolean` | `true` | Enable virtual rendering. |
| `rowKey` | `string` | `'id'` | Key used for item identity. |
| `enableCache` | `boolean` | `true` | Cache previously computed item layout. |
| `gap` | `number` | `15` | Gap between items. |
| `padding` | `number \| string` | `15` | Padding for the inner content container. |
| `preloadScreenCount` | `[number, number]` | `[0, 0]` | Preload screens above/below. |
| `itemMinWidth` | `number` | `220` | Minimum width per column. |
| `maxColumnCount` | `number` | `10` | Maximum number of columns. |
| `minColumnCount` | `number` | `2` | Minimum number of columns. |
| `items` | `unknown[]` | `[]` | Items to render. |
| `calcItemHeight` | `(item, width) => number` | `() => 250` | Calculate item height. |
| `scrollTarget` | `HTMLElement \| Window \| 'window'` | host | Scroll container override. |
| `useIdleLayout` | `boolean` | `true` | Use `requestIdleCallback` for large layout recalculations. |
| `idleLayoutThreshold` | `number` | `120` | Minimum item count before idle layout is used. |
| `idleLayoutTimeout` | `number` | `200` | Timeout (ms) for idle layout fallback. |
| `debug` | `boolean` | `false` | Log scroll/render metrics on `scrollend`. |

## Slots

- `item` (default): access exposed values via `$host.item` and `$host.index`

## Methods

- `withItemSpaces(cb)` — access current layout metadata for items.

## Notes

- The component itself should be a fixed-height scroll container (set `height` + `overflow: auto`).
- If you need to use the window as the scroll target, set `scroll-target="window"`.
- Debug logs are emitted on the `scrollend` event when available.
