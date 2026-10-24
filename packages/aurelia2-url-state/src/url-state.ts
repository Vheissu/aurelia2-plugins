import {
  batch,
  DI,
  ILogger,
  IObserverLocator,
  IPlatform,
  resolve,
  type IDisposable,
} from 'aurelia';
import { IUrlStateAdapter, type UrlStateAdapterEvent } from './adapter.js';
import {
  assertKey,
  describe,
  isUrlParam,
  UrlStateCodecError,
  type HistoryMode,
  type UrlParam,
} from './params.js';

export type UrlParams<M> = { [K in keyof M]?: UrlParam<M[K]> };

export type UrlStateErrorCode = 'rejected' | 'failed' | 'serialize';

/** A write that did not reach the URL. `keys` are query keys. */
export class UrlStateError extends Error {
  constructor(
    readonly code: UrlStateErrorCode,
    message: string,
    readonly keys: readonly string[],
    readonly mode: HistoryMode | null,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'UrlStateError';
  }
}

export type UrlStateApplySource = 'connect' | 'navigation' | 'refresh' | 'revert';

export type UrlStateEvent =
  /** URL values were written to the model. `corrected` lists property names whose URL values were invalid or not canonical. */
  | {
      readonly type: 'apply';
      readonly source: UrlStateApplySource;
      readonly values: Readonly<Record<string, unknown>>;
      readonly corrected: readonly string[];
    }
  /** Model values reached the URL. `keys` are query keys. */
  | {
      readonly type: 'commit';
      readonly mode: HistoryMode;
      readonly keys: readonly string[];
      readonly search: string;
    }
  | { readonly type: 'error'; readonly error: UrlStateError };

export interface UrlStateConnectOptions {
  /** Receives every event, including the `apply` that happens during `connect`. */
  listener?: (event: UrlStateEvent) => void;
}

export interface UrlStateHandle<M extends object = object> {
  readonly model: M;
  /** Query keys owned by this handle. */
  readonly keys: readonly string[];
  /** True while changes are debounced, queued or being written. */
  readonly pending: boolean;
  /** The last failed write; cleared by the next successful one. */
  readonly error: UrlStateError | null;
  readonly disposed: boolean;
  /** Copies of the current model values for every param. */
  snapshot(): Partial<M>;
  /** Write debounced changes now. */
  flush(): void;
  /** Drop pending changes and read the URL into the model again. */
  refresh(): void;
  /** Resolves when no url-state work is pending in this app. */
  settled(): Promise<void>;
  subscribe(listener: (event: UrlStateEvent) => void): IDisposable;
  /** Cancels pending writes (without flushing them), stops observing and frees the keys. */
  dispose(): void;
}

interface Entry {
  readonly name: string;
  readonly key: string;
  readonly param: UrlParam<unknown>;
  readonly fallback: unknown;
  observer: { unsubscribe(subscriber: unknown): void } | null;
  array: {
    target: unknown[];
    observer: { unsubscribe(subscriber: unknown): void };
    subscriber: unknown;
  } | null;
  dirty: boolean;
  ready: boolean;
  mode: HistoryMode;
  timer: ReturnType<typeof setTimeout> | null;
}

interface PatchItem {
  readonly session: Session;
  readonly entry: Entry;
  readonly values: readonly string[];
}
interface WriteBatch {
  readonly mode: HistoryMode;
  readonly patch: Map<string, PatchItem>;
}

const sameValues = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);
const normalize = (search: string) => new URLSearchParams(search).toString();
const pair = (key: string, value: string) => new URLSearchParams([[key, value]]).toString();
const segmentKey = (segment: string) => new URLSearchParams(segment).keys().next().value ?? '';
const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as PromiseLike<unknown> | null)?.then === 'function';

