import { IContainer, ILogger, IPlatform, resolve, type IDisposable } from 'aurelia';
import {
  ILocationManager,
  IRouter,
  IRouterEvents,
  IRouterOptions,
  type Params,
} from '@aurelia/router';
import type { HistoryMode, UrlStateAdapter, UrlStateAdapterEvent } from './index.js';

interface OwnWrite {
  id: number | null;
  settled: boolean;
  settle(result: boolean | Error): void;
}

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Split a router path (`orders/7?q=a#top`) into a normalized query and a fragment. */
function splitUrl(url: string): { search: string; fragment: string } {
  let rest = url;
  let fragment = '';
  const hash = rest.indexOf('#');
  if (hash >= 0) {
    fragment = decode(rest.slice(hash + 1));
    rest = rest.slice(0, hash);
  }
  const question = rest.indexOf('?');
  return {
    search: new URLSearchParams(question >= 0 ? rest.slice(question + 1) : '').toString(),
    fragment,
  };
}

function toRecord(search: string): Params {
  const record: Record<string, string | string[]> = Object.create(null);
  for (const [key, value] of new URLSearchParams(search)) {
    const previous = record[key];
    record[key] =
      previous === undefined
        ? value
        : Array.isArray(previous)
          ? [...previous, value]
          : [previous, value];
  }
  // The router appends array values as repeated keys (`mergeURLSearchParams`), although `Params` is typed as strings.
  return record as Params;
}

/**
 * Writes the query through `router.load(currentPath, { queryParams, fragment, historyStrategy })`.
 *
 * - The path is the one from the last completed navigation, so the router's own same-path rule
 *   keeps every routed component, sibling viewport and child route; `canLoad`/`loading` do not run.
 * - Writes wait until the router is idle and are never issued while another navigation is queued.
 * - A popstate the router ignores (it compares paths, not queries) is still reported to url-state.
 */
export class RouterUrlStateAdapter implements UrlStateAdapter {
  private readonly router: IRouter;
  private readonly locationManager: ILocationManager;
  private readonly platform = resolve(IPlatform);
  private readonly logger = resolve(ILogger).scopeTo('url-state:router');
  private readonly listeners = new Set<(event: UrlStateAdapterEvent) => void>();
  private subscriptions: IDisposable[] = [];
  private readonly events = resolve(IRouterEvents);
  private path: string | null = null;
  private search = '';
  private fragment = '';
  private writing = false;
  private own: OwnWrite | null = null;
  private pendingLocation: string | null = null;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (!resolve(IContainer).has(IRouterOptions, true))
      throw new Error(
        'url-state: RouterUrlStateAdapter needs RouterConfiguration from @aurelia/router',
      );
    this.router = resolve(IRouter);
    this.locationManager = resolve(ILocationManager);
    this.start();
  }

  private start(): void {
    if (this.subscriptions.length) return;
    const events = this.events;
    this.subscriptions = [
      events.subscribe('au:router:location-change', (event) => this.onLocationChange(event.url)),
      events.subscribe('au:router:navigation-start', (event) =>
        this.onStart(event.id, event.trigger),
      ),
      events.subscribe('au:router:navigation-end', (event) => {
        const instructions = event.finalInstructions;
        this.path = instructions.toPath();
        this.search = instructions.queryParams.toString();
        this.fragment = instructions.fragment ?? '';
        this.onSettled(event.id, true);
      }),
      events.subscribe('au:router:navigation-cancel', (event) => this.onSettled(event.id, false)),
      events.subscribe('au:router:navigation-error', (event) => this.onSettled(event.id, false)),
    ];
  }

  get busy(): boolean {
    return (
      this.router.isNavigating ||
      this.path === null ||
      this.own !== null ||
      this.pendingLocation !== null ||
      this.settleTimer !== null
    );
  }

  read(): string {
    // During a navigation the incoming query is already on the route tree; ICurrentRoute updates later.
    if (this.router.isNavigating) return this.router.routeTree.queryParams.toString();
    if (this.path === null) return splitUrl(this.locationManager.getPath()).search;
    return this.search;
  }

  write(search: string, mode: HistoryMode): Promise<boolean> {
    const path = this.path;
    if (path === null || this.router.isNavigating) return Promise.resolve(false);
    const strategy = this.router.options.historyStrategy === 'none' ? 'none' : mode;
    return new Promise<boolean>((done, fail) => {
      const own: OwnWrite = {
        id: null,
        settled: false,
        settle: (result) => {
          if (own.settled) return;
          own.settled = true;
          if (this.own === own) this.own = null;
          this.scheduleSettle();
          if (result instanceof Error) fail(result);
          else done(result);
        },
      };
      this.own = own;
      this.writing = true;
      let navigation: Promise<boolean>;
      try {
        navigation = this.router.load(path, {
          queryParams: toRecord(search),
          fragment: this.fragment,
          historyStrategy: strategy,
        });
      } catch (error) {
        own.settle(error instanceof Error ? error : new Error(describe(error)));
        return;
      } finally {
        this.writing = false;
      }
      navigation.then(
        (ok) => own.settle(ok !== false),
        (error: unknown) => own.settle(error instanceof Error ? error : new Error(describe(error))),
      );
    });
  }

  subscribe(listener: (event: UrlStateAdapterEvent) => void): IDisposable {
    this.start();
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  dispose(): void {
    for (const subscription of this.subscriptions) subscription.dispose();
    this.subscriptions.length = 0;
    this.own?.settle(false);
    if (this.settleTimer !== null) this.platform.clearTimeout(this.settleTimer);
    this.settleTimer = null;
    this.pendingLocation = null;
    this.listeners.clear();
  }

  private onStart(id: number, trigger: string): void {
    const own = this.own;
    if (this.writing && own !== null && own.id === null && trigger === 'api') {
      own.id = id;
      return;
    }
    // The router honoured the browser navigation, so its navigation-end will report it.
    if (trigger !== 'api') this.pendingLocation = null;
    this.emit('navigating');
  }

  private onSettled(id: number, completed: boolean): void {
    const own = this.own;
    if (own !== null && own.id === id) {
      // `router.load` settles the write; navigation-end can arrive first.
      if (completed) own.settle(true);
    } else {
      // Another navigation finished while ours was running, so ours was dropped by the router.
      if (own !== null && own.id !== null) own.settle(false);
      this.emit(completed ? 'navigated' : 'cancelled');
    }
    this.scheduleSettle();
  }

  private onLocationChange(url: string): void {
    this.pendingLocation = url;
    this.emit('navigating');
    this.scheduleSettle();
  }

  /** Runs one macrotask after router activity, after the router's own queued transitions have started. */
  private scheduleSettle(): void {
    if (this.settleTimer !== null) this.platform.clearTimeout(this.settleTimer);
    this.settleTimer = this.platform.setTimeout(() => {
      this.settleTimer = null;
      if (this.router.isNavigating) return;
      const location = this.pendingLocation;
      if (location !== null) {
        // The router skipped this popstate because only the query differs; the address bar is the truth.
        this.pendingLocation = null;
        ({ search: this.search, fragment: this.fragment } = splitUrl(location));
        this.emit('navigated');
      }
      // A write whose navigation never started was replaced by another queued navigation.
      if (this.own !== null && this.own.id === null && !this.writing) this.own.settle(false);
      if (!this.busy) this.emit('idle');
    }, 0);
  }

  private emit(type: UrlStateAdapterEvent['type']): void {
    for (const listener of [...this.listeners]) {
      try {
        listener({ type });
      } catch (error) {
        this.logger.error(`url-state: a router adapter listener threw: ${describe(error)}`);
      }
    }
  }
}
