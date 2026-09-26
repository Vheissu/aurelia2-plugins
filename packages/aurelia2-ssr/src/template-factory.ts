import { IPlatform, Registration, resolve, type IRegistration } from '@aurelia/kernel';
import { ITemplateElementFactory } from '@aurelia/template-compiler';

type DomPlatform = { readonly document: Document };

const cacheByDocument = new WeakMap<Document, Map<string, HTMLTemplateElement>>();

/**
 * Replacement for Aurelia's `TemplateElementFactory` whose markup cache is
 * scoped to the owning `document`.
 *
 * Core caches parsed template elements in a module-level map keyed by markup
 * string. When a process renders with more than one DOM window (one jsdom per
 * route or per request), the second window receives template nodes owned by
 * the first, which fails `instanceof p.Node` and surfaces as AUR0757
 * (`rendering_mismatch_length`, "0 targets"). `createServerContainer`
 * registers this factory so each window parses its own templates.
 */
export class SsrTemplateElementFactory implements ITemplateElementFactory {
  private readonly p = resolve(IPlatform) as unknown as DomPlatform;
  private _template = this.t();

  private t(): HTMLTemplateElement {
    return this.p.document.createElement('template');
  }

  public createTemplate(input: string | Node): HTMLTemplateElement {
    if (typeof input === 'string') {
      const document = this.p.document;
      let cache = cacheByDocument.get(document);
      if (!cache) {
        cache = new Map();
        cacheByDocument.set(document, cache);
      }

      let result = cache.get(input);
      if (result === undefined) {
        const template = this._template;
        template.innerHTML = input;
        const node = template.content.firstElementChild;
        if (needsWrapping(node)) {
          this._template = this.t();
          result = template;
        } else {
          template.content.removeChild(node!);
          result = node as HTMLTemplateElement;
        }
        cache.set(input, result);
      }

      return result.cloneNode(true) as HTMLTemplateElement;
    }

    if (input.nodeName !== 'TEMPLATE') {
      const template = this.t();
      template.content.appendChild(input);
      return template;
    }

    input.parentNode?.removeChild(input);
    return input.cloneNode(true) as HTMLTemplateElement;
  }
}

export function createSsrTemplateFactoryRegistration(): IRegistration {
  return Registration.singleton(ITemplateElementFactory, SsrTemplateElementFactory);
}

/** Drops cached templates for a document, for example before closing a long-lived window. */
export function clearSsrTemplateCache(document: Document): void {
  cacheByDocument.delete(document);
}

function needsWrapping(node: Element | null | undefined): boolean {
  if (node == null) {
    return true;
  }
  if (node.nodeName !== 'TEMPLATE') {
    return true;
  }
  if (node.nextElementSibling != null) {
    return true;
  }

  const previous = node.previousSibling;
  if (previous != null && previous.nodeType === 3 && (previous.textContent ?? '').trim().length > 0) {
    return true;
  }

  const next = node.nextSibling;
  if (next != null && next.nodeType === 3 && (next.textContent ?? '').trim().length > 0) {
    return true;
  }

  return false;
}