/** Replace owned keys, keep every other raw segment and its order, then list owned keys in connect order. */
function compose(
  current: string,
  patch: ReadonlyMap<string, PatchItem>,
  owned: readonly string[],
): string {
  const ownedSet = new Set(owned);
  const kept: string[] = [];
  const existing = new Map<string, string[]>();
  for (const segment of current.split('&')) {
    if (!segment) continue;
    const key = segmentKey(segment);
    if (!ownedSet.has(key)) kept.push(segment);
    else existing.set(key, [...(existing.get(key) ?? []), segment]);
  }
  for (const key of owned) {
    const item = patch.get(key);
    if (item) kept.push(...item.values.map((value) => pair(key, value)));
    else kept.push(...(existing.get(key) ?? []));
  }
  return kept.join('&');
}

class Session implements UrlStateHandle {
  readonly entries: Entry[];
  readonly keys: readonly string[];
  disposed = false;
  error: UrlStateError | null = null;
  private suppress = 0;
  private readonly listeners = new Set<(event: UrlStateEvent) => void>();

  constructor(
    private readonly service: UrlStateService,
    readonly model: object,
    specs: readonly Pick<Entry, 'name' | 'key' | 'param' | 'fallback'>[],
  ) {
    this.entries = specs.map((spec) => ({
      ...spec,
      observer: null,
      array: null,
      dirty: false,
      ready: false,
      mode: 'replace',
      timer: null,
    }));
    this.keys = Object.freeze(this.entries.map((entry) => entry.key));
  }

  get pending(): boolean {
    return (
      !this.disposed && (this.entries.some((entry) => entry.dirty) || this.service.hasWork(this))
    );
  }

