import {
  bindable,
  BindingMode,
  customElement,
  IEffect,
  INode,
  IObservation,
  queueTask,
  resolve,
} from 'aurelia';
import { ITransferListOptions, type TransferListMessages } from './messages.js';
import {
  isTransferKey,
  reorderKeys,
  sameKeys,
  type TransferChange,
  type TransferDirection,
  type TransferKey,
} from './transfer.js';

export type TransferSide = 'source' | 'target';
export type TransferAction = 'add' | 'addAll' | 'remove' | 'removeAll' | 'up' | 'down';
export interface TransferRow {
  key: TransferKey;
  /** DOM id of the option element; stable for a key for the component's lifetime. */
  id: string;
  label: string;
  /** The option, or `undefined` for an assigned key that isn't in `options`. */
  item: unknown;
  disabled: boolean;
  unavailable: boolean;
}
/** Observable state of one list. */
export class TransferPane {
  /** Rows shown after filtering. */
  rows: TransferRow[] = [];
  /** Rows before filtering. */
  total = 0;
  filter = '';
  selected: ReadonlySet<TransferKey> = new Set();
  active: TransferKey | null = null;
  activeId: string | null = null;
  anchor: TransferKey | null = null;
  constructor(readonly side: TransferSide) {}
}
type Plan = { next: TransferKey[]; moved: TransferKey[] } | { reason: string };

const visuallyHidden =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';
const bool = (value: unknown) => value === true || value === '' || value === 'true';
function toMax(value: unknown): number | null {
  if (value == null || value === '') return null;
  const max = Number(value);
  if (!Number.isInteger(max) || max < 0)
    throw new RangeError('Transfer list max must be a non-negative integer');
  return max;
}
const toLevel = (value: unknown) => {
  const level = Number(value);
  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : 3;
};
const field = (item: unknown, name: string) =>
  typeof item === 'object' && item !== null ? (item as Record<string, unknown>)[name] : undefined;

const pane = (side: TransferSide) => {
  const label = side === 'source' ? 'sourceLabel' : 'targetLabel';
  return `<div class="au-transfer-list__pane" data-side="${side}">
    <div role="heading" aria-level.bind="headingLevel" id.bind="ids.${side}Heading" class="au-transfer-list__heading">\${messages.heading(${label}, ${side}.rows.length, ${side}.total)}</div>
    <input if.bind="filterable" type="search" class="au-transfer-list__filter" autocomplete="off" value.to-view="${side}.filter"
      aria-label.bind="messages.filter(${label})" aria-controls.bind="ids.${side}List" disabled.bind="disabled"
      input.trigger="setFilter('${side}', $event.target.value)" keydown.trigger="filterKeydown('${side}', $event)">
    <ul role="listbox" ref="${side}Box" id.bind="ids.${side}List" class="au-transfer-list__options" tabindex.bind="disabled ? -1 : 0"
      aria-multiselectable="true" aria-labelledby.bind="ids.${side}Heading" aria-describedby.bind="ids.help"
      aria-activedescendant.bind="${side}.activeId" aria-disabled.bind="disabled ? 'true' : null"
      keydown.trigger="keydown('${side}', $event)" focus.trigger="focusList('${side}')">
      <li repeat.for="row of ${side}.rows; key: key" role="option" id.bind="row.id" class="au-transfer-list__option"
        aria-selected.bind="${side}.selected.has(row.key) ? 'true' : 'false'" aria-disabled.bind="row.disabled || disabled ? 'true' : null"
        data-active.bind="${side}.active === row.key ? '' : null" data-unavailable.bind="row.unavailable ? '' : null"
        click.trigger="click('${side}', row.key, $event)" dblclick.trigger="dblclick('${side}', row.key)"
        ><template if.bind="row.unavailable">\${row.label}</template><au-slot else name="item" expose.bind="{ item: row.item, key: row.key, label: row.label, disabled: row.disabled, selected: ${side}.selected.has(row.key), side: '${side}' }">\${row.label}</au-slot></li>
    </ul>
    <p if.bind="!${side}.rows.length" class="au-transfer-list__empty">\${${side}.filter ? messages.noMatches : messages.empty}</p>
  </div>`;
};
const button = (action: TransferAction, text: string) =>
  `<button type="button" class="au-transfer-list__action" data-action="${action}" aria-disabled.bind="reasons.${action} ? 'true' : null"
      aria-describedby.bind="reasons.${action} ? ids.reason + '-${action}' : null" click.trigger="act('${action}')">\${messages.${text}}</button>
    <span id.bind="ids.reason + '-${action}'" hidden>\${reasons.${action}}</span>`;

