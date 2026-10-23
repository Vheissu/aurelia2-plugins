import {
  bindable,
  BindingMode,
  customAttribute,
  DI,
  IContainer,
  IEffect,
  IObservation,
  Registration,
  resolve,
} from 'aurelia';

export interface AutosaveOptions<T> {
  delay: number;
  /** Save the initial model as well as subsequent edits. */
  saveInitial?: boolean;
  maxWait: number;
  serialize: (value: T) => string;
  deserialize: (value: string) => T;
}
export type AutosaveTiming = Pick<AutosaveOptions<unknown>, 'delay' | 'maxWait'>;
export const IAutosaveTiming = DI.createInterface<AutosaveTiming>('IAutosaveTiming');

/** One draft, one ordered stream of writes. A failed write retains the newest draft for retry. */
export class AutosaveSession<T extends object> {
  status: 'idle' | 'scheduled' | 'saving' | 'saved' | 'error' | 'disposed' = 'idle';
  error: unknown = null;
  dirty = false;
  private acknowledged: string | undefined;
  private latest: string;
  private effect?: IEffect;
  private timer?: ReturnType<typeof setTimeout>;
  private deadline?: ReturnType<typeof setTimeout>;
  private inflight?: Promise<boolean>;
  private abort?: AbortController;
  private disposed = false;
  private settleDisposed?: (value: boolean) => void;

