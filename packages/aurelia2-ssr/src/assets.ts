import { ensureHead, setElementAttributes, toRootRelativeUrl } from './html';
import type {
  SsrAssetManifest,
  SsrLinkDefinition,
  SsrPreloadAsset,
  SsrRouteConfig,
  SsrScriptDefinition,
  SsrSiteConfig,
  SsrStyleDefinition,
} from './types';

export interface CollectedManifestAssets {
  readonly scripts: readonly string[];
  readonly styles: readonly string[];
  readonly assets: readonly string[];
}

export function collectManifestAssets(
  moduleIds: readonly string[] | undefined,
  manifest: SsrAssetManifest | null | undefined,
): CollectedManifestAssets {
  if (!manifest || !Array.isArray(moduleIds)) {
    return { scripts: [], styles: [], assets: [] };
  }

  const scripts = new Set<string>();
  const styles = new Set<string>();
  const assets = new Set<string>();
  const visited = new Set<string>();

  for (const moduleId of moduleIds) {
    collectManifestEntry(moduleId, manifest, scripts, styles, assets, visited);
  }

  return {
    scripts: Array.from(scripts),
    styles: Array.from(styles),
    assets: Array.from(assets),
  };
}

export function findManifestEntry(moduleId: string, manifest: SsrAssetManifest): SsrAssetManifest[string] | undefined {
  if (manifest[moduleId]) {
    return manifest[moduleId];
  }

  const normalized = moduleId.replace(/^\//u, '');
  if (manifest[normalized]) {
    return manifest[normalized];
  }

  const moduleName = normalized.split('/').at(-1)?.replace(/\.[cm]?[jt]sx?$/u, '');
  return Object.values(manifest).find(entry => {
    return entry.src === normalized
      || entry.src === moduleId
      || entry.name === moduleName
      || Boolean(moduleName && entry.file?.includes(`${moduleName}-`));
  });
}

export function injectResourceHints(document: Document, site: SsrSiteConfig, route?: SsrRouteConfig): void {
  for (const href of site.assets?.dnsPrefetch ?? []) {
    appendUniqueLink(document, { rel: 'dns-prefetch', href });
  }

  for (const preconnect of site.assets?.preconnect ?? []) {
    appendUniqueLink(document, {
      rel: 'preconnect',
      href: preconnect.href,
      crossorigin: preconnect.crossorigin,
    });
  }

  for (const preload of site.assets?.globalPreloads ?? []) {
    appendPreload(document, preload, site);
  }

  for (const preload of route?.assets?.preloads ?? []) {
    appendPreload(document, preload, site);
  }
}

export function injectPriorityAssets(
  document: Document,
  site: SsrSiteConfig,
  route: SsrRouteConfig,
  manifest?: SsrAssetManifest | null,
): void {
  if (site.assets?.priorityImagePreload ?? true) {
    for (const image of route.priority?.images ?? []) {
      appendPreload(document, {
        href: image.href,
        as: 'image',
        fetchPriority: image.fetchPriority,
        media: image.media,
        imagesrcset: image.imagesrcset,
        imagesizes: image.imagesizes,
      }, site);
    }
  }

  const manifestAssets = collectManifestAssets(route.priority?.moduleIds, manifest);
  if (site.assets?.modulePreload ?? true) {
    for (const href of manifestAssets.scripts) {
      appendUniqueLink(document, {
        rel: 'modulepreload',
        href,
        crossorigin: '',
      });
    }
  }

  if (site.assets?.manifestStyles ?? true) {
    for (const href of manifestAssets.styles) {
      appendStyle(document, { href });
    }
  }
}

export function injectStyles(document: Document, site: SsrSiteConfig, route?: SsrRouteConfig): void {
  const styles = [
    ...(site.assets?.styles ?? []),
    ...(route?.assets?.styles ?? []),
  ];

  for (const style of styles) {
    appendStyle(document, style, site.security?.nonce);
  }
}

export function injectScripts(
  document: Document,
  site: SsrSiteConfig,
  route: SsrRouteConfig,
  strategy: SsrScriptDefinition['strategy'],
  clientEntrySelector = 'script[type="module"]',
): void {
  const scripts = [
    ...(site.assets?.scripts ?? []),
    ...(route.assets?.scripts ?? []),
  ].filter(script => (script.strategy ?? 'body-end') === strategy);

  for (const script of scripts) {
    appendScript(document, script, site.security?.nonce, clientEntrySelector);
  }
}

export function appendPreload(document: Document, preload: SsrPreloadAsset, site: SsrSiteConfig): HTMLLinkElement {
  return appendUniqueLink(document, {
    rel: 'preload',
    href: toRootRelativeUrl(preload.href, site.origin),
    as: preload.as,
    type: preload.type,
    media: preload.media,
    crossorigin: preload.crossorigin,
    fetchPriority: preload.fetchPriority,
    integrity: preload.integrity,
    attrs: {
      ...(preload.imagesrcset ? { imagesrcset: preload.imagesrcset } : {}),
      ...(preload.imagesizes ? { imagesizes: preload.imagesizes } : {}),
      ...(preload.attrs ?? {}),
    },
  });
}

export function appendStyle(document: Document, style: SsrStyleDefinition, nonce?: string): HTMLStyleElement | HTMLLinkElement {
  const head = ensureHead(document);

  if (style.href) {
    const existing = head.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][href="${style.href}"]`);
    if (existing) {
      return existing;
    }

    const link = document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', style.href);
    if (style.media) {
      link.setAttribute('media', style.media);
    }
    if (style.disabled) {
      link.setAttribute('disabled', '');
    }
    setElementAttributes(link, style.attrs);
    head.append(link);
    return link;
  }

  const existing = style.id ? head.querySelector<HTMLStyleElement>(`style#${style.id}`) : null;
  if (existing) {
    existing.textContent = style.content ?? '';
    return existing;
  }

  const element = document.createElement('style');
  if (style.id) {
    element.id = style.id;
  }
  if (style.media) {
    element.setAttribute('media', style.media);
  }
  if (nonce) {
    element.setAttribute('nonce', nonce);
  }
  setElementAttributes(element, style.attrs);
  element.textContent = style.content ?? '';
  head.append(element);
  return element;
}

export function appendScript(
  document: Document,
  script: SsrScriptDefinition,
  nonce?: string,
  clientEntrySelector = 'script[type="module"]',
): HTMLScriptElement {
  const element = document.createElement('script');
  if (script.id) {
    element.id = script.id;
  }
  if (script.type) {
    element.type = script.type;
  }
  if (script.src) {
    element.src = script.src;
  }
  if (script.async) {
    element.async = true;
  }
  if (script.defer) {
    element.defer = true;
  }
  if (script.nomodule) {
    element.setAttribute('nomodule', '');
  }
  if (script.crossorigin !== undefined) {
    element.setAttribute('crossorigin', script.crossorigin === true ? '' : String(script.crossorigin));
  }
  if (script.integrity) {
    element.integrity = script.integrity;
  }
  if (script.referrerpolicy) {
    element.setAttribute('referrerpolicy', script.referrerpolicy);
  }
  if (nonce && script.content) {
    element.setAttribute('nonce', nonce);
  }
  setElementAttributes(element, script.attrs);
  if (script.content) {
    element.textContent = script.content;
  }

  placeScript(document, element, script.strategy ?? 'body-end', clientEntrySelector);
  return element;
}

export function appendUniqueLink(document: Document, link: SsrLinkDefinition): HTMLLinkElement {
  const head = ensureHead(document);
  const key = linkKey(link);
  const existing = Array.from(head.querySelectorAll<HTMLLinkElement>('link')).find(candidate => linkKeyFromElement(candidate) === key);
  if (existing) {
    return existing;
  }

  const element = document.createElement('link');
  element.rel = link.rel;
  element.href = link.href;
  if (link.as) {
    element.setAttribute('as', link.as);
  }
  if (link.type) {
    element.type = link.type;
  }
  if (link.media) {
    element.media = link.media;
  }
  if (link.sizes) {
    element.setAttribute('sizes', link.sizes);
  }
  if (link.hreflang) {
    element.setAttribute('hreflang', link.hreflang);
  }
  if (link.crossorigin !== undefined) {
    element.setAttribute('crossorigin', link.crossorigin === true ? '' : String(link.crossorigin));
  }
  if (link.fetchPriority) {
    element.setAttribute('fetchpriority', link.fetchPriority);
  }
  if (link.integrity) {
    element.integrity = link.integrity;
  }
  if (link.referrerpolicy) {
    element.setAttribute('referrerpolicy', link.referrerpolicy);
  }
  setElementAttributes(element, link.attrs);
  head.append(element);

  return element;
}

function collectManifestEntry(
  moduleId: string,
  manifest: SsrAssetManifest,
  scripts: Set<string>,
  styles: Set<string>,
  assets: Set<string>,
  visited: Set<string>,
): void {
  const entry = findManifestEntry(moduleId, manifest);
  if (!entry?.file || visited.has(entry.file)) {
    return;
  }

  visited.add(entry.file);

  if (entry.file.endsWith('.js')) {
    scripts.add(`/${entry.file}`);
  }

  for (const css of entry.css ?? []) {
    styles.add(`/${css}`);
  }

  for (const asset of entry.assets ?? []) {
    assets.add(`/${asset}`);
  }

  for (const importId of entry.imports ?? []) {
    collectManifestEntry(importId, manifest, scripts, styles, assets, visited);
  }
}

function placeScript(
  document: Document,
  element: HTMLScriptElement,
  strategy: SsrScriptDefinition['strategy'],
  clientEntrySelector: string,
): void {
  const head = ensureHead(document);
  const body = document.body ?? document.documentElement;

  if (strategy === 'head-start') {
    head.insertBefore(element, head.firstChild);
    return;
  }

  if (strategy === 'head-end') {
    head.append(element);
    return;
  }

  if (strategy === 'before-client' || strategy === 'before-preboot' || strategy === 'after-client') {
    const clientEntry = head.querySelector(clientEntrySelector);
    if (clientEntry && strategy !== 'after-client') {
      head.insertBefore(element, clientEntry);
      return;
    }
    if (clientEntry?.parentNode && strategy === 'after-client') {
      clientEntry.parentNode.insertBefore(element, clientEntry.nextSibling);
      return;
    }
    head.append(element);
    return;
  }

  body.append(element);
}

function linkKey(link: SsrLinkDefinition): string {
  return link.key ?? `${link.rel}:${link.as ?? ''}:${link.href}`;
}

function linkKeyFromElement(link: HTMLLinkElement): string {
  return `${link.rel}:${link.getAttribute('as') ?? ''}:${link.getAttribute('href') ?? ''}`;
}
