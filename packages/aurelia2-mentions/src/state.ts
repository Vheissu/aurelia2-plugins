import { DI } from 'aurelia';
import type { MentionEntity, MentionRange } from './text.js';

export interface MentionItem {
  id: string;
  label: string;
  description?: string;
  /** Disabled items are shown but can't be inserted. */
  disabled?: boolean;
}
export interface MentionTrigger<T extends MentionItem = MentionItem> {
  /** A single non-whitespace, non-word character such as `@`, `#` or `/`. */
  char: string;
  /** Return results for the query. Honour `signal` to stop superseded work. */
  search(query: string, signal: AbortSignal): readonly T[] | PromiseLike<readonly T[]>;
  /** Text to insert; defaults to `char + item.label`. */
  format?(item: T): string;
  minLength?: number;
  maxResults?: number;
  maxQueryLength?: number;
  allowSpaces?: boolean;
  startOfLineOnly?: boolean;
  /** Milliseconds to wait after the last keystroke before searching. */
  debounce?: number;
  /** Insert a space after the mention unless whitespace already follows. */
  appendSpace?: boolean;
}
export interface MentionsOptions {
  maxResults: number;
  maxQueryLength: number;
  debounce: number;
  appendSpace: boolean;
}
export const defaultMentionsOptions: Readonly<MentionsOptions> = Object.freeze({
  maxResults: 10,
  maxQueryLength: 50,
  debounce: 0,
  appendSpace: true,
});
export const IMentionsOptions = DI.createInterface<Readonly<MentionsOptions>>(
  'IMentionsOptions',
  (x) => x.instance(defaultMentionsOptions),
);

/** Viewport coordinates (CSS pixels) of the trigger character. */
export interface MentionAnchor {
  top: number;
  bottom: number;
  left: number;
  height: number;
}
export interface MentionBeforeInsertDetail {
  mention: MentionEntity;
  item: MentionItem;
  query: string;
  /** The range of the trigger and query that will be replaced. */
  replace: MentionRange;
}
export interface MentionInsertDetail {
  mention: MentionEntity;
  item: MentionItem;
}
export interface MentionRemoveDetail {
  mention: MentionEntity;
  /** `edit`: the user changed the mention text; `external`: a bound text change; `invalid`: supplied mentions did not match the text. */
  reason: 'edit' | 'external' | 'invalid';
}
export interface MentionStateController {
  select(index: number): boolean;
  activate(index: number): void;
  close(): void;
}

/**
 * Observable suggestion state published by the `mentions` attribute. Read it from a view;
 * change it only through `select`, `activate` and `close`.
 */
export class MentionState {
  open = false;
  trigger: string | null = null;
  query = '';
  range: MentionRange | null = null;
  items: readonly MentionItem[] = [];
  activeIndex = -1;
  loading = false;
  error: unknown = null;
  insertionError = '';
  anchor: MentionAnchor | null = null;
  constructor(
    readonly listboxId: string,
    private readonly controller: MentionStateController,
  ) {}
  get activeId(): string | null {
    return this.open && this.activeIndex >= 0 ? this.optionId(this.activeIndex) : null;
  }
  optionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }
  /** Insert the item at `index`. Returns false when it is disabled, stale or cancelled. */
  select(index: number): boolean {
    return this.controller.select(index);
  }
  /** Move the active option, e.g. on pointer hover. Disabled items are ignored. */
  activate(index: number): void {
    this.controller.activate(index);
  }
  /** Close the list and keep the typed text. The same query will not reopen it. */
  close(): void {
    this.controller.close();
  }
}
