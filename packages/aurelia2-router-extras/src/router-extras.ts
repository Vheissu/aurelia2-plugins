import { observable } from 'aurelia';
import { resolve } from '@aurelia/kernel';
import { IRouter, IRouterEvents } from '@aurelia/router';
import type { RouteNode } from '@aurelia/router';
import type { BreadcrumbItem, MetaEntry } from './types';

export class RouterExtras {
  @observable public breadcrumbs: BreadcrumbItem[] = [];

  private readonly router = resolve(IRouter);
  private readonly metaElements: HTMLMetaElement[] = [];

  public constructor() {
    resolve(IRouterEvents).subscribe('au:router:navigation-end', () => {
      const root = this.router.currentTr.routeTree.root;
      this.updateFromRouteTree(root);
    });
  }

  public init(): void {
    const root = this.router.currentTr.routeTree.root;
    this.updateFromRouteTree(root);
  }

  public updateFromRouteTree(root: RouteNode): void {
    const nodes = this.getPrimaryPath(root);
    const breadcrumbs = nodes
      .map((node) => this.createBreadcrumb(node))
      .filter((crumb): crumb is BreadcrumbItem => Boolean(crumb));

    this.breadcrumbs.splice(0, this.breadcrumbs.length, ...breadcrumbs);

    const metaEntries = this.collectMeta(nodes);
    this.applyMeta(metaEntries);
  }

  private getPrimaryPath(root: RouteNode): RouteNode[] {
    const nodes: RouteNode[] = [];
    let current: RouteNode | null = root;

    while (current && current.children.length > 0) {
      const next = current.children.find((child) => {
        const vp = child.instruction?.viewport ?? null;
        return vp === null || vp === '' || vp === 'default';
      }) ?? current.children[0];

      nodes.push(next);
      current = next;
    }

    return nodes;
  }

  private createBreadcrumb(node: RouteNode): BreadcrumbItem | null {
    const title = this.resolveTitle(node);
    if (!title) return null;

    const path = node.computeAbsolutePath();

    return {
      title,
      path: path.startsWith('/') ? path : `/${path}`,
      params: node.params ?? null,
      data: node.data ?? {},
    };
  }

  private resolveTitle(node: RouteNode): string | null {
    const title = typeof node.title === 'function' ? node.title(node) : node.title;
    if (title) return title;

    const fallback = node.component?.name ?? null;
    return fallback ? String(fallback) : null;
  }

  private collectMeta(nodes: RouteNode[]): MetaEntry[] {
    const metaMap = new Map<string, MetaEntry>();

    for (const node of nodes) {
      const data = node.data as Record<string, unknown> | undefined;
      if (!data || !('meta' in data)) continue;

      const meta = (data as any).meta as unknown;
      const entries = normalizeMeta(meta);

      for (const entry of entries) {
        const key = entry.name
          ? `name:${entry.name}`
          : entry.property
            ? `property:${entry.property}`
            : null;
        if (!key) continue;
        metaMap.set(key, entry);
      }
    }

    return Array.from(metaMap.values());
  }

  private applyMeta(entries: MetaEntry[]): void {
    for (const element of this.metaElements) {
      element.remove();
    }
    this.metaElements.length = 0;

    const head = document.head;
    for (const entry of entries) {
      const meta = document.createElement('meta');
      if (entry.name) meta.setAttribute('name', entry.name);
      if (entry.property) meta.setAttribute('property', entry.property);
      meta.setAttribute('content', entry.content);
      head.appendChild(meta);
      this.metaElements.push(meta);
    }
  }
}

function normalizeMeta(meta: unknown): MetaEntry[] {
  if (!meta) return [];

  if (Array.isArray(meta)) {
    return meta.filter((entry): entry is MetaEntry => Boolean(entry && entry.content && (entry.name || entry.property)));
  }

  if (typeof meta === 'object') {
    const entries: MetaEntry[] = [];
    for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
      if (value == null) continue;
      if (typeof value === 'string') {
        if (key.includes(':')) {
          entries.push({ property: key, content: value });
        } else {
          entries.push({ name: key, content: value });
        }
        continue;
      }

      if (typeof value === 'object') {
        const entry = value as MetaEntry;
        if (entry.content && (entry.name || entry.property)) {
          entries.push(entry);
        }
      }
    }
    return entries;
  }

  return [];
}
