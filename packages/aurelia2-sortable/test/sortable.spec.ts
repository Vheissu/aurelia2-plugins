import { createFixture } from '@aurelia/testing';
import { runTasks } from 'aurelia';
import { AureliaSortableConfiguration, moveItem } from '../src/index';
const key = (el: Element, key: string) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
async function setup() {
  const f = createFixture(
    '<au-sortable items.two-way="items" component.ref="view"></au-sortable>',
    { items: ['A', 'B', 'C'], view: undefined as any },
    [AureliaSortableConfiguration],
  );
  await f.startPromise;
  return f;
}
describe('sortable lists', () => {
  it('moves immutably and rejects invalid indices', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(items).toEqual(['a', 'b', 'c']);
    for (const [a, b] of [
      [-1, 0],
      [0, 3],
      [0.5, 1],
    ])
      expect(() => moveItem(items, a, b)).toThrow(RangeError);
  });
  it('previews keyboard moves, commits on drop and emits the original/new positions', async () => {
    const f = await setup();
    const change = jest.fn();
    f.appHost.addEventListener('sortable-change', change);
    const first = f.appHost.querySelector('button')!;
    key(first, ' ');
    key(first, 'ArrowDown');
    runTasks();
    expect(f.component.items).toEqual(['A', 'B', 'C']);
    expect(Array.from(f.appHost.querySelectorAll('button')).map((x) => x.textContent)).toEqual([
      'B',
      'A',
      'C',
    ]);
    key(first, 'Enter');
    runTasks();
    expect(f.component.items).toEqual(['B', 'A', 'C']);
    expect(change.mock.calls[0][0].detail).toMatchObject({ from: 0, to: 1, item: 'A' });
    await f.tearDown();
  });
  it('restores the original order on Escape and supports Home/End', async () => {
    const f = await setup();
    const first = f.appHost.querySelector('button')!;
    key(first, ' ');
    key(first, 'End');
    runTasks();
    key(first, 'Escape');
    runTasks();
    expect(Array.from(f.appHost.querySelectorAll('button')).map((x) => x.textContent)).toEqual([
      'A',
      'B',
      'C',
    ]);
    expect(f.component.items).toEqual(['A', 'B', 'C']);
    await f.tearDown();
  });
  it('lets the application veto a move', async () => {
    const f = await setup();
    f.appHost.addEventListener('sortable-before-change', (e) => e.preventDefault());
    const first = f.appHost.querySelector('button')!;
    key(first, ' ');
    key(first, 'End');
    key(first, 'Enter');
    runTasks();
    expect(f.component.items).toEqual(['A', 'B', 'C']);
    await f.tearDown();
  });
  it('cancels if external data changes during a gesture', async () => {
    const f = await setup();
    const first = f.appHost.querySelector('button')!;
    key(first, ' ');
    key(first, 'End');
    f.component.items = ['X', 'Y'];
    runTasks();
    expect(f.component.view.grabbed).toBe(-1);
    expect(f.appHost.querySelectorAll('button')).toHaveLength(2);
    await f.tearDown();
  });
  it('supports native drag/drop and ignores unrelated payloads', async () => {
    const f = await setup();
    const data = new Map();
    const transfer = {
      setData: (k, v) => data.set(k, v),
      getData: (k) => data.get(k),
      effectAllowed: '',
      dropEffect: '',
    };
    const event = (type: string, target: Element) => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(e, 'dataTransfer', { value: transfer });
      target.dispatchEvent(e);
      return e;
    };
    event('dragstart', f.appHost.querySelector('button')!);
    expect(event('dragover', f.appHost.querySelectorAll('li')[2]).defaultPrevented).toBe(true);
    event('drop', f.appHost.querySelectorAll('li')[2]);
    runTasks();
    expect(f.component.items).toEqual(['B', 'C', 'A']);
    await f.tearDown();
  });
  it('honours disabled state and validates unique keys', async () => {
    const f = await setup();
    f.component.view.disabled = true;
    runTasks();
    key(f.appHost.querySelector('button')!, ' ');
    expect(f.component.view.grabbed).toBe(-1);
    expect(() => {
      f.component.view.items = ['A', 'A'];
      f.component.view.itemsChanged();
    }).toThrow('unique');
    f.component.view.items = [];
    await f.tearDown();
  });
});

