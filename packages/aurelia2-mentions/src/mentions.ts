import {
  bindable,
  BindingMode,
  customAttribute,
  IEffect,
  INode,
  IObservation,
  IObserverLocator,
  IPlatform,
  queueTask,
  resolve,
} from 'aurelia';
import { getCaretRect } from './caret.js';
import {
  IMentionsOptions,
  MentionState,
  type MentionBeforeInsertDetail,
  type MentionInsertDetail,
  type MentionItem,
  type MentionRemoveDetail,
  type MentionTrigger,
} from './state.js';
import {
  findTrigger,
  normalizeMentions,
  rebaseMentions,
  shiftMentions,
  type MentionEntity,
  type RebaseResult,
  type TriggerMatch,
} from './text.js';

type TextField = HTMLTextAreaElement | HTMLInputElement;
interface Rule {
  char: string;
  search: MentionTrigger['search'];
  format?: (item: MentionItem) => string;
  minLength: number;
  maxResults: number;
  maxQueryLength: number;
  allowSpaces: boolean;
  startOfLineOnly: boolean;
  debounce: number;
  appendSpace: boolean;
}
interface ActiveMatch extends TriggerMatch {
  rule: Rule;
}
interface Request {
  abort: AbortController;
  timer?: ReturnType<typeof setTimeout>;
}
interface ValueObserver {
  subscribe(subscriber: { handleChange(): void }): void;
  unsubscribe(subscriber: { handleChange(): void }): void;
}

const ARIA = [
  'role',
  'aria-autocomplete',
  'aria-expanded',
  'aria-controls',
  'aria-activedescendant',
];
const TEXT_TYPES = new Set(['text', 'search', 'url', 'tel', 'password']);
const INVALID_CHAR = /[\s\p{L}\p{N}\p{M}_]/u;
const ruleKeys = [
  'char',
  'search',
  'format',
  'minLength',
  'maxResults',
  'maxQueryLength',
  'allowSpaces',
  'startOfLineOnly',
  'debounce',
  'appendSpace',
] as const;
let nextId = 0;

const byStart = (a: MentionEntity, b: MentionEntity) => a.start - b.start;
const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as PromiseLike<unknown> | null)?.then === 'function';
function count(value: unknown, name: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || (value as number) < 0)
    throw new TypeError(`Mention trigger ${name} must be a non-negative integer`);
  return value as number;
}
function replaceRange(field: TextField, text: string, start: number, end: number): void {
  if (typeof field.setRangeText === 'function') field.setRangeText(text, start, end, 'end');
  else field.value = field.value.slice(0, start) + text + field.value.slice(end);
  field.setSelectionRange(start + text.length, start + text.length);
}

/**
 * Detects trigger characters in a `<textarea>` or text `<input>`, runs the trigger's search, and
 * inserts the chosen item as text while keeping `mentions` offsets in step with every edit.
 */
@customAttribute({ name: 'mentions', defaultProperty: 'triggers' })
export class MentionsAttribute {
  @bindable triggers: readonly MentionTrigger[] = [];
  @bindable({ mode: BindingMode.twoWay }) mentions: readonly MentionEntity[] = [];
  private readonly id = ++nextId;
  @bindable({ mode: BindingMode.fromView }) state: MentionState = new MentionState(
    `au-mentions-${this.id}-listbox`,
    {
      select: (index) => this.insert(index),
      activate: (index) => this.activate(index),
      close: () => this.close(true),
    },
  );
  private readonly host = resolve(INode) as TextField;
  private readonly options = resolve(IMentionsOptions);
  private readonly observerLocator = resolve(IObserverLocator);
  private readonly observation = resolve(IObservation);
  private readonly platform = resolve(IPlatform);
  private active = false;
  private composing = false;
  /** The text that `entities` currently describe. */
  private text = '';
  private entities: MentionEntity[] = [];
  private published: readonly MentionEntity[] | null = null;
  private pendingAdoption: { value: readonly unknown[] | null | undefined } | null = null;
  private rules: Rule[] = [];
  private match: ActiveMatch | null = null;
  private dismissed: string | null = null;
  private request: Request | null = null;
  /** True when `state.items` belong to the current query. */
  private fresh = false;
  private aria: Map<string, string | null> | null = null;
  private effect?: IEffect;
  private observer?: ValueObserver;
  private readonly valueSubscriber = { handleChange: () => this.reconcile() };

