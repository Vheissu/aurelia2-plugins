import { buildSsrDocument } from './document.js';
import { createJSDOMEnvironment } from './globals.js';
import { isRedirectStatus } from './redirects.js';
import { renderAureliaToString } from './renderer.js';
import { matchSsrRoute, normalizeSsrPath } from './routes.js';
import type {
  SsrAppRenderResult,
  SsrAssetManifest,
  SsrCacheConfig,
  SsrDiagnostic,
  SsrDomEnvironment,
  SsrRenderAureliaOptions,
  SsrRouteConfig,
  SsrSiteConfig,
} from './types.js';

export interface SsrRequestLike {
  /** Absolute URL or request path (`/products/1?tab=a`). */
  readonly url: string;
  readonly method?: string;
  readonly headers?: Headers | Readonly<Record<string, string | readonly string[] | undefined>>;
}

export interface SsrResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  /** Where the response came from. */
  readonly source: 'render' | 'cache' | 'redirect' | 'spa' | 'not-modified' | 'error';
  readonly route: SsrRouteConfig | null;
  readonly render: SsrAppRenderResult | null;
  readonly diagnostics: readonly SsrDiagnostic[];
}

export interface SsrResponseCache {
  get(key: string): SsrCachedResponse | undefined | Promise<SsrCachedResponse | undefined>;
  set(key: string, value: SsrCachedResponse, ttlMs: number): void | Promise<void>;
  delete?(key: string): void | Promise<void>;
  clear?(): void | Promise<void>;
}

export interface SsrCachedResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly expiresAt: number;
}

export type SsrServerRenderOptions<TComponent extends object> = Omit<
  SsrRenderAureliaOptions<TComponent>,
  'window' | 'component' | 'route' | 'site' | 'host'
>;

export interface SsrRequestHandlerOptions<TComponent extends object = object> {
  readonly site: SsrSiteConfig;
  readonly component: new (...args: never[]) => TComponent;
  /** Document template, or a loader (called per request, so dev servers can transform it). */
  readonly template: string | ((request: SsrRequestLike) => string | Promise<string>);
  readonly manifest?: SsrAssetManifest | null;
  /** Routes to serve. Defaults to `site.routes`. */
  readonly routes?: readonly SsrRouteConfig[];
  /**
   * What to do when no route matches:
   * - `spa`: serve the template shell with status 200 and let the client router handle it (default)
   * - `render`: render the app anyway with a synthesized route using the site defaults
   * - `not-found`: render the route with `status: 404` when one exists, otherwise a 404 shell
   */
  readonly fallback?: 'spa' | 'render' | 'not-found';
  /** When a render throws or reports errors: serve the SPA shell (default) or a 500 error page. */
  readonly onRenderError?: 'spa' | 'error';
  readonly createEnvironment?: (url: string, route: SsrRouteConfig, request: SsrRequestLike) => Promise<SsrDomEnvironment> | SsrDomEnvironment;
  /** Options forwarded to `renderAureliaToString`. May be a function to add per-request registrations (cookies, auth). */
  readonly render?: SsrServerRenderOptions<TComponent> | ((request: SsrRequestLike, route: SsrRouteConfig) => SsrServerRenderOptions<TComponent> | Promise<SsrServerRenderOptions<TComponent>>);
  /** In-memory (or custom) response cache. Pass `false` to disable. Defaults to a memory cache when any route or the site sets `cache.ttlMs`. */
  readonly cache?: SsrResponseCache | false;
  /** Emit and honor weak ETags. Defaults to `true`. */
  readonly etag?: boolean;
  /** Extra headers added to every response. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Called with render diagnostics after each rendered response. */
  readonly onDiagnostics?: (diagnostics: readonly SsrDiagnostic[], request: SsrRequestLike) => void;
  readonly onError?: (error: unknown, request: SsrRequestLike) => void;
}

export interface SsrRequestHandler {
  (request: SsrRequestLike): Promise<SsrResponse>;
  /** Drops cached responses (all, or one path). */
  invalidate(path?: string): Promise<void>;
}

/**
 * Creates a framework-agnostic request-time renderer. Feed it any request
 * shape and adapt the result with `toWebResponse`, `sendNodeResponse`, or
 * `createNodeSsrMiddleware`.
 */
