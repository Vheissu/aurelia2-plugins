import { createFixture } from '@aurelia/testing';
import { runTasks } from 'aurelia';
import {
  AureliaMentionsConfiguration,
  IMentionsOptions,
  type MentionEntity,
  type MentionItem,
  type MentionState,
  type MentionTrigger,
} from '../src/index';

type Field = HTMLTextAreaElement | HTMLInputElement;
const people: MentionItem[] = [
  { id: 'u1', label: 'Ana Smith', description: 'Design' },
  { id: 'u2', label: 'Andre Ng' },
  { id: 'u3', label: 'Anouk Disabled', disabled: true },
  { id: 'u4', label: 'Annie Lee' },
];
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
function type(field: Field, text: string, init: InputEventInit = {}) {
  field.focus();
  field.setRangeText(text, field.selectionStart!, field.selectionEnd!, 'end');
  field.dispatchEvent(
    new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText', ...init }),
  );
}
function caret(field: Field, index: number) {
  field.setSelectionRange(index, index);
  field.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}
function press(field: Field, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  field.dispatchEvent(event);
  field.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, ...init }));
  return event;
}
const options = (host: HTMLElement) =>
  Array.from(host.querySelectorAll<HTMLElement>('[role="option"]'));
const search = (items: MentionItem[] = people) =>
  jest.fn((query: string, _signal: AbortSignal) =>
    items.filter((item) => item.label.toLowerCase().startsWith(query.toLowerCase())),
  );

interface Model {
  text: string;
  mentions: MentionEntity[];
  state?: MentionState;
  triggers: MentionTrigger[];
}
const template = `<textarea value.bind="text" aria-describedby="hint"
  mentions="triggers.bind: triggers; mentions.two-way: mentions; state.from-view: state"></textarea>
<au-mention-list state.bind="state"></au-mention-list>`;
async function setup(model: Partial<Model> = {}, html = template, deps: unknown[] = []) {
  const vm: Model = { text: '', mentions: [], state: undefined, triggers: [], ...model };
  if (!model.triggers) vm.triggers = [{ char: '@', search: search() }];
  const f = createFixture(html, vm, [AureliaMentionsConfiguration, ...deps]);
  await f.startPromise;
  const field = f.appHost.querySelector<Field>('textarea,input')!;
  return { f, field, vm: f.component as unknown as Model };
}

