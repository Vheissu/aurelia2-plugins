import { DI } from 'aurelia';
import type {
  HeadAttributes,
  HeadHandle,
  HeadLinkDefinition,
  HeadManagerOptions,
  HeadMetaDefinition,
  HeadMetaInput,
  HeadState,
} from './types';

const MANAGED_ATTR = 'data-aurelia-head';
const KEY_ATTR = 'data-aurelia-head-key';

export class HeadManager {
  private options: Required<HeadManagerOptions> = {
    defaultTitle: '',
    titleTemplate: '%s',
    manageTitle: true,
  };

  private readonly states = new Map<string, HeadState>();
  private readonly previousHtmlAttrs = new Set<string>();
  private readonly previousBodyAttrs = new Set<string>();
  private nextOwnerId = 0;

  public configure(options: HeadManagerOptions = {}): void {
    this.options = {
      ...this.options,
      ...options,
    };
    this.render();
  }

  public apply(state: HeadState, owner = this.createOwner()): HeadHandle {
    this.states.set(owner, state);
    this.render();

    return {
      owner,
      update: (nextState: HeadState) => {
        this.states.set(owner, nextState);
        this.render();
      },
      dispose: () => {
        this.states.delete(owner);
        this.render();
      },
    };
  }

  public clear(owner?: string): void {
    if (owner) {
      this.states.delete(owner);
    } else {
      this.states.clear();
    }
    this.render();
  }

  public setTitle(title: string | null, template?: string | null, owner = 'global:title'): HeadHandle {
    return this.apply({ title, titleTemplate: template }, owner);
  }

  private render(): void {
    if (typeof document === 'undefined') return;

    const states = Array.from(this.states.values());
    const titleState = [...states].reverse().find((state) => state.title !== undefined);
    if (this.options.manageTitle) {
      this.applyTitle(titleState);
    }

    this.removeManagedElements();
    this.renderMeta(states);
    this.renderLinks(states);
    this.applyAttributes(document.documentElement, this.previousHtmlAttrs, this.mergeAttributes(states, 'htmlAttrs'));
    this.applyAttributes(document.body, this.previousBodyAttrs, this.mergeAttributes(states, 'bodyAttrs'));
  }

  private applyTitle(state: HeadState | undefined): void {
    const rawTitle = state?.title ?? this.options.defaultTitle;
    const template = state?.titleTemplate ?? this.options.titleTemplate;

    if (!rawTitle) {
      document.title = '';
      return;
    }

    document.title = template.includes('%s') ? template.replace('%s', rawTitle) : `${rawTitle}${template}`;
  }

  private renderMeta(states: HeadState[]): void {
    const entries = new Map<string, HeadMetaDefinition>();

    for (const state of states) {
      for (const entry of normalizeMeta(state.meta)) {
        entries.set(metaKey(entry), entry);
      }
    }

    for (const [key, entry] of entries) {
      const element = document.createElement('meta');
      element.setAttribute(MANAGED_ATTR, '');
      element.setAttribute(KEY_ATTR, key);

      if (entry.charset) element.setAttribute('charset', entry.charset);
      if (entry.name) element.setAttribute('name', entry.name);
      if (entry.property) element.setAttribute('property', entry.property);
      if (entry.httpEquiv) element.setAttribute('http-equiv', entry.httpEquiv);
      if (entry.content !== undefined) element.setAttribute('content', String(entry.content));

      document.head.appendChild(element);
    }
  }

  private renderLinks(states: HeadState[]): void {
    const entries = new Map<string, HeadLinkDefinition>();

    for (const state of states) {
      for (const entry of state.links ?? []) {
        if (!entry?.rel || !entry.href) continue;
        entries.set(linkKey(entry), entry);
      }
    }

    for (const [key, entry] of entries) {
      const element = document.createElement('link');
      element.setAttribute(MANAGED_ATTR, '');
      element.setAttribute(KEY_ATTR, key);

      setElementAttributes(element, entry);
      document.head.appendChild(element);
    }
  }

  private mergeAttributes(states: HeadState[], property: 'htmlAttrs' | 'bodyAttrs'): HeadAttributes {
    return states.reduce<HeadAttributes>((attrs, state) => {
      return {
        ...attrs,
        ...(state[property] ?? {}),
      };
    }, {});
  }

  private applyAttributes(element: Element, previous: Set<string>, attrs: HeadAttributes): void {
    for (const name of previous) {
      if (!(name in attrs)) {
        element.removeAttribute(name);
      }
    }
    previous.clear();

    for (const [name, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) {
        element.removeAttribute(name);
        continue;
      }

      element.setAttribute(name, value === true ? '' : String(value));
      previous.add(name);
    }
  }

  private removeManagedElements(): void {
    document.head.querySelectorAll(`[${MANAGED_ATTR}]`).forEach((node) => node.remove());
  }

  private createOwner(): string {
    this.nextOwnerId += 1;
    return `head:${this.nextOwnerId}`;
  }
}

export const IHeadManager = DI.createInterface<IHeadManager>('IHeadManager', x => x.singleton(HeadManager));
export interface IHeadManager extends HeadManager {}

export function normalizeMeta(meta: HeadMetaInput): HeadMetaDefinition[] {
  if (!meta) return [];

  if (Array.isArray(meta)) {
    return meta.filter(isValidMetaDefinition);
  }

  return Object.entries(meta).flatMap(([key, value]) => {
    if (value === null || value === undefined) return [];
    if (typeof value === 'object') {
      return isValidMetaDefinition(value) ? [value] : [];
    }

    return [key.includes(':')
      ? { property: key, content: value }
      : { name: key, content: value }];
  });
}

function isValidMetaDefinition(entry: unknown): entry is HeadMetaDefinition {
  if (!entry || typeof entry !== 'object') return false;
  const meta = entry as HeadMetaDefinition;
  return Boolean(meta.charset || meta.name || meta.property || meta.httpEquiv);
}

function metaKey(entry: HeadMetaDefinition): string {
  return entry.key
    ?? (entry.charset ? `charset:${entry.charset}` : null)
    ?? (entry.name ? `name:${entry.name}` : null)
    ?? (entry.property ? `property:${entry.property}` : null)
    ?? (entry.httpEquiv ? `http-equiv:${entry.httpEquiv}` : null)
    ?? JSON.stringify(entry);
}

function linkKey(entry: HeadLinkDefinition): string {
  return entry.key ?? `${entry.rel}:${entry.href}:${entry.as ?? ''}`;
}

function setElementAttributes(element: HTMLElement, attrs: object): void {
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || name === 'key') continue;
    element.setAttribute(name === 'crossorigin' ? 'crossorigin' : name, String(value));
  }
}
