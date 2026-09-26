import { DI } from '@aurelia/kernel';
import { appendUniqueLink } from './assets.js';
import { cssEscape, ensureHead, upsertCanonical, upsertMeta } from './html.js';
import type { SsrLinkDefinition, SsrMetaDefinition, SsrSerializableAttributes } from './types.js';

/**
 * Serializable snapshot of everything components set through `ISsrHead`
 * during a render. `buildSsrDocument` layers it over the route's static SEO.
 */
export interface SsrHeadSnapshot {
  readonly title?: string;
  readonly description?: string;
  readonly canonicalUrl?: string;
  readonly robots?: string;
  readonly lang?: string;
  readonly status?: number;
  readonly redirectTo?: string;
  readonly meta: readonly SsrMetaDefinition[];
  readonly links: readonly SsrLinkDefinition[];
  readonly jsonLd: readonly Record<string, unknown>[];
  readonly htmlAttrs: SsrSerializableAttributes;
  readonly bodyAttrs: SsrSerializableAttributes;
}

export interface SsrHeadService {
  /** `true` while rendering on the server. */
  readonly isServer: boolean;
  readonly status: number | undefined;
  readonly redirectTo: string | undefined;
  setTitle(title: string): this;
  setDescription(description: string): this;
  setCanonical(url: string): this;
  setRobots(value: string): this;
  setLang(lang: string): this;
  /** Adds or replaces a meta tag; `key` (or `name`/`property`) deduplicates. */
  setMeta(meta: SsrMetaDefinition): this;
  /** Adds or replaces a link tag; `key` (or `rel:href`) deduplicates. */
  setLink(link: SsrLinkDefinition): this;
  addJsonLd(data: Record<string, unknown>): this;
  setHtmlAttribute(name: string, value: string | number | boolean | null): this;
  setBodyAttribute(name: string, value: string | number | boolean | null): this;
  /** HTTP status the response should use, e.g. `404` when a record is missing. */
  setStatus(status: number): this;
  /** Ask the server to respond with a redirect instead of the rendered page. */
  redirect(to: string, status?: number): this;
  snapshot(): SsrHeadSnapshot;
  /** Applies title, description, canonical, meta, and links to a live document. */
  applyTo(document: Document): void;
}

export class SsrHead implements SsrHeadService {
  private title?: string;
  private description?: string;
  private canonicalUrl?: string;
  private robots?: string;
  private lang?: string;
  private _status?: number;
  private _redirectTo?: string;
  private readonly meta = new Map<string, SsrMetaDefinition>();
  private readonly links = new Map<string, SsrLinkDefinition>();
  private readonly jsonLd: Record<string, unknown>[] = [];
  private readonly htmlAttrs: Record<string, string | number | boolean | null> = {};
  private readonly bodyAttrs: Record<string, string | number | boolean | null> = {};

  public constructor(
    public readonly isServer: boolean = false,
    /** On the client, apply changes to this document immediately. */
    private readonly liveDocument: Document | null = typeof document === 'undefined' ? null : document,
  ) {}

  public static forServer(): SsrHead {
    return new SsrHead(true, null);
  }

  public get status(): number | undefined {
    return this._status;
  }

  public get redirectTo(): string | undefined {
    return this._redirectTo;
  }

  public setTitle(title: string): this {
    this.title = title;
    if (this.liveDocument) {
      this.liveDocument.title = title;
    }
    return this;
  }

  public setDescription(description: string): this {
    this.description = description;
    if (this.liveDocument) {
      upsertMeta(this.liveDocument, 'name', 'description', description);
    }
    return this;
  }

  public setCanonical(url: string): this {
    this.canonicalUrl = url;
    if (this.liveDocument) {
      upsertCanonical(this.liveDocument, url);
    }
    return this;
  }

  public setRobots(value: string): this {
    this.robots = value;
    if (this.liveDocument) {
      upsertMeta(this.liveDocument, 'name', 'robots', value);
    }
    return this;
  }

  public setLang(lang: string): this {
    this.lang = lang;
    if (this.liveDocument) {
      this.liveDocument.documentElement.lang = lang;
    }
    return this;
  }

  public setMeta(meta: SsrMetaDefinition): this {
    this.meta.set(metaKey(meta), meta);
    if (this.liveDocument) {
      applyMeta(this.liveDocument, meta);
    }
    return this;
  }

  public setLink(link: SsrLinkDefinition): this {
    this.links.set(link.key ?? `${link.rel}:${link.href}`, link);
    if (this.liveDocument) {
      appendUniqueLink(this.liveDocument, link);
    }
    return this;
  }

