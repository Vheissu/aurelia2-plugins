import {
  bindable,
  computed,
  customAttribute,
  IContainer,
  INode,
  Registration,
  resolve,
} from 'aurelia';

export interface MachineEvent {
  type: string;
}
export interface Transition<C, E extends MachineEvent> {
  target: string;
  guard?: (context: Readonly<C>, event: E) => boolean;
  reduce?: (context: Readonly<C>, event: E) => C;
}
export interface MachineDefinition<C, E extends MachineEvent> {
  initial: string;
  context: C;
  states: Record<
    string,
    { on?: Record<string, Transition<C, E> | readonly Transition<C, E>[]>; final?: boolean }
  >;
}
export interface MachineSnapshot<C> {
  state: string;
  context: C;
  revision: number;
}
/** Guards and reducers must be synchronous and pure. A throwing reducer never commits a transition. */
export class StateMachine<C, E extends MachineEvent = MachineEvent> {
  private current: MachineSnapshot<C>;
  private sending = false;
  constructor(private readonly definition: MachineDefinition<C, E>) {
    if (!Object.hasOwn(definition.states, definition.initial))
      throw new Error('Unknown initial state');
    for (const state of Object.values(definition.states)) {
      for (const entry of Object.values(state.on ?? {})) {
        for (const transition of Array.isArray(entry) ? entry : [entry]) {
          if (!Object.hasOwn(definition.states, transition.target))
            throw new Error(`Unknown target state: ${transition.target}`);
        }
      }
    }
    this.definition = {
      ...definition,
      states: Object.fromEntries(
        Object.entries(definition.states).map(([name, state]) => [
          name,
          {
            final: state.final,
            on: Object.fromEntries(
              Object.entries(state.on ?? {}).map(([event, entries]) => [
                event,
                (Array.isArray(entries) ? entries : [entries]).map((entry) =>
                  Object.freeze({ ...entry }),
                ),
              ]),
            ),
          },
        ]),
      ),
    };
    this.current = { state: definition.initial, context: definition.context, revision: 0 };
  }
  get state(): string {
    return this.current.state;
  }
  get context(): C {
    return this.current.context;
  }
  get revision(): number {
    return this.current.revision;
  }
  get done(): boolean {
    return this.definition.states[this.state].final === true;
  }
  @computed()
  matches(state: string): boolean {
    return this.state === state;
  }
  @computed()
  can(event: E): boolean {
    return this.find(event) !== undefined;
  }
  send(event: E): boolean {
    if (this.sending) throw new Error('Reentrant transitions are not allowed');
    this.sending = true;
    try {
      const transition = this.find(event);
      if (!transition) return false;
      const context = transition.reduce ? transition.reduce(this.context, event) : this.context;
      if (context != null && typeof (context as { then?: unknown }).then === 'function') {
        void Promise.resolve(context).catch(() => {});
        throw new TypeError('Machine reducers must be synchronous');
      }
      this.current = { state: transition.target, context, revision: this.revision + 1 };
      return true;
    } finally {
      this.sending = false;
    }
  }
  private find(event: E): Transition<C, E> | undefined {
    if (this.done) return undefined;
    const on = this.definition.states[this.state].on;
    const candidates = on && Object.hasOwn(on, event.type) ? on[event.type] : undefined;
    return (Array.isArray(candidates) ? candidates : candidates ? [candidates] : []).find((t) => {
      if (!t.guard) return true;
      const result = t.guard(this.context, event);
      if (typeof result !== 'boolean') {
        void Promise.resolve(result).catch(() => {});
        throw new TypeError('Machine guards must return a synchronous boolean');
      }
      return result;
    });
  }
}
export class MachineFactory {
  create<C, E extends MachineEvent = MachineEvent>(
    definition: MachineDefinition<C, E>,
  ): StateMachine<C, E> {
    return new StateMachine(definition);
  }
}
@customAttribute({ name: 'machine-send', defaultProperty: 'machine' })
export class MachineSend {
  @bindable machine?: StateMachine<unknown>;
  @bindable event: MachineEvent = { type: '' };
  @bindable on = 'click';
  private readonly host = resolve(INode) as HTMLElement;
  private listening = '';
  private readonly handle = (event: Event) => {
    if (event.defaultPrevented || !this.machine) return;
    event.preventDefault();
    if (this.machine.send(this.event)) {
      this.host.dispatchEvent(
        new CustomEvent('machine-transition', {
          bubbles: true,
          detail: { state: this.machine.state, context: this.machine.context, event: this.event },
        }),
      );
    }
  };
  attached(): void {
    this.listening = this.on;
    this.host.addEventListener(this.listening, this.handle);
  }
  onChanged(): void {
    if (this.listening) {
      this.detaching();
      this.attached();
    }
  }
  detaching(): void {
    if (this.listening) this.host.removeEventListener(this.listening, this.handle);
    this.listening = '';
  }
}
export const AureliaStateMachineConfiguration = {
  register(container: IContainer) {
    return container.register(Registration.singleton(MachineFactory, MachineFactory), MachineSend);
  },
};
