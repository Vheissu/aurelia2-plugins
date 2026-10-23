import { createFixture } from '@aurelia/testing';
import { AureliaUndoRedoConfiguration, History, HistoryFactory } from '../src/index';
const options = {
  clone: (value: { text: string }) => ({ ...value }),
  equals: (a: { text: string }, b: { text: string }) => a.text === b.text,
};
describe('undo and redo', () => {
  it('copies snapshots, removes abandoned branches, and limits history', () => {
    const initial = { text: 'a' };
    const h = new History(initial, { ...options, limit: 2 });
    initial.text = 'mutated';
    expect(h.value.text).toBe('a');
    h.record({ text: 'b' }, 'B');
    h.record({ text: 'c' }, 'C');
    h.record({ text: 'd' }, 'D');
    expect(h.length).toBe(3);
    expect(h.undo().text).toBe('c');
    expect(h.undo().text).toBe('b');
    expect(h.canUndo).toBe(false);
    expect(h.redoLabel).toBe('C');
    expect(h.redo().text).toBe('c');
    h.record({ text: 'e' });
    expect(h.canRedo).toBe(false);
    const value = h.value;
    value.text = 'no';
    expect(h.value.text).toBe('e');
  });
  it('groups a gesture into one transaction and supports rollback', () => {
    const h = new History({ text: 'a' }, options);
    h.begin('Drag');
    h.record({ text: 'b' });
    h.record({ text: 'c' });
    expect(h.canUndo).toBe(false);
    expect(() => h.begin()).toThrow();
    h.commit();
    expect(h.undoLabel).toBe('Drag');
    expect(h.undo().text).toBe('a');
    h.begin();
    h.record({ text: 'd' });
    expect(h.rollback().text).toBe('a');
    expect(h.canRedo).toBe(true);
    expect(() => h.commit()).toThrow();
    h.reset({ text: 'z' });
    expect(h.canRedo).toBe(false);
  });
  it('deduplicates equal values and validates bounds', () => {
    const h = new History({ text: 'a' }, options);
    h.record({ text: 'a' });
    expect(h.length).toBe(1);
    expect(() => new History(1, { clone: (x) => x, limit: 0 })).toThrow();
  });
  it('integrates keyboard history while preserving native text undo', async () => {
    const f = createFixture(
      '<section tabindex="0" history-keys="history.bind: history; apply.bind: apply"><input></section>',
      {
        history: undefined as any,
        result: '',
        apply: (_value: unknown) => {},
      },
      [AureliaUndoRedoConfiguration.configure({ limit: 3 })],
    );
    await f.startPromise;
    const h = f.container.get(HistoryFactory).create({ text: 'a' }, options);
    h.record({ text: 'b' });
    f.component.history = h;
    f.component.apply = (v) => {
      f.component.result = (v as any).text;
    };
    await new Promise((resolve) => setTimeout(resolve, 0));
    const section = f.appHost.querySelector('section')!;
    section.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }),
    );
    expect(f.component.result).toBe('a');
    section.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'z',
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(f.component.result).toBe('b');
    section
      .querySelector('input')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(h.value.text).toBe('b');
    await f.tearDown();
    section.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    expect(h.value.text).toBe('b');
  });
});

it('retains null as an uncommitted transaction value', () => {
  const history = new History<string | null>('initial', { clone: (value) => value });
  history.begin();
  history.record(null);
  expect(history.value).toBeNull();
  history.commit();
  expect(history.value).toBeNull();
  expect(history.undo()).toBe('initial');
});

it('keeps the cursor and transaction intact when a clone fails', () => {
  let fail = false;
  const history = new History(0, {
    clone: (value) => {
      if (fail) throw Error('clone');
      return value;
    },
  });
  history.record(1);
  fail = true;
  expect(() => history.undo()).toThrow('clone');
  fail = false;
  expect(history.value).toBe(1);
  history.begin('transaction');
  history.record(2);
  fail = true;
  expect(() => history.commit()).toThrow('clone');
  fail = false;
  expect(history.value).toBe(2);
  expect(history.canUndo).toBe(false);
  history.commit();
  expect(history.undo()).toBe(1);
});

it('preserves redo and open transactions when equality or cloning fails', () => {
  let equalsFails = false;
  let cloneFails = false;
  const h = new History(0, {
    clone: (n) => {
      if (cloneFails) throw Error('clone');
      return n;
    },
    equals: (a, b) => {
      if (equalsFails) throw Error('equals');
      return a === b;
    },
  });
  h.record(1);
  h.record(2);
  h.undo();
  h.begin();
  h.record(3);
  equalsFails = true;
  expect(() => h.commit()).toThrow('equals');
  equalsFails = false;
  expect(h.value).toBe(3);
  expect(h.rollback()).toBe(1);
  expect(h.canRedo).toBe(true);
  cloneFails = true;
  expect(() => h.redo()).toThrow();
  cloneFails = false;
  expect(h.value).toBe(1);
  expect(h.redo()).toBe(2);
});