export function createSsrRequestHandler<TComponent extends object = object>(
  options: SsrRequestHandlerOptions<TComponent>,
): SsrRequestHandler {
  const site = options.site;
  const routes = options.routes ?? site.routes ?? [];
  const cache = options.cache === false
    ? null
    : options.cache ?? (hasCacheTtl(site, routes) ? createMemorySsrCache() : null);
  const useEtag = options.etag ?? true;
  const hostTag = site.rendering?.hostTagName ?? site.rendering?.hostSelector?.replace(/^[#.]/u, '') ?? 'my-app';
  // DOM globals and the Aurelia platform are process-wide, so renders run one
  // at a time. Cached, redirect, and shell responses do not wait.
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  const handler = (async (request: SsrRequestLike): Promise<SsrResponse> => {
    const method = (request.method ?? 'GET').toUpperCase();
    const url = new URL(request.url, site.origin);
    const pathname = normalizeSsrPath(url.pathname);
    const cacheKey = `${pathname}${url.search}`;
    const baseHeaders = { 'content-type': 'text/html; charset=utf-8', ...(options.headers ?? {}) };

    if (method !== 'GET' && method !== 'HEAD') {
      return respond(405, { ...baseHeaders, allow: 'GET, HEAD' }, '', 'error', null, null, []);
    }

    if (cache) {
      const cached = await cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return finalize({ status: cached.status, headers: cached.headers, body: cached.body, source: 'cache', route: null, render: null, diagnostics: [] }, request);
      }
    }

    const match = matchSsrRoute(pathname, routes);
    let route: SsrRouteConfig | null = match?.route ?? null;

    if (route?.redirectTo) {
      return respond(isRedirectStatus(route.status) ? route.status! : 301, {
        ...baseHeaders,
        location: withSearch(route.redirectTo, url.search),
      }, '', 'redirect', route, null, []);
    }

    if (!route) {
      const fallback = options.fallback ?? 'spa';
      if (fallback === 'spa') {
        return spaShell(200, request, baseHeaders, null);
      }
      if (fallback === 'not-found') {
        route = routes.find(candidate => candidate.status === 404 && !candidate.redirectTo) ?? null;
        if (!route) {
          return spaShell(404, request, baseHeaders, null);
        }
        route = { ...route, path: pathname };
      } else {
        route = {
          path: pathname,
          mode: 'server',
          seo: {
            title: site.defaultTitle ?? site.siteName,
            description: site.defaultDescription ?? '',
            canonicalPath: pathname,
          },
        };
      }
    }

    if (route.mode === 'client') {
      return spaShell(route.status ?? 200, request, baseHeaders, route);
    }

    return serialize(() => renderRoute(request, route!, url, cacheKey, baseHeaders));
  }) as SsrRequestHandler;

  async function renderRoute(
    request: SsrRequestLike,
    route: SsrRouteConfig,
    url: URL,
    cacheKey: string,
    baseHeaders: Record<string, string>,
  ): Promise<SsrResponse> {
    const environment = await createEnvironment(url.toString(), route, request);

    try {
      const renderOptions = typeof options.render === 'function'
        ? await options.render(request, route)
        : options.render ?? {};
      const render = await renderAureliaToString<TComponent>({
        ...renderOptions,
        window: environment.window,
        component: options.component,
        site,
        route,
      });
      const diagnostics = render.diagnostics ?? [];
      options.onDiagnostics?.(diagnostics, request);

      if (diagnostics.some(diagnostic => diagnostic.code === 'render_failed')) {
        return failed(request, baseHeaders, route, render, diagnostics);
      }

      if (render.redirectTo && isRedirectStatus(render.status)) {
        return respond(render.status!, { ...baseHeaders, location: render.redirectTo }, '', 'redirect', route, render, diagnostics);
      }

      const template = typeof options.template === 'function' ? await options.template(request) : options.template;
      const document = buildSsrDocument({ template, route, site, render, manifest: options.manifest, baseDocument: environment.document });
      const status = render.status ?? route.status ?? 200;
      const cachePolicy = { ...(site.cache ?? {}), ...(route.cache ?? {}) };
      const headers: Record<string, string> = { ...baseHeaders, 'cache-control': cacheControl(cachePolicy) };
      const response = finalize({
        status, headers, body: document.html, source: 'render', route, render, diagnostics: document.diagnostics,
      }, request);

      if (cache && status === 200 && !cachePolicy.noStore && (cachePolicy.ttlMs ?? 0) > 0) {
        await cache.set(cacheKey, {
          status: response.status, headers: response.headers, body: response.body, expiresAt: Date.now() + cachePolicy.ttlMs!,
        }, cachePolicy.ttlMs!);
      }

      return response;
    } catch (error) {
      options.onError?.(error, request);
      return failed(request, baseHeaders, route, null, [{
        severity: 'error', code: 'render_failed', message: error instanceof Error ? error.message : String(error), path: route.path,
      }]);
    } finally {
      environment.close();
    }
  }

  async function createEnvironment(requestUrl: string, route: SsrRouteConfig, request: SsrRequestLike): Promise<SsrDomEnvironment> {
    return options.createEnvironment
      ? options.createEnvironment(requestUrl, route, request)
      : createJSDOMEnvironment({
        url: requestUrl,
        html: `<!doctype html><html><head><base href="/"></head><body><${hostTag}></${hostTag}></body></html>`,
      });
  }

  handler.invalidate = async (path?: string) => {
    if (!cache) {
      return;
    }
    if (path === undefined) {
      await cache.clear?.();
      return;
    }
    await cache.delete?.(normalizeSsrPath(path));
  };

  return handler;

  async function spaShell(
    status: number,
    request: SsrRequestLike,
    headers: Record<string, string>,
    route: SsrRouteConfig | null,
  ): Promise<SsrResponse> {
    const template = typeof options.template === 'function' ? await options.template(request) : options.template;
    if (!route) {
      return finalize({ status, headers: { ...headers, 'cache-control': 'no-store' }, body: template, source: 'spa', route: null, render: null, diagnostics: [] }, request);
    }

    const environment = await createEnvironment(new URL(route.path, site.origin).toString(), route, request);
    try {
      const document = buildSsrDocument({
        template,
        route,
        site,
        render: { appHtml: `<${hostTag}></${hostTag}>`, path: route.path, status },
        manifest: options.manifest,
        includeManifest: false,
        baseDocument: environment.document,
      });
      return finalize({
        status, headers: { ...headers, 'cache-control': cacheControl({ ...(site.cache ?? {}), ...(route.cache ?? {}) }) },
        body: document.html, source: 'spa', route, render: null, diagnostics: document.diagnostics.filter(d => d.code !== 'missing_h1'),
      }, request);
    } finally {
      environment.close();
    }
  }

  async function failed(
    request: SsrRequestLike,
    headers: Record<string, string>,
    route: SsrRouteConfig,
    render: SsrAppRenderResult | null,
    diagnostics: readonly SsrDiagnostic[],
  ): Promise<SsrResponse> {
    if ((options.onRenderError ?? 'spa') === 'spa') {
      const shell = await spaShell(200, request, headers, route);
      return { ...shell, source: 'error', render, diagnostics: [...diagnostics, ...shell.diagnostics] };
    }

    return respond(500, { ...headers, 'cache-control': 'no-store' }, errorHtml(diagnostics), 'error', route, render, diagnostics);
  }

  function respond(
    status: number,
    headers: Record<string, string>,
    body: string,
    source: SsrResponse['source'],
    route: SsrRouteConfig | null,
    render: SsrAppRenderResult | null,
    diagnostics: readonly SsrDiagnostic[],
  ): SsrResponse {
    return { status, headers, body, source, route, render, diagnostics };
  }

  function finalize(response: SsrResponse, request: SsrRequestLike): SsrResponse {
    if (!useEtag || response.status !== 200) {
      return response;
    }

    const etag = response.headers.etag ?? etagFor(response.body);
    const headers = { ...response.headers, etag };
    const ifNoneMatch = headerValue(request.headers, 'if-none-match');

    if (ifNoneMatch && ifNoneMatch.split(',').map(value => value.trim()).includes(etag)) {
      return { ...response, status: 304, headers, body: '', source: 'not-modified' };
    }

    return { ...response, headers };
  }
}

export function cacheControl(policy: SsrCacheConfig): string {
  if (policy.noStore) {
    return 'no-store';
  }

  const parts = [policy.private ? 'private' : 'public'];
  parts.push(`max-age=${policy.maxAge ?? 0}`);
  if (policy.sMaxAge !== undefined) {
    parts.push(`s-maxage=${policy.sMaxAge}`);
  }
  if (policy.staleWhileRevalidate !== undefined) {
    parts.push(`stale-while-revalidate=${policy.staleWhileRevalidate}`);
  }
  if (policy.maxAge === undefined && policy.sMaxAge === undefined) {
    parts.push('must-revalidate');
  }
  return parts.join(', ');
}

export function createMemorySsrCache(options: { readonly maxEntries?: number } = {}): SsrResponseCache {
  const entries = new Map<string, SsrCachedResponse>();
  const maxEntries = options.maxEntries ?? 500;

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) {
        return undefined;
      }
      if (entry.expiresAt <= Date.now()) {
        entries.delete(key);
        return undefined;
      }
      return entry;
    },
    set(key, value) {
      entries.set(key, value);
      if (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) {
          entries.delete(oldest);
        }
      }
    },
    delete(key) {
      for (const existing of Array.from(entries.keys())) {
        if (existing === key || existing.startsWith(`${key}?`)) {
          entries.delete(existing);
        }
      }
    },
    clear() {
      entries.clear();
    },
  };
}

