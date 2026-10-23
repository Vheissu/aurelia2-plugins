# aurelia2-sortable

Reorder lists with native drag/drop or the keyboard. A gesture previews its order locally, then emits a cancellable event before committing a new array through Aurelia's two-way binding.

```sh
npm install aurelia2-sortable
```

```ts
import Aurelia from 'aurelia';
import { AureliaSortableConfiguration } from 'aurelia2-sortable';
Aurelia.register(AureliaSortableConfiguration);
```

```html
<au-sortable items.two-way="stages" label="Delivery stages"
  sortable-before-change.trigger="validateMove($event)"
  sortable-change.trigger="saveOrder($event.detail.items)">
</au-sortable>
```

For primitive values, `stages = ['Research', 'Design', 'Build']` is enough. Object lists default to `item.id` and `item.label`. Override `get-key.bind` and `get-label.bind` with functions for other shapes. Keys must be unique, stable strings. Missing or duplicate keys throw before rendering the new list.

```ts
stages = [{ code: 'research', title: 'Research' }, { code: 'build', title: 'Build' }];
keyFor = (item: { code: string }) => item.code;
labelFor = (item: { title: string }) => item.title;
```

```html
<au-sortable items.two-way="stages" get-key.bind="keyFor" get-label.bind="labelFor"></au-sortable>
```

## Interaction contract

Focus an item's button and press Space or Enter to pick it up. Up/Down move its preview, Home/End move to the ends, Enter/Space commit, and Escape or Tab cancels. The focused button stays associated with its keyed item. A live region announces positions. `disabled.bind` stops interaction and cancels an active gesture.

Drag/drop uses the same commit path. Drops from unrelated lists are ignored; cross-list transfers and nested sortable containers are not supported. Native HTML drag/drop support varies on touch devices. Set `controls` (or `controls.bind="true"`) to show labelled Up/Down buttons; these use the same cancellable commit path and work with touch, mouse, and assistive technology.

The component does not mutate the supplied array. A successful commit publishes a new array containing the same item objects. `sortable-before-change` is cancelable; call `event.preventDefault()` to reject a move. `sortable-change` fires after commit. Both events contain `{ items, item, from, to }` with zero-based indices.

If external data changes during a gesture, the gesture is cancelled. Aurelia observation tracks array mutations and key/label changes. Treat item keys as identity; changing them replaces the rendered item. Source replacement or in-place edits inside `sortable-before-change` cancel the stale gesture, including same-turn changes before observation notifications run. Dropping an item at its existing index does not emit `sortable-change`. Consumer handlers should treat event details as read-only.

`moveItem(items, from, to)` is exported for application-side reordering. It returns a copy and throws `RangeError` for invalid indices.

Requires Aurelia `^2.0.0-rc.2`. Test with `npm test -w aurelia2-sortable -- --runInBand`; build with `npm run build -w aurelia2-sortable`.