  snapshot(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const entry of this.entries) result[entry.name] = this.copy(entry, this.read(entry));
    return result;
  }

  flush(): void {
    if (this.disposed) return;
    for (const entry of this.entries)
      if (entry.dirty) {
        this.clearTimer(entry);
        entry.ready = true;
      }
    this.service.collect();
  }

  refresh(): void {
    if (this.disposed) return;
    this.service.forget(this);
    for (const entry of this.entries) this.reset(entry);
    this.reconcile('refresh', true);
  }

  settled(): Promise<void> {
    return this.service.settled();
  }

  subscribe(listener: (event: UrlStateEvent) => void): IDisposable {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of this.entries) {
      this.reset(entry);
      entry.observer?.unsubscribe(this.subscriberFor(entry));
      entry.observer = null;
      this.unwatchArray(entry);
    }
    this.service.release(this);
    this.listeners.clear();
  }

  /** @internal */
  start(listener: ((event: UrlStateEvent) => void) | undefined): void {
    if (listener) this.listeners.add(listener);
    const corrected = this.apply(this.service.read(), 'connect', this.entries);
    const observerLocator = this.service.observerLocator;
    for (const entry of this.entries) {
      const observer = observerLocator.getObserver(this.model, entry.name);
      observer.subscribe(this.subscriberFor(entry));
      entry.observer = observer;
      this.watchArray(entry);
    }
    if (!this.service.blocked) for (const entry of corrected) this.mark(entry, 'replace', 0);
  }

  /** Read the URL into the model; optionally schedule corrections. @internal */
  reconcile(source: UrlStateApplySource, correct: boolean, entries = this.entries): void {
    if (this.disposed) return;
    let corrected: Entry[];
    try {
      corrected = this.apply(this.service.read(), source, entries);
    } catch (error) {
      this.fail(
        new UrlStateError(
          'failed',
          `url-state: could not update the model: ${describe(error)}`,
          [],
          null,
          error,
        ),
      );
      return;
    }
    if (correct) for (const entry of corrected) this.mark(entry, 'replace', 0);
  }

  /** Re-schedule model values that differ from the URL, after a cancelled navigation. @internal */
  resume(): void {
    if (this.disposed) return;
    const query = new URLSearchParams(this.service.read());
    for (const entry of this.entries) {
      const values = this.encode(entry, this.read(entry));
      if (!(values instanceof UrlStateError) && !sameValues(values, query.getAll(entry.key)))
        this.mark(entry, entry.param.options.history, 0);
    }
  }

  /** Move a ready (or, for a push, any) dirty entry into a patch. @internal */
  take(entry: Entry, into: Map<string, PatchItem>): boolean {
    this.reset(entry);
    const values = this.encode(entry, this.read(entry));
    if (values instanceof UrlStateError) {
      this.fail(values);
      return false;
    }
    into.set(entry.key, { session: this, entry, values });
    return true;
  }

  /** @internal */
  reset(entry: Entry): void {
    this.clearTimer(entry);
    entry.dirty = false;
    entry.ready = false;
  }

  /** @internal */
  committed(mode: HistoryMode, keys: readonly string[], search: string): void {
    this.error = null;
    this.emit({ type: 'commit', mode, keys, search });
  }

  /** @internal */
  fail(error: UrlStateError): void {
    this.error = error;
    this.service.logger.warn(error.message);
    this.emit({ type: 'error', error });
  }

  private subscribers = new WeakMap<Entry, { handleChange(): void }>();
  private subscriberFor(entry: Entry) {
    let subscriber = this.subscribers.get(entry);
    if (!subscriber) {
      subscriber = { handleChange: () => this.changed(entry, true) };
      this.subscribers.set(entry, subscriber);
    }
    return subscriber;
  }

  private changed(entry: Entry, property: boolean): void {
    if (this.disposed) return;
    if (property) this.watchArray(entry);
    if (this.suppress > 0 || this.service.blocked) return;
    this.mark(entry, entry.param.options.history, entry.param.options.debounce);
  }

  private mark(entry: Entry, mode: HistoryMode, debounce: number): void {
    this.clearTimer(entry);
    entry.dirty = true;
    entry.mode = mode;
    if (debounce > 0) {
      entry.ready = false;
      entry.timer = this.service.platform.setTimeout(() => {
        entry.timer = null;
        entry.ready = true;
        this.service.schedule();
      }, debounce);
    } else {
      entry.ready = true;
      this.service.schedule();
    }
  }

  private clearTimer(entry: Entry): void {
    if (entry.timer !== null) this.service.platform.clearTimeout(entry.timer);
    entry.timer = null;
  }

  private watchArray(entry: Entry): void {
    const value = this.read(entry);
    if (entry.array?.target === value) return;
    this.unwatchArray(entry);
    if (!Array.isArray(value)) return;
    const observer = this.service.observerLocator.getArrayObserver(value);
    const subscriber = { handleCollectionChange: () => this.changed(entry, false) };
    observer.subscribe(subscriber);
    entry.array = { target: value, observer, subscriber };
  }

  private unwatchArray(entry: Entry): void {
    entry.array?.observer.unsubscribe(entry.array.subscriber);
    entry.array = null;
  }

  private read(entry: Entry): unknown {
    return (this.model as Record<string, unknown>)[entry.name];
  }

  private same(entry: Entry, a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || a === undefined || b === null || b === undefined) return false;
    try {
      return entry.param.validate(a) && entry.param.validate(b) && entry.param.equals(a, b);
    } catch {
      return false;
    }
  }

  private copy(entry: Entry, value: unknown): unknown {
    if (value === null || value === undefined || !entry.param.validate(value)) return value;
    try {
      return entry.param.clone(value);
    } catch {
      return value;
    }
  }

  /** Values for the URL, or the reason they cannot be written. Defaults are omitted. */
  private encode(entry: Entry, value: unknown): string[] | UrlStateError {
    const fail = (message: string, cause?: unknown) =>
      new UrlStateError(
        'serialize',
        `url-state: cannot write "${entry.name}": ${message}`,
        [entry.key],
        null,
        cause,
      );
    if (this.same(entry, value, entry.fallback)) return [];
    if (value === null || value === undefined || !entry.param.validate(value))
      return fail(`the model value is not a valid ${entry.param.kind}`);
    let values: unknown;
    try {
      values = entry.param.serialize(value);
    } catch (error) {
      return fail(error instanceof UrlStateCodecError ? error.message : describe(error), error);
    }
    if (!Array.isArray(values) || values.some((item) => typeof item !== 'string'))
      return fail('serialize did not return strings');
    return values as string[];
  }

  private apply(search: string, source: UrlStateApplySource, entries: readonly Entry[]): Entry[] {
    const query = new URLSearchParams(search);
    const corrected: Entry[] = [];
    const assignments: [Entry, unknown][] = [];
    for (const entry of entries) {
      const raw = query.getAll(entry.key);
      let value: unknown = entry.fallback;
      if (raw.length > 0) {
        const result = entry.param.parse(raw);
        if (result.ok) value = result.value;
      }
      if (value === entry.fallback) value = this.copy(entry, value);
      const expected = this.encode(entry, value);
      if (expected instanceof UrlStateError || !sameValues(expected, raw)) corrected.push(entry);
      if (!this.same(entry, this.read(entry), value)) assignments.push([entry, value]);
    }
    if (assignments.length > 0) {
      this.suppress++;
      try {
        batch(() => {
          for (const [entry, value] of assignments)
            (this.model as Record<string, unknown>)[entry.name] = value;
        });
      } finally {
        this.suppress--;
      }
    }
    if (assignments.length > 0 || corrected.length > 0 || source === 'connect')
      this.emit({
        type: 'apply',
        source,
        values: this.snapshot(),
        corrected: corrected.map((entry) => entry.name),
      });
    return corrected;
  }

  private emit(event: UrlStateEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        this.service.logger.error(`url-state: an event listener threw: ${describe(error)}`);
      }
    }
  }
}

