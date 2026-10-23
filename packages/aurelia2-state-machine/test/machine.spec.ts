import { createFixture } from '@aurelia/testing';
import { runTasks } from 'aurelia';
import { AureliaStateMachineConfiguration, MachineFactory, StateMachine } from '../src/index';
const definition = () => ({
  initial: 'editing',
  context: { valid: false, count: 0 },
  states: {
    editing: {
      on: {
        NEXT: [
          { target: 'done', guard: (c) => c.valid },
          { target: 'invalid', reduce: (c) => ({ ...c, count: c.count + 1 }) },
        ],
      },
    },
    invalid: { on: { EDIT: { target: 'editing', reduce: (c) => ({ ...c, valid: true }) } } },
    done: { final: true },
  },
});
describe('state machine', () => {
  it('selects guarded alternatives and stops at terminal states', () => {
    const m = new StateMachine(definition());
    expect(m.can({ type: 'NO' })).toBe(false);
    expect(m.send({ type: 'NEXT' })).toBe(true);
    expect(m.state).toBe('invalid');
    expect(m.context.count).toBe(1);
    m.send({ type: 'EDIT' });
    m.send({ type: 'NEXT' });
    expect(m.done).toBe(true);
    expect(m.revision).toBe(3);
    expect(m.send({ type: 'EDIT' })).toBe(false);
  });
  it('does not commit a failing reducer', () => {
    const m = new StateMachine({
      initial: 'a',
      context: 1,
      states: {
        a: {
          on: {
            GO: {
              target: 'b',
              reduce: () => {
                throw Error('no');
              },
            },
          },
        },
        b: {},
      },
    });
    expect(() => m.send({ type: 'GO' })).toThrow('no');
    expect(m.state).toBe('a');
    expect(m.context).toBe(1);
    expect(m.revision).toBe(0);
  });
  it('validates definitions and treats prototype event names as unknown', () => {
    expect(() => new StateMachine({ initial: 'x', context: null, states: {} })).toThrow();
    expect(
      () =>
        new StateMachine({
          initial: 'a',
          context: null,
          states: { a: { on: { GO: { target: 'b' } } } },
        }),
    ).toThrow();
    const m = new StateMachine(definition());
    expect(m.send({ type: 'toString' })).toBe(false);
  });
  it('rejects reentrant transitions', () => {
    const m = new StateMachine({
      initial: 'a',
      context: 0,
      states: {
        a: {
          on: {
            GO: {
              target: 'a',
              reduce: () => {
                m.send({ type: 'GO' });
                return 1;
              },
            },
          },
        },
      },
    });
    expect(() => m.send({ type: 'GO' })).toThrow('Reentrant');
    expect(m.revision).toBe(0);
  });
  it('dispatches transitions from a real Aurelia view and cleans listeners', async () => {
    const m = new StateMachine(definition());
    const f = createFixture(
      '<button machine-send="machine.bind: machine; event.bind: event">${machine.state}</button>',
      { machine: m, event: { type: 'NEXT' } },
      [AureliaStateMachineConfiguration],
    );
    await f.startPromise;
    expect(f.container.get(MachineFactory).create(definition()).state).toBe('editing');
    const button = f.appHost.querySelector('button')!;
    const listener = jest.fn();
    button.addEventListener('machine-transition', listener);
    button.click();
    await runTasks();
    expect(button.textContent).toBe('invalid');
    expect(listener).toHaveBeenCalledTimes(1);
    await f.tearDown();
    f.component.event = { type: 'EDIT' };
    button.click();
    expect(m.state).toBe('invalid');
  });
});

it('prevents native form submission even when a guarded transition is rejected', async () => {
  const machine = new StateMachine({
    initial: 'draft',
    context: {},
    states: { draft: { on: { SAVE: { target: 'draft', guard: () => false } } } },
  });
  const f = createFixture(
    '<form machine-send="machine.bind: machine; event.bind: event; on: submit"></form>',
    { machine, event: { type: 'SAVE' } },
    [AureliaStateMachineConfiguration],
  );
  await f.startPromise;
  const listener = jest.fn();
  f.appHost.addEventListener('machine-transition', listener);
  const event = new Event('submit', { bubbles: true, cancelable: true });
  f.appHost.querySelector('form')!.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(listener).not.toHaveBeenCalled();
  expect(machine.revision).toBe(0);
  await f.tearDown();
});

it('reactively observes can and matches in templates', async () => {
  const machine = new StateMachine({
    initial: 'draft',
    context: {},
    states: { draft: { on: { NEXT: { target: 'done' } } }, done: { final: true } },
  });
  const f = createFixture(
    '<button disabled.bind="!machine.can(event)">${machine.matches("done")}</button>',
    { machine, event: { type: 'NEXT' } },
    [AureliaStateMachineConfiguration],
  );
  await f.startPromise;
  try {
    machine.send({ type: 'NEXT' });
    runTasks();
    expect(f.appHost.querySelector('button')!.disabled).toBe(true);
    expect(f.appHost.textContent).toBe('true');
  } finally {
    await f.tearDown();
  }
});
it('snapshots the definition so later caller edits cannot introduce invalid targets', () => {
  const definition = {
    initial: 'a',
    context: {},
    states: { a: { on: { GO: { target: 'b' } } }, b: {} },
  };
  const machine = new StateMachine(definition);
  definition.states.a.on.GO.target = 'missing';
  machine.send({ type: 'GO' });
  expect(machine.state).toBe('b');
});

it('rejects asynchronous guards and reducers rather than silently taking the transition', () => {
  const guard = new StateMachine({
    initial: 'a',
    context: {},
    states: {
      a: { on: { GO: { target: 'b', guard: (() => Promise.resolve(false)) as any } } },
      b: {},
    },
  });
  expect(() => guard.send({ type: 'GO' })).toThrow('synchronous');
  expect(guard.state).toBe('a');
  const reducer = new StateMachine({
    initial: 'a',
    context: {},
    states: {
      a: { on: { GO: { target: 'b', reduce: (() => Promise.resolve({})) as any } } },
      b: {},
    },
  });
  expect(() => reducer.send({ type: 'GO' })).toThrow('synchronous');
  expect(reducer.state).toBe('a');
});
it('tracks nested guard inputs without needing a state transition', async () => {
  const machine = new StateMachine({
    initial: 'a',
    context: { ready: false },
    states: { a: { on: { GO: { target: 'b', guard: (c) => c.ready } } }, b: {} },
  });
  const f = createFixture(
    '<button disabled.bind="!machine.can(event)">Go</button>',
    { machine, event: { type: 'GO' } },
    [AureliaStateMachineConfiguration],
  );
  await f.startPromise;
  try {
    expect(f.appHost.querySelector('button')!.disabled).toBe(true);
    machine.context.ready = true;
    runTasks();
    expect(f.appHost.querySelector('button')!.disabled).toBe(false);
  } finally {
    await f.tearDown();
  }
});
