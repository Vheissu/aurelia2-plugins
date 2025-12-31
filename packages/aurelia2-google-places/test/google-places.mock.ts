type Listener = (...args: any[]) => void;

class EventTargetStub {
  private listeners = new Map<string, Listener[]>();

  addListener(name: string, cb: Listener) {
    const list = this.listeners.get(name) ?? [];
    list.push(cb);
    this.listeners.set(name, list);
    return {
      remove: () => {
        const next = (this.listeners.get(name) ?? []).filter(
          (listener) => listener !== cb
        );
        this.listeners.set(name, next);
      },
    };
  }

  trigger(name: string, event?: any) {
    (this.listeners.get(name) ?? []).forEach((cb) => cb(event));
  }
}

export class AutocompleteMock extends EventTargetStub {
  static instances: AutocompleteMock[] = [];

  public setOptions = jest.fn((options: any) => {
    this.options = { ...this.options, ...options };
  });
  public setFields = jest.fn();
  public setTypes = jest.fn();
  public setBounds = jest.fn();
  public setComponentRestrictions = jest.fn();
  public getPlace = jest.fn(() => ({ name: 'Mock place' }));

  constructor(public input: HTMLInputElement, public options: any) {
    super();
    AutocompleteMock.instances.push(this);
  }
}

export function installGooglePlacesMock() {
  const maps = {
    places: {
      Autocomplete: AutocompleteMock,
    },
  };

  (globalThis as any).google = { maps };

  return maps;
}

export function teardownGooglePlacesMock() {
  delete (globalThis as any).google;
}