  constructor() {
    if (this.host.nodeName !== 'TEXTAREA' && this.host.nodeName !== 'INPUT')
      throw new Error('The mentions attribute requires a <textarea> or text <input>');
  }

  attached(): void {
    const host = this.host;
    if (host.nodeName === 'INPUT' && !TEXT_TYPES.has((host as HTMLInputElement).type))
      throw new Error(`The mentions attribute does not support <input type="${host.type}">`);
    this.rules = this.compile(this.triggers);
    this.active = true;
    this.text = host.value;
    this.pendingAdoption = { value: this.mentions };
    this.adopt();
    this.observer = this.observerLocator.getObserver(host, 'value') as unknown as ValueObserver;
    this.observer.subscribe(this.valueSubscriber);
    const document = host.ownerDocument;
    document.addEventListener('input', this.onDocumentInput, true);
    document.addEventListener('scroll', this.onLayout, true);
    document.defaultView?.addEventListener('resize', this.onLayout);
    const target: HTMLElement = host;
    target.addEventListener('input', this.onInput);
    target.addEventListener('keydown', this.onKeydown);
    target.addEventListener('keyup', this.onCaret);
    target.addEventListener('click', this.onCaret);
    target.addEventListener('blur', this.onBlur);
    target.addEventListener('compositionstart', this.onCompositionStart);
    target.addEventListener('compositionend', this.onCompositionEnd);
    this.aria = new Map(ARIA.map((name) => [name, host.getAttribute(name)]));
    if (host.nodeName === 'INPUT') host.setAttribute('role', 'combobox');
    host.setAttribute('aria-autocomplete', 'list');
    this.syncAria();
    this.effect = this.observation.watch(
      this,
      (vm) =>
        (Array.isArray(vm.triggers) ? vm.triggers : []).map((t) => ruleKeys.map((key) => t?.[key])),
      () => this.reloadTriggers(),
      { immediate: false },
    );
  }

  detaching(): void {
    const host = this.host;
    this.active = false;
    this.close();
    this.pendingAdoption = null;
    this.dismissed = null;
    this.composing = false;
    this.effect?.stop();
    this.effect = undefined;
    this.observer?.unsubscribe(this.valueSubscriber);
    this.observer = undefined;
    const document = host.ownerDocument;
    document.removeEventListener('input', this.onDocumentInput, true);
    document.removeEventListener('scroll', this.onLayout, true);
    document.defaultView?.removeEventListener('resize', this.onLayout);
    const target: HTMLElement = host;
    target.removeEventListener('input', this.onInput);
    target.removeEventListener('keydown', this.onKeydown);
    target.removeEventListener('keyup', this.onCaret);
    target.removeEventListener('click', this.onCaret);
    target.removeEventListener('blur', this.onBlur);
    target.removeEventListener('compositionstart', this.onCompositionStart);
    target.removeEventListener('compositionend', this.onCompositionEnd);
    for (const [name, value] of this.aria ?? []) this.setAttribute(name, value);
    this.aria = null;
  }

  triggersChanged(): void {
    this.reloadTriggers();
  }

  mentionsChanged(value: readonly MentionEntity[] | null | undefined): void {
    if (!this.active || value === this.published) return;
    // Text bound in the same turn reaches the field in a queued layout write, so validate
    // supplied mentions against the next observed text, or at the end of the turn.
    const pending = (this.pendingAdoption = { value });
    queueTask(() =>
      queueTask(() => {
        if (this.active && this.pendingAdoption === pending) {
          this.text = this.host.value;
          this.adopt();
        }
      }),
    );
  }

