import { escapeAttribute, escapeText } from './html';
import type { SerializeHtmlOptions, SsrShadowDomConfig } from './types';

const voidElements = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const defaultShadowDomConfig: Required<SsrShadowDomConfig> = {
  serialize: true,
  mode: 'declarative-shadow-dom',
  includeSerializableAttribute: true,
  includeClonableAttribute: false,
  includeDelegatesFocusAttribute: true,
  includeAdoptedStyleSheets: true,
};

export function serializeElementForSsr(element: Element, options: SerializeHtmlOptions = {}): string {
  return serializeNode(element, normalizeSerializeOptions(options));
}

export function serializeNodeForSsr(node: Node, options: SerializeHtmlOptions = {}): string {
  return serializeNode(node, normalizeSerializeOptions(options));
}

function normalizeSerializeOptions(options: SerializeHtmlOptions): Required<SerializeHtmlOptions> {
  return {
    shadowDom: {
      ...defaultShadowDomConfig,
      ...(options.shadowDom ?? {}),
    },
    stripAureliaMarkers: options.stripAureliaMarkers ?? false,
    preserveComments: options.preserveComments ?? true,
    onWarning: options.onWarning ?? (() => undefined),
  };
}

function serializeNode(node: Node, options: Required<SerializeHtmlOptions>): string {
  switch (node.nodeType) {
    case node.ELEMENT_NODE:
      return serializeElement(node as Element, options);
    case node.TEXT_NODE:
      return escapeText(node.textContent ?? '');
    case node.COMMENT_NODE:
      return serializeComment(node as Comment, options);
    case node.DOCUMENT_FRAGMENT_NODE:
      return Array.from(node.childNodes).map(child => serializeNode(child, options)).join('');
    case node.DOCUMENT_TYPE_NODE:
      return '';
    default:
      return '';
  }
}

function serializeElement(element: Element, options: Required<SerializeHtmlOptions>): string {
  const tagName = element.tagName.toLowerCase();
  const attributes = serializeElementAttributes(element);

  if (voidElements.has(tagName)) {
    return `<${tagName}${attributes}>`;
  }

  const shadowHtml = serializeShadowRoot(element, options);
  const children = Array.from(element.childNodes).map(child => serializeNode(child, options)).join('');

  return `<${tagName}${attributes}>${shadowHtml}${children}</${tagName}>`;
}

function serializeShadowRoot(element: Element, options: Required<SerializeHtmlOptions>): string {
  const shadowDom = {
    ...defaultShadowDomConfig,
    ...(options.shadowDom ?? {}),
  };

  if (!shadowDom.serialize) {
    return '';
  }

  const shadowRoot = element.shadowRoot;
  if (!shadowRoot) {
    return '';
  }

  const mode = shadowRoot.mode === 'closed' ? 'closed' : 'open';
  const delegatesFocus = Boolean((shadowRoot as ShadowRoot & { delegatesFocus?: boolean }).delegatesFocus);
  const attributes = [
    `shadowrootmode="${mode}"`,
    shadowDom.includeSerializableAttribute ? 'shadowrootserializable' : '',
    shadowDom.includeClonableAttribute ? 'shadowrootclonable' : '',
    shadowDom.includeDelegatesFocusAttribute && delegatesFocus ? 'shadowrootdelegatesfocus' : '',
  ].filter(Boolean).join(' ');

  const adoptedStyleSheets = shadowDom.includeAdoptedStyleSheets
    ? serializeAdoptedStyleSheets(shadowRoot, options)
    : '';
  const shadowHtml = Array.from(shadowRoot.childNodes).map(child => serializeNode(child, options)).join('');

  return `<template ${attributes}>${adoptedStyleSheets}${shadowHtml}</template>`;
}

function serializeAdoptedStyleSheets(shadowRoot: ShadowRoot, options: Required<SerializeHtmlOptions>): string {
  const sheets = Array.from(shadowRoot.adoptedStyleSheets ?? []);
  if (sheets.length === 0) {
    return '';
  }

  const cssText = sheets.map((sheet, index) => {
    try {
      return Array.from(sheet.cssRules ?? []).map(rule => rule.cssText).join('\n');
    } catch {
      options.onWarning(`Could not serialize adoptedStyleSheets[${index}] from a shadow root.`);
      return '';
    }
  }).filter(Boolean).join('\n');

  return cssText ? `<style data-aurelia-ssr-adopted>${escapeText(cssText)}</style>` : '';
}

function serializeElementAttributes(element: Element): string {
  const attributes = Array.from(element.attributes).map(attribute => {
    return `${attribute.name}="${escapeAttribute(attribute.value)}"`;
  });

  return attributes.length ? ` ${attributes.join(' ')}` : '';
}

function serializeComment(comment: Comment, options: Required<SerializeHtmlOptions>): string {
  const value = comment.textContent ?? '';
  if (options.stripAureliaMarkers && /^au-(start|end)$/u.test(value.trim())) {
    return '';
  }

  if (!options.preserveComments) {
    return '';
  }

  return `<!--${value.replace(/-->/g, '--&gt;')}-->`;
}
