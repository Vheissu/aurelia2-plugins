import {
  bindable,
  BindingMode,
  customElement,
  IContainer,
  IEffect,
  INode,
  IObservation,
  resolve,
} from 'aurelia';

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  )
    throw new RangeError('Invalid reorder index');
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}
export interface SortableChange<T = unknown> {
  items: T[];
  item: T;
  from: number;
  to: number;
}
let nextId = 0;
@customElement({
  name: 'au-sortable',
  template: `<div>
  <p id.bind="helpId">Use Space to pick up an item, arrow keys to move it, Enter to drop, or Escape to cancel.</p>
  <ol aria-label.bind="label">
    <li repeat.for="row of rows; key: key" dragover.trigger="dragover($event)" drop.trigger="drop($index, $event)">
      <button type="button" draggable.bind="!disabled" disabled.bind="disabled" aria-describedby.bind="helpId" aria-pressed.bind="grabbed === $index ? 'true' : 'false'"
        data-sort-key.bind="row.key" keydown.trigger="keydown($index, $event)" dragstart.trigger="dragstart($index, $event)" dragend.trigger="cancel()">\${row.label}</button>
      <button if.bind="controls" type="button" disabled.bind="disabled || $first" aria-label.bind="'Move ' + row.label + ' up'" click.trigger="move($index, -1)">↑</button>
      <button if.bind="controls" type="button" disabled.bind="disabled || $last" aria-label.bind="'Move ' + row.label + ' down'" click.trigger="move($index, 1)">↓</button>
    </li>
  </ol>
  <span role="status" aria-live="polite">\${announcement}</span>
</div>`,
})
export class AuSortable {
  @bindable({ mode: BindingMode.twoWay }) items: readonly unknown[] = [];
  @bindable getKey: (item: unknown) => string = (item) =>
    String(typeof item === 'object' && item !== null ? (item as { id: unknown }).id : item);
  @bindable getLabel: (item: unknown) => string = (item) =>
    String(typeof item === 'object' && item !== null ? (item as { label: unknown }).label : item);
  @bindable({ set: (value) => value === true || value === '' || value === 'true' }) disabled =
    false;
  @bindable({ set: (value) => value === true || value === '' || value === 'true' }) controls =
    false;
  @bindable label = 'Reorder items';
  rows: { key: string; label: string; item: unknown }[] = [];
  grabbed = -1;
  announcement = '';
  readonly helpId = `au-sortable-help-${++nextId}`;
  private readonly host = resolve(INode) as HTMLElement;
  private readonly observation = resolve(IObservation);
  private effect?: IEffect;
  private origin = -1;
  private original: readonly unknown[] | null = null;
  private originalRows: { key: string; label: string; item: unknown }[] = [];
  private active = false;
  binding(): void {
    this.active = true;
    this.rebuild();
    this.effect = this.observation.watch(
      this,
      (value) => value.items.map((item) => [value.getKey(item), value.getLabel(item)]),
      () => {
        this.cancel();
        this.rebuild();
      },
      { immediate: false },
    );
  }
  itemsChanged(): void {
    if (this.active) {
      this.cancel();
      this.rebuild();
    }
  }
  getKeyChanged(): void {
    if (this.active) {
      this.cancel();
      this.rebuild();
    }
  }
  getLabelChanged(): void {
    if (this.active) this.rebuild();
  }
  disabledChanged(): void {
    if (this.disabled) this.cancel();
  }
  private rebuild(): void {
    const keys = new Set<string>();
    this.rows = this.items.map((item) => {
      const key = this.getKey(item);
      if (!key || key === 'undefined' || keys.has(key))
        throw new Error(`Sortable keys must be unique: ${key}`);
      keys.add(key);
      return { key, label: this.getLabel(item), item };
    });
  }
  private pick(index: number): void {
    if (this.disabled || !this.rows[index]) return;
    this.original = this.items;
    this.originalRows = [...this.rows];
    this.origin = this.grabbed = index;
    this.announcement = `Picked up ${this.rows[index].label}`;
  }
  cancel(): void {
    if (this.grabbed < 0) return;
    this.grabbed = this.origin = -1;
    this.original = null;
    this.originalRows = [];
    this.rebuild();
    this.announcement = 'Reordering cancelled';
  }
  private sourceUnchanged(): boolean {
    return (
      this.items === this.original &&
      this.items.length === this.originalRows.length &&
      this.originalRows.every(
        (row, index) =>
          row.item === this.items[index] &&
          row.key === this.getKey(this.items[index]) &&
          row.label === this.getLabel(this.items[index]),
      )
    );
  }
  private commit(): boolean {
    if (this.grabbed < 0 || !this.original || this.disabled) return false;
    if (!this.sourceUnchanged()) {
      this.cancel();
      return false;
    }
    const original = this.original;
    const from = this.origin;
    const to = this.grabbed;
    const item = this.items[from];
    const items = this.rows.map((row) => row.item);
    const detail: SortableChange = { from, to, item, items };
    if (
      !this.host.dispatchEvent(
        new CustomEvent('sortable-before-change', { bubbles: true, cancelable: true, detail }),
      )
    ) {
      this.cancel();
      return false;
    }
    if (this.original !== original || this.items !== original || this.disabled || !this.active)
      return false;
    if (!this.sourceUnchanged()) {
      this.cancel();
      return false;
    }
    this.grabbed = this.origin = -1;
    this.original = null;
    this.originalRows = [];
    if (from === to) {
      this.announcement = 'Order unchanged';
      return true;
    }
    this.items = items;
    this.announcement = `Moved to position ${to + 1} of ${items.length}`;
    this.host.dispatchEvent(new CustomEvent('sortable-change', { bubbles: true, detail }));
    return true;
  }
  keydown(index: number, event: KeyboardEvent): void {
    if (
      this.disabled ||
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    if (this.grabbed < 0) {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        this.pick(index);
      }
      return;
    }
    if (event.key === 'Tab') {
      this.cancel();
      return;
    }
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End', ' ', 'Enter', 'Escape'].includes(event.key))
      return;
    event.preventDefault();
    if (event.key === 'Escape') {
      this.cancel();
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      this.commit();
      return;
    }
    const to =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? this.rows.length - 1
          : Math.max(
              0,
              Math.min(this.rows.length - 1, this.grabbed + (event.key === 'ArrowDown' ? 1 : -1)),
            );
    this.rows = moveItem(this.rows, this.grabbed, to);
    this.grabbed = to;
    this.announcement = `Position ${to + 1} of ${this.rows.length}`;
  }
  move(index: number, offset: number): boolean {
    const to = index + offset;
    if (
      this.disabled ||
      !Number.isInteger(index) ||
      !Number.isInteger(to) ||
      index < 0 ||
      index >= this.items.length ||
      to < 0 ||
      to >= this.items.length
    )
      return false;
    this.cancel();
    this.pick(index);
    this.rows = moveItem(this.rows, index, to);
    this.grabbed = to;
    return this.commit();
  }
  dragstart(index: number, event: DragEvent): void {
    if (this.disabled || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    this.pick(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', this.helpId);
  }
  dragover(event: DragEvent): void {
    if (this.grabbed >= 0 && !this.disabled) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }
  }
  drop(index: number, event: DragEvent): void {
    if (
      this.grabbed < 0 ||
      event.dataTransfer?.getData('text/plain') !== this.helpId ||
      this.disabled
    )
      return;
    event.preventDefault();
    this.rows = moveItem(this.rows, this.grabbed, index);
    this.grabbed = index;
    this.commit();
  }
  unbinding(): void {
    this.active = false;
    this.effect?.stop();
    this.effect = undefined;
    this.cancel();
  }
}
export const AureliaSortableConfiguration = {
  register(container: IContainer) {
    return container.register(AuSortable);
  },
};
