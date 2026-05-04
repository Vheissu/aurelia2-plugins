import {
  injectPriorityAssets,
  injectResourceHints,
  injectScripts,
  injectStyles,
  appendUniqueLink,
} from './assets.js';
import { analyzeSsrDocument } from './diagnostics.js';
import {
  createDocumentFromHtml,
  ensureBody,
  ensureHead,
  safeJson,
  setElementAttributes,
  toAbsoluteUrl,
  upsertCanonical,
  upsertMeta,
} from './html.js';
import { injectPrebootScript } from './preboot.js';
import { canonicalUrlForRoute } from './routes.js';
import type {
  SsrBuildDocumentOptions,
  SsrDiagnostic,
  SsrDocumentResult,
  SsrMetaDefinition,
  SsrRouteConfig,
  SsrSiteConfig,
} from './types.js';

export function buildSsrDocument(options: SsrBuildDocumentOptions): SsrDocumentResult {
  const document = options.document ?? createDocumentFromHtml(options.template);
  const site = options.site;
  const route = options.route;
  const render = options.render;
  const canonicalUrl = canonicalUrlForRoute(route, site);
  const diagnostics: SsrDiagnostic[] = [];

  ensureHead(document);
  ensureBody(document);
  applySeo(document, route, site, canonicalUrl);
  replaceAppHost(document, render.appHtml, site, diagnostics, route.path);
  injectScripts(document, site, route, 'head-start', options.clientEntrySelector);
  injectResourceHints(document, site, route);
  injectStyles(document, site, route);
  injectPriorityAssets(document, site, route, options.manifest);
  injectScripts(document, site, route, 'head-end', options.clientEntrySelector);
  injectScripts(document, site, route, 'before-preboot', options.clientEntrySelector);
  injectPreboot(document, site, options.prebootScript);
  injectScripts(document, site, route, 'before-client', options.clientEntrySelector);
  injectScripts(document, site, route, 'after-client', options.clientEntrySelector);
  injectStructuredData(document, route, site, canonicalUrl);
  injectSsrContext(document, route, site, canonicalUrl, options.now ?? new Date(), render);
  injectScripts(document, site, route, 'body-end', options.clientEntrySelector);

  const html = `<!DOCTYPE html>\n${document.documentElement.outerHTML}\n`;
  const documentResult: SsrDocumentResult = {
    html,
    document,
    canonicalUrl,
    diagnostics,
  };
  const analyzedDiagnostics = analyzeSsrDocument(documentResult, route, site, render);

  return {
    ...documentResult,
    diagnostics: analyzedDiagnostics,
  };
}

export function applySeo(
  document: Document,
  route: SsrRouteConfig,
  site: SsrSiteConfig,
  canonicalUrl: string = canonicalUrlForRoute(route, site),
): void {
  document.documentElement.lang = site.language ?? 'en';
  document.documentElement.setAttribute('data-aurelia-ssr-prerendered', '');
  document.title = route.seo.title || site.defaultTitle || site.siteName;
  setElementAttributes(document.documentElement, route.seo.htmlAttrs);
  setElementAttributes(document.body, route.seo.bodyAttrs);

  upsertMeta(document, 'name', 'description', route.seo.description || site.defaultDescription || '');
  upsertMeta(document, 'name', 'robots', route.seo.robots ?? 'index,follow');
  if (route.seo.keywords?.length) {
    upsertMeta(document, 'name', 'keywords', route.seo.keywords.join(', '));
  }
  if (site.themeColor) {
    upsertMeta(document, 'name', 'theme-color', site.themeColor);
  }

  upsertMeta(document, 'property', 'og:site_name', route.seo.openGraph?.siteName ?? site.siteName);
  upsertMeta(document, 'property', 'og:title', route.seo.openGraph?.title ?? route.seo.title);
  upsertMeta(document, 'property', 'og:description', route.seo.openGraph?.description ?? route.seo.description);
  upsertMeta(document, 'property', 'og:url', canonicalUrl);
  upsertMeta(document, 'property', 'og:type', route.seo.openGraph?.type ?? 'website');
  if (route.seo.openGraph?.locale) {
    upsertMeta(document, 'property', 'og:locale', route.seo.openGraph.locale);
  }

  const ogImage = routeSeoImage(route, site);
  if (ogImage) {
    upsertMeta(document, 'property', 'og:image', toAbsoluteUrl(ogImage, site.origin));
  }

  upsertMeta(document, 'name', 'twitter:card', route.seo.twitter?.card ?? 'summary_large_image');
  upsertMeta(document, 'name', 'twitter:title', route.seo.twitter?.title ?? route.seo.title);
  upsertMeta(document, 'name', 'twitter:description', route.seo.twitter?.description ?? route.seo.description);
  if (route.seo.twitter?.site) {
    upsertMeta(document, 'name', 'twitter:site', route.seo.twitter.site);
  }
  if (route.seo.twitter?.creator) {
    upsertMeta(document, 'name', 'twitter:creator', route.seo.twitter.creator);
  }
  if (route.seo.twitter?.image || ogImage) {
    upsertMeta(document, 'name', 'twitter:image', toAbsoluteUrl(route.seo.twitter?.image ?? ogImage!, site.origin));
  }

  upsertCanonical(document, canonicalUrl);
  for (const meta of route.seo.meta ?? []) {
    appendMeta(document, meta);
  }
  for (const link of route.seo.links ?? []) {
    appendUniqueLink(document, link);
  }
}

