# aurelia2-autosave

Observe a draft with Aurelia's observation API and save edits without overlapping writes. Edits are debounced, continuous typing has a maximum wait, and changes made during a save are coalesced into the next write.

```sh
npm install aurelia2-autosave
```

```ts
import Aurelia from 'aurelia';
import { AureliaAutosaveConfiguration, type AutosaveSession } from 'aurelia2-autosave';

Aurelia.register(AureliaAutosaveConfiguration.configure({ delay: 500, maxWait: 5000 }));

export class DraftEditor {
  draft = { title: '', body: '' };
  session?: AutosaveSession<object>;
  save = async (snapshot: object, signal: AbortSignal) => {
    const response = await fetch('/api/draft', {
      method: 'PUT', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    if (!response.ok) throw new Error(`Save failed: ${response.status}`);
  };
}
```

```html
<section autosave="model.bind: draft; save.bind: save; session.from-view: session">
  <input value.bind="draft.title">
  <textarea value.bind="draft.body"></textarea>
  <p aria-live="polite">${session.status}</p>
  <button if.bind="session.error" click.trigger="session.flush()">Retry save</button>
</section>
```

## Write ordering

The initial model is the acknowledged baseline and is not saved automatically. Set `saveInitial: true` in session options to save a newly created draft too. `hasPendingChanges` checks the current model even before observation notifications run. A changed snapshot starts the debounce timer. `maxWait` limits how long continuous edits can postpone the first write. Reverting to the acknowledged snapshot before a write cancels the pending save.

Only one write runs at a time. Edits made while it runs replace the pending snapshot; after success, the newest pending snapshot is written. A failed write sets `error`, leaves `dirty` true, and stops the drain. `flush()` retries. A subsequent edit also schedules another attempt. There is no automatic retry loop.

`flush()` reads the current model immediately, including edits whose Aurelia observer notification has not run yet, and clears debounce timers and returns a promise resolving to true after all current writes finish, or false on error/disposal. Concurrent flush calls share the same promise. `status` is one of `idle`, `scheduled`, `saving`, `saved`, `error`, or `disposed`. `dirty` and `error` are observable.

## Snapshot format and lifecycle

Serialization errors are exposed through `error` and retain a dirty draft. They do not escape through Aurelia's observation queue; fixing the value permits another attempt.

The default codec uses `JSON.stringify` and `JSON.parse`; it supports JSON-shaped models, not cyclic graphs, BigInt, or object identity. The observed serialized value doubles as the change fingerprint. Each save receives a detached snapshot. Supply `serialize` and `deserialize` through `options.bind` or the factory for other data types; the pair must round-trip and serialization must be deterministic.

Aurelia observes properties read by serialization, including nested edits. Initialize the properties you intend to edit. For structural additions, replace the relevant object or the attribute's `model` rather than relying on observation of previously absent properties.

```ts
import { resolve } from 'aurelia';
import { AutosaveFactory, type AutosaveSession } from 'aurelia2-autosave';

export class Editor {
  private readonly factory = resolve(AutosaveFactory);
  draft = { title: '' };
  session?: AutosaveSession<typeof this.draft>;
  binding() {
    this.session = this.factory.create(this.draft, async (snapshot, signal) => {
      const response = await fetch('/api/draft', {
        method: 'PUT', signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      });
      if (!response.ok) throw new Error(`Save failed: ${response.status}`);
    });
  }
  unbinding() { this.session?.dispose(); }
}
```

Create factory sessions on each binding because Aurelia can reuse a component after unbinding, including cached `if` views. A disposed session remains stopped.

The attribute disposes sessions when its model, save callback, or options are replaced, and on unbinding. Replacing the callback or options carries unsaved edits into the replacement session. Replacing the model starts a new document baseline; flush the previous session before switching documents if its edits must be saved. Disposal stops observation, clears timers, aborts the request, and resolves a pending flush as false even if the save callback ignores its signal. It does not flush. Before a deliberate navigation, await `session.flush()` and decide how to handle false. Unload handlers cannot guarantee delivery.

A save callback must honour its abort signal. Abort cannot undo a write already accepted by your backend; use server revisions or optimistic concurrency checks when multiple editors may save the same record. Offline persistence belongs in `aurelia2-offline-sync`.

Requires Aurelia `^2.0.0-rc.2`. Run `npm test -w aurelia2-autosave -- --runInBand` and `npm run build -w aurelia2-autosave` from the root.