let nextId = 0;

/**
 * Two keyed lists: options that are available and keys that are assigned. `value` is the
 * assigned key array; the component publishes a new array for every change and never mutates it.
 */
@customElement({
  name: 'au-transfer-list',
  template: `<div class="au-transfer-list" data-disabled.bind="disabled ? '' : null">
  ${pane('source')}
  <div class="au-transfer-list__actions" role="group" aria-label.bind="messages.actions">
    ${button('add', 'addSelected')}
    ${button('addAll', 'addAll')}
    ${button('remove', 'removeSelected')}
    ${button('removeAll', 'removeAll')}
    <template if.bind="orderable">
    ${button('up', 'moveUp')}
    ${button('down', 'moveDown')}
    </template>
  </div>
  ${pane('target')}
  <span id.bind="ids.help" hidden>\${messages.help(orderable)}</span>
  <div role="status" aria-live="polite" class="au-transfer-list__status" style="${visuallyHidden}">\${announcement}</div>
</div>`,
})
export class AuTransferList {
  @bindable options: readonly unknown[] = [];
  @bindable({ mode: BindingMode.twoWay }) value: readonly TransferKey[] = [];
  @bindable getKey: (item: unknown) => TransferKey = (item) => field(item, 'id') as TransferKey;
  @bindable getLabel: (item: unknown) => string = (item) => String(field(item, 'label') ?? item);
  @bindable getDisabled: (item: unknown) => boolean = (item) => field(item, 'disabled') === true;
  @bindable sourceLabel = 'Available';
  @bindable targetLabel = 'Selected';
  @bindable({ set: bool }) filterable = false;
  @bindable({ set: bool }) orderable = false;
  @bindable({ set: bool }) disabled = false;
  @bindable({ set: toMax }) max: number | null = null;
  @bindable({ set: toLevel }) headingLevel = 3;

  readonly source = new TransferPane('source');
  readonly target = new TransferPane('target');
  announcement = '';
  reasons: Record<TransferAction, string | null> = {
    add: null,
    addAll: null,
    remove: null,
    removeAll: null,
    up: null,
    down: null,
  };
  readonly messages: Readonly<TransferListMessages> = resolve(ITransferListOptions).messages;
  readonly ids: Record<
    'sourceHeading' | 'targetHeading' | 'sourceList' | 'targetList' | 'help' | 'reason',
    string
  >;
  sourceBox?: HTMLElement;
  targetBox?: HTMLElement;
  private readonly host = resolve(INode) as HTMLElement;
  private readonly observation = resolve(IObservation);
  private readonly prefix = `au-transfer-${++nextId}`;
  private readonly optionIds = new Map<TransferKey, string>();
  private index = new Map<TransferKey, TransferRow>();
  private active = false;
  private changing = false;
  private committing = false;
  private effect?: IEffect;
  private typed = { side: '' as TransferSide | '', text: '', at: 0 };

  constructor() {
    const p = this.prefix;
    this.ids = {
      sourceHeading: `${p}-source-heading`,
      targetHeading: `${p}-target-heading`,
      sourceList: `${p}-source`,
      targetList: `${p}-target`,
      help: `${p}-help`,
      reason: `${p}-reason`,
    };
  }

  binding(): void {
    this.active = true;
    this.rebuild();
    // Observe in-place changes: options splice/push, key/label/disabled edits and value mutation.
    this.effect = this.observation.watch(
      this,
      (vm) => vm.signature(),
      () => {
        if (this.active && !this.committing) this.rebuild();
      },
      { immediate: false },
    );
  }

  unbinding(): void {
    this.active = false;
    this.effect?.stop();
    this.effect = undefined;
  }

  optionsChanged(): void {
    this.refresh();
  }
  valueChanged(): void {
    if (!this.committing) this.refresh();
  }
  getKeyChanged(): void {
    this.refresh();
  }
  getLabelChanged(): void {
    this.refresh();
  }
  getDisabledChanged(): void {
    this.refresh();
  }
  filterableChanged(): void {
    if (!this.filterable) this.source.filter = this.target.filter = '';
    this.refresh();
  }
  disabledChanged(): void {
    this.updateReasons();
  }
  maxChanged(): void {
    this.updateReasons();
  }
  orderableChanged(): void {
    this.updateReasons();
  }
  sourceLabelChanged(): void {
    this.updateReasons();
  }
  targetLabelChanged(): void {
    this.updateReasons();
  }