it('observes in-place additions and label edits without retaining old collection subscriptions', async () => {
  const f = createFixture(
    '<au-sortable items.two-way="items" component.ref="view"></au-sortable>',
    { items: [{ id: 'a', label: 'A' }], view: undefined as any },
    [AureliaSortableConfiguration],
  );
  await f.startPromise;
  f.component.items.push({ id: 'b', label: 'B' });
  runTasks();
  expect(f.appHost.querySelectorAll('button')).toHaveLength(2);
  f.component.items[0].label = 'Updated';
  runTasks();
  expect(f.appHost.querySelector('button')!.textContent).toBe('Updated');
  const old = f.component.items;
  f.component.items = [{ id: 'c', label: 'C' }];
  runTasks();
  old.push({ id: 'd', label: 'D' });
  runTasks();
  expect(f.appHost.querySelectorAll('button')).toHaveLength(1);
  await f.tearDown();
});

it('does not commit stale rows when a before-change handler replaces the source', async () => {
  const f = await setup();
  f.appHost.addEventListener('sortable-before-change', () => {
    f.component.items = ['X', 'Y'];
    runTasks();
  });
  const first = f.appHost.querySelector('button')!;
  key(first, ' ');
  key(first, 'ArrowDown');
  key(first, 'Enter');
  runTasks();
  try {
    expect(f.component.items).toEqual(['X', 'Y']);
  } finally {
    await f.tearDown();
  }
});

it('cancels keyboard previews on Tab and does not emit a no-op reorder', async () => {
  const f = await setup();
  const changed = jest.fn();
  f.appHost.addEventListener('sortable-change', changed);
  const first = f.appHost.querySelector('button')!;
  try {
    key(first, ' ');
    key(first, 'Enter');
    expect(changed).not.toHaveBeenCalled();
    key(first, ' ');
    key(first, 'ArrowDown');
    key(first, 'Tab');
    runTasks();
    expect(f.component.view.grabbed).toBe(-1);
    expect(f.component.items).toEqual(['A', 'B', 'C']);
  } finally {
    await f.tearDown();
  }
});
it('supports static boolean syntax without treating disabled="false" as true', async () => {
  const f = createFixture(
    '<au-sortable items.bind="items" disabled component.ref="disabled"></au-sortable><au-sortable items.bind="items" disabled="false" component.ref="enabled"></au-sortable>',
    { items: ['A'], disabled: undefined as any, enabled: undefined as any },
    [AureliaSortableConfiguration],
  );
  await f.startPromise;
  try {
    expect(f.component.disabled.disabled).toBe(true);
    expect(f.component.enabled.disabled).toBe(false);
  } finally {
    await f.tearDown();
  }
});

it('provides touch-friendly move controls through the same cancellable commit path', async () => {
  const f = createFixture(
    '<au-sortable items.two-way="items" controls></au-sortable>',
    { items: ['A', 'B', 'C'] },
    [AureliaSortableConfiguration],
  );
  await f.startPromise;
  try {
    const down = f.appHost.querySelector<HTMLButtonElement>('[aria-label="Move A down"]')!;
    down.click();
    runTasks();
    expect(f.component.items).toEqual(['B', 'A', 'C']);
    expect(f.appHost.querySelector<HTMLButtonElement>('[aria-label="Move B up"]')!.disabled).toBe(
      true,
    );
    f.appHost.addEventListener('sortable-before-change', (e) => e.preventDefault());
    f.appHost.querySelector<HTMLButtonElement>('[aria-label="Move A up"]')!.click();
    runTasks();
    expect(f.component.items).toEqual(['B', 'A', 'C']);
  } finally {
    await f.tearDown();
  }
});

it('preserves same-turn in-place edits made by a before-change handler', async () => {
  const f = await setup();
  const changed = jest.fn();
  f.appHost.addEventListener('sortable-change', changed);
  f.appHost.addEventListener('sortable-before-change', () => f.component.items.push('D'));
  const first = f.appHost.querySelector('button')!;
  try {
    key(first, ' ');
    key(first, 'ArrowDown');
    key(first, 'Enter');
    runTasks();
    expect(f.component.items).toEqual(['A', 'B', 'C', 'D']);
    expect(changed).not.toHaveBeenCalled();
  } finally {
    await f.tearDown();
  }
});

it('isolates the proposed event payload from the committed order and metadata', async () => {
  const f = await setup();
  const changed = jest.fn();
  f.appHost.addEventListener('sortable-change', changed);
  f.appHost.addEventListener('sortable-before-change', (event: CustomEvent) => {
    event.detail.items.splice(0);
    event.detail.from = 99;
  });
  try {
    expect(f.component.view.move(0, 1)).toBe(true);
    runTasks();
    expect(f.component.items).toEqual(['B', 'A', 'C']);
    expect(changed.mock.calls[0][0].detail).toEqual({
      items: ['B', 'A', 'C'], item: 'A', from: 0, to: 1,
    });
  } finally {
    await f.tearDown();
  }
});

