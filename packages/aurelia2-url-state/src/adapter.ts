import { CustomElement, DI, IContainer, IPlatform, resolve, type IDisposable } from 'aurelia';
import type { HistoryMode } from './params.js';

/**
 * - `navigating`: a navigation the plugin did not start has begun. Pending writes are stale.
 * - `navigated`: such a navigation finished, or the URL changed outside the plugin. Models are re-read.
 * - `cancelled`: such a navigation was cancelled or failed. The URL is unchanged.
 * - `idle`: the adapter stopped being `busy`, so queued writes can continue.
 */
export type UrlStateAdapterEvent = {
  readonly type: 'navigating' | 'navigated' | 'cancelled' | 'idle';
};

/**
 * Connects url-state to a URL source. Writes are serialized by `IUrlState`: `write` is never called
 * again until the previous call has settled, and never while `busy` is true.
 */
export interface UrlStateAdapter {
  /** The current (or, during a navigation, the incoming) query string without `?`. */
  read(): string;
  /** Replace the whole query string. Return `false` when the navigation was rejected. */
  write(search: string, mode: HistoryMode): boolean | void | Promise<boolean | void>;
  /** Report external URL changes. */
  subscribe(listener: (event: UrlStateAdapterEvent) => void): IDisposable;
  /** When true, writes wait for an `idle` event. */
  readonly busy?: boolean;
  dispose?(): void;
}

export const IUrlStateAdapter =
  /*@__PURE__*/ DI.createInterface<UrlStateAdapter>('IUrlStateAdapter');

export interface UrlStateAdapterSettings {
  readonly ignoreRouter: boolean;
}
export const IUrlStateAdapterSettings = /*@__PURE__*/ DI.createInterface<UrlStateAdapterSettings>(
  'IUrlStateAdapterSettings',
  (x) => x.instance(Object.freeze({ ignoreRouter: false })),
);

const stripQuestion = (search: string) => (search.startsWith('?') ? search.slice(1) : search);

/**
 * Uses `window.history` and `popstate`. Keeps the path, hash and `history.state` as they are.
 * Does nothing when the platform has no `history` (server rendering).
 */
export class HistoryUrlStateAdapter implements UrlStateAdapter {
  private readonly window: Window | null;
  constructor() {
    const platform = resolve(IPlatform);
    const container = resolve(IContainer);
    const win = (platform as { window?: Window }).window;
    this.window =
      win &&
      typeof win.history?.replaceState === 'function' &&
      typeof win.location?.search === 'string'
        ? win
        : null;
    if (
      this.window &&
      !resolve(IUrlStateAdapterSettings).ignoreRouter &&
      CustomElement.find(container, 'au-viewport') !== null
    )
      throw new Error(
        'url-state: a router is registered, so the history adapter would bypass it. Register ' +
          "AureliaUrlStateConfiguration.configure({ adapter: RouterUrlStateAdapter }) from 'aurelia2-url-state/router', " +
          'or pass ignoreRouter: true if this app does not route with query strings.',
      );
  }
  /** False on platforms without `window.history`; reads return '' and writes do nothing. */
  get active(): boolean {
    return this.window !== null;
  }
  read(): string {
    return this.window ? stripQuestion(this.window.location.search) : '';
  }
  write(search: string, mode: HistoryMode): boolean {
    const win = this.window;
    if (!win) return true;
    const { pathname, hash } = win.location;
    const url = `${pathname}${search ? `?${search}` : ''}${hash}`;
    const state: unknown = win.history.state;
    if (mode === 'push') win.history.pushState(state, '', url);
    else win.history.replaceState(state, '', url);
    return true;
  }
  subscribe(listener: (event: UrlStateAdapterEvent) => void): IDisposable {
    const win = this.window;
    if (!win) return { dispose() {} };
    const handler = () => listener({ type: 'navigated' });
    win.addEventListener('popstate', handler);
    return { dispose: () => win.removeEventListener('popstate', handler) };
  }
}

/**
 * Keeps the query string in memory. Use it on the server (seeded from the request URL), in tests,
 * or in embedded views that must not touch the address bar.
 */
export class MemoryUrlStateAdapter implements UrlStateAdapter {
  private entries: string[];
  private index = 0;
  private readonly listeners = new Set<(event: UrlStateAdapterEvent) => void>();
  constructor(search = '') {
    this.entries = [new URLSearchParams(stripQuestion(search)).toString()];
  }
  get length(): number {
    return this.entries.length;
  }
  read(): string {
    return this.entries[this.index];
  }
  write(search: string, mode: HistoryMode): boolean {
    if (mode === 'push') {
      this.entries = [...this.entries.slice(0, this.index + 1), search];
      this.index++;
    } else this.entries[this.index] = search;
    return true;
  }
  subscribe(listener: (event: UrlStateAdapterEvent) => void): IDisposable {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }
  /** Move through entries like the browser's back and forward buttons. */
  go(delta: number): boolean {
    const next = this.index + delta;
    if (!Number.isInteger(delta) || next < 0 || next >= this.entries.length) return false;
    this.index = next;
    for (const listener of [...this.listeners]) listener({ type: 'navigated' });
    return true;
  }
  /** Change the query as an external navigation would. */
  navigate(search: string, mode: HistoryMode = 'push'): void {
    this.write(new URLSearchParams(stripQuestion(search)).toString(), mode);
    for (const listener of [...this.listeners]) listener({ type: 'navigated' });
  }
}
