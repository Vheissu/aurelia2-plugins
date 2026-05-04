import { escapeXml } from './html.js';
import type { SsrRouteConfig, SsrSiteConfig, SsrValidationResult } from './types.js';

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

export function outputFileForRoute(route: SsrRouteConfig): string {
  const path = normalizeSsrPath(route.path);
  if (path === '/') {
    return 'index.html';
  }

  return `${path.replace(/^\//u, '')}.html`;
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