export type IUrlState = UrlStateService;
export const IUrlState = /*@__PURE__*/ DI.createInterface<IUrlState>('IUrlState', (x) =>
  x.singleton(UrlStateService),
);

/**
 * Owns query keys for one app container and serializes every write through the adapter.
 */
export class UrlStateService {
  /** @internal */ readonly platform = resolve(IPlatform);
  /** @internal */ readonly observerLocator = resolve(IObserverLocator);
  /** @internal */ readonly logger = resolve(ILogger).scopeTo('url-state');
  /** @internal */ blocked = false;
  private readonly adapter = resolve(IUrlStateAdapter);
  private readonly sessions = new Set<Session>();
  private readonly owners = new Map<string, Session>();
  private subscription: IDisposable | null = null;
  private ticking = false;
  private queue: WriteBatch[] = [];
  private inflight: WriteBatch | null = null;
  private lastWritten: string | null = null;
  private waiters: (() => void)[] = [];
  private pumping = false;

  /**
   * Two-way link between `model` and the query string. URL values are applied before this returns.
   * Throws when a key is already owned or a param cannot represent the model value.
   */
  connect<M extends object>(
    model: M,
    params: UrlParams<M>,
    options: UrlStateConnectOptions = {},
  ): UrlStateHandle<M> {
    if (typeof model !== 'object' || model === null)
      throw new TypeError('url-state: model must be an object');
    if (Object.isFrozen(model)) throw new TypeError('url-state: model must not be frozen');
    if (typeof params !== 'object' || params === null)
      throw new TypeError('url-state: params must be an object');
    const names = Object.keys(params);
    if (names.length === 0) throw new TypeError('url-state: params must define at least one param');
    const keys = new Set<string>();
    const specs = names.map((name) => {
      assertKey(name, 'param name');
      const param: unknown = (params as Record<string, unknown>)[name];
      if (!isUrlParam(param))
        throw new TypeError(`url-state: "${name}" must be created with a param.*() builder`);
      const key = param.options.key ?? name;
      if (keys.has(key)) throw new Error(`url-state: query key "${key}" is used by two params`);
      if (this.owners.has(key))
        throw new Error(`url-state: query key "${key}" is already owned by another model`);
      keys.add(key);
      let fallback: unknown;
      if (param.options.hasDefault) fallback = param.options.default;
      else {
        if (!(name in model))
          throw new TypeError(`url-state: model has no "${name}" and the param has no default`);
        const initial: unknown = (model as Record<string, unknown>)[name];
        if (initial !== null && !param.validate(initial))
          throw new TypeError(
            `url-state: model "${name}" is not a valid ${param.kind}; give the param a default`,
          );
        fallback = initial === null ? null : param.clone(initial);
      }
      return { name, key, param, fallback };
    });
    const session = new Session(this, model, specs);
    for (const key of keys) this.owners.set(key, session);
    this.sessions.add(session);
    this.subscription ??= this.adapter.subscribe((event) => this.onAdapterEvent(event));
    try {
      session.start(options.listener);
    } catch (error) {
      session.dispose();
      throw error;
    }
    return session as unknown as UrlStateHandle<M>;
  }

