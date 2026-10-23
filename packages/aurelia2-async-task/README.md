# aurelia2-async-task

Control what happens when a user starts an operation twice. Searches can restart, submit buttons can drop duplicate attempts, and ordered local operations can queue. Task state is observable from Aurelia views, and every invocation resolves to an explicit outcome.

```sh
npm install aurelia2-async-task
```

```ts
import Aurelia, { resolve } from 'aurelia';
import { AureliaAsyncTaskConfiguration, TaskFactory } from 'aurelia2-async-task';

Aurelia.register(AureliaAsyncTaskConfiguration.configure({ policy: 'restart', maxQueued: 20 }));

export class SearchPage {
  query = '';
  search = resolve(TaskFactory).create(async (query: string, signal) => {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
    if (!response.ok) throw new Error(`Search failed: ${response.status}`);
    return response.json();
  });
  unbinding() { this.search.dispose(); }
}
```

```html
<form task-run="task.bind: search; args.bind: query; on: submit">
  <input value.bind="query">
  <button type="submit">Search</button>
</form>
<p if.bind="search.running">Searching…</p>
<p if.bind="search.error">Search failed. Try again.</p>
```

## Policies and outcomes

| Policy | When work is already running |
| --- | --- |
| `restart` | Abort and settle the older invocation, then start the new one |
| `drop` | Resolve the new invocation as `dropped` without executing it |
| `enqueue` | Run in FIFO order; return `dropped` once `maxQueued` waiting jobs are present |

`run(args)` always resolves with one of:

```ts
{ status: 'completed', value }
{ status: 'failed', error }
{ status: 'cancelled' }
{ status: 'dropped' }
```

Action failures are represented as outcomes rather than rejected promises. Inspect the outcome when calling a task from application code. `value` retains the most recent successful result. `error` resets at the start of a job; `status`, `running`, and `queued` can be bound in a view. By the time a run resolves, its internal bookkeeping is complete.

`cancel()` aborts the active job, settles all waiting jobs as cancelled, and leaves the task reusable. `dispose()` also prevents future runs. A run attempted synchronously from an abort listener during cancellation resolves as cancelled, avoiding reentrant jobs that could block a replacement task. Cancellation settles callers immediately even if an action ignores its signal; stale results cannot change task state. The underlying operation must honour its signal to stop network or CPU work. Restarting is appropriate for reads, not non-idempotent server writes that might already have committed.

## Attribute lifecycle

`task-run` owns the supplied task during its attachment. It prevents the event's default action, calls `run(args)`, and emits `task-settled` with the outcome as its detail. Changing the task or detaching cancels the previous task. Events from a removed/replaced attachment are suppressed. A task used by this attribute should not be shared with unrelated views.

This is an in-memory concurrency tool. It does not cache query results or persist offline operations; those are the responsibilities of `aurelia2-query` and `aurelia2-offline-sync`.

Requires Aurelia `^2.0.0-rc.2`. Run `npm test -w aurelia2-async-task -- --runInBand` and `npm run build -w aurelia2-async-task` from the root.