function replaceAppHost(
  document: Document,
  appHtml: string,
  site: SsrSiteConfig,
  diagnostics: SsrDiagnostic[],
  path: string,
): void {
  const selector = site.rendering?.hostSelector ?? site.rendering?.hostTagName ?? 'my-app';
  const host = document.querySelector(selector);

  if (!host) {
    diagnostics.push({
      severity: 'error',
      code: 'missing_host',
      message: `Could not find SSR host "${selector}" in the document template.`,
      path,
    });
    return;
  }

  host.outerHTML = appHtml;
}

function injectPreboot(document: Document, site: SsrSiteConfig, prebootScript?: string): void {
  if (site.preboot?.enabled === false) {
    return;
  }

  if (prebootScript) {
    const script = document.createElement('script');
    script.setAttribute('data-aurelia-ssr-preboot', '');
    if (site.security?.nonce) {
      script.setAttribute('nonce', site.security.nonce);
    }
    script.textContent = prebootScript;
    const clientEntry = document.head.querySelector('script[type="module"]');
    if (clientEntry) {
      document.head.insertBefore(script, clientEntry);
    } else {
      document.head.append(script);
    }
    return;
  }

  injectPrebootScript(document, site.preboot, site.security?.nonce);
}

function injectStructuredData(
  document: Document,
  route: SsrRouteConfig,
  site: SsrSiteConfig,
  canonicalUrl: string,
): void {
  const graph: Record<string, unknown>[] = [];
  const organization = site.organization;
  const ogImage = routeSeoImage(route, site);

  if (organization) {
    graph.push({
      '@type': 'Organization',
      '@id': `${site.origin}/#organization`,
      name: organization.name,
      url: organization.url ?? site.origin,
      ...(organization.logo ? { logo: toAbsoluteUrl(organization.logo, site.origin) } : {}),
      ...(organization.sameAs ? { sameAs: organization.sameAs } : {}),
    });
  }

  graph.push({
    '@type': 'WebSite',
    '@id': `${site.origin}/#website`,
    name: site.siteName,
    url: site.origin,
    ...(organization ? { publisher: { '@id': `${site.origin}/#organization` } } : {}),
  });

  graph.push({
    '@type': 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: route.seo.title,
    description: route.seo.description,
    isPartOf: {
      '@id': `${site.origin}/#website`,
    },
    ...(ogImage ? { primaryImageOfPage: { '@type': 'ImageObject', url: toAbsoluteUrl(ogImage, site.origin) } } : {}),
  });

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  if (site.security?.nonce) {
    script.setAttribute('nonce', site.security.nonce);
  }
  script.textContent = safeJson({
    '@context': 'https://schema.org',
    '@graph': [...graph, ...(route.seo.jsonLd ?? [])],
  });
  document.head.append(script);
}

function injectSsrContext(
  document: Document,
  route: SsrRouteConfig,
  site: SsrSiteConfig,
  canonicalUrl: string,
  now: Date,
  render: { ssrScope?: unknown; ssrDefinition?: unknown; status?: number; data?: Record<string, unknown> },
): void {
  const script = document.createElement('script');
  script.type = 'application/json';
  script.id = 'aurelia-ssr-context';
  script.textContent = safeJson({
    path: route.path,
    canonicalUrl,
    priority: route.priority?.level ?? 'normal',
    renderedAt: now.toISOString(),
    takeoverMode: route.render?.takeoverMode ?? site.rendering?.takeoverMode ?? 'remount',
    status: render.status ?? route.status ?? 200,
    data: render.data ?? route.data ?? {},
  });
  document.body.append(script);

  if (render.ssrScope) {
    const manifest = document.createElement('script');
    manifest.type = 'application/json';
    manifest.id = 'aurelia-ssr-manifest';
    manifest.textContent = safeJson(render.ssrScope);
    document.body.append(manifest);
  }

  if (render.ssrDefinition) {
    const definition = document.createElement('script');
    definition.type = 'application/json';
    definition.id = 'aurelia-ssr-definition';
    definition.textContent = safeJson(render.ssrDefinition);
    document.body.append(definition);
  }
}

function appendMeta(document: Document, meta: SsrMetaDefinition): void {
  const element = document.createElement('meta');
  if (meta.charset) {
    element.setAttribute('charset', meta.charset);
  }
  if (meta.name) {
    element.setAttribute('name', meta.name);
  }
  if (meta.property) {
    element.setAttribute('property', meta.property);
  }
  if (meta.httpEquiv) {
    element.setAttribute('http-equiv', meta.httpEquiv);
  }
  if (meta.content !== undefined) {
    element.setAttribute('content', String(meta.content));
  }
  document.head.append(element);
}

function routeSeoImage(route: SsrRouteConfig, site: SsrSiteConfig): string | undefined {
  return route.seo.openGraph?.image
    ?? route.seo.twitter?.image
    ?? site.defaultOgImage;
}