  /** True while any change is debounced, queued or being written. */
  get pending(): boolean {
    return (
      this.ticking ||
      this.inflight !== null ||
      this.queue.length > 0 ||
      [...this.sessions].some((session) => session.entries.some((entry) => entry.dirty))
    );
  }

  settled(): Promise<void> {
    if (!this.pending) return Promise.resolve();
    return new Promise((done) => this.waiters.push(done));
  }

  /** Drop pending writes and read the URL into every model, for URL changes made outside url-state. */
  sync(): void {
    this.dropPending();
    this.reconcile('refresh');
    this.notify();
  }

  /** Disconnect every model. The service can be used again afterwards. */
  dispose(): void {
    for (const session of [...this.sessions]) session.dispose();
    this.subscription?.dispose();
    this.subscription = null;
    this.adapter.dispose?.();
    this.queue = [];
    this.blocked = false;
    this.lastWritten = null;
    this.notify();
  }

  /** @internal */
  read(): string {
    try {
      return this.adapter.read();
    } catch (error) {
      this.logger.warn(`url-state: the adapter could not read the URL: ${describe(error)}`);
      return '';
    }
  }

  /** @internal */
  hasWork(session: Session): boolean {
    const touches = (write: WriteBatch | null) =>
      write !== null && [...write.patch.values()].some((item) => item.session === session);
    return touches(this.inflight) || this.queue.some(touches);
  }

  /** @internal */
  schedule(): void {
    if (this.ticking) return;
    this.ticking = true;
    this.platform.queueMicrotask(() => {
      this.ticking = false;
      this.collect();
    });
  }

  /** Turn ready changes into writes. Debounced changes are written first, as a replace, when a push happens. @internal */
  collect(): void {
    if (!this.blocked) {
      const main = new Map<string, PatchItem>();
      const early = new Map<string, PatchItem>();
      let push = false;
      for (const session of this.sessions)
        for (const entry of session.entries)
          if (entry.dirty && entry.ready) {
            const mode = entry.mode;
            if (session.take(entry, main) && mode === 'push') push = true;
          }
      if (push)
        for (const session of this.sessions)
          for (const entry of session.entries) if (entry.dirty) session.take(entry, early);
      if (early.size > 0) this.enqueue({ mode: 'replace', patch: early });
      if (main.size > 0) this.enqueue({ mode: push ? 'push' : 'replace', patch: main });
      this.pump();
    }
    this.notify();
  }

  /** @internal */
  forget(session: Session): void {
    for (const write of this.queue)
      for (const [key, item] of write.patch) if (item.session === session) write.patch.delete(key);
    this.queue = this.queue.filter((write) => write.patch.size > 0);
  }

  /** @internal */
  release(session: Session): void {
    this.forget(session);
    for (const key of session.keys) if (this.owners.get(key) === session) this.owners.delete(key);
    this.sessions.delete(session);
    this.notify();
  }

