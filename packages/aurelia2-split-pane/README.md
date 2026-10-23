# aurelia2-split-pane

Resizable two-pane workspaces with minimum dimensions, keyboard controls, and an accessible separator. Use it for an editor/preview layout, inspector, or side-by-side comparison.

```sh
npm install aurelia2-split-pane
```

```ts
import Aurelia from 'aurelia';
import { AureliaSplitPaneConfiguration } from 'aurelia2-split-pane';
Aurelia.register(AureliaSplitPaneConfiguration);
```

```html
<div style="height: 500px">
  <au-split-pane style="display:block;height:100%"
    ratio.two-way="split" min-first.bind="200" min-second.bind="240"
    label="Resize editor and preview"
    pane-resize-end.trigger="rememberSplit($event.detail.ratio)">
    <div au-slot="first"><document-editor></document-editor></div>
    <div au-slot="second"><document-preview></document-preview></div>
  </au-split-pane>
</div>
```

Initialize `split = 0.5`. The named slots preserve each child's Aurelia lifecycle while resizing; the plugin changes pane dimensions rather than recreating their contents.

## Layout and constraints

`orientation="horizontal"` arranges panes left/right. `orientation="vertical"` stacks them top/bottom. The separator's ARIA orientation describes the separator itself, so it is the opposite of the layout direction.

`ratio` is the first pane's fraction of usable space after subtracting the 8-pixel separator. `minFirst` and `minSecond` are CSS pixels and default to 80. Ratios are clamped to those limits. If the container is smaller than the combined minimums, space is shared proportionally so neither pane overflows the container. A hidden zero-sized container retains its ratio until measurable again.

`paneLimits(available, minFirst, minSecond)` exports the constraint calculation. Negative/non-finite sizes, invalid orientation, and a non-positive keyboard `step` are rejected.

The component needs a definite containing height. Set `display: block; height: 100%` on the custom element, as above. Resize observation maintains constraints as the container changes; call `refresh()` after layout changes in environments without `ResizeObserver`.

## Pointer and keyboard behavior

Drag the separator to resize. Pointer cancellation or Escape restores the ratio from the start of the drag. Only the active pointer can change it. Horizontal dragging and arrow keys respect RTL layout direction. Drag distances are converted to local CSS pixels under scaled ancestors; resizing the container during a drag rebases the active gesture without a jump.

The separator is focusable and exposes its controlled pane, label, orientation, value, and limits. Left/Right resize horizontal layouts; Up/Down resize vertical layouts. `step` defaults to 10 pixels; Shift multiplies it by ten. Home/End move to the allowed limits. Bare `disabled`, `disabled="false"`, and boolean bindings are normalized consistently. `disabled.bind` cancels a drag and removes the separator from keyboard focus order.

`pane-resize` fires during changes and `pane-resize-end` after a completed pointer or keyboard action. Both bubble with `{ ratio, first, second }`, where sizes are pixels. Persist a ratio through your application's storage layer if needed. Detachment releases pointer capture and disconnects observation.

Requires Aurelia `^2.0.0-rc.2`. Test with `npm test -w aurelia2-split-pane -- --runInBand`; build with `npm run build -w aurelia2-split-pane`.
