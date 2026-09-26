import type { SsrRouteConfig, SsrSiteConfig } from './types.js';

/**
 * Identity helper that gives `ssr.config.ts` full type inference and
 * autocomplete, following the Vite `defineConfig` convention.
 *
 * ```ts
 * export default defineSsrConfig({
 *   origin: 'https://example.com',
 *   siteName: 'Example',
 *   routes: defineSsrRoutes([{ path: '/', seo: { title: 'Home', description: '...' } }]),
 * });
 * ```
 */
export function defineSsrConfig<T extends SsrSiteConfig>(config: T): T {
  return config;
}

export function defineSsrRoutes<T extends readonly SsrRouteConfig[]>(routes: T): T {
  return routes;
}

/** Shorthand for a route that redirects, with sensible SEO defaults. */
export function redirectRoute(from: string, to: string, status = 301): SsrRouteConfig {
  return {
    path: from,
    redirectTo: to,
    status,
    seo: { title: 'Redirect', description: `Redirects to ${to}`, robots: 'noindex', sitemap: { include: false } },
  };
}

/** Shorthand for the site's 404 route, written to `404.html` by `prerenderSite`. */
export function notFoundRoute(path = '/404', seo: Partial<SsrRouteConfig['seo']> = {}): SsrRouteConfig {
  return {
    path,
    status: 404,
    seo: {
      title: 'Page not found',
      description: 'The page you were looking for could not be found. Check the address or return to the home page.',
      robots: 'noindex,follow',
      sitemap: { include: false },
      ...seo,
    },
  };
}

/**
 * The shape of a server entry module used by the CLI and the Vite plugin.
 * Export the root component and any server-side registrations.
 *
 * ```ts
 * // src/ssr-entry.ts
 * export const component = MyApp;
 * export const registrations = [ApiConfiguration];
 * export const settle = createRouterSettle();
 * ```
 */
export interface SsrServerEntry<TComponent extends object = object> {
  readonly component: new (...args: never[]) => TComponent;
  readonly site?: SsrSiteConfig;
  readonly registrations?: readonly unknown[];
  readonly configureAurelia?: (aurelia: unknown, context: unknown) => void | Promise<void>;
  readonly settle?: number | ((context: unknown) => void | Promise<void>);
  readonly beforeStart?: (context: unknown) => void | Promise<void>;
  readonly afterStart?: (context: unknown) => void | Promise<void>;
}

/** Picks the site config from a loaded config module (default export, `site`, `ssrSite`, or `config`). */
export function resolveSsrConfigModule(module: unknown): SsrSiteConfig | null {
  if (!module || typeof module !== 'object') {
    return null;
  }

  const record = module as Record<string, unknown>;
  const candidates = [record.default, record.site, record.ssrSite, record.ssrConfig, record.config];
  for (const candidate of candidates) {
    if (isSiteConfig(candidate)) {
      return candidate;
    }
    if (candidate && typeof candidate === 'object' && isSiteConfig((candidate as Record<string, unknown>).default)) {
      return (candidate as Record<string, unknown>).default as SsrSiteConfig;
    }
  }

  return null;
}

/** Picks the server entry from a loaded module (default export or named exports). */
export function resolveSsrEntryModule(module: unknown): SsrServerEntry | null {
  if (!module || typeof module !== 'object') {
    return null;
  }

  const record = module as Record<string, unknown>;
  const fromDefault = record.default;
  if (isEntry(fromDefault)) {
    return fromDefault;
  }
  if (typeof fromDefault === 'function') {
    return { ...(record as object), component: fromDefault } as SsrServerEntry;
  }
  if (isEntry(record)) {
    return record;
  }
  if (typeof record.App === 'function') {
    return { ...(record as object), component: record.App } as SsrServerEntry;
  }
  return null;
}

function isSiteConfig(value: unknown): value is SsrSiteConfig {
  return typeof value === 'object'
    && value !== null
    && typeof (value as SsrSiteConfig).origin === 'string'
    && typeof (value as SsrSiteConfig).siteName === 'string';
}

function isEntry(value: unknown): value is SsrServerEntry {
  return typeof value === 'object'
    && value !== null
    && typeof (value as SsrServerEntry).component === 'function';
}
