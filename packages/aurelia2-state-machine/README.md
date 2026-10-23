# aurelia2-state-machine

Explicit state transitions for publishing, approval, and other workflows where arbitrary state assignments are a source of bugs. Guards choose transitions; reducers produce the next context. Aurelia bindings observe the resulting state and context.

```sh
npm install aurelia2-state-machine
```

```ts
import Aurelia, { resolve } from 'aurelia';
import { AureliaStateMachineConfiguration, MachineFactory } from 'aurelia2-state-machine';

Aurelia.register(AureliaStateMachineConfiguration);

export class ReviewPage {
  submitEvent = { type: 'SUBMIT' };
  workflow = resolve(MachineFactory).create({
    initial: 'draft',
    context: { ready: true, attempts: 0 },
    states: {
      draft: {
        on: {
          SUBMIT: [
            { target: 'review', guard: context => context.ready },
            { target: 'draft', reduce: context => ({ ...context, attempts: context.attempts + 1 }) },
          ],
        },
      },
      review: { on: { APPROVE: { target: 'published' }, REJECT: { target: 'draft' } } },
      published: { final: true },
    },
  });
}
```

```html
<p>Status: ${workflow.state}</p>
<button machine-send="machine.bind: workflow; event.bind: submitEvent">Submit for review</button>
```

## Transition semantics

`send(event)` returns true when a transition commits and false when no transition is available. Alternatives are evaluated in order; the first passing guard wins. Unknown events do nothing, and final states reject all events. Initial and target states are validated when the machine is created.

Guards and reducers are synchronous and must be pure. Treat context as immutable. The machine snapshots the transition definition on creation, so later changes to the caller's definition cannot alter validated targets. A reducer should return a new context rather than mutate its argument. A thrown guard or reducer propagates to the caller without changing the machine's state or revision. Reentrant `send` calls throw. Promise-returning guards or reducers are rejected explicitly; they are never treated as truthy guards or committed contexts.

For asynchronous work, run a task and send success or failure events when it settles. This package does not execute effects, persist workflows, or implement hierarchical/parallel states.

| API | Purpose |
| --- | --- |
| `state`, `context` | Current committed snapshot |
| `revision` | Increases once per committed transition, including self-transitions |
| `done` | True in a final state |
| `matches(name)` | Test the active state |
| `can(event)` | Evaluate guards without committing; guards must be side-effect-free |
| `send(event)` | Evaluate and commit a transition |

`can(event)` and `matches(name)` participate in Aurelia computed-method observation, including guard dependencies read from context. Bind expressions such as `disabled.bind="!workflow.can(submitEvent)"` directly.

The `StateMachine<C, E>` and `MachineDefinition<C, E>` types support typed event unions with payloads. The factory creates independent machines, so registering the plugin never creates shared workflow state.

## DOM integration

`machine-send` listens to `click` by default. Set `on: submit` to use a form event. `machine`, `event`, and `on` are bindable. With a machine configured, it prevents the original event's default action even when a transition is rejected, so a guarded form cannot accidentally submit through the browser. Accepted transitions emit `machine-transition` with `{ state, context, event }`. Detachment removes the listener.

Requires Aurelia `^2.0.0-rc.2`. Run `npm test -w aurelia2-state-machine -- --runInBand` and `npm run build -w aurelia2-state-machine` from the repository root.