  /** Add available keys (all of them enabled), going through the same events and limits as the UI. */
  add(keys: readonly TransferKey[]): boolean {
    return this.change('add', keys);
  }
  /** Remove assigned keys. Disabled assigned options can't be removed; unavailable keys can. */
  remove(keys: readonly TransferKey[]): boolean {
    return this.change('remove', keys);
  }
  /** Move assigned keys one place up (-1) or down (1). `orderable` only controls the UI. */
  reorder(keys: readonly TransferKey[], offset: -1 | 1): boolean {
    return this.change('reorder', keys, offset);
  }
  /** Replace the selection of one list with the visible, enabled rows among `keys`. */
  select(side: TransferSide, keys: readonly TransferKey[]): void {
    const pane = this[side];
    const wanted = new Set(keys);
    pane.selected = new Set(this.enabled(pane).filter((key) => wanted.has(key)));
    this.updateReasons();
  }

  act(action: TransferAction): boolean {
    const reason = this.reasons[action];
    if (reason) {
      this.announce(reason);
      return false;
    }
    switch (action) {
      case 'add':
        return this.change('add', this.selection(this.source));
      case 'addAll':
        return this.change('add', this.enabled(this.source));
      case 'remove':
        return this.change('remove', this.selection(this.target));
      case 'removeAll':
        return this.change('remove', this.enabled(this.target));
      case 'up':
      case 'down':
        return this.change('reorder', this.selection(this.target), action === 'up' ? -1 : 1);
    }
  }

  setFilter(side: TransferSide, text: string): void {
    const pane = this[side];
    if (pane.filter === text) return;
    const before = pane.selected.size;
    pane.filter = text;
    this.rebuild();
    const lost = before - pane.selected.size;
    if (lost > 0) this.announce(this.messages.deselected(lost));
  }

  filterKeydown(side: TransferSide, event: KeyboardEvent): boolean {
    if (event.key !== 'ArrowDown' || event.defaultPrevented || event.isComposing) return true;
    event.preventDefault();
    this[`${side}Box`]?.focus();
    return false;
  }

  focusList(side: TransferSide): void {
    const pane = this[side];
    if (pane.active === null && pane.rows.length)
      this.setActive(
        pane,
        pane.rows.find((row) => pane.selected.has(row.key))?.key ?? pane.rows[0].key,
      );
  }

  click(side: TransferSide, key: TransferKey, event: MouseEvent): void {
    if (this.disabled) return;
    const pane = this[side];
    this[`${side}Box`]?.focus();
    const anchor = pane.anchor ?? key;
    this.setActive(pane, key);
    if (this.index.get(key)?.disabled) return;
    if (event.shiftKey) this.selectRange(pane, anchor, key);
    else if (event.ctrlKey || event.metaKey) this.toggle(pane, key);
    else this.selectOnly(pane, key);
  }

  dblclick(side: TransferSide, key: TransferKey): void {
    if (this.disabled || this.index.get(key)?.disabled) return;
    this.change(side === 'source' ? 'add' : 'remove', [key]);
  }

