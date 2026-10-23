# aurelia2-pan-zoom

A bounded viewport for diagrams, floor plans, maps, and other application-owned canvases. Pointer pan, pinch zoom, keyboard controls, and Ctrl+wheel zoom all update the same Aurelia-bound transform.

```sh
npm install aurelia2-pan-zoom
```

```ts
import Aurelia from 'aurelia';
import { AureliaPanZoomConfiguration } from 'aurelia2-pan-zoom';
Aurelia.register(AureliaPanZoomConfiguration);
```

```html
<div style="height: 500px">
  <au-pan-zoom style="display:block;height:100%"
    content-width.bind="1600" content-height.bind="1000"
    min-scale.bind="0.2" max-scale.bind="4"
    transform.two-way="viewport" component.ref="canvas"
    label="Office floor plan">
    <office-plan></office-plan>
  </au-pan-zoom>
</div>
<button click.trigger="canvas.fit()">Fit plan</button>
```

Initialize `viewport = { x: 0, y: 0, scale: 1 }`. The container must have a definite height; the component fills it. Projected content uses world coordinates within the specified content dimensions. The plugin applies its transform to a wrapper around that content.

## Coordinates and bounds

`x` and `y` are viewport CSS pixels; `scale` maps world pixels to viewport pixels. Content larger than the viewport cannot be dragged beyond its edges. Smaller content is centered. Scale is clamped between `minScale` (default 0.1) and `maxScale` (default 8). Dimensions and scale limits must be positive and finite.

`fit()` chooses a scale that fits the complete content, subject to the configured limits. `screenToWorld({ x, y })` converts a point relative to the viewport's top-left into world coordinates. For a mouse/pointer event, use `clientToWorld(event)` to account for ancestor CSS scaling and the viewport offset. `worldToScreen(point)` performs the inverse local-coordinate transform.

`constrain(transform, bounds)` and `zoomAt(transform, scale, anchor, bounds)` are exported pure geometry functions. `zoomAt` preserves the world point beneath its viewport-relative anchor unless translation limits prevent it.

## Interaction

- Drag the background to pan. Pointer capture keeps the gesture active outside the viewport.
- Use two pointers to pinch around their midpoint.
- Ctrl+wheel zooms around the pointer. Ordinary wheel scrolling is left to the page.
- With the viewport focused, arrow keys pan by 40 pixels, +/− zoom, and 0 fits the content.

Inputs, links, buttons, selects, textareas, and editable regions do not start a pan. Keyboard handling only applies when the viewport itself is the event target. `disabled.bind` cancels active gestures and prevents interaction.

In-place edits to the bound transform are also observed and constrained. Gestures use local CSS pixels under scaled ancestors; pinch anchoring is calculated before applying bounds. Additional pointers beyond the first two are ignored, and all editable content modes keep their native interaction.

`pan-zoom-change` bubbles with a copied `{ x, y, scale }` whenever the transform changes. A `ResizeObserver` reconstrains the viewport when its container changes size; `refresh()` is available for environments without that API. Detachment disconnects observation, releases pointer capture, and removes the native wheel listener.

Requires Aurelia `^2.0.0-rc.2`. Test with `npm test -w aurelia2-pan-zoom -- --runInBand`; build with `npm run build -w aurelia2-pan-zoom`.