describe('mentions attribute', () => {
  it('searches as the user types, renders options and tracks the active option', async () => {
    const find = search();
    const { f, field, vm } = await setup({ triggers: [{ char: '@', search: find }] });
    expect(field.getAttribute('role')).toBeNull();
    expect(field.getAttribute('aria-autocomplete')).toBe('list');
    type(field, 'Hi @an');
    expect(find).toHaveBeenLastCalledWith('an', expect.any(AbortSignal));
    expect(vm.state!.open).toBe(true);
    const listbox = f.appHost.querySelector('[role="listbox"]')!;
    expect(field.getAttribute('aria-controls')).toBe(listbox.id);
    expect(options(f.appHost).map((o) => o.textContent!.trim())).toEqual([
      'Ana Smith Design',
      'Andre Ng',
      'Anouk Disabled',
      'Annie Lee',
    ]);
    expect(field.getAttribute('aria-activedescendant')).toBe(options(f.appHost)[0].id);
    expect(press(field, 'ArrowDown').defaultPrevented).toBe(true);
    expect(field.getAttribute('aria-activedescendant')).toBe(options(f.appHost)[1].id);
    runTasks();
    expect(options(f.appHost).map((o) => o.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
    press(field, 'ArrowDown');
    expect(vm.state!.activeIndex).toBe(3);
    expect(options(f.appHost)[2].getAttribute('aria-disabled')).toBe('true');
    press(field, 'ArrowDown');
    expect(vm.state!.activeIndex).toBe(0);
    press(field, 'ArrowUp');
    expect(vm.state!.activeIndex).toBe(3);
    runTasks();
    expect(f.appHost.querySelector('[role="status"]')!.textContent).toBe('4 suggestions available');
    await f.stop(true);
  });

  it('inserts the formatted mention, moves the caret and publishes offsets through bindings', async () => {
    const { f, field, vm } = await setup({ text: 'Hi  thanks' });
    const inserted = jest.fn();
    const inputs = jest.fn();
    field.addEventListener('mention-insert', inserted);
    field.addEventListener('input', inputs);
    field.focus();
    field.setSelectionRange(3, 3);
    type(field, '@an');
    inputs.mockClear();
    expect(press(field, 'Enter').defaultPrevented).toBe(true);
    expect(field.value).toBe('Hi @Ana Smith thanks');
    expect(vm.text).toBe('Hi @Ana Smith thanks');
    expect(field.selectionStart).toBe(13);
    expect(field.selectionEnd).toBe(13);
    expect(inputs).toHaveBeenCalledTimes(1);
    const expected = {
      trigger: '@',
      id: 'u1',
      label: 'Ana Smith',
      text: '@Ana Smith',
      start: 3,
      end: 13,
    };
    expect(vm.mentions).toEqual([expected]);
    expect(inserted.mock.calls[0][0].detail).toEqual({ mention: expected, item: people[0] });
    expect(vm.state!.open).toBe(false);
    expect(field.hasAttribute('aria-controls')).toBe(false);
    expect(field.hasAttribute('aria-activedescendant')).toBe(false);
    expect(document.activeElement).toBe(field);
    await f.stop(true);
  });

  it('rebases offsets on user edits and removes a mention edited inside', async () => {
    const { f, field, vm } = await setup();
    const removed = jest.fn();
    field.addEventListener('mention-remove', removed);
    type(field, '@an');
    press(field, 'Enter');
    field.setSelectionRange(0, 0);
    type(field, 'Hey ');
    expect(vm.mentions[0]).toMatchObject({ start: 4, end: 14 });
    field.setSelectionRange(8, 8);
    type(field, 'x');
    expect(field.value).toBe('Hey @Anax Smith ');
    expect(vm.mentions).toEqual([]);
    expect(removed.mock.calls[0][0].detail).toMatchObject({
      reason: 'edit',
      mention: { id: 'u1', start: 4 },
    });
    await f.stop(true);
  });

  it('rebases on external bound edits and drops mentions the view model edits inside', async () => {
    const { f, field, vm } = await setup();
    const removed = jest.fn();
    field.addEventListener('mention-remove', removed);
    type(field, '@an');
    press(field, 'Enter');
    field.blur();
    vm.text = `Re: ${vm.text}`;
    runTasks();
    expect(field.value).toBe('Re: @Ana Smith ');
    expect(vm.mentions).toEqual([
      expect.objectContaining({ start: 4, end: 14, text: '@Ana Smith' }),
    ]);
    vm.text = 'Re: @Ana Smyth ';
    runTasks();
    expect(vm.mentions).toEqual([]);
    expect(removed).toHaveBeenCalledTimes(1);
    expect(removed.mock.calls[0][0].detail).toMatchObject({
      reason: 'external',
      mention: { start: 4 },
    });
    await f.stop(true);
  });

  it('adopts mentions supplied with their text in the same turn and rejects mismatches', async () => {
    const { f, field, vm } = await setup();
    const removed = jest.fn();
    field.addEventListener('mention-remove', removed);
    const saved = [
      { trigger: '@', id: 'u2', label: 'Andre Ng', text: '@Andre Ng', start: 6, end: 15 },
    ];
    vm.mentions = saved;
    vm.text = 'Hello @Andre Ng!';
    runTasks();
    expect(vm.mentions).toBe(saved);
    field.setSelectionRange(0, 0);
    type(field, '> ');
    expect(vm.mentions).toEqual([{ ...saved[0], start: 8, end: 17 }]);
    vm.text = 'Different text';
    vm.mentions = [{ trigger: '@', id: 'x', label: 'X', text: '@X', start: 0, end: 2 }];
    runTasks();
    expect(vm.mentions).toEqual([]);
    expect(removed.mock.calls.at(-1)![0].detail).toMatchObject({
      reason: 'invalid',
      mention: { id: 'x' },
    });
    await f.stop(true);
  });

  it('ignores a slow earlier response, aborts superseded searches and aborts on detach', async () => {
    const calls: {
      query: string;
      signal: AbortSignal;
      result: ReturnType<typeof deferred<MentionItem[]>>;
    }[] = [];
    const slow: MentionTrigger = {
      char: '@',
      search: (query, signal) => {
        const result = deferred<MentionItem[]>();
        calls.push({ query, signal, result });
        return result.promise;
      },
    };
    const { f, field, vm } = await setup({ triggers: [slow] });
    type(field, '@a');
    type(field, 'n');
    expect(calls.map((c) => c.query)).toEqual(['a', 'an']);
    expect(calls[0].signal.aborted).toBe(true);
    expect(vm.state!.loading).toBe(true);
    calls[1].result.resolve([people[1]]);
    await tick();
    calls[0].result.resolve([people[0]]);
    await tick();
    expect(vm.state!.items).toEqual([people[1]]);
    expect(vm.state!.loading).toBe(false);
    type(field, 'd');
    const pending = calls[2];
    await f.stop(true);
    expect(pending.signal.aborted).toBe(true);
    pending.result.resolve([people[0]]);
    await tick();
    expect(vm.state!.open).toBe(false);
    expect(vm.state!.items).toEqual([]);
  });

  it('does not insert stale results with Enter while a newer search is loading', async () => {
    const later = deferred<MentionItem[]>();
    let first = true;
    const trigger: MentionTrigger = {
      char: '@',
      search: () => {
        if (first) {
          first = false;
          return people.filter((p) => p.label.startsWith('A'));
        }
        return later.promise;
      },
    };
    const { f, field, vm } = await setup({ triggers: [trigger] });
    type(field, '@a');
    expect(vm.state!.items.length).toBe(4);
    type(field, 'nn');
    expect(vm.state!.loading).toBe(true);
    expect(press(field, 'Enter').defaultPrevented).toBe(true);
    expect(field.value).toBe('@ann');
    later.resolve([people[3]]);
    await tick();
    press(field, 'Enter');
    expect(field.value).toBe('@Annie Lee ');
    await f.stop(true);
  });

  it('passes keys through during composition and checks triggers after it ends', async () => {
    const find = search();
    const { f, field, vm } = await setup({ triggers: [{ char: '@', search: find }] });
    type(field, '@an');
    expect(vm.state!.open).toBe(true);
    field.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    expect(press(field, 'ArrowDown').defaultPrevented).toBe(false);
    expect(press(field, 'Enter', { isComposing: true }).defaultPrevented).toBe(false);
    expect(vm.state!.activeIndex).toBe(0);
    find.mockClear();
    type(field, 'に', { isComposing: true });
    expect(find).not.toHaveBeenCalled();
    field.setRangeText('', field.value.length - 1, field.value.length, 'end');
    type(field, 'd', { isComposing: true });
    field.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'd' }));
    expect(find).toHaveBeenCalledWith('and', expect.any(AbortSignal));
    expect(press(field, 'Enter', { keyCode: 229 } as KeyboardEventInit).defaultPrevented).toBe(
      false,
    );
    expect(field.value).toBe('@and');
    await f.stop(true);
  });

  it('closes on Escape, keeps the text, and leaves Enter and Tab alone while closed', async () => {
    const find = search();
    const { f, field, vm } = await setup({ triggers: [{ char: '@', search: find }] });
    const outer = jest.fn();
    f.appHost.addEventListener('keydown', outer);
    type(field, '@an');
    const escape = press(field, 'Escape');
    expect(escape.defaultPrevented).toBe(true);
    expect(outer).not.toHaveBeenCalled();
    expect(vm.state!.open).toBe(false);
    expect(field.value).toBe('@an');
    caret(field, 3);
    expect(vm.state!.open).toBe(false);
    expect(press(field, 'Enter').defaultPrevented).toBe(false);
    expect(press(field, 'Tab').defaultPrevented).toBe(false);
    type(field, 'd');
    expect(vm.state!.open).toBe(true);
    expect(find).toHaveBeenLastCalledWith('and', expect.any(AbortSignal));
    type(field, ' ');
    expect(vm.state!.open).toBe(false);
    expect(press(field, 'Enter').defaultPrevented).toBe(false);
    await f.stop(true);
  });

  it('lets mention-before-insert cancel the insert and skips disabled items', async () => {
    const { f, field, vm } = await setup();
    const veto = (event: Event) => event.preventDefault();
    field.addEventListener('mention-before-insert', veto);
    type(field, '@ano');
    expect(vm.state!.items).toEqual([people[2]]);
    expect(vm.state!.activeIndex).toBe(-1);
    expect(press(field, 'Enter').defaultPrevented).toBe(false);
    expect(vm.state!.select(0)).toBe(false);
    field.value = '@an';
    field.setSelectionRange(3, 3);
    type(field, '');
    expect(vm.state!.select(0)).toBe(false);
    expect(field.value).toBe('@an');
    expect(vm.state!.open).toBe(true);
    field.removeEventListener('mention-before-insert', veto);
    expect(vm.state!.select(0)).toBe(true);
    expect(field.value).toBe('@Ana Smith ');
    await f.stop(true);
  });

  it('abandons an insert when the before-insert handler edits the text or moves the caret', async () => {
    const { f, field, vm } = await setup();
    let edit = () => field.setRangeText('x', field.value.length, field.value.length, 'preserve');
    field.addEventListener('mention-before-insert', () => edit());
    type(field, '@an');
    expect(field.selectionEnd).toBe(3);
    expect(vm.state!.select(1)).toBe(false);
    expect(field.value).toBe('@anx');
    expect(field.selectionEnd).toBe(3);
    expect(vm.mentions).toEqual([]);
    edit = () => field.setSelectionRange(1, 1);
    caret(field, 3);
    expect(vm.state!.open).toBe(true);
    expect(vm.state!.select(0)).toBe(false);
    expect(field.value).toBe('@anx');
    expect(vm.mentions).toEqual([]);
    await f.stop(true);
  });

  it('keeps focus in the field for pointer selection', async () => {
    const { f, field, vm } = await setup();
    type(field, '@an');
    const option = options(f.appHost)[1];
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    const pointer = new Event('pointerdown', { bubbles: true, cancelable: true });
    option.dispatchEvent(pointer);
    option.dispatchEvent(down);
    expect(pointer.defaultPrevented).toBe(true);
    expect(down.defaultPrevented).toBe(true);
    option.dispatchEvent(new Event('pointermove', { bubbles: true }));
    expect(vm.state!.activeIndex).toBe(1);
    options(f.appHost)[2].dispatchEvent(new Event('pointermove', { bubbles: true }));
    expect(vm.state!.activeIndex).toBe(1);
    option.click();
    expect(field.value).toBe('@Andre Ng ');
    expect(document.activeElement).toBe(field);
    await f.stop(true);
  });

  it('stores search failures in state and renders an error message', async () => {
    const failing: MentionTrigger = {
      char: '@',
      search: () => Promise.reject(new Error('offline')),
    };
    const throwing: MentionTrigger = {
      char: '#',
      search: () => {
        throw new Error('bad');
      },
    };
    const { f, field, vm } = await setup({ triggers: [failing, throwing] });
    type(field, '@a');
    await tick();
    expect(vm.state!.error).toEqual(new Error('offline'));
    expect(vm.state!.loading).toBe(false);
    runTasks();
    expect(f.appHost.querySelector('.au-mention-list__message')!.textContent).toBe(
      'Suggestions unavailable',
    );
    expect(f.appHost.querySelector('[role="status"]')!.textContent).toBe('Suggestions unavailable');
    expect(press(field, 'Enter').defaultPrevented).toBe(false);
    type(field, ' #1');
    expect((vm.state!.error as Error).message).toBe('bad');
    type(field, ' @');
    vm.triggers = [{ char: '@', search: () => [{ id: 1 } as unknown as MentionItem] }];
    expect((vm.state!.error as Error).message).toMatch(/string id and label/);
    await f.stop(true);
  });

  it('supports several triggers with their own search, format and start-of-line rule', async () => {
    const tickets = jest.fn(() => [{ id: 'T-12', label: 'Login fails' }]);
    const commands = jest.fn(() => [{ id: 'giphy', label: 'giphy' }]);
    const { f, field, vm } = await setup({
      triggers: [
        { char: '@', search: search() },
        { char: '#', search: tickets, format: (item) => `#${item.id}` },
        { char: '/', search: commands, startOfLineOnly: true, appendSpace: false },
      ],
    });
    type(field, 'see #lo');
    expect(tickets).toHaveBeenCalledWith('lo', expect.any(AbortSignal));
    press(field, 'Enter');
    expect(field.value).toBe('see #T-12 ');
    type(field, '/gi');
    expect(commands).not.toHaveBeenCalled();
    expect(vm.state!.open).toBe(false);
    type(field, '\n/gi');
    expect(commands).toHaveBeenCalledWith('gi', expect.any(AbortSignal));
    press(field, 'Tab');
    expect(field.value).toBe('see #T-12 /gi\n/giphy');
    expect(vm.mentions.map((m) => [m.trigger, m.id, m.text])).toEqual([
      ['#', 'T-12', '#T-12'],
      ['/', 'giphy', '/giphy'],
    ]);
    await f.stop(true);
  });

  it('uses the combobox pattern on an input and restores original ARIA on detach', async () => {
    const html = `<template><input if.bind="show" type="search" value.bind="text" role="searchbox" aria-controls="other" aria-autocomplete="none"
      mentions="triggers.bind: triggers; state.from-view: state"><au-mention-list state.bind="state"></au-mention-list></template>`;
    const f = createFixture(
      html,
      {
        show: true,
        text: '',
        state: undefined as MentionState | undefined,
        triggers: [{ char: '@', search: search() }],
      },
      [AureliaMentionsConfiguration],
    );
    await f.startPromise;
    const field = f.appHost.querySelector('input')!;
    expect(field.getAttribute('role')).toBe('combobox');
    expect(field.getAttribute('aria-expanded')).toBe('false');
    expect(field.getAttribute('aria-controls')).toBe('other');
    type(field, '@an');
    expect(field.getAttribute('aria-expanded')).toBe('true');
    expect(field.getAttribute('aria-controls')).toBe(f.component.state!.listboxId);
    press(field, 'Enter');
    expect(f.component.text).toBe('@Ana Smith ');
    type(field, '@an');
    f.component.show = false;
    runTasks();
    expect(field.getAttribute('role')).toBe('searchbox');
    expect(field.getAttribute('aria-controls')).toBe('other');
    expect(field.getAttribute('aria-autocomplete')).toBe('none');
    expect(field.hasAttribute('aria-expanded')).toBe(false);
    expect(field.hasAttribute('aria-activedescendant')).toBe(false);
    await f.stop(true);
  });

  it('restarts cleanly without duplicate listeners', async () => {
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const add = jest.spyOn(document, 'addEventListener').mockImplementation(function (
      this: Document,
      type,
      listener,
      options,
    ) {
      if (options === true && (type === 'input' || type === 'scroll')) listeners.add(listener!);
      return EventTarget.prototype.addEventListener.call(this, type, listener, options);
    });
    const remove = jest.spyOn(document, 'removeEventListener').mockImplementation(function (
      this: Document,
      type,
      listener,
      options,
    ) {
      if (options === true && (type === 'input' || type === 'scroll')) listeners.delete(listener!);
      return EventTarget.prototype.removeEventListener.call(this, type, listener, options);
    });
    const find = search();
    const { f, field, vm } = await setup({ triggers: [{ char: '@', search: find }] });
    expect(listeners.size).toBe(2);
    await f.au.stop();
    expect(listeners.size).toBe(0);
    expect(field.hasAttribute('aria-autocomplete')).toBe(false);
    type(field, '@a');
    expect(find).not.toHaveBeenCalled();
    await f.au.start();
    const restarted = f.appHost.querySelector('textarea')!;
    expect(restarted.getAttribute('aria-autocomplete')).toBe('list');
    restarted.value = '';
    type(restarted, '@an');
    expect(find).toHaveBeenCalledTimes(1);
    const inserted = jest.fn();
    restarted.addEventListener('mention-insert', inserted);
    press(restarted, 'Enter');
    expect(inserted).toHaveBeenCalledTimes(1);
    expect(vm.mentions).toHaveLength(1);
    expect(listeners.size).toBe(2);
    await f.stop(true);
    expect(listeners.size).toBe(0);
    add.mockRestore();
    remove.mockRestore();
  });

  it('aborts and re-runs the open query when triggers are replaced or mutated', async () => {
    const first = deferred<MentionItem[]>();
    let signal!: AbortSignal;
    const old: MentionTrigger = {
      char: '@',
      search: (_q, s) => {
        signal = s;
        return first.promise;
      },
    };
    const replacement = search([people[1]]);
    const { f, field, vm } = await setup({ triggers: [old] });
    type(field, '@an');
    vm.triggers = [{ char: '@', search: replacement }];
    expect(signal.aborted).toBe(true);
    expect(replacement).toHaveBeenCalledWith('an', expect.any(AbortSignal));
    first.resolve([people[0]]);
    await tick();
    expect(vm.state!.items).toEqual([people[1]]);
    const tickets = jest.fn(() => [{ id: 'T-1', label: 'Bug' }]);
    vm.triggers.push({ char: '#', search: tickets });
    runTasks();
    type(field, ' #b');
    expect(tickets).toHaveBeenCalledWith('b', expect.any(AbortSignal));
    expect(() => {
      vm.triggers = [
        { char: '@', search: replacement },
        { char: '@', search: replacement },
      ];
    }).toThrow(/Duplicate mention trigger/);
    await f.stop(true);
  });

  it('applies minLength, maxResults and debounce', async () => {
    const find = search();
    const { f, field, vm } = await setup({
      triggers: [{ char: '@', search: find, minLength: 2, maxResults: 2, debounce: 20 }],
    });
    type(field, '@a');
    expect(vm.state!.open).toBe(false);
    type(field, 'n');
    type(field, 'n');
    expect(vm.state!.loading).toBe(true);
    expect(find).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(find).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalledWith('ann', expect.any(AbortSignal));
    field.setRangeText('', 3, 4, 'end');
    type(field, '');
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(find).toHaveBeenLastCalledWith('an', expect.any(AbortSignal));
    expect(vm.state!.items).toEqual([people[0], people[1]]);
    await f.stop(true);
  });

  it('projects item templates through au-slot with $host', async () => {
    const html = `<textarea value.bind="text" mentions="triggers.bind: triggers; state.from-view: state"></textarea>
<au-mention-list state.bind="state" label="People"><template au-slot="item"><b>\${$host.item.label}</b><i if.bind="$host.active">*</i></template></au-mention-list>`;
    const { f, field } = await setup({}, html);
    type(field, '@an');
    expect(f.appHost.querySelector('[role="listbox"]')!.getAttribute('aria-label')).toBe('People');
    const texts = () => options(f.appHost).map((o) => o.textContent);
    expect(texts()).toEqual(['Ana Smith*', 'Andre Ng', 'Anouk Disabled', 'Annie Lee']);
    expect(options(f.appHost)[0].querySelector('b')!.innerHTML).toBe('Ana Smith');
    press(field, 'ArrowDown');
    runTasks();
    expect(texts()).toEqual(['Ana Smith', 'Andre Ng*', 'Anouk Disabled', 'Annie Lee']);
    await f.stop(true);
  });

  it('renders labels as text, never as HTML', async () => {
    const hostile = [{ id: 'x', label: '<img src=x onerror=alert(1)>' }];
    const { f, field } = await setup({ triggers: [{ char: '@', search: () => hostile }] });
    type(field, '@');
    expect(f.appHost.querySelector('img')).toBeNull();
    expect(options(f.appHost)[0].textContent!.trim()).toBe(hostile[0].label);
    await f.stop(true);
  });

  it('positions the popup at the trigger and flips above when there is no room below', async () => {
    const { f, field, vm } = await setup();
    field.getBoundingClientRect = () =>
      ({ top: 700, left: 20, right: 320, bottom: 760, width: 300, height: 60 }) as DOMRect;
    type(field, '@an');
    runTasks();
    const popup = f.appHost.querySelector<HTMLElement>('.au-mention-list')!;
    expect(vm.state!.anchor).toMatchObject({ top: expect.any(Number), left: expect.any(Number) });
    expect(popup.style.position).toBe('fixed');
    expect(popup.dataset.placement).toBe('below');
    Object.defineProperty(popup, 'offsetHeight', { value: 200, configurable: true });
    vm.state!.anchor = { ...vm.state!.anchor! };
    runTasks();
    expect(popup.dataset.placement).toBe('above');
    expect(parseFloat(popup.style.top)).toBeLessThan(700);
    await f.stop(true);
  });

  it('copies configuration per container and validates it', async () => {
    const configured = AureliaMentionsConfiguration.configure({
      maxResults: 1,
      appendSpace: false,
    });
    const f = createFixture(
      template,
      {
        text: '',
        mentions: [] as MentionEntity[],
        state: undefined as MentionState | undefined,
        triggers: [{ char: '@', search: search() }],
      },
      [configured],
    );
    await f.startPromise;
    const options = f.container.get(IMentionsOptions);
    expect(Object.isFrozen(options)).toBe(true);
    const field = f.appHost.querySelector('textarea')!;
    type(field, '@an');
    expect(f.component.state!.items).toHaveLength(1);
    press(field, 'Enter');
    expect(field.value).toBe('@Ana Smith');
    await f.stop(true);
    expect(() => AureliaMentionsConfiguration.configure({ maxResults: -1 })).toThrow(TypeError);
    expect(() =>
      AureliaMentionsConfiguration.configure({ appendSpace: 'yes' as unknown as boolean }),
    ).toThrow(TypeError);
    const defaults = createFixture('<div></div>', {}, [AureliaMentionsConfiguration]);
    await defaults.startPromise;
    expect(defaults.container.get(IMentionsOptions).maxResults).toBe(10);
    await defaults.stop(true);
  });

  it('rejects unsupported hosts', () => {
    expect(() =>
      createFixture('<div mentions.bind="triggers"></div>', { triggers: [] }, [
        AureliaMentionsConfiguration,
      ]),
    ).toThrow(/requires a <textarea>/);
  });
});