  public addJsonLd(data: Record<string, unknown>): this {
    this.jsonLd.push(data);
    return this;
  }

  public setHtmlAttribute(name: string, value: string | number | boolean | null): this {
    this.htmlAttrs[name] = value;
    if (this.liveDocument) {
      applyAttribute(this.liveDocument.documentElement, name, value);
    }
    return this;
  }

  public setBodyAttribute(name: string, value: string | number | boolean | null): this {
    this.bodyAttrs[name] = value;
    if (this.liveDocument?.body) {
      applyAttribute(this.liveDocument.body, name, value);
    }
    return this;
  }

  public setStatus(status: number): this {
    this._status = status;
    return this;
  }

  public redirect(to: string, status = 302): this {
    this._redirectTo = to;
    this._status = status;
    return this;
  }

  public snapshot(): SsrHeadSnapshot {
    return {
      title: this.title,
      description: this.description,
      canonicalUrl: this.canonicalUrl,
      robots: this.robots,
      lang: this.lang,
      status: this._status,
      redirectTo: this._redirectTo,
      meta: Array.from(this.meta.values()),
      links: Array.from(this.links.values()),
      jsonLd: [...this.jsonLd],
      htmlAttrs: { ...this.htmlAttrs },
      bodyAttrs: { ...this.bodyAttrs },
    };
  }

  public applyTo(document: Document): void {
    applyHeadSnapshot(document, this.snapshot());
  }
}

/**
 * Injectable head service. Without a registration it resolves to a client
 * instance that edits the live document, which also makes it useful for SPA
 * navigation after takeover.
 */
export const ISsrHead = DI.createInterface<ISsrHead>('ISsrHead', x => x.cachedCallback(() => new SsrHead(false)));
export type ISsrHead = SsrHeadService;

export function applyHeadSnapshot(document: Document, head: SsrHeadSnapshot | undefined): void {
  if (!head) {
    return;
  }

  ensureHead(document);

  if (head.lang) {
    document.documentElement.lang = head.lang;
  }
  if (head.title !== undefined) {
    document.title = head.title;
  }
  if (head.description !== undefined) {
    upsertMeta(document, 'name', 'description', head.description);
  }
  if (head.robots !== undefined) {
    upsertMeta(document, 'name', 'robots', head.robots);
  }
  if (head.canonicalUrl !== undefined) {
    upsertCanonical(document, head.canonicalUrl);
  }
  for (const meta of head.meta) {
    applyMeta(document, meta);
  }
  for (const link of head.links) {
    appendUniqueLink(document, link);
  }
  for (const [name, value] of Object.entries(head.htmlAttrs)) {
    applyAttribute(document.documentElement, name, value);
  }
  if (document.body) {
    for (const [name, value] of Object.entries(head.bodyAttrs)) {
      applyAttribute(document.body, name, value);
    }
  }
}

export function hasHeadContent(head: SsrHeadSnapshot | undefined): boolean {
  if (!head) {
    return false;
  }

  return head.title !== undefined
    || head.description !== undefined
    || head.canonicalUrl !== undefined
    || head.robots !== undefined
    || head.lang !== undefined
    || head.meta.length > 0
    || head.links.length > 0
    || head.jsonLd.length > 0
    || Object.keys(head.htmlAttrs).length > 0
    || Object.keys(head.bodyAttrs).length > 0;
}

function metaKey(meta: SsrMetaDefinition): string {
  return meta.key
    ?? (meta.name ? `name:${meta.name}` : undefined)
    ?? (meta.property ? `property:${meta.property}` : undefined)
    ?? (meta.httpEquiv ? `http-equiv:${meta.httpEquiv}` : undefined)
    ?? `charset:${meta.charset ?? ''}`;
}

function applyMeta(document: Document, meta: SsrMetaDefinition): void {
  const head = ensureHead(document);
  const keyAttribute = meta.name ? 'name' : meta.property ? 'property' : meta.httpEquiv ? 'http-equiv' : null;
  const keyValue = meta.name ?? meta.property ?? meta.httpEquiv ?? null;

  if (keyAttribute && keyValue !== null) {
    upsertMeta(document, keyAttribute, keyValue, meta.content === undefined ? '' : String(meta.content));
    return;
  }

  if (meta.charset) {
    const existing = head.querySelector(`meta[charset="${cssEscape(meta.charset)}"]`);
    if (existing) {
      return;
    }
    const element = document.createElement('meta');
    element.setAttribute('charset', meta.charset);
    head.insertBefore(element, head.firstChild);
  }
}

function applyAttribute(element: Element, name: string, value: string | number | boolean | null): void {
  if (value === null || value === false) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, value === true ? '' : String(value));
  }
}