  private enqueue(write: WriteBatch): void {
    const last = this.queue[this.queue.length - 1];
    // A replace merges into the queued entry; consecutive pushes stay separate history entries.
    if (last && write.mode === 'replace')
      for (const [key, item] of write.patch) last.patch.set(key, item);
    else this.queue.push(write);
  }

  private pump(): void {
    if (this.pumping) return;
    this.pumping = true;
    try {
      this.drain();
    } finally {
      this.pumping = false;
    }
  }

  private drain(): void {
    while (
      this.inflight === null &&
      !this.blocked &&
      this.queue.length > 0 &&
      this.adapter.busy !== true
    ) {
      const write = this.queue.shift()!;
      const current = this.read();
      const query = new URLSearchParams(current);
      for (const [key, item] of write.patch)
        if (
          item.session.disposed ||
          this.owners.get(key) !== item.session ||
          sameValues(query.getAll(key), item.values)
        )
          write.patch.delete(key);
      if (write.patch.size === 0) continue;
      const owned = [...this.sessions].flatMap((session) => session.keys);
      const search = compose(current, write.patch, owned);
      this.inflight = write;
      let result: unknown;
      try {
        result = this.adapter.write(search, write.mode);
      } catch (error) {
        this.finish(write, search, false, error);
        continue;
      }
      if (isThenable(result))
        result.then(
          (ok) => this.finish(write, search, ok !== false, undefined),
          (error: unknown) => this.finish(write, search, false, error ?? new Error('write failed')),
        );
      else this.finish(write, search, result !== false, undefined);
    }
  }

  private finish(write: WriteBatch, search: string, ok: boolean, error: unknown): void {
    if (this.inflight !== write) return;
    this.inflight = null;
    const groups = new Map<Session, Entry[]>();
    for (const item of write.patch.values())
      if (!item.session.disposed)
        groups.set(item.session, [...(groups.get(item.session) ?? []), item.entry]);
    if (ok) {
      this.lastWritten = normalize(search);
      for (const [session, entries] of groups)
        session.committed(
          write.mode,
          entries.map((entry) => entry.key),
          search,
        );
    } else {
      for (const [session, entries] of groups) {
        const keys = entries.map((entry) => entry.key);
        session.fail(
          error === undefined
            ? new UrlStateError(
                'rejected',
                `url-state: the ${write.mode} navigation for ${keys.join(', ')} was rejected`,
                keys,
                write.mode,
              )
            : new UrlStateError(
                'failed',
                `url-state: writing ${keys.join(', ')} failed: ${describe(error)}`,
                keys,
                write.mode,
                error,
              ),
        );
        // The URL did not change: show what it holds, unless the user has edited the value again.
        if (!this.blocked)
          session.reconcile(
            'revert',
            false,
            entries.filter((entry) => !entry.dirty),
          );
      }
    }
    this.pump();
    this.notify();
  }

  private onAdapterEvent(event: UrlStateAdapterEvent): void {
    switch (event.type) {
      case 'navigating':
        this.blocked = true;
        this.dropPending();
        break;
      case 'navigated':
        this.blocked = false;
        this.dropPending();
        this.reconcile('navigation');
        break;
      case 'cancelled':
        this.blocked = false;
        for (const session of [...this.sessions]) session.resume();
        break;
    }
    this.pump();
    this.notify();
  }

  private reconcile(source: UrlStateApplySource): void {
    // Never correct our own last write again: a codec that does not round-trip must not loop.
    const echo = this.lastWritten !== null && normalize(this.read()) === this.lastWritten;
    for (const session of [...this.sessions]) session.reconcile(source, !echo);
  }

  private dropPending(): void {
    this.queue = [];
    for (const session of this.sessions) for (const entry of session.entries) session.reset(entry);
  }

  private notify(): void {
    if (this.waiters.length === 0 || this.pending) return;
    const waiters = this.waiters;
    this.waiters = [];
    for (const done of waiters) done();
  }
}