  private readonly onDocumentInput = (event: Event) => {
    if (this.active && (event.composedPath?.()[0] ?? event.target) === this.host)
      this.userEdit(event);
  };
  private readonly onInput = (event: Event) => {
    if (this.active) this.userEdit(event);
  };
  private readonly onCaret = (event: Event) => {
    if (!this.active || this.composing || (event as KeyboardEvent).isComposing) return;
    this.reconcile();
    this.evaluate();
  };
  private readonly onBlur = () => this.close();
  private readonly onLayout = () => {
    if (this.state.open) this.updateAnchor();
  };
  private readonly onCompositionStart = () => {
    this.composing = true;
  };
  private readonly onCompositionEnd = (event: Event) => {
    this.composing = false;
    if (this.active) this.userEdit(event);
  };
  private readonly onKeydown = (event: KeyboardEvent) => {
    if (
      !this.active ||
      event.defaultPrevented ||
      this.composing ||
      event.isComposing ||
      event.keyCode === 229
    )
      return;
    this.reconcile();
    const state = this.state;
    if (!state.open || event.altKey || event.ctrlKey || event.metaKey) return;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        this.move(event.key === 'ArrowDown' ? 1 : -1);
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close(true);
        return;
      case 'Enter':
      case 'Tab':
        if (event.shiftKey) {
          if (event.key === 'Tab') this.close(true);
          return;
        }
        if (this.fresh && state.activeIndex >= 0) {
          event.preventDefault();
          this.insert(state.activeIndex);
        } else if (event.key === 'Enter' && state.loading) event.preventDefault();
        return;
    }
  };

  private userEdit(event: Event): void {
    const host = this.host;
    const value = host.value;
    if (value !== this.text) {
      const previous = this.text;
      this.text = value;
      if (this.pendingAdoption) this.adopt();
      else {
        const caret =
          host.selectionStart !== null && host.selectionStart === host.selectionEnd
            ? host.selectionEnd!
            : undefined;
        this.apply(rebaseMentions(previous, value, this.entities, caret), 'edit');
      }
    }
    if (!this.composing && !(event as InputEvent).isComposing) this.evaluate();
  }

  /** Reconcile text changed by a binding or a direct DOM write. */
  private reconcile(): void {
    const value = this.host.value;
    if (!this.active || value === this.text) return;
    const previous = this.text;
    this.text = value;
    if (this.pendingAdoption) this.adopt();
    else this.apply(rebaseMentions(previous, value, this.entities), 'external');
    if (this.state.open) {
      this.close();
      if (this.focused()) this.evaluate();
    }
  }

  private adopt(): void {
    const value = this.pendingAdoption?.value;
    this.pendingAdoption = null;
    const result = normalizeMentions(this.text, value);
    this.entities = result.mentions;
    if (result.removed.length || result.invalid.length) this.publish();
    else this.published = value as readonly MentionEntity[];
    for (const mention of result.removed) this.emitRemove(mention, 'invalid');
  }

  private apply(result: RebaseResult<MentionEntity>, reason: MentionRemoveDetail['reason']): void {
    const previous = this.entities;
    this.entities = result.mentions;
    if (
      result.removed.length ||
      previous.length !== result.mentions.length ||
      result.mentions.some((m, i) => m.start !== previous[i].start || m.end !== previous[i].end)
    )
      this.publish();
    for (const mention of result.removed) this.emitRemove(mention, reason);
  }

  private publish(): void {
    const value = this.entities.map((mention) => ({ ...mention }));
    this.published = value;
    this.mentions = value;
  }

  private emitRemove(mention: MentionEntity, reason: MentionRemoveDetail['reason']): void {
    this.emit<MentionRemoveDetail>('mention-remove', { mention: { ...mention }, reason });
  }

  private emit<T>(name: string, detail: T, cancelable = false): boolean {
    return this.host.dispatchEvent(new CustomEvent(name, { bubbles: true, cancelable, detail }));
  }

  private compile(triggers: readonly MentionTrigger[] | null | undefined): Rule[] {
    if (triggers == null) return [];
    if (!Array.isArray(triggers)) throw new TypeError('Mention triggers must be an array');
    const chars = new Set<string>();
    return triggers.map((trigger: MentionTrigger) => {
      const char = trigger?.char;
      if (typeof char !== 'string' || char.length !== 1 || INVALID_CHAR.test(char))
        throw new TypeError(`Invalid mention trigger character: ${String(char)}`);
      if (chars.has(char)) throw new TypeError(`Duplicate mention trigger: ${char}`);
      if (typeof trigger.search !== 'function')
        throw new TypeError(`Mention trigger ${char} needs a search function`);
      if (trigger.format !== undefined && typeof trigger.format !== 'function')
        throw new TypeError(`Mention trigger ${char} format must be a function`);
      chars.add(char);
      const options = this.options;
      return {
        char,
        search: trigger.search,
        format: trigger.format,
        minLength: count(trigger.minLength, 'minLength', 0),
        maxResults: count(trigger.maxResults, 'maxResults', options.maxResults),
        maxQueryLength: count(trigger.maxQueryLength, 'maxQueryLength', options.maxQueryLength),
        debounce: count(trigger.debounce, 'debounce', options.debounce),
        allowSpaces: trigger.allowSpaces === true,
        startOfLineOnly: trigger.startOfLineOnly === true,
        appendSpace: trigger.appendSpace ?? options.appendSpace,
      };
    });
  }

  private reloadTriggers(): void {
    if (!this.active) return;
    const rules = this.compile(this.triggers);
    if (
      rules.length === this.rules.length &&
      rules.every((rule, i) => ruleKeys.every((key) => rule[key] === this.rules[i][key]))
    )
      return;
    this.rules = rules;
    this.close();
    if (this.focused()) this.evaluate();
  }

  private focused(): boolean {
    return (this.host.getRootNode() as Document | ShadowRoot).activeElement === this.host;
  }

  private evaluate(): void {
    const host = this.host;
    if (!this.active || this.composing) return;
    const caret = host.selectionEnd;
    if (
      host.disabled ||
      host.readOnly ||
      !this.focused() ||
      caret === null ||
      host.selectionStart !== caret
    ) {
      this.close();
      return;
    }
    const found = findTrigger(this.text, caret, this.rules, this.entities);
    if (!found) {
      this.dismissed = null;
      this.close();
      return;
    }
    if (`${found.start}:${found.char}:${found.query}` === this.dismissed) return;
    this.dismissed = null;
    const rule = this.rules[found.trigger];
    if (found.query.length < rule.minLength) {
      this.close();
      return;
    }
    const previous = this.match;
    this.match = { ...found, rule };
    this.state.range = { start: found.start, end: found.end };
    if (previous?.rule === rule && previous.query === found.query) this.updateAnchor();
    else this.search(found, rule, previous?.rule === rule);
  }

  private search(found: TriggerMatch, rule: Rule, keepItems: boolean): void {
    this.cancelRequest();
    const state = this.state;
    const abort = new AbortController();
    const request: Request = (this.request = { abort });
    state.open = true;
    state.trigger = rule.char;
    state.query = found.query;
    state.error = null;
    state.insertionError = '';
    state.loading = true;
    if (!keepItems) {
      if (state.items.length) state.items = [];
      state.activeIndex = -1;
    }
    this.fresh = false;
    this.updateAnchor();
    this.syncAria();
    const stale = () => !this.active || this.request !== request || abort.signal.aborted;
    const fail = (error: unknown) => {
      if (stale()) return;
      this.request = null;
      if (state.items.length) state.items = [];
      state.activeIndex = -1;
      state.loading = false;
      state.error = error ?? new Error('Mention search failed');
      this.fresh = true;
      this.syncAria();
    };
    const done = (items: unknown) => {
      if (stale()) return;
      if (!Array.isArray(items)) return fail(new TypeError('Mention search must return an array'));
      const list = (items as MentionItem[]).slice(0, rule.maxResults);
      if (
        !list.every(
          (item) =>
            item && typeof item.id === 'string' && item.id && typeof item.label === 'string',
        )
      )
        return fail(new TypeError('Mention items need a string id and label'));
      this.request = null;
      state.items = list;
      state.activeIndex = list.findIndex((item) => !item.disabled);
      state.loading = false;
      this.fresh = true;
      this.syncAria();
    };
    const run = () => {
      request.timer = undefined;
      if (stale()) return;
      let result: unknown;
      try {
        result = rule.search(found.query, abort.signal);
      } catch (error) {
        fail(error);
        return;
      }
      if (isThenable(result)) Promise.resolve(result).then(done, fail);
      else done(result);
    };
    if (rule.debounce > 0) request.timer = this.platform.setTimeout(run, rule.debounce);
    else run();
  }

  private cancelRequest(): void {
    const request = this.request;
    this.request = null;
    if (!request) return;
    if (request.timer !== undefined) this.platform.clearTimeout(request.timer);
    request.abort.abort();
  }

  private close(dismiss = false): void {
    if (dismiss && this.match)
      this.dismissed = `${this.match.start}:${this.match.char}:${this.match.query}`;
    this.cancelRequest();
    this.match = null;
    this.fresh = false;
    const state = this.state;
    state.open = false;
    state.trigger = null;
    state.query = '';
    state.range = null;
    if (state.items.length) state.items = [];
    state.activeIndex = -1;
    state.loading = false;
    state.error = null;
    state.insertionError = '';
    state.anchor = null;
    this.syncAria();
  }

  private move(delta: 1 | -1): void {
    const state = this.state;
    const items = state.items;
    let index = state.activeIndex;
    for (let step = 0; step < items.length; step++) {
      index =
        index < 0
          ? delta > 0
            ? 0
            : items.length - 1
          : (index + delta + items.length) % items.length;
      if (!items[index].disabled) {
        state.activeIndex = index;
        this.syncAria();
        return;
      }
    }
  }

  private activate(index: number): void {
    const state = this.state;
    const item = state.items[index];
    if (!this.active || !state.open || !item || item.disabled || state.activeIndex === index)
      return;
    state.activeIndex = index;
    this.syncAria();
  }

  private insert(index: number): boolean {
    const host = this.host;
    const state = this.state;
    const match = this.match;
    if (!this.active || this.composing || !state.open || !match || host.disabled || host.readOnly)
      return false;
    const item = state.items[index];
    if (!item || item.disabled) return false;
    this.reconcile();
    if (this.match !== match) return false;
    const rule = match.rule;
    const text = rule.format ? rule.format(item) : rule.char + item.label;
    if (typeof text !== 'string' || !text)
      throw new TypeError('Mention format must return a non-empty string');
    const { start, end } = match;
    const following = this.text[end];
    const inserted =
      rule.appendSpace && !(following !== undefined && /\s/.test(following)) ? `${text} ` : text;
    const mention: MentionEntity = {
      trigger: rule.char,
      id: item.id,
      label: item.label,
      text,
      start,
      end: start + text.length,
    };
    const items = state.items;
    const value = this.text;
    const caret = host.selectionEnd;
    const selectionStart = host.selectionStart;
    const detail: MentionBeforeInsertDetail = {
      mention: { ...mention },
      item,
      query: match.query,
      replace: { start, end },
    };
    if (!this.emit('mention-before-insert', detail, true)) return false;
    // The handler may have edited the text, moved the caret, closed the list or detached us.
    if (
      !this.active ||
      host.disabled ||
      host.readOnly ||
      item.disabled ||
      this.match !== match ||
      state.items !== items ||
      host.value !== value ||
      this.text !== value ||
      host.selectionEnd !== caret ||
      host.selectionStart !== selectionStart
    )
      return false;
    if (host.maxLength >= 0 && value.length - (end - start) + inserted.length > host.maxLength) {
      state.insertionError = 'This mention exceeds the field’s maximum length.';
      return false;
    }
    replaceRange(host, inserted, start, end);
    const shifted = shiftMentions(this.entities, {
      start,
      removedEnd: end,
      insertedEnd: start + inserted.length,
    });
    this.text = host.value;
    this.close();
    this.apply(
      { mentions: [...shifted.mentions, mention].sort(byStart), removed: shifted.removed },
      'edit',
    );
    const InputEventType = host.ownerDocument.defaultView?.InputEvent;
    host.dispatchEvent(
      InputEventType
        ? new InputEventType('input', {
            bubbles: true,
            inputType: 'insertReplacementText',
            data: inserted,
          })
        : new Event('input', { bubbles: true }),
    );
    this.emit<MentionInsertDetail>('mention-insert', { mention: { ...mention }, item });
    if (this.active && !this.focused()) host.focus();
    return true;
  }

  private updateAnchor(): void {
    if (this.state.open && this.match)
      this.state.anchor = getCaretRect(this.host, this.match.start);
  }

  private syncAria(): void {
    const aria = this.aria;
    if (!aria) return;
    const state = this.state;
    if (this.host.nodeName === 'INPUT')
      this.setAttribute('aria-expanded', state.open ? 'true' : 'false');
    this.setAttribute('aria-controls', state.open ? state.listboxId : aria.get('aria-controls')!);
    this.setAttribute(
      'aria-activedescendant',
      state.activeId ?? aria.get('aria-activedescendant')!,
    );
  }

  private setAttribute(name: string, value: string | null): void {
    if (value === null) this.host.removeAttribute(name);
    else this.host.setAttribute(name, value);
  }
}