  constructor(
    observation: IObservation,
    private readonly model: T,
    private readonly save: (snapshot: T, signal: AbortSignal) => unknown | Promise<unknown>,
    private readonly options: AutosaveOptions<T>,
  ) {
    if (
      !Number.isFinite(options.delay) ||
      options.delay < 0 ||
      !Number.isFinite(options.maxWait) ||
      options.maxWait < options.delay
    )
      throw new Error('Invalid autosave timing');
    this.latest = this.snapshot(model);
    this.acknowledged = options.saveInitial ? undefined : this.latest;
    this.effect = observation.watch(
      model,
      (value) => {
        try {
          return { value: this.snapshot(value) };
        } catch (error) {
          return { error };
        }
      },
      (result) => {
        if ('error' in result) {
          this.clearTimers();
          this.error = result.error;
          this.status = 'error';
          this.dirty = true;
        } else this.changed(result.value!);
      },
      { immediate: false },
    );
    if (options.saveInitial) this.changed(this.latest);
  }
  get hasPendingChanges(): boolean {
    if (this.disposed) return false;
    try {
      return this.dirty || this.snapshot(this.model) !== this.acknowledged;
    } catch {
      return true;
    }
  }
  private snapshot(model: T): string {
    const value = this.options.serialize(model);
    if (typeof value !== 'string') throw new TypeError('Autosave serialize must return a string');
    return value;
  }
  private changed(value: string): void {
    if (this.disposed) return;
    this.latest = value;
    this.dirty = this.latest !== this.acknowledged;
    this.error = null;
    if (this.inflight) {
      this.dirty = true;
      return;
    }
    if (!this.dirty) {
      this.clearTimers();
      this.status = 'idle';
      return;
    }
    this.status = 'scheduled';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, this.options.delay);
    this.deadline ??= setTimeout(() => {
      void this.flush();
    }, this.options.maxWait);
  }
  /** Resolves false on a save error or disposal. Inspect error; call flush again to retry. */
  flush(): Promise<boolean> {
    this.clearTimers();
    if (this.disposed) return Promise.resolve(false);
    try {
      this.latest = this.snapshot(this.model);
      this.dirty = this.latest !== this.acknowledged || this.inflight !== undefined;
    } catch (error) {
      this.error = error;
      this.status = 'error';
      this.dirty = true;
      return Promise.resolve(false);
    }
    if (this.inflight) return this.inflight;
    if (!this.dirty) {
      this.error = null;
      this.status = 'idle';
      return Promise.resolve(true);
    }
    // Defer the drain so synchronous throws cannot leave a stale inflight promise.
    const disposal = new Promise<boolean>((resolve) => {
      this.settleDisposed = resolve;
    });
    this.inflight = Promise.race([Promise.resolve().then(() => this.drain()), disposal]).finally(
      () => {
        this.inflight = undefined;
        this.settleDisposed = undefined;
        if (!this.disposed && this.status !== 'error' && this.latest !== this.acknowledged)
          this.changed(this.latest);
      },
    );
    return this.inflight;
  }
  private async drain(): Promise<boolean> {
    while (!this.disposed && this.latest !== this.acknowledged) {
      const payload = this.latest;
      const abort = (this.abort = new AbortController());
      this.status = 'saving';
      this.error = null;
      try {
        await this.save(this.options.deserialize(payload), abort.signal);
      } catch (error) {
        if (!this.disposed) {
          this.error = error;
          this.status = 'error';
          this.dirty = true;
        }
        return false;
      }
      if (this.disposed) return false;
      this.acknowledged = payload;
      try {
        this.latest = this.snapshot(this.model);
      } catch (error) {
        this.error = error;
        this.status = 'error';
        this.dirty = true;
        return false;
      }
    }
    if (this.disposed) return false;
    this.dirty = false;
    this.status = 'saved';
    return true;
  }
  private clearTimers(): void {
    clearTimeout(this.timer);
    clearTimeout(this.deadline);
    this.timer = this.deadline = undefined;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearTimers();
    this.effect?.stop();
    this.effect = undefined;
    this.abort?.abort();
    this.status = 'disposed';
    this.settleDisposed?.(false);
    this.settleDisposed = undefined;
  }
}
export class AutosaveFactory {
  private readonly observation = resolve(IObservation);
  private readonly timing = resolve(IAutosaveTiming);
  create<T extends object>(
    model: T,
    save: (snapshot: T, signal: AbortSignal) => unknown | Promise<unknown>,
    options: Partial<AutosaveOptions<T>> = {},
  ): AutosaveSession<T> {
    return new AutosaveSession(this.observation, model, save, {
      ...this.timing,
      serialize: JSON.stringify,
      deserialize: JSON.parse,
      ...options,
    });
  }
}
@customAttribute({ name: 'autosave', defaultProperty: 'model' })
export class Autosave {
  @bindable model?: object;
  @bindable save?: (snapshot: object, signal: AbortSignal) => unknown | Promise<unknown>;
  @bindable options: Partial<AutosaveOptions<object>> = {};
  @bindable({ mode: BindingMode.fromView }) session?: AutosaveSession<object>;
  private readonly factory = resolve(AutosaveFactory);
  private active = false;
  bound(): void {
    this.active = true;
    this.reset();
  }
  modelChanged(): void {
    if (this.active) this.reset();
  }
  saveChanged(): void {
    if (this.active) this.reset(true);
  }
  optionsChanged(): void {
    if (this.active) this.reset(true);
  }
  private reset(preservePending = false): void {
    const pending = preservePending && this.session?.hasPendingChanges;
    this.session?.dispose();
    this.session =
      this.model && this.save
        ? this.factory.create(this.model, this.save, {
            ...this.options,
            saveInitial: pending || this.options.saveInitial,
          })
        : undefined;
  }
  unbinding(): void {
    this.active = false;
    this.session?.dispose();
    this.session = undefined;
  }
}
function configure(options: Partial<AutosaveTiming> = {}) {
  const value = { delay: 500, maxWait: 5000, ...options };
  if (
    !Number.isFinite(value.delay) ||
    value.delay < 0 ||
    !Number.isFinite(value.maxWait) ||
    value.maxWait < value.delay
  )
    throw new Error('Invalid autosave timing');
  return {
    register(container: IContainer) {
      return container.register(
        Registration.instance(IAutosaveTiming, value),
        Registration.singleton(AutosaveFactory, AutosaveFactory),
        Autosave,
      );
    },
  };
}
export const AureliaAutosaveConfiguration = { ...configure(), configure };