/** Adapts a Web `Request` (Hono, Bun, Deno, Cloudflare Workers) to the handler. */
export async function handleWebRequest(handler: SsrRequestHandler, request: Request): Promise<Response> {
  const result = await handler({ url: request.url, method: request.method, headers: request.headers });
  return toWebResponse(result, request.method);
}

export function toWebResponse(response: SsrResponse, method = 'GET'): Response {
  const body = method.toUpperCase() === 'HEAD' || response.status === 304 ? null : response.body;
  return new Response(body, { status: response.status, headers: response.headers });
}

export interface NodeRequestLike {
  readonly url?: string;
  readonly method?: string;
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
}

export interface NodeResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  end(body?: string): unknown;
  readonly headersSent?: boolean;
}

export function sendNodeResponse(res: NodeResponseLike, response: SsrResponse, method = 'GET'): void {
  res.statusCode = response.status;
  for (const [name, value] of Object.entries(response.headers)) {
    res.setHeader(name, value);
  }
  if (response.status !== 304 && method.toUpperCase() !== 'HEAD') {
    res.setHeader('content-length', String(byteLength(response.body)));
    res.end(response.body);
  } else {
    res.end();
  }
}

export interface NodeSsrMiddlewareOptions {
  /** Only handle requests whose `accept` header includes `text/html`. Defaults to `true`. */
  readonly htmlOnly?: boolean;
  /** Skip paths that look like files (`/assets/app.js`). Defaults to `true`. */
  readonly skipFiles?: boolean;
}

