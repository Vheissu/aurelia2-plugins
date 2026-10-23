# aurelia2-undo-redo

Bounded edit histories for document editors, diagram tools, and settings screens. Transactions group a drag or multi-field edit into one undo step. Each history belongs to one editor; the DI factory does not share document state.

```sh
npm install aurelia2-undo-redo
```

```ts
import Aurelia, { resolve } from 'aurelia';
import { AureliaUndoRedoConfiguration, HistoryFactory } from 'aurelia2-undo-redo';

Aurelia.register(AureliaUndoRedoConfiguration.configure({ limit: 100 }));

export class Editor {
  document = { title: 'Untitled' };
  history = resolve(HistoryFactory).create(this.document, {
    clone: value => ({ ...value }),
    equals: (a, b) => a.title === b.title,
  });
  apply = (value: unknown) => { this.document = value as { title: string }; };
  checkpoint() { this.history.record(this.document, 'Rename document'); }
  undo() { this.apply(this.history.undo()); }
  redo() { this.apply(this.history.redo()); }
}
```

```html
<section tabindex="0" history-keys="history.bind: history; apply.bind: apply">
  <input value.bind="document.title">
  <button click.trigger="checkpoint()">Save checkpoint</button>
  <button disabled.bind="!history.canUndo" click.trigger="undo()">Undo</button>
  <button disabled.bind="!history.canRedo" click.trigger="redo()">Redo</button>
</section>
```

## Snapshot contract

Supply a clone function appropriate for your document. A shallow clone is sufficient for the example above; nested documents need a deep clone such as `structuredClone`. Snapshots are cloned both when recorded and when read. `equals` is optional; when supplied, equal consecutive snapshots do not create entries. Keep both functions pure.

A failing clone or equality callback leaves the cursor, redo branch, and open transaction unchanged, so the operation can be retried.

`limit` counts undo steps, so a limit of 100 retains at most 101 snapshots. Recording after undo discards the redo branch. `undo()` and `redo()` return the current snapshot at their respective boundaries without throwing.

| Member | Behavior |
| --- | --- |
| `value` | A clone of the current snapshot or uncommitted transaction value |
| `record(value, label?)` | Record an edit; default label is `Edit` |
| `begin(label?)` | Open a transaction; nested transactions throw |
| `commit()` | Record the transaction as one edit; throws if none is open |
| `rollback()` | Discard the transaction and return the current committed snapshot |
| `reset(value)` | Clear undo, redo, and any open transaction |
| `canUndo`, `canRedo` | Bindable through Aurelia observation; false during a transaction |
| `undoLabel`, `redoLabel` | Labels for the next available operation |

```ts
history.begin('Move cards');
history.record(firstPosition);
history.record(finalPosition);
history.commit();
```

The plugin never mutates your document or intercepts every assignment. Record meaningful checkpoints and apply returned values explicitly. It complements Aurelia state management without replacing a store.

## Keyboard ownership

`history-keys` handles Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl/Cmd+Y within its host. It requires both `history` and `apply`. Input, textarea, select, and editable descendants retain native editing shortcuts. IME composition is left alone. Unhandled shortcuts keep their default behavior; listeners are removed on detachment.

Requires Aurelia `^2.0.0-rc.2`. Build and test from the root with `npm run build -w aurelia2-undo-redo` and `npm test -w aurelia2-undo-redo -- --runInBand`.
