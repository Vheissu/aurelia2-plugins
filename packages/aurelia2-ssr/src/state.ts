import { DI, Registration, type IRegistration } from '@aurelia/kernel';
import { safeJson } from './html.js';

export const SSR_STATE_SCRIPT_ID = 'aurelia-ssr-state';

declare global {
  interface Window {
    __AURELIA_SSR_STATE__?: unknown;
  }
}

/**
 * Serializable key/value state that travels from the server render to the
 * client. On the server every `set` is captured and embedded in the document
 * by `buildSsrDocument`; on the client the store starts with that embedded
 * data so components can reuse it instead of refetching.
 */
export interface SsrStateStore {
  /** `true` while rendering on the server. */
  readonly isServer: boolean;
  readonly size: number;
  has(key: string): boolean;
  get<T = unknown>(key: string): T | undefined;
  set<T = unknown>(key: string, value: T): void;
  delete(key: string): boolean;
  clear(): void;
  keys(): string[];
  toJSON(): Record<string, unknown>;
}

export class SsrState implements SsrStateStore {
  private readonly values: Map<string, unknown>;

  public constructor(
    initial: Record<string, unknown> | null | undefined = undefined,
    public readonly isServer: boolean = false,
  ) {
    this.values = new Map(Object.entries(initial ?? {}));
  }

  /** A client store seeded from the JSON script `buildSsrDocument` embeds. */
  public static fromDocument(scriptId: string = SSR_STATE_SCRIPT_ID): SsrState {
    return new SsrState(readSsrState(scriptId), false);
  }

  public static forServer(initial?: Record<string, unknown>): SsrState {
    return new SsrState(initial, true);
  }

  public get size(): number {
    return this.values.size;
  }

  public has(key: string): boolean {
    return this.values.has(key);
  }

  public get<T = unknown>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  public set<T = unknown>(key: string, value: T): void {
    if (this.isServer) {
      assertSerializable(key, value);
    }
    this.values.set(key, value);
  }

  public delete(key: string): boolean {
    return this.values.delete(key);
  }

  public clear(): void {
    this.values.clear();
  }

  public keys(): string[] {
    return Array.from(this.values.keys());
  }

  public toJSON(): Record<string, unknown> {
    return Object.fromEntries(this.values);
  }
}

/**
 * Injectable SSR state. Without an explicit registration it resolves to a
 * client store seeded from the embedded state script, so `resolve(ISsrState)`
 * works in a plain SPA bootstrap as well as after `hydrateAureliaSsr`.
 */
export const ISsrState = DI.createInterface<ISsrState>('ISsrState', x => x.cachedCallback(() => SsrState.fromDocument()));
export type ISsrState = SsrStateStore;

export function createSsrStateRegistration(state: SsrStateStore): IRegistration {
  return Registration.instance(ISsrState, state);
}

export interface SsrDataOptions {
  /**
   * Remove the key from the client store after it has been read once, so a
   * later visit to the same view runs the loader again. Defaults to `false`.
   */
  readonly consume?: boolean;
  /** Ignore embedded data and always run the loader. */
  readonly refresh?: boolean;
}

/**
 * Runs `loader` on the server and records the result under `key`; on the
 * client returns the embedded value when present instead of calling `loader`.
 *
 * ```ts
 * readonly state = resolve(ISsrState);
 * async loading() {
 *   this.products = await ssrData(this.state, 'products', () => this.api.products());
 * }
 * ```
 */
export async function ssrData<T>(
  state: SsrStateStore,
  key: string,
  loader: () => T | Promise<T>,
  options: SsrDataOptions = {},
): Promise<T> {
  if (!state.isServer && !options.refresh && state.has(key)) {
    const value = state.get<T>(key) as T;
    if (options.consume) {
      state.delete(key);
    }
    return value;
  }

  const value = await loader();
  if (state.isServer) {
    state.set(key, value);
  }
  return value;
}

export function readSsrState(scriptId: string = SSR_STATE_SCRIPT_ID): Record<string, unknown> | null {
  if (typeof window !== 'undefined' && isRecord(window.__AURELIA_SSR_STATE__)) {
    return window.__AURELIA_SSR_STATE__;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  const script = document.getElementById(scriptId);
  if (!script?.textContent) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(script.textContent);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeSsrState(state: SsrStateStore | Record<string, unknown>): string {
  return safeJson(typeof (state as SsrStateStore).toJSON === 'function'
    ? (state as SsrStateStore).toJSON()
    : state);
}

export interface SsrFetchInterceptorOptions {
  /** HTTP methods whose responses are captured. Defaults to `['GET']`. */
  readonly methods?: readonly string[];
  /** Builds the state key for a request. Return `null` to skip it. */
  readonly keyFor?: (request: Request) => string | null;
  /** Remove a replayed response from the store after the first use. Defaults to `true`. */
  readonly consume?: boolean;
  /** Only capture responses with these statuses. Defaults to any 2xx. */
  readonly shouldCapture?: (response: Response, request: Request) => boolean;
}

interface SerializedFetchResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: readonly (readonly [string, string])[];
  readonly body: string;
}

/**
 * An `@aurelia/fetch-client` interceptor that records responses during the
 * server render and replays them on the client from the embedded state, so
 * components keep calling `fetch` and still avoid the duplicate request.
 *
 * ```ts
 * httpClient.configure(config => config.withInterceptor(createSsrFetchInterceptor(state)));
 * ```
 */
export function createSsrFetchInterceptor(
  state: SsrStateStore,
  options: SsrFetchInterceptorOptions = {},
): {
  request(request: Request): Request | Response;
  response(response: Response, request?: Request): Promise<Response>;
} {
  const methods = new Set((options.methods ?? ['GET']).map(method => method.toUpperCase()));
  const keyFor = options.keyFor ?? defaultFetchKey;
  const consume = options.consume ?? true;
  const shouldCapture = options.shouldCapture ?? ((response: Response) => response.ok);

  return {
    request(request: Request): Request | Response {
      if (state.isServer || !methods.has(request.method.toUpperCase())) {
        return request;
      }

      const key = keyFor(request);
      if (key === null || !state.has(key)) {
        return request;
      }

      const cached = state.get<SerializedFetchResponse>(key)!;
      if (consume) {
        state.delete(key);
      }

      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: cached.headers.map(([name, value]): [string, string] => [name, value]),
      });
    },
    async response(response: Response, request?: Request): Promise<Response> {
      if (!state.isServer || !request || !methods.has(request.method.toUpperCase()) || !shouldCapture(response, request)) {
        return response;
      }

      const key = keyFor(request);
      if (key === null) {
        return response;
      }

      const body = await response.clone().text();
      const headers: (readonly [string, string])[] = [];
      response.headers.forEach((value, name) => {
        headers.push([name, value]);
      });

      state.set<SerializedFetchResponse>(key, {
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
      });

      return response;
    },
  };
}

export function defaultFetchKey(request: Request): string {
  return `fetch:${request.method.toUpperCase()}:${request.url}`;
}

function assertSerializable(key: string, value: unknown): void {
  try {
    JSON.stringify(value);
  } catch (error) {
    throw new Error(`ISsrState value for "${key}" is not JSON serializable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