/**
 * Node `http`/Connect/Express-style middleware: `(req, res, next)`. Calls
 * `next()` for non-HTML or asset requests so static middleware can serve them.
 */
export function createNodeSsrMiddleware(
  handler: SsrRequestHandler,
  options: NodeSsrMiddlewareOptions = {},
): (req: NodeRequestLike, res: NodeResponseLike, next?: (error?: unknown) => void) => Promise<void> {
  return async (req, res, next) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';
    const accept = headerValue(req.headers, 'accept') ?? '';

    if ((options.htmlOnly ?? true) && accept && !accept.includes('text/html') && !accept.includes('*/*')) {
      next?.();
      return;
    }
    if ((options.skipFiles ?? true) && /\.[a-z0-9]{1,8}(\?|$)/iu.test(url.split('?')[0].split('/').at(-1) ?? '')) {
      next?.();
      return;
    }

    try {
      const response = await handler({ url, method, headers: req.headers });
      sendNodeResponse(res, response, method);
    } catch (error) {
      if (next) {
        next(error);
      } else {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }
  };
}

export function headerValue(
  headers: SsrRequestLike['headers'] | undefined,
  name: string,
): string | undefined {
  if (!headers) {
    return undefined;
  }
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name) ?? undefined;
  }
  const record = headers as Readonly<Record<string, string | readonly string[] | undefined>>;
  const value = record[name] ?? record[name.toLowerCase()] ?? record[name.toUpperCase()];
  return Array.isArray(value) ? value.join(', ') : (value as string | undefined);
}

function hasCacheTtl(site: SsrSiteConfig, routes: readonly SsrRouteConfig[]): boolean {
  return (site.cache?.ttlMs ?? 0) > 0 || routes.some(route => (route.cache?.ttlMs ?? 0) > 0);
}

function withSearch(target: string, search: string): string {
  if (!search || target.includes('?') || /^https?:\/\//iu.test(target) && new URL(target).search) {
    return target;
  }
  return `${target}${search}`;
}

function errorHtml(diagnostics: readonly SsrDiagnostic[]): string {
  const messages = diagnostics
    .filter(diagnostic => diagnostic.severity === 'error')
    .map(diagnostic => `<li><code>${escape(diagnostic.code)}</code> ${escape(diagnostic.message)}</li>`)
    .join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Server render failed</title><meta name="robots" content="noindex"></head><body><h1>Server render failed</h1><ul>${messages}</ul></body></html>`;
}

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Weak ETag for a rendered document. The `renderedAt` timestamp in the SSR
 * context script is ignored so identical content produces identical tags.
 */
export function etagFor(body: string): string {
  return `W/"${hashString(body.replace(/"renderedAt":"[^"]*"/u, '"renderedAt":""'))}"`;
}

/** cyrb53: small, fast, runtime-agnostic string hash used for weak ETags. */
export function hashString(value: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

function byteLength(value: string): number {
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(value, 'utf8');
  }
  return new TextEncoder().encode(value).length;
}
