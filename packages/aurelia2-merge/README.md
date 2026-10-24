# aurelia2-merge

Resolve conflicting edits to records using a saved base, a local draft, and a newer server version. Independent changes merge automatically. When both sides change the same field, the user chooses a version or enters a custom value.

This fits a 409 response from an autosave API, settings editors, and reconciliation of imported records. It does not retry HTTP requests or implement real-time collaboration.

```ts
import Aurelia, { resolve } from 'aurelia';
import { AureliaMergeConfiguration, MergeService } from 'aurelia2-merge';

Aurelia.register(AureliaMergeConfiguration.configure({ maxDepth: 64, maxNodes: 10000 }));

export class Editor {
  private readonly merges = resolve(MergeService);
  base = { title: 'Draft', priority: 1 };
  mine = { title: 'My title', priority: 1 };
  theirs = { title: 'Server title', priority: 2 };
  accept(merged: object) {
    // Save with the server's current version/ETag. Handle another conflict if necessary.
  }
}
```

```html
<au-merge base.bind="base" mine.bind="mine" theirs.bind="theirs"
  label="Resolve document changes"
  merge-resolve.trigger="accept($event.detail.merged)"></au-merge>
```

The component displays original/local/server values, labelled radio choices, a custom JSON editor and an Apply button. Each conflict has a status line (unresolved, the chosen side, or the custom value) that describes its fieldset. Radios and status are derived from the session, so they also follow `session.resolve()` and `session.clear()` calls made through the bound `session`. Unresolved application attempts focus the first unresolved choice. Data is rendered as text, including strings that contain HTML. Nested `undefined` is shown as `undefined`, distinct from `null` and from missing keys. Conflicts are paginated (20 per page by default; `page-size` accepts 1–100). Multi-line original/server text has an optional bounded line comparison, calculated only when opened. Large comparisons fall back to the original value display rather than creating thousands of DOM rows. A default slot can hold application instructions.

## Merge rules

- Equal local and server values are accepted.
- If only one side differs from the base, that side wins, including deletion.
- Nested plain records merge field by field. Arrays are atomic: two different edits to an array produce one conflict.
- Missing keys, explicit `undefined`, and `null` are distinct. A conflict side exposes `{ present, value }`.
- Numbers compare by value, so `-0` and `0` are equal.
- Conflicts are ordered by local key order, then server key order. Paths are arrays of literal keys, so `['a.b']` and `['a', 'b']` differ.
- Inputs and returned results are copied. Conflict snapshots are frozen. Plain records, arrays and finite scalar values are supported, including Aurelia-observed own properties. Cycles, sparse arrays, class instances, executable values, symbol keys and prototype-mutating keys are rejected.

The default budget is 64 levels and 10,000 nodes per input or custom value. Excessively deep or large input fails validation. A malformed component input displays an error and disables application; replacing it with valid data recovers the view. The headless APIs throw validation errors.

## Headless API

```ts
const session = resolve(MergeService).create(base, mine, theirs);
for (const conflict of session.conflicts) {
  session.resolve(conflict.id, { choice: 'mine' });
}
const result = session.result();
```

`new MergeSession(base, mine, theirs, limits?)` is also available for framework-independent use. Its observable getters are `unresolvedCount` and `isComplete`. Methods:

- `resolve(id, { choice: 'base' | 'mine' | 'theirs' | 'delete' })`
- `resolve(id, { choice: 'custom', value })`
- `clear(id)` to reopen a choice
- `isResolved(id)`
- `decision(id)` to read the recorded `{ choice, present, value }` (frozen), or `undefined`
- `result()` to return a fresh result, or throw while any conflict remains

`mergeRecords(base, mine, theirs, limits?)` returns `{ merged, conflicts, changes }`. `merged` is tentative and uses the local side for unresolved conflicts. Never save it without checking `conflicts`. `changes` lists paths merged without a conflict; use a session for interactive resolution.

`copyMergeValue` validates and copies one value. `diffLines(before, after, maxCells = 250000)` returns `equal`, `add`, `remove`, or whole-text `replace` operations. It uses a bounded comparison table and falls back to replacement above its budget. Line endings and trailing newlines are preserved; it does not merge text edits automatically.

## Component lifecycle and events

`session` and `error` can be bound from-view. `field-label.bind` accepts a function from a key path to a display label; replacing it relabels the rows and keeps choices, and if it throws, the path is shown. Replacing `base`, `mine`, or `theirs` creates a new session at the end of the turn and clears previous choices. This deliberately avoids applying choices to a newer server conflict. Replace inputs for external edits; in-place mutation is not a session reset signal. When the view is deactivated and bound again (for example a cached `if.bind`), it keeps its session if all three input references are unchanged, and starts a new session otherwise.

`merge-reset` publishes the new session. `merge-before-apply` is cancellable and contains a detached `{ merged }` proposal. If accepted, `merge-resolve` emits a separate result. Changes to inputs or choices during the callback cancel that application. `apply()` is not reentrant: calling it from a `merge-before-apply` or `merge-resolve` listener returns `false`, so one apply publishes at most one resolution. `merge-cancel` asks the application to close or discard the view; it does not mutate inputs.

Custom values in the default UI use JSON syntax, so use Remove field for deletion and the headless API for explicit `undefined`. Arrays are not merged by item identity, and strings are resolved as whole fields. There are no rich-text diffs, conflict-marker parsing, CRDTs, or network calls.

Requires Aurelia `^2.0.0-rc.2`. Run `npm run build -w aurelia2-merge`, `npm test -w aurelia2-merge -- --runInBand`, and `npm run lint -w aurelia2-merge`.
