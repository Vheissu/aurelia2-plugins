import {
  bindable,
  BindingMode,
  customElement,
  IContainer,
  INode,
  Registration,
  resolve,
  queueTask,
} from 'aurelia';

export interface TreeNode {
  id: string;
  label: string;
  children?: readonly TreeNode[];
  hasChildren?: boolean;
  disabled?: boolean;
}
export interface TreeRow {
  id: string;
  node: TreeNode;
  level: number;
  position: number;
  size: number;
  expanded: boolean;
  branch: boolean;
  busy: boolean;
  error?: unknown;
}
export type TreeLoader = (node: TreeNode, signal: AbortSignal) => Promise<readonly TreeNode[]>;
export class TreeModel {
  rows: TreeRow[] = [];
  activeId: string | null = null;
  selectedId: string | null = null;
  private roots: readonly TreeNode[] = [];
  private index = new Map<string, TreeNode>();
  private parents = new Map<string, string>();
  private expanded = new Set<string>();
  private loaded = new Map<string, readonly TreeNode[]>();
  private requests = new Map<string, { abort: AbortController; promise: Promise<boolean> }>();
  private errors = new Map<string, unknown>();
  private disposed = false;
  constructor(
    nodes: readonly TreeNode[],
    private readonly loader?: TreeLoader,
  ) {
    this.replace(nodes);
  }
  replace(nodes: readonly TreeNode[]): void {
    if (this.disposed) return;
    const { index, parents } = this.scan(nodes, new Map());
    this.cancel();
    if (this.disposed) return;
    this.roots = nodes;
    this.loaded.clear();
    this.errors.clear();
    this.index = index;
    this.parents = parents;
    this.expanded = new Set(
      [...this.expanded].filter((id) => (index.get(id)?.children?.length ?? 0) > 0),
    );
    if (this.selectedId && !index.has(this.selectedId)) this.selectedId = null;
    this.refresh();
  }
  private scan(roots: readonly TreeNode[], loaded: Map<string, readonly TreeNode[]>) {
    const index = new Map<string, TreeNode>();
    const parents = new Map<string, string>();
    const stack: { nodes: readonly TreeNode[]; parent?: string }[] = [{ nodes: roots }];
    while (stack.length) {
      const { nodes, parent } = stack.pop()!;
      if (!Array.isArray(nodes)) throw new Error('Tree children must be an array');
      for (const node of nodes) {
        if (!node || typeof node.id !== 'string' || !node.id || typeof node.label !== 'string')
          throw new Error('Tree nodes require string IDs and labels');
        if (index.has(node.id)) throw new Error(`Duplicate or cyclic tree node: ${node.id}`);
        index.set(node.id, node);
        if (parent !== undefined) parents.set(node.id, parent);
        stack.push({ nodes: loaded.get(node.id) ?? node.children ?? [], parent: node.id });
      }
    }
    return { index, parents };
  }
  private children(node: TreeNode): readonly TreeNode[] | undefined {
    return this.loaded.get(node.id) ?? node.children;
  }
  private branch(node: TreeNode): boolean {
    const children = this.children(node);
    return children ? children.length > 0 : node.hasChildren === true;
  }
  private refresh(): void {
    const rows: TreeRow[] = [];
    const stack: { nodes: readonly TreeNode[]; level: number; index: number }[] = [
      { nodes: this.roots, level: 1, index: 0 },
    ];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      if (frame.index >= frame.nodes.length) {
        stack.pop();
        continue;
      }
      const node = frame.nodes[frame.index++];
      const expanded = this.expanded.has(node.id);
      rows.push({
        id: node.id,
        node,
        level: frame.level,
        position: frame.index,
        size: frame.nodes.length,
        expanded,
        branch: this.branch(node),
        busy: this.requests.has(node.id),
        error: this.errors.get(node.id),
      });
      if (expanded)
        stack.push({ nodes: this.children(node) ?? [], level: frame.level + 1, index: 0 });
    }
    this.rows = rows;
    if (!rows.some((row) => row.node.id === this.activeId))
      this.activeId = rows[0]?.node.id ?? null;
  }
  expand(id: string): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    const node = this.index.get(id);
    if (!node || !this.branch(node)) return Promise.resolve(false);
    const pending = this.requests.get(id);
    if (pending) return pending.promise;
    if (this.children(node)) {
      this.expanded.add(id);
      this.refresh();
      return Promise.resolve(true);
    }
    if (!this.loader) return Promise.resolve(false);
    const abort = new AbortController();
    this.errors.delete(id);
    const work = Promise.resolve()
      .then(() => {
        abort.signal.throwIfAborted();
        return this.loader!(node, abort.signal);
      })
      .then((children) => {
        if (abort.signal.aborted || this.disposed) return false;
        const loaded = new Map(this.loaded).set(id, children);
        const { index, parents } = this.scan(this.roots, loaded);
        this.loaded = loaded;
        this.index = index;
        this.parents = parents;
        this.expanded.add(id);
        return true;
      })
      .catch((error) => {
        if (!abort.signal.aborted) this.errors.set(id, error);
        return false;
      });
    let onAbort!: () => void;
    const cancelled = new Promise<boolean>((resolve) => {
      onAbort = () => resolve(false);
      abort.signal.addEventListener('abort', onAbort, { once: true });
    });
    const promise = Promise.race([work, cancelled]).finally(() => {
      abort.signal.removeEventListener('abort', onAbort);
      if (this.requests.get(id)?.abort === abort) {
        this.requests.delete(id);
        this.refresh();
      }
    });
    this.requests.set(id, { abort, promise });
    this.refresh();
    return promise;
  }
  collapse(id: string): void {
    this.requests.get(id)?.abort.abort();
    this.requests.delete(id);
    this.expanded.delete(id);
    let ancestor = this.activeId;
    while (ancestor) {
      ancestor = this.parents.get(ancestor) ?? null;
      if (ancestor === id) {
        this.activeId = id;
        break;
      }
    }
    this.refresh();
  }
  toggle(id: string): Promise<boolean> {
    if (this.expanded.has(id) || this.requests.has(id)) {
      this.collapse(id);
      return Promise.resolve(false);
    }
    return this.expand(id);
  }
  select(id: string): boolean {
    const node = this.index.get(id);
    if (!node || node.disabled) return false;
    let parent = this.parents.get(id);
    let reveal = false;
    while (parent !== undefined) {
      if (!this.expanded.has(parent)) reveal = true;
      this.expanded.add(parent);
      parent = this.parents.get(parent);
    }
    if (reveal) this.refresh();
    this.selectedId = id;
    this.activeId = id;
    return true;
  }
  has(id: string): boolean {
    return this.index.has(id);
  }
  async navigate(key: string): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.node.id === this.activeId);
    const row = this.rows[index];
    if (!row) return false;
    if (key === 'ArrowDown')
      this.activeId = this.rows[Math.min(index + 1, this.rows.length - 1)].node.id;
    else if (key === 'ArrowUp') this.activeId = this.rows[Math.max(index - 1, 0)].node.id;
    else if (key === 'Home') this.activeId = this.rows[0].node.id;
    else if (key === 'End') this.activeId = this.rows[this.rows.length - 1].node.id;
    else if (key === 'ArrowRight') {
      if (row.expanded) this.activeId = this.children(row.node)?.[0]?.id ?? row.node.id;
      else await this.expand(row.node.id);
    } else if (key === 'ArrowLeft') {
      if (row.expanded || row.busy) this.collapse(row.node.id);
      else this.activeId = this.parents.get(row.node.id) ?? row.node.id;
    } else if (key === 'Enter' || key === ' ') this.select(row.node.id);
    else return false;
    return true;
  }
  search(prefix: string): void {
    const index = this.rows.findIndex((row) => row.node.id === this.activeId);
    const start = prefix.length > 1 ? Math.max(0, index) : index + 1;
    const ordered = [...this.rows.slice(start), ...this.rows.slice(0, start)];
    const match = ordered.find((row) =>
      row.node.label.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase()),
    );
    if (match) this.activeId = match.node.id;
  }
  private cancel(): void {
    for (const { abort } of this.requests.values()) abort.abort();
    this.requests.clear();
  }
  dispose(): void {
    this.disposed = true;
    this.cancel();
    this.refresh();
  }
}
export class TreeFactory {
  create(nodes: readonly TreeNode[], loader?: TreeLoader): TreeModel {
    return new TreeModel(nodes, loader);
  }
}
@customElement({
  name: 'au-tree',
  template: `<div role="tree" aria-label.bind="label" keydown.trigger="keydown($event)">
  <div repeat.for="row of tree.rows; key: id" role="treeitem" data-tree-id.bind="row.node.id" aria-label.bind="row.node.label"
    tabindex.bind="tree.activeId === row.node.id ? 0 : -1" aria-level.bind="row.level" aria-posinset.bind="row.position" aria-setsize.bind="row.size"
    aria-expanded.bind="row.branch ? (row.expanded ? 'true' : 'false') : null" aria-selected.bind="selected === row.node.id ? 'true' : 'false'"
    aria-disabled.bind="row.node.disabled ? 'true' : null" aria-busy.bind="row.busy ? 'true' : null"
    padding-inline-start.style="((row.level - 1) * 20) + 'px'" focusin.trigger="tree.activeId = row.node.id"
    click.trigger="select(row.node.id)" dblclick.trigger="toggle(row.node.id, $event)">
    <button if.bind="row.branch" type="button" tabindex="-1" aria-label.bind="(row.expanded ? 'Collapse ' : 'Expand ') + row.node.label" click.trigger="toggle(row.node.id, $event)">\${row.expanded ? '▾' : '▸'}</button> \${row.node.label}
    <span if.bind="row.error" role="alert">Unable to load children</span>
  </div></div>`,
})
export class AuTree {
  @bindable nodes: readonly TreeNode[] = [];
  @bindable loadChildren?: TreeLoader;
  @bindable label = 'Tree';
  @bindable({ mode: BindingMode.twoWay }) selected: string | null = null;
  tree!: TreeModel;
  private readonly factory = resolve(TreeFactory);
  private readonly host = resolve(INode) as HTMLElement;
  private active = false;
  private prefix = '';
  private typedAt = 0;
  private focusRequest = 0;
  private selectionRequest = 0;
  binding(): void {
    this.active = true;
    this.reset();
  }
  nodesChanged(): void {
    if (this.active) this.reset();
  }
  loadChildrenChanged(): void {
    if (this.active) this.reset();
  }
  selectedChanged(): void {
    if (!this.active || !this.tree) return;
    const request = ++this.selectionRequest;
    const selected = this.selected;
    if (selected === null) this.tree.selectedId = null;
    else if (!this.tree.select(selected)) {
      this.tree.selectedId = null;
      if (this.tree.has(selected)) this.selected = null;
      else queueTask(() => {
        if (this.active && request === this.selectionRequest && !this.tree.select(selected))
          this.selected = null;
      });
    }
  }
  private reset(): void {
    this.tree?.dispose();
    this.tree = this.factory.create(this.nodes, this.loadChildren);
    this.selectedChanged();
  }
  toggle(id: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (event.type === 'dblclick' && (event.target as Element).closest('button')) return;
    this.tree.activeId = id;
    void this.tree.toggle(id);
  }
  select(id: string): void {
    if (this.tree.select(id)) {
      this.selected = id;
      this.host.dispatchEvent(new CustomEvent('tree-select', { bubbles: true, detail: { id } }));
    }
  }
  async keydown(event: KeyboardEvent): Promise<void> {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const supported = [
      'ArrowDown',
      'ArrowUp',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'Enter',
      ' ',
    ].includes(event.key);
    if (!supported && event.key.length !== 1) return;
    event.preventDefault();
    const tree = this.tree;
    const request = ++this.focusRequest;
    const focused = this.host.ownerDocument.activeElement;
    if (supported) {
      if ((event.key === 'Enter' || event.key === ' ') && tree.activeId) this.select(tree.activeId);
      else await tree.navigate(event.key);
    } else {
      const now = Date.now();
      this.prefix = (now - this.typedAt < 700 ? this.prefix : '') + event.key;
      this.typedAt = now;
      tree.search(this.prefix);
    }
    queueTask(() => {
      if (
        !this.active ||
        this.tree !== tree ||
        this.focusRequest !== request ||
        this.host.ownerDocument.activeElement !== focused
      )
        return;
      Array.from(this.host.querySelectorAll<HTMLElement>('[data-tree-id]'))
        .find((el) => el.dataset.treeId === tree.activeId)
        ?.focus();
    });
  }
  unbinding(): void {
    this.active = false;
    this.tree?.dispose();
  }
}
export const AureliaTreeConfiguration = {
  register(container: IContainer) {
    return container.register(Registration.singleton(TreeFactory, TreeFactory), AuTree);
  },
};