it('retains focus on the grabbed item when keyboard previews move its DOM node', async () => {
  const f = await setup();
  const grabbed = f.appHost.querySelectorAll('button')[1];
  try {
    grabbed.focus();
    key(grabbed, ' ');
    key(grabbed, 'ArrowUp');
    runTasks();
    expect(document.activeElement).toBe(grabbed);
    key(document.activeElement!, 'End');
    runTasks();
    expect(document.activeElement).toBe(grabbed);
    key(document.activeElement!, 'Enter');
    runTasks();
    expect(f.component.items).toEqual(['A', 'C', 'B']);
    expect(document.activeElement).toBe(grabbed);
  } finally {
    await f.tearDown();
  }
});

it('restores focus after cancelling a preview without reclaiming focus moved elsewhere', async () => {
  const f = await setup();
  const grabbed = f.appHost.querySelectorAll('button')[1];
  const outside = document.createElement('button');
  document.body.append(outside);
  try {
    grabbed.focus();
    key(grabbed, ' ');
    key(grabbed, 'ArrowUp');
    runTasks();
    key(grabbed, 'Escape');
    runTasks();
    expect(document.activeElement).toBe(grabbed);
    expect(f.component.items).toEqual(['A', 'B', 'C']);
    key(grabbed, ' ');
    key(grabbed, 'End');
    outside.focus();
    runTasks();
    expect(document.activeElement).toBe(outside);
  } finally {
    outside.remove();
    await f.tearDown();
  }
});

it('cancels a keyboard preview after focus leaves the sortable list', async () => {
  const f = createFixture('<button id="outside">Outside</button><au-sortable items.two-way="items" component.ref="view"></au-sortable>', {
    items:['A','B','C'], view: undefined as any,
  }, [AureliaSortableConfiguration]);
  await f.startPromise;
  const key = (element: Element, key: string) => element.dispatchEvent(new KeyboardEvent('keydown', {key,bubbles:true,cancelable:true}));
  try {
    const first = f.appHost.querySelector<HTMLButtonElement>('[data-sort-key="A"]')!;
    first.focus(); key(first,' '); key(first,'End'); runTasks();
    f.appHost.querySelector<HTMLButtonElement>('#outside')!.focus(); runTasks();
    expect(f.component.view.grabbed).toBe(-1);
    expect(f.component.items).toEqual(['A','B','C']);
  } finally { await f.tearDown(); }
});

it('never commits a preview from a key received on a different item', async () => {
  const f = await setup();
  const changed = jest.fn();
  f.appHost.addEventListener('sortable-change', changed);
  try {
    const a = f.appHost.querySelector<HTMLButtonElement>('[data-sort-key="A"]')!;
    a.focus(); key(a, ' '); key(a, 'End'); runTasks();
    const b = f.appHost.querySelector<HTMLButtonElement>('[data-sort-key="B"]')!;
    b.focus(); key(b, 'Enter'); runTasks();
    expect(f.component.items).toEqual(['A', 'B', 'C']);
    expect(changed).not.toHaveBeenCalled();
    expect(f.component.view.grabbed).toBe(-1);
  } finally { await f.tearDown(); }
});

it('cancels keyboard preview on pointer down before starting a native drag', async () => {
  const f = await setup();
  try {
    const a = f.appHost.querySelector<HTMLButtonElement>('[data-sort-key="A"]')!;
    a.focus(); key(a, ' '); key(a, 'End'); runTasks();
    const b = f.appHost.querySelector<HTMLButtonElement>('[data-sort-key="B"]')!;
    b.dispatchEvent(new Event('pointerdown', {bubbles:true})); runTasks();
    expect(f.component.view.grabbed).toBe(-1);
    const data = new Map();
    const transfer = {setData:(key,value)=>data.set(key,value),getData:key=>data.get(key)};
    const start = new Event('dragstart', {bubbles:true,cancelable:true});
    Object.defineProperty(start,'dataTransfer',{value:transfer}); b.dispatchEvent(start);
    const drop = new Event('drop', {bubbles:true,cancelable:true});
    Object.defineProperty(drop,'dataTransfer',{value:transfer});
    f.appHost.querySelectorAll('li')[2].dispatchEvent(drop); runTasks();
    expect(f.component.items).toEqual(['A','C','B']);
  } finally { await f.tearDown(); }
});
