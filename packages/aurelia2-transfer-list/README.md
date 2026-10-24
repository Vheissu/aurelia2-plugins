# aurelia2-transfer-list

Assign keyed items between two lists: reviewers, team members, columns, recipients, or enabled integrations. The assigned value is an ordered array of keys, so it can be saved without copying the option objects.

```ts
import Aurelia from 'aurelia';
import { AureliaTransferListConfiguration } from 'aurelia2-transfer-list';
Aurelia.register(AureliaTransferListConfiguration);

export class Team {
  people = [
    { id: 'ana', label: 'Ana Smith' },
    { id: 'ben', label: 'Ben Lee' },
    { id: 'pat', label: 'Pat Taylor', disabled: true },
  ];
  reviewers = ['ana'];
}
```

```html
<au-transfer-list options.bind="people" value.two-way="reviewers"
  source-label="People" target-label="Reviewers" filterable orderable max="3">
</au-transfer-list>
```

Keys must be unique non-empty strings or finite numbers. The default readers use `id`, `label`, and `disabled`. Bind `get-key`, `get-label`, and `get-disabled` functions for another data shape. Keys retain their types: `1` and `'1'` are different. Invalid or duplicate keys throw rather than silently dropping assignments.

Each accepted operation replaces `value`; it never mutates the supplied array. Additions follow option order. Unknown assigned keys stay visible with an unavailable label and can be removed. Disabled options cannot be added, removed, or selected for reordering. `max` rejects an entire addition that would exceed the limit; removals remain possible when a value already exceeds it. `disabled` blocks all changes.

Filtering affects each list separately. Hidden selections are cleared. Add all and Remove all operate on visible, enabled rows. Reordering is blocked while the assigned list is filtered, because the visible order omits items.

## Keyboard and events

Focus stays on the listbox; `aria-activedescendant` identifies the active row. Arrow keys, Home and End move it. Space toggles selection, Shift+Arrow extends a range, Ctrl/Cmd+A selects or clears visible enabled rows, typing finds a label, and Enter transfers the selection or active row. Alt+Up/Down reorders assigned selections when `orderable` is enabled. Clicking selects one item; Ctrl/Cmd+click toggles and Shift+click selects a range. Double-click transfers one item.

`transfer-before-change` bubbles and is cancelable. Its detail is `{ value, previous, moved, direction }`, where direction is `add`, `remove`, or `reorder`. Accepted operations emit `transfer-change` with a separate detail copy. A listener can veto a change with `preventDefault()`. If it changes the value, options, disabled state, or limits during the callback, the component checks the proposal again before committing. Recursive before-change operations are rejected.

Buttons remain focusable with `aria-disabled` and a description explaining why an action is unavailable. A live region announces transfers, limits, and cancellations. Set `source-label`, `target-label`, and `heading-level` to fit the surrounding page.

## Custom content and messages

The `item` slot exposes `{ item, key, label, disabled, selected, side }` through `$host`. Keep its content noninteractive: each row is a listbox option. Unavailable keys use the configured fallback text.

```html
<au-transfer-list options.bind="people" value.two-way="reviewers">
  <template au-slot="item"><strong>${$host.label}</strong></template>
</au-transfer-list>
```

Configure any of the exported `TransferListMessages` using `AureliaTransferListConfiguration.configure({ messages: { ... } })`. Counts and announcements are functions, so applications can supply their own pluralization. CSS hooks use `au-transfer-list__*`; no stylesheet is injected. See `examples/workspace-lab` for a styled example.

## Programmatic use

A component reference exposes `add(keys)`, `remove(keys)`, and `reorder(keys, -1 | 1)`. They return whether the operation committed and use the same events and constraints as the UI. `orderable` controls the UI; `reorder` remains available programmatically. `select(side, keys)` and `setFilter(side, text)` update one pane.

The pure helpers `transfer(value, keys, 'add' | 'remove', { max? })` and `reorderKeys(value, keys, -1 | 1)` return new arrays. Both validate dense, unique key arrays. They have no option metadata, so callers must enforce disabled-item rules themselves. The component observes array edits and the fields read by its option callbacks, and stops those subscriptions on unbinding.
