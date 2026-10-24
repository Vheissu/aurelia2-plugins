import { bindable, customElement, IEffect, INode, IObservation, resolve } from 'aurelia';
import type { MentionState } from './state.js';

const visuallyHidden =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';
const GAP = 4;

/**
 * Renders a `MentionState` as a listbox. Options keep focus in the text field: pointer presses are
 * cancelled and the field keeps `aria-activedescendant`. With `position="caret"` (the default) the
 * popup uses fixed positioning next to the trigger and flips above it when there is no room below.
 */
@customElement({
  name: 'au-mention-list',
  template: `<div if.bind="state.open" ref="popup" class="au-mention-list" data-placement.bind="placement"
  style.bind="popupStyle" pointerdown.trigger="keepFocus($event)" mousedown.trigger="keepFocus($event)">
  <div role="listbox" id.bind="state.listboxId" aria-label.bind="label" aria-busy.bind="state.loading ? 'true' : null" class="au-mention-list__options">
    <div repeat.for="item of state.items" role="option" id.bind="state.optionId($index)" class="au-mention-list__option"
      aria-selected.bind="$index === state.activeIndex ? 'true' : 'false'" aria-disabled.bind="item.disabled ? 'true' : null"
      data-active.bind="$index === state.activeIndex ? '' : null" pointermove.trigger="state.activate($index)" click.trigger="state.select($index)"
      ><au-slot name="item" expose.bind="{ item: item, index: $index, active: $index === state.activeIndex, query: state.query, trigger: state.trigger }">\${item.label}<span if.bind="item.description" class="au-mention-list__description"> \${item.description}</span></au-slot></div>
  </div>
  <div if.bind="message" class="au-mention-list__message" data-kind.bind="state.error ? 'error' : state.loading ? 'loading' : 'empty'">\${message}</div>
</div>
<span role="status" aria-live="polite" class="au-mention-list__status" style="${visuallyHidden}">\${status}</span>`,
})
export class AuMentionList {
  @bindable state: MentionState | null = null;
  @bindable label = 'Suggestions';
  @bindable loadingText = 'Loading suggestions…';
  @bindable emptyText = 'No matches';
  @bindable errorText = 'Suggestions unavailable';
  @bindable countText: (count: number) => string = (count) =>
    count === 1 ? '1 suggestion available' : `${count} suggestions available`;
  /** `caret` positions the popup with `position: fixed`; `none` leaves placement to your CSS. */
  @bindable position: 'caret' | 'none' = 'caret';
  popup?: HTMLElement;
  placement: 'below' | 'above' = 'below';
  top: number | null = null;
  left: number | null = null;
  private readonly host = resolve(INode) as HTMLElement;
  private readonly observation = resolve(IObservation);
  private effect?: IEffect;

  get message(): string | null {
    const state = this.state;
    if (!state?.open) return null;
    if (state.insertionError) return state.insertionError;
    if (state.error) return this.errorText;
    if (state.items.length) return null;
    return state.loading ? this.loadingText : this.emptyText;
  }

  get status(): string {
    const state = this.state;
    if (!state?.open) return '';
    if (state.insertionError) return state.insertionError;
    if (state.error) return this.errorText;
    if (state.loading) return this.loadingText;
    return state.items.length ? this.countText(state.items.length) : this.emptyText;
  }

  get popupStyle(): string {
    if (this.position !== 'caret' || this.top === null || this.left === null) return '';
    return `position: fixed; top: ${this.top}px; left: ${this.left}px`;
  }

  binding(): void {
    this.effect = this.observation.watch(
      this,
      (vm) => {
        const state = vm.state;
        return state?.open && vm.position === 'caret'
          ? [state.anchor, state.items.length, state.loading, state.error]
          : null;
      },
      () => this.place(),
    );
  }

  unbinding(): void {
    this.effect?.stop();
    this.effect = undefined;
  }

  keepFocus(event: Event): void {
    event.preventDefault();
  }

  /** Recalculate placement, e.g. after changing the popup's size with CSS. */
  place(): void {
    const anchor = this.state?.open ? this.state.anchor : null;
    if (!anchor || this.position !== 'caret') {
      this.top = this.left = null;
      return;
    }
    const view = this.host.ownerDocument.defaultView;
    const height = this.popup?.offsetHeight ?? 0;
    const width = this.popup?.offsetWidth ?? 0;
    const viewportHeight = view?.innerHeight ?? Infinity;
    const viewportWidth = view?.innerWidth ?? Infinity;
    const below = anchor.bottom + GAP;
    const above = anchor.top - GAP - height;
    this.placement = below + height > viewportHeight && above >= 0 ? 'above' : 'below';
    this.top = this.placement === 'above' ? above : below;
    this.left = Math.max(0, Math.min(anchor.left, viewportWidth - width));
  }
}
