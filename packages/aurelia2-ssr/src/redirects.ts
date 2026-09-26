import { escapeAttribute, escapeText } from './html.js';
import { normalizeSsrPath, outputFileForRoute } from './routes.js';
import type { SsrOutputConfig, SsrRedirectPlatform, SsrRouteConfig, SsrSiteConfig } from './types.js';

export interface SsrRedirectRule {
  readonly from: string;
  readonly to: string;
  readonly status: number;
}

export interface SsrOutputFile {
  /** Path relative to the output directory. */
  readonly path: string;
  readonly contents: string;
  readonly kind: 'page' | 'redirect-page' | 'not-found' | 'sitemap' | 'robots' | 'report' | 'redirects' | 'headers';
}

export function collectSsrRedirects(routes: readonly SsrRouteConfig[]): SsrRedirectRule[] {
  const rules: SsrRedirectRule[] = [];

  for (const route of routes) {
    if (!route.redirectTo) {
      continue;
    }

    rules.push({
      from: normalizeSsrPath(route.path),
      to: route.redirectTo,
      status: isRedirectStatus(route.status) ? route.status! : 301,
    });
  }

  return rules;
}

export function isRedirectStatus(status: number | undefined): boolean {
  return typeof status === 'number' && status >= 300 && status < 400;
}

/** Netlify and Cloudflare Pages `_redirects` format. */
export function createNetlifyRedirects(
  rules: readonly SsrRedirectRule[],
  options: { readonly spaFallback?: boolean; readonly notFoundFile?: string } = {},
): string {
  const lines = rules.map(rule => `${rule.from} ${rule.to} ${rule.status}`);

  if (options.spaFallback) {
    lines.push('/* /index.html 200');
  } else if (options.notFoundFile) {
    lines.push(`/* /${options.notFoundFile.replace(/^\//u, '')} 404`);
  }

  return `${lines.join('\n')}\n`;
}

export const createCloudflareRedirects = createNetlifyRedirects;

/** `vercel.json` with `redirects` (and a `rewrites` SPA fallback when requested). */
export function createVercelConfig(
  rules: readonly SsrRedirectRule[],
  options: { readonly spaFallback?: boolean; readonly cleanUrls?: boolean } = {},
): string {
  const config: Record<string, unknown> = {
    ...(options.cleanUrls ? { cleanUrls: true } : {}),
    redirects: rules.map(rule => ({
      source: rule.from,
      destination: rule.to,
      permanent: rule.status === 301 || rule.status === 308,
    })),
  };

  if (options.spaFallback) {
    config.rewrites = [{ source: '/(.*)', destination: '/index.html' }];
  }

  return `${JSON.stringify(config, null, 2)}\n`;
}

/** An nginx snippet to `include` inside a `server` block. */
export function createNginxRedirects(rules: readonly SsrRedirectRule[]): string {
  return rules
    .map(rule => `location = ${rule.from} {\n  return ${rule.status} ${rule.to};\n}`)
    .join('\n\n')
    .concat(rules.length ? '\n' : '');
}

/** `.htaccess` `Redirect` directives. */
export function createApacheRedirects(rules: readonly SsrRedirectRule[]): string {
  return rules
    .map(rule => `Redirect ${rule.status} ${rule.from} ${rule.to}`)
    .join('\n')
    .concat(rules.length ? '\n' : '');
}

/** Static HTML page that forwards visitors when the host has no redirect support. */
export function createRedirectHtml(to: string, options: { readonly lang?: string; readonly siteName?: string } = {}): string {
  const href = escapeAttribute(to);
  const text = escapeText(to);

  return [
    '<!DOCTYPE html>',
    `<html lang="${escapeAttribute(options.lang ?? 'en')}">`,
    '<head>',
    '<meta charset="utf-8">',
    `<title>Redirecting${options.siteName ? ` – ${escapeText(options.siteName)}` : ''}</title>`,
    '<meta name="robots" content="noindex">',
    `<meta http-equiv="refresh" content="0; url=${href}">`,
    `<link rel="canonical" href="${href}">`,
    '</head>',
    '<body>',
    `<p>Redirecting to <a href="${href}">${text}</a>.</p>`,
    `<script>location.replace(${JSON.stringify(to)})</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

export function redirectFileName(platform: SsrRedirectPlatform): string {
  switch (platform) {
    case 'netlify':
    case 'cloudflare':
      return '_redirects';
    case 'vercel':
      return 'vercel.json';
    case 'nginx':
      return 'redirects.nginx.conf';
    case 'apache':
      return '.htaccess';
    case 'json':
      return 'redirects.json';
  }
}

/**
 * Builds every redirect-related output file for a site: platform rule files
 * from `site.output.redirects` and per-route redirect pages.
 */
export function createSsrRedirectFiles(
  routes: readonly SsrRouteConfig[],
  site: SsrSiteConfig,
  output: SsrOutputConfig = site.output ?? {},
): SsrOutputFile[] {
  const rules = collectSsrRedirects(routes);
  const files: SsrOutputFile[] = [];
  const platforms = new Set(output.redirects ?? []);

  for (const platform of platforms) {
    const contents = createRedirectFile(platform, rules, output);
    if (contents !== null) {
      files.push({ path: redirectFileName(platform), contents, kind: 'redirects' });
    }
  }

  if (output.redirectPages ?? true) {
    for (const rule of rules) {
      files.push({
        path: outputFileForRoute(rule.from, { cleanUrls: output.cleanUrls }),
        contents: createRedirectHtml(rule.to, { lang: site.language, siteName: site.siteName }),
        kind: 'redirect-page',
      });
    }
  }

  return files;
}

export function createRedirectFile(
  platform: SsrRedirectPlatform,
  rules: readonly SsrRedirectRule[],
  output: SsrOutputConfig = {},
): string | null {
  switch (platform) {
    case 'netlify':
    case 'cloudflare':
      return createNetlifyRedirects(rules, {
        spaFallback: output.spaFallback,
        notFoundFile: output.notFoundFile ?? '404.html',
      });
    case 'vercel':
      return createVercelConfig(rules, { spaFallback: output.spaFallback, cleanUrls: output.cleanUrls });
    case 'nginx':
      return rules.length ? createNginxRedirects(rules) : null;
    case 'apache':
      return rules.length ? createApacheRedirects(rules) : null;
    case 'json':
      return `${JSON.stringify(rules, null, 2)}\n`;
  }
}
