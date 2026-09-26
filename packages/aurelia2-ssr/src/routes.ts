import { escapeXml } from './html.js';
import type {
  SsrDiagnostic,
  SsrRouteConfig,
  SsrRouteExpansion,
  SsrSiteConfig,
  SsrValidationResult,
} from './types.js';

export function normalizeSsrPath(value: string): string {
  if (!value) {
    return '/';
  }

  const path = value.startsWith('/') ? value : `/${value}`;
  const normalized = path.length > 1 ? path.replace(/\/+$/u, '') : path;
  return normalized || '/';
}

export function canonicalPathForRoute(route: SsrRouteConfig): string {
  return normalizeSsrPath(route.seo.canonicalPath ?? route.path);
}

export function canonicalUrlForRoute(route: SsrRouteConfig, siteOrOrigin: SsrSiteConfig | string): string {
  if (route.seo.canonicalUrl) {
    return route.seo.canonicalUrl;
  }

  const origin = typeof siteOrOrigin === 'string' ? siteOrOrigin : siteOrOrigin.origin;
  return new URL(canonicalPathForRoute(route), origin).toString();
}

export interface OutputFileOptions {
  /** Write `about/index.html` instead of `about.html`. */
  readonly cleanUrls?: boolean;
}

export function outputFileForRoute(route: SsrRouteConfig | string, options: OutputFileOptions = {}): string {
  const path = normalizeSsrPath(typeof route === 'string' ? route : route.path);
  if (path === '/') {
    return 'index.html';
  }

  const relative = path.replace(/^\//u, '');
  if (/\.[a-z0-9]+$/iu.test(relative)) {
    return relative;
  }

  return options.cleanUrls ? `${relative}/index.html` : `${relative}.html`;
}

/** `true` when the path contains `:param` or `*` segments. */
export function isDynamicSsrPath(path: string): boolean {
  return /(^|\/)(:[^/]+|\*)/u.test(path);
}

export interface SsrRouteMatch {
  readonly route: SsrRouteConfig;
  readonly params: Readonly<Record<string, string>>;
}

/**
 * Finds the route for a request path. Static paths win over `:param` routes,
 * which win over `*` catch-alls. The returned route carries the matched
 * `params`.
 */
export function matchSsrRoute(pathname: string, routes: readonly SsrRouteConfig[]): SsrRouteMatch | null {
  const path = normalizeSsrPath(decodeURIComponentSafe(pathname.split('?')[0].split('#')[0]));
  let best: { route: SsrRouteConfig; params: Record<string, string>; score: number } | null = null;

  for (const route of routes) {
    const params = matchPathPattern(route.path, path);
    if (params === null) {
      continue;
    }

    const score = patternScore(route.path);
    if (!best || score > best.score) {
      best = { route, params, score };
    }
  }

  if (!best) {
    return null;
  }

  return {
    route: { ...best.route, path, params: best.params },
    params: best.params,
  };
}

/** Substitutes `params` into a `/blog/:slug` pattern. */
export function fillSsrPath(pattern: string, params: Readonly<Record<string, string | number>> = {}): string {
  const filled = pattern.replace(/:([A-Za-z0-9_]+)\??/gu, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Missing route parameter "${name}" for pattern ${pattern}.`);
    }
    return encodeURIComponent(String(value));
  });

  return normalizeSsrPath(filled.replace(/\/\*$/u, ''));
}

export interface SsrRouteExpansionResult {
  readonly routes: readonly SsrRouteConfig[];
  readonly diagnostics: readonly SsrDiagnostic[];
}

/**
 * Resolves every route's `expand` hook and drops unexpanded dynamic patterns,
 * returning a flat list of concrete routes ready to prerender.
 */
export async function expandSsrRoutes(routes: readonly SsrRouteConfig[]): Promise<SsrRouteExpansionResult> {
  const expanded: SsrRouteConfig[] = [];
  const diagnostics: SsrDiagnostic[] = [];
  const seen = new Set<string>();

  for (const route of routes) {
    if (!route.expand) {
      if (isDynamicSsrPath(route.path) && (route.mode ?? 'prerender') === 'prerender') {
        diagnostics.push({
          severity: 'warning',
          code: 'route_needs_expansion',
          message: `Route ${route.path} has dynamic segments but no expand() hook, so it cannot be prerendered. Add expand() or set mode: "server".`,
          path: route.path,
        });
        continue;
      }

      push(route);
      continue;
    }

    let expansions: readonly SsrRouteExpansion[];
    try {
      expansions = await route.expand(route);
    } catch (error) {
      diagnostics.push({
        severity: 'error',
        code: 'route_expansion_failed',
        message: `expand() for ${route.path} threw: ${error instanceof Error ? error.message : String(error)}`,
        path: route.path,
      });
      continue;
    }

    for (const expansion of expansions) {
      try {
        push(applyExpansion(route, expansion));
      } catch (error) {
        diagnostics.push({
          severity: 'error',
          code: 'route_expansion_failed',
          message: error instanceof Error ? error.message : String(error),
          path: route.path,
        });
      }
    }
  }

  return { routes: expanded, diagnostics };

  function push(route: SsrRouteConfig): void {
    const key = normalizeSsrPath(route.path);
    if (seen.has(key)) {
      diagnostics.push({
        severity: 'warning',
        code: 'route_duplicate_after_expansion',
        message: `Route ${key} was produced more than once; keeping the first.`,
        path: key,
      });
      return;
    }
    seen.add(key);
    expanded.push(route);
  }
}

function applyExpansion(route: SsrRouteConfig, expansion: SsrRouteExpansion): SsrRouteConfig {
  const overrides = typeof expansion === 'string' ? { path: expansion } : expansion;
  const params = Object.fromEntries(
    Object.entries(overrides.params ?? {}).map(([name, value]) => [name, String(value)]),
  );
  const path = overrides.path ?? fillSsrPath(route.path, params);
  const { expand: _expand, ...base } = route;
  const { params: _params, seo, ...rest } = overrides;

  return {
    ...base,
    ...rest,
    path: normalizeSsrPath(path),
    params: { ...(route.params ?? {}), ...params, ...inferParams(route.path, path) },
    seo: {
      ...route.seo,
      ...(seo ?? {}),
    },
  };
}

function inferParams(pattern: string, path: string): Record<string, string> {
  return matchPathPattern(pattern, normalizeSsrPath(path)) ?? {};
}

function matchPathPattern(pattern: string, path: string): Record<string, string> | null {
  const normalizedPattern = normalizeSsrPath(pattern);
  if (normalizedPattern === path) {
    return {};
  }
  if (!isDynamicSsrPath(normalizedPattern)) {
    return null;
  }

  const patternSegments = normalizedPattern.split('/').slice(1);
  const pathSegments = path === '/' ? [] : path.split('/').slice(1);
  const params: Record<string, string> = {};

  for (let index = 0; index < patternSegments.length; index++) {
    const segment = patternSegments[index];
    const value = pathSegments[index];

    if (segment === '*') {
      params['*'] = pathSegments.slice(index).join('/');
      return params;
    }

    if (segment.startsWith(':')) {
      const optional = segment.endsWith('?');
      const name = segment.slice(1, optional ? -1 : undefined);
      if (value === undefined) {
        if (optional && index === patternSegments.length - 1) {
          return params;
        }
        return null;
      }
      params[name] = value;
      continue;
    }

    if (segment !== value) {
      return null;
    }
  }

  return pathSegments.length === patternSegments.length ? params : null;
}

function patternScore(pattern: string): number {
  const segments = normalizeSsrPath(pattern).split('/').slice(1);
  let score = 0;
  for (const segment of segments) {
    if (segment === '*') {
      score += 1;
    } else if (segment.startsWith(':')) {
      score += 10;
    } else {
      score += 100;
    }
  }
  return score;
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function uniqueSitemapRoutes(routes: readonly SsrRouteConfig[]): SsrRouteConfig[] {
  const byCanonical = new Map<string, SsrRouteConfig>();

  for (const route of routes) {
    if (!route.seo.sitemap?.include) {
      continue;
    }

    const canonicalPath = canonicalPathForRoute(route);
    if (!byCanonical.has(canonicalPath)) {
      byCanonical.set(canonicalPath, route);
    }
  }

  return Array.from(byCanonical.values());
}

export function createSitemapXml(
  routes: readonly SsrRouteConfig[],
  site: SsrSiteConfig,
  now: Date = new Date(),
): string {
  const routeDate = now.toISOString().slice(0, 10);
  const urls = uniqueSitemapRoutes(routes).map(route => {
    const sitemap = route.seo.sitemap;
    return [
      '  <url>',
      `    <loc>${escapeXml(canonicalUrlForRoute(route, site))}</loc>`,
      `    <lastmod>${escapeXml(sitemap?.lastmod ?? routeDate)}</lastmod>`,
      `    <changefreq>${escapeXml(sitemap?.changefreq ?? 'weekly')}</changefreq>`,
      `    <priority>${sitemap?.priority ?? 0.5}</priority>`,
      '  </url>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

export function createRobotsTxt(site: SsrSiteConfig, sitemapPath = '/sitemap.xml'): string {
  return [
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${new URL(sitemapPath, site.origin).toString()}`,
    '',
  ].join('\n');
}

export function validateSsrRoutes(routes: readonly SsrRouteConfig[]): SsrValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const paths = new Set<string>();
  const sitemapCanonicals = new Set<string>();

  for (const route of routes) {
    const normalizedPath = normalizeSsrPath(route.path);
    if (!route.path.startsWith('/')) {
      errors.push(`${route.path}: route path must start with /`);
    }
    if (paths.has(normalizedPath)) {
      errors.push(`${route.path}: duplicate route path`);
    }
    paths.add(normalizedPath);

    if (!route.seo?.title) {
      errors.push(`${route.path}: missing seo.title`);
    }
    if (!route.seo?.description) {
      errors.push(`${route.path}: missing seo.description`);
    }
    if (route.seo?.canonicalPath && !route.seo.canonicalPath.startsWith('/')) {
      errors.push(`${route.path}: seo.canonicalPath must start with /`);
    }
    if (route.status && (route.status < 100 || route.status > 599)) {
      errors.push(`${route.path}: status must be a valid HTTP status code`);
    }

    const sitemap = route.seo?.sitemap;
    if (sitemap?.include) {
      const canonicalPath = canonicalPathForRoute(route);
      if (sitemapCanonicals.has(canonicalPath)) {
        errors.push(`${route.path}: duplicate sitemap canonical ${canonicalPath}`);
      }
      sitemapCanonicals.add(canonicalPath);

      if (route.seo.canonicalPath && normalizeSsrPath(route.seo.canonicalPath) !== normalizedPath) {
        warnings.push(`${route.path}: alias route is included in sitemap`);
      }
      if (typeof sitemap.priority === 'number' && (sitemap.priority < 0 || sitemap.priority > 1)) {
        errors.push(`${route.path}: sitemap priority must be between 0 and 1`);
      }
    }

    for (const moduleId of route.priority?.moduleIds ?? []) {
      if (!moduleId.startsWith('src/') && !moduleId.startsWith('/src/')) {
        warnings.push(`${route.path}: moduleId ${moduleId} should usually be a Vite source-relative manifest id`);
      }
    }
  }

  return { errors, warnings };
}

export function validateSsrConfig(config: SsrSiteConfig): SsrValidationResult {
  const routeValidation = validateSsrRoutes(config.routes ?? []);
  const errors = [...routeValidation.errors];
  const warnings = [...routeValidation.warnings];

  if (!/^https?:\/\//u.test(config.origin)) {
    errors.push('site.origin must be an absolute http(s) origin');
  }
  if (!config.siteName) {
    errors.push('site.siteName is required');
  }
  if (config.diagnostics?.budgets?.titleMaxLength !== undefined && config.diagnostics.budgets.titleMaxLength < 1) {
    errors.push('diagnostics.budgets.titleMaxLength must be greater than 0');
  }

  return { errors, warnings };
}