  keydown(side: TransferSide, event: KeyboardEvent): boolean {
    if (this.disabled || event.defaultPrevented || event.isComposing) return true;
    const pane = this[side];
    const rows = pane.rows;
    const modified = event.ctrlKey || event.metaKey;
    const index = rows.findIndex((row) => row.key === pane.active);
    const go = (to: number) => {
      const row = rows[Math.max(0, Math.min(rows.length - 1, to))];
      if (!row) return;
      const from = pane.active ?? row.key;
      if (!event.shiftKey) pane.anchor = row.key;
      else if (pane.anchor === null) pane.anchor = from;
      this.setActive(pane, row.key);
      if (event.shiftKey) this.selectRange(pane, pane.anchor ?? from, row.key);
    };
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        const offset = event.key === 'ArrowDown' ? 1 : -1;
        if (event.altKey) {
          if (side !== 'target' || !this.orderable) return true;
          event.preventDefault();
          const keys = this.selection(pane);
          const active = pane.active !== null && pane.rows.find((row) => row.key === pane.active);
          this.change(
            'reorder',
            keys.length ? keys : active && !active.disabled ? [active.key] : [],
            offset,
          );
          return false;
        }
        if (modified) return true;
        event.preventDefault();
        go(index < 0 ? 0 : index + offset);
        return false;
      }
      case 'Home':
      case 'End':
        if (modified && !event.shiftKey) return true;
        event.preventDefault();
        go(event.key === 'Home' ? 0 : rows.length - 1);
        return false;
      case ' ':
        event.preventDefault();
        if (pane.active === null) go(0);
        else if (event.shiftKey) this.selectRange(pane, pane.anchor ?? pane.active, pane.active);
        else this.toggle(pane, pane.active);
        return false;
      case 'Enter': {
        event.preventDefault();
        const keys = this.selection(pane);
        const active = pane.active !== null && pane.rows.find((row) => row.key === pane.active);
        this.change(
          side === 'source' ? 'add' : 'remove',
          keys.length ? keys : active && !active.disabled ? [active.key] : [],
        );
        return false;
      }
    }
    if (modified && !event.altKey && (event.key === 'a' || event.key === 'A')) {
      event.preventDefault();
      const enabled = this.enabled(pane);
      this.select(side, enabled.every((key) => pane.selected.has(key)) ? [] : enabled);
      return false;
    }
    if (event.key.length === 1 && !modified && !event.altKey) {
      event.preventDefault();
      this.typeahead(pane, event.key);
      return false;
    }
    return true;
  }

  private refresh(): void {
    if (this.active) this.rebuild();
  }

  /** Snapshot read by the observation effect; it tracks the properties the callbacks read. */
  private signature(): string {
    const parts: unknown[] = [];
    for (const item of Array.isArray(this.options) ? this.options : []) {
      try {
        parts.push(this.getKey(item), this.getLabel(item), this.getDisabled(item));
      } catch {
        parts.push(null);
      }
    }
    parts.push('|', ...(Array.isArray(this.value) ? this.value : []));
    return JSON.stringify(parts);
  }

  private idFor(key: TransferKey): string {
    let id = this.optionIds.get(key);
    if (!id) this.optionIds.set(key, (id = `${this.prefix}-option-${this.optionIds.size}`));
    return id;
  }

  private rebuild(): void {
    const options = this.options ?? [];
    const value = this.value ?? [];
    if (!Array.isArray(options)) throw new TypeError('Transfer list options must be an array');
    if (!Array.isArray(value)) throw new TypeError('Transfer list value must be an array of keys');
    const index = new Map<TransferKey, TransferRow>();
    for (const item of options) {
      const key = this.getKey(item);
      if (!isTransferKey(key))
        throw new TypeError(
          `Transfer list keys must be non-empty strings or finite numbers: ${String(key)}`,
        );
      if (index.has(key)) throw new Error(`Duplicate transfer list key: ${String(key)}`);
      index.set(key, {
        key,
        id: this.idFor(key),
        label: String(this.getLabel(item)),
        item,
        disabled: this.getDisabled(item) === true,
        unavailable: false,
      });
    }
    const assigned = new Set<TransferKey>();
    for (const key of value) {
      if (!isTransferKey(key))
        throw new TypeError(
          `Transfer list keys must be non-empty strings or finite numbers: ${String(key)}`,
        );
      if (assigned.has(key))
        throw new Error(`Duplicate key in transfer list value: ${String(key)}`);
      assigned.add(key);
    }
    this.index = index;
    this.fill(
      this.source,
      [...index.values()].filter((row) => !assigned.has(row.key)),
    );
    this.fill(
      this.target,
      value.map(
        (key) =>
          index.get(key) ?? {
            key,
            id: this.idFor(key),
            label: this.messages.unavailable(key),
            item: undefined,
            disabled: false,
            unavailable: true,
          },
      ),
    );
    this.updateReasons();
  }

  private fill(pane: TransferPane, rows: TransferRow[]): void {
    const query = pane.filter.trim().toLocaleLowerCase();
    pane.total = rows.length;
    pane.rows = query ? rows.filter((row) => row.label.toLocaleLowerCase().includes(query)) : rows;
    const visible = new Set(pane.rows.map((row) => row.key));
    const enabled = new Set(this.enabled(pane));
    if ([...pane.selected].some((key) => !enabled.has(key)))
      pane.selected = new Set([...enabled].filter((key) => pane.selected.has(key)));
    if (pane.active !== null && !visible.has(pane.active)) this.setActive(pane, null);
    if (pane.anchor !== null && !visible.has(pane.anchor)) pane.anchor = null;
  }

  private enabled(pane: TransferPane): TransferKey[] {
    return pane.rows.filter((row) => !row.disabled).map((row) => row.key);
  }

  private selection(pane: TransferPane): TransferKey[] {
    return this.enabled(pane).filter((key) => pane.selected.has(key));
  }

  private setActive(pane: TransferPane, key: TransferKey | null): void {
    pane.active = key;
    pane.activeId = key === null ? null : this.idFor(key);
    if (key === null) return;
    const id = pane.activeId;
    queueTask(() => {
      const element = id ? this.host.ownerDocument.getElementById(id) : null;
      element?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  private selectOnly(pane: TransferPane, key: TransferKey): void {
    pane.anchor = key;
    this.select(pane.side, [key]);
  }

  private toggle(pane: TransferPane, key: TransferKey): void {
    if (this.index.get(key)?.disabled) return;
    pane.anchor = key;
    const next = new Set(pane.selected);
    if (!next.delete(key)) next.add(key);
    this.select(pane.side, [...next]);
  }

  private selectRange(pane: TransferPane, from: TransferKey, to: TransferKey): void {
    const keys = pane.rows.map((row) => row.key);
    const a = keys.indexOf(from);
    const b = keys.indexOf(to);
    if (a < 0 || b < 0) return;
    this.select(pane.side, keys.slice(Math.min(a, b), Math.max(a, b) + 1));
  }

  private typeahead(pane: TransferPane, char: string): void {
    const now = Date.now();
    const typed = this.typed;
    typed.text =
      (typed.side === pane.side && now - typed.at < 700 ? typed.text : '') +
      char.toLocaleLowerCase();
    typed.side = pane.side;
    typed.at = now;
    const index = pane.rows.findIndex((row) => row.key === pane.active);
    const start = typed.text.length > 1 ? Math.max(0, index) : index + 1;
    const ordered = [...pane.rows.slice(start), ...pane.rows.slice(0, start)];
    const match = ordered.find((row) => row.label.toLocaleLowerCase().startsWith(typed.text));
    if (match) this.setActive(pane, match.key);
  }

  private plan(
    direction: TransferDirection,
    keys: readonly TransferKey[],
    offset: -1 | 1 = 1,
  ): Plan {
    const messages = this.messages;
    if (this.disabled) return { reason: messages.disabled };
    const value = this.value ?? [];
    const assigned = new Set(value);
    const wanted = new Set(keys);
    if (direction === 'add') {
      const moved = [...this.index.values()]
        .filter((row) => wanted.has(row.key) && !assigned.has(row.key) && !row.disabled)
        .map((row) => row.key);
      if (!moved.length) return { reason: messages.noSelection(this.sourceLabel) };
      if (this.max !== null && value.length + moved.length > this.max)
        return { reason: messages.limit(this.max, Math.max(0, this.max - value.length)) };
      return { next: [...value, ...moved], moved };
    }
    const moved = value.filter((key) => wanted.has(key) && !this.index.get(key)?.disabled);
    if (!moved.length) return { reason: messages.noSelection(this.targetLabel) };
    if (direction === 'remove') {
      const removed = new Set(moved);
      return { next: value.filter((key) => !removed.has(key)), moved };
    }
    if (this.target.filter.trim()) return { reason: messages.filtered };
    const next = reorderKeys(value, moved, offset);
    if (sameKeys(next, value)) return { reason: offset < 0 ? messages.atTop : messages.atBottom };
    return { next, moved };
  }

  private change(
    direction: TransferDirection,
    keys: readonly TransferKey[],
    offset: -1 | 1 = 1,
  ): boolean {
    if (!this.active || this.changing) return false;
    const plan = this.plan(direction, keys, offset);
    if ('reason' in plan) {
      this.announce(plan.reason);
      return false;
    }
    const previous = this.value ?? [];
    const before = [...previous];
    const detail: TransferChange = {
      value: [...plan.next],
      previous: [...before],
      moved: [...plan.moved],
      direction,
    };
    this.changing = true;
    let allowed: boolean;
    try {
      allowed = this.host.dispatchEvent(
        new CustomEvent('transfer-before-change', { bubbles: true, cancelable: true, detail }),
      );
    } finally {
      this.changing = false;
    }
    if (!this.active) return false;
    if (!allowed) {
      this.announce(this.messages.cancelled);
      return false;
    }
    // The handler may have edited value, options or callbacks; reject the stale proposal.
    this.rebuild();
    const again = this.plan(direction, plan.moved, offset);
    if (
      (this.value ?? []) !== previous ||
      !sameKeys(previous, before) ||
      'reason' in again ||
      !sameKeys(again.next, plan.next) ||
      !sameKeys(again.moved, plan.moved)
    ) {
      this.announce(this.messages.stale);
      return false;
    }
    const origin = direction === 'add' ? this.source : this.target;
    const moved = new Set(plan.moved);
    const successor = direction === 'reorder' ? origin.active : this.successor(origin, moved);
    this.committing = true;
    try {
      this.value = plan.next;
    } finally {
      this.committing = false;
    }
    if (direction !== 'reorder')
      origin.selected = new Set([...origin.selected].filter((key) => !moved.has(key)));
    this.rebuild();
    if (successor !== null && origin.rows.some((row) => row.key === successor))
      this.setActive(origin, successor);
    else if (direction !== 'reorder') this.setActive(origin, null);
    this.announce(this.describe(direction, plan.moved, plan.next));
    this.host.dispatchEvent(
      new CustomEvent<TransferChange>('transfer-change', {
        bubbles: true,
        detail: { value: [...plan.next], previous: before, moved: [...plan.moved], direction },
      }),
    );
    return true;
  }

  private successor(pane: TransferPane, moved: ReadonlySet<TransferKey>): TransferKey | null {
    const rows = pane.rows;
    const index = rows.findIndex((row) => row.key === pane.active);
    if (index < 0 || !moved.has(rows[index].key)) return pane.active;
    for (let i = index + 1; i < rows.length; i++) if (!moved.has(rows[i].key)) return rows[i].key;
    for (let i = index - 1; i >= 0; i--) if (!moved.has(rows[i].key)) return rows[i].key;
    return null;
  }

  private describe(
    direction: TransferDirection,
    moved: TransferKey[],
    next: TransferKey[],
  ): string {
    const messages = this.messages;
    if (direction === 'add') return messages.added(moved.length, this.targetLabel, next.length);
    if (direction === 'remove')
      return messages.removed(moved.length, this.targetLabel, next.length);
    if (moved.length > 1) return messages.reorderedMany(moved.length);
    const row = this.index.get(moved[0]);
    return messages.reordered(
      row?.label ?? messages.unavailable(moved[0]),
      next.indexOf(moved[0]) + 1,
      next.length,
    );
  }

  private updateReasons(): void {
    if (!this.active) return;
    const messages = this.messages;
    const value = this.value ?? [];
    const limit = (count: number) =>
      this.max !== null && value.length + count > this.max
        ? messages.limit(this.max, Math.max(0, this.max - value.length))
        : null;
    const sourceSelection = this.selection(this.source);
    const targetSelection = this.selection(this.target);
    const sourceShown = this.enabled(this.source);
    const targetShown = this.enabled(this.target);
    const order = (offset: -1 | 1) => {
      if (this.target.filter.trim()) return messages.filtered;
      if (!targetSelection.length) return messages.noSelection(this.targetLabel);
      return sameKeys(reorderKeys(value, targetSelection, offset), value)
        ? offset < 0
          ? messages.atTop
          : messages.atBottom
        : null;
    };
    const disabled = this.disabled ? messages.disabled : null;
    this.reasons = {
      add:
        disabled ??
        (sourceSelection.length
          ? limit(sourceSelection.length)
          : messages.noSelection(this.sourceLabel)),
      addAll:
        disabled ??
        (sourceShown.length ? limit(sourceShown.length) : messages.noneShown(this.sourceLabel)),
      remove: disabled ?? (targetSelection.length ? null : messages.noSelection(this.targetLabel)),
      removeAll: disabled ?? (targetShown.length ? null : messages.noneShown(this.targetLabel)),
      up: disabled ?? order(-1),
      down: disabled ?? order(1),
    };
  }

  private announce(message: string): void {
    // Repeat announcements must still change the live region's text.
    this.announcement = this.announcement === message ? `${message} ` : message;
  }
}
