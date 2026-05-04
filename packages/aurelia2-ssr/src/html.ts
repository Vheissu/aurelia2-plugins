import type { SsrSerializableAttributes } from './types';

export function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeAttribute(value: string): string {
  return escapeText(value)
    .replace(/"/g, '&quot;');
}

export function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function normalizeBooleanAttribute(value: string | number | boolean | null | undefined): string | null {
  if (value === null || value === undefined || value === false) {
    return null;
  }

  return value === true ? '' : String(value);
}

export function setElementAttributes(element: Element, attrs: SsrSerializableAttributes | undefined): void {
  if (!attrs) {
    return;
  }

  for (const [name, rawValue] of Object.entries(attrs)) {
    const value = normalizeBooleanAttribute(rawValue);
    if (value === null) {
      element.removeAttribute(name);
    } else {
      element.setAttribute(name, value);
    }
  }
}

export function serializeAttributes(attrs: SsrSerializableAttributes): string {
  const entries = Object.entries(attrs)
    .flatMap(([name, rawValue]) => {
      const value = normalizeBooleanAttribute(rawValue);
      if (value === null) {
        return [];
      }

      return value === '' ? [name] : [`${name}="${escapeAttribute(value)}"`];
    });

  return entries.length ? ` ${entries.join(' ')}` : '';
}

export function createDocumentFromHtml(template: string, baseDocument: Document = document): Document {
  const nextDocument = baseDocument.implementation.createHTMLDocument('');
  nextDocument.open();
  nextDocument.write(template);
  nextDocument.close();

  return nextDocument;
}

export function ensureHead(document: Document): HTMLHeadElement {
  if (document.head) {
    return document.head;
  }

  const head = document.createElement('head');
  document.documentElement.insertBefore(head, document.body ?? null);
  return head;
}

export function ensureBody(document: Document): HTMLBodyElement {
  if (document.body) {
    return document.body as HTMLBodyElement;
  }

  const body = document.createElement('body') as HTMLBodyElement;
  document.documentElement.append(body);
  return body;
}

export function toAbsoluteUrl(value: string, origin: string): string {
  return new URL(value, origin).toString();
}

export function toRootRelativeUrl(value: string, origin: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return new URL(value, origin).pathname;
}

export function upsertMeta(document: Document, keyAttribute: 'name' | 'property' | 'http-equiv', keyValue: string, content: string): HTMLMetaElement {
  const head = ensureHead(document);
  let meta = head.querySelector<HTMLMetaElement>(`meta[${keyAttribute}="${cssEscape(keyValue)}"]`);

  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(keyAttribute, keyValue);
    head.append(meta);
  }

  meta.setAttribute('content', content);
  return meta;
}

export function upsertCanonical(document: Document, href: string): HTMLLinkElement {
  const head = ensureHead(document);
  let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    head.append(link);
  }

  link.setAttribute('href', href);
  return link;
}

export function cssEscape(value: string): string {
  const css = globalThis.CSS as { escape?: (value: string) => string } | undefined;
  if (css?.escape) {
    return css.escape(value);
  }

  return value.replace(/["\\]/g, '\\$&');
}
