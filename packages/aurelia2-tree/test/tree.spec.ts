import { createFixture } from '@aurelia/testing';
import { runTasks } from 'aurelia';
import { AureliaTreeConfiguration, TreeModel } from '../src/index';
const nodes = () => [
  {
    id: 'a',
    label: 'Animals',
    children: [
      { id: 'cat', label: 'Cat' },
      { id: 'dog', label: 'Dog', disabled: true },
    ],
  },
  { id: 'z', label: 'Zebra' },
];
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
describe('tree navigation', () => {
  it('flattens expanded branches with correct ARIA positions and keyboard movement', async () => {
    const tree = new TreeModel(nodes());
    expect(tree.rows.map((r) => r.node.id)).toEqual(['a', 'z']);
    await tree.navigate('ArrowRight');
    expect(tree.rows.map((r) => r.node.id)).toEqual(['a', 'cat', 'dog', 'z']);
    expect(tree.rows[2]).toMatchObject({ level: 2, position: 2, size: 2 });
    await tree.navigate('ArrowRight');
    expect(tree.activeId).toBe('cat');
    await tree.navigate('ArrowDown');
    expect(tree.activeId).toBe('dog');
    expect(tree.select('dog')).toBe(false);
    await tree.navigate('ArrowLeft');
    expect(tree.activeId).toBe('a');
    await tree.navigate('ArrowLeft');
    expect(tree.rows).toHaveLength(2);
    await tree.navigate('End');
    expect(tree.activeId).toBe('z');
    await tree.navigate('Home');
    expect(tree.activeId).toBe('a');
  });
  it('loads children once, deduplicates in-flight expansions and caches loaded children', async () => {
    let complete!: (value: any) => void;
    const load = jest.fn(
      () =>
        new Promise<any>((resolve) => {
          complete = resolve;
        }),
    );
    const tree = new TreeModel([{ id: 'a', label: 'A', hasChildren: true }], load);
    const a = tree.expand('a');
    const b = tree.expand('a');
    expect(a).toBe(b);
    expect(tree.rows[0].busy).toBe(true);
    await tick();
    complete([{ id: 'b', label: 'B' }]);
    expect(await a).toBe(true);
    tree.collapse('a');
    await tree.expand('a');
    expect(load).toHaveBeenCalledTimes(1);
    expect(tree.rows).toHaveLength(2);
  });
  it('cancels collapse and ignores stale child results', async () => {
    let complete!: (value: any) => void;
    let signal!: AbortSignal;
    const tree = new TreeModel([{ id: 'a', label: 'A', hasChildren: true }], (_node, s) => {
      signal = s;
      return new Promise((resolve) => {
        complete = resolve;
      });
    });
    const pending = tree.expand('a');
    await tick();
    tree.collapse('a');
    expect(signal.aborted).toBe(true);
    complete([{ id: 'b', label: 'B' }]);
    expect(await pending).toBe(false);
    expect(tree.rows).toHaveLength(1);
  });
  it('reports loader errors, retries and rejects duplicate child identifiers atomically', async () => {
    const load = jest
      .fn()
      .mockRejectedValueOnce(Error('offline'))
      .mockResolvedValueOnce([{ id: 'a', label: 'duplicate' }])
      .mockResolvedValueOnce([]);
    const tree = new TreeModel([{ id: 'a', label: 'A', hasChildren: true }], load);
    expect(await tree.expand('a')).toBe(false);
    expect(tree.rows[0].error).toBeDefined();
    expect(await tree.expand('a')).toBe(false);
    expect(tree.rows).toHaveLength(1);
    expect(await tree.expand('a')).toBe(true);
    expect(tree.rows[0].branch).toBe(false);
  });
  it('rejects cycles and duplicate IDs and repairs focus when collapsing ancestors', async () => {
    const a: any = { id: 'a', label: 'A', children: [] };
    a.children.push(a);
    expect(() => new TreeModel([a])).toThrow('cyclic');
    expect(
      () =>
        new TreeModel([
          { id: 'a', label: 'A' },
          { id: 'a', label: 'B' },
        ]),
    ).toThrow('Duplicate');
    const tree = new TreeModel(nodes());
    await tree.expand('a');
    tree.select('cat');
    tree.collapse('a');
    expect(tree.activeId).toBe('a');
    tree.search('z');
    expect(tree.activeId).toBe('z');
  });
  it('renders and updates a real tree with roving focus and selection events', async () => {
    const f = createFixture(
      '<au-tree nodes.bind="nodes" selected.two-way="selected" component.ref="view"></au-tree>',
      { nodes: nodes(), selected: null, view: undefined as any },
      [AureliaTreeConfiguration],
    );
    await f.startPromise;
    const root = f.appHost.querySelector('[role=tree]')!;
    expect(root.querySelectorAll('[role=treeitem]')).toHaveLength(2);
    root.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    await tick();
    runTasks();
    expect(root.querySelectorAll('[role=treeitem]')).toHaveLength(4);
    expect((root.querySelector('[data-tree-id=cat]') as HTMLElement).style.paddingInlineStart).toBe(
      '20px',
    );
    root.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    await tick();
    runTasks();
    expect(document.activeElement?.getAttribute('data-tree-id')).toBe('cat');
    const selected = jest.fn();
    f.appHost.addEventListener('tree-select', selected);
    root.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await tick();
    expect(f.component.selected).toBe('cat');
    expect(selected).toHaveBeenCalledTimes(1);
    await f.tearDown();
  });
  it('aborts pending lazy work when the component unbinds', async () => {
    let signal!: AbortSignal;
    const load = (_node, s) => {
      signal = s;
      return new Promise<any>(() => {});
    };
    const f = createFixture(
      '<au-tree nodes.bind="nodes" load-children.bind="load" component.ref="view"></au-tree>',
      { nodes: [{ id: 'a', label: 'A', hasChildren: true }], load, view: undefined as any },
      [AureliaTreeConfiguration],
    );
    await f.startPromise;
    void f.component.view.tree.expand('a');
    await tick();
    await f.tearDown();
    expect(signal.aborted).toBe(true);
  });
});

it('replaces roots while lazy work is pending and clears removed selection', async () => {
  let complete!: (value: any) => void;
  let signal!: AbortSignal;
  const tree = new TreeModel([{ id: 'a', label: 'A', hasChildren: true }], (_node, s) => {
    signal = s;
    return new Promise((resolve) => {
      complete = resolve;
    });
  });
  tree.select('a');
  const pending = tree.expand('a');
  await tick();
  tree.replace([{ id: 'b', label: 'B' }]);
  expect(signal.aborted).toBe(true);
  complete([{ id: 'old', label: 'Old' }]);
  expect(await pending).toBe(false);
  expect(tree.rows.map((r) => r.node.id)).toEqual(['b']);
  expect(tree.selectedId).toBeNull();
  expect(await tree.navigate('Unknown')).toBe(false);
  expect(tree.select('missing')).toBe(false);
  expect(await tree.expand('missing')).toBe(false);
  tree.dispose();
  expect(await tree.expand('b')).toBe(false);
});

it('handles empty trees, branches without loaders, toggle, and headless selection', async () => {
  const empty = new TreeModel([]);
  expect(await empty.navigate('Home')).toBe(false);
  empty.search('x');
  expect(empty.activeId).toBeNull();
  const unloaded = new TreeModel([{ id: 'a', label: 'A', hasChildren: true }]);
  expect(await unloaded.expand('a')).toBe(false);
  const tree = new TreeModel(nodes());
  await tree.toggle('a');
  await tree.navigate('ArrowRight');
  await tree.navigate('Enter');
  expect(tree.selectedId).toBe('cat');
  await tree.navigate('ArrowUp');
  expect(tree.activeId).toBe('a');
  expect(await tree.toggle('a')).toBe(false);
  expect(tree.rows).toHaveLength(2);
});

it('supports typeahead, two-way selection, and external replacement in a live view', async () => {
  const f = createFixture(
    '<au-tree nodes.bind="nodes" selected.two-way="selected" load-children.bind="load" component.ref="view"></au-tree>',
    {
      nodes: nodes(),
      selected: null as string | null,
      load: undefined as any,
      view: undefined as any,
    },
    [AureliaTreeConfiguration],
  );
  await f.startPromise;
  const root = f.appHost.querySelector('[role=tree]')!;
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true }));
  await tick();
  expect(f.component.view.tree.activeId).toBe('z');
  root.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  await tick();
  expect(f.component.selected).toBe('z');
  f.component.selected = 'a';
  runTasks();
  expect(f.component.view.tree.selectedId).toBe('a');
  const previous = f.component.view.tree;
  f.component.load = async () => [];
  runTasks();
  expect(f.component.view.tree).not.toBe(previous);
  f.component.nodes = [{ id: 'new', label: 'New' }];
  runTasks();
  expect(root.querySelectorAll('[role=treeitem]')).toHaveLength(1);
  await f.tearDown();
});

it('preserves keyed DOM row identity across expansion and collapse', async () => {
  const f = createFixture(
    '<au-tree nodes.bind="nodes" component.ref="view"></au-tree>',
    { nodes: nodes(), view: undefined as any },
    [AureliaTreeConfiguration],
  );
  await f.startPromise;
  const parent = f.appHost.querySelector('[data-tree-id=a]');
  const sibling = f.appHost.querySelector('[data-tree-id=z]');
  await f.component.view.tree.expand('a');
  runTasks();
  expect(f.appHost.querySelector('[data-tree-id=a]')).toBe(parent);
  expect(f.appHost.querySelector('[data-tree-id=z]')).toBe(sibling);
  f.component.view.tree.collapse('a');
  runTasks();
  expect(f.appHost.querySelector('[data-tree-id=z]')).toBe(sibling);
  await f.tearDown();
});

it('can reload a lazy branch after replacing roots with the same IDs', async () => {
  const root = () => [{ id: 'a', label: 'A', hasChildren: true }];
  const loader = jest.fn(async () => [{ id: 'child', label: 'Child' }]);
  const tree = new TreeModel(root(), loader);
  await tree.expand('a');
  tree.replace(root());
  expect(tree.rows[0].expanded).toBe(false);
  await tree.navigate('ArrowRight');
  expect(loader).toHaveBeenCalledTimes(2);
  expect(tree.rows).toHaveLength(2);
});

it('settles a cancelled expansion and never starts a loader cancelled in the same turn', async () => {
  const load = jest.fn(() => new Promise<never>(() => {}));
  const tree = new TreeModel([{ id: 'a', label: 'A', hasChildren: true }], load);
  const pending = tree.expand('a');
  tree.collapse('a');
  await tick();
  expect(await Promise.race([pending, tick().then(() => 'blocked')])).toBe(false);
  expect(load).not.toHaveBeenCalled();
  tree.dispose();
});
it('does not steal focus when lazy children finish after Tab moves outside the tree', async () => {
  let complete!: (nodes: any[]) => void;
  const f = createFixture(
    '<au-tree nodes.bind="nodes" load-children.bind="load"></au-tree><input aria-label="Outside">',
    {
      nodes: [{ id: 'a', label: 'A', hasChildren: true }],
      load: () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    },
    [AureliaTreeConfiguration],
  );
  await f.startPromise;
  const row = f.appHost.querySelector<HTMLElement>('[role=treeitem]')!;
  row.focus();
  row.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
  );
  await tick();
  const outside = f.appHost.querySelector('input')!;
  outside.focus();
  complete([{ id: 'b', label: 'B' }]);
  await tick();
  runTasks();
  try {
    expect(document.activeElement).toBe(outside);
  } finally {
    await f.tearDown();
  }
});

it('validates deeply nested server data without recursive stack overflow', () => {
  let node: any = { id: 'leaf', label: 'Leaf' };
  for (let i = 0; i < 12000; i++) node = { id: String(i), label: String(i), children: [node] };
  const tree = new TreeModel([node]);
  expect(tree.select('leaf')).toBe(true);
  expect(tree.rows).toHaveLength(12001);
  tree.dispose();
  expect(() => new TreeModel([{ id: 'bad', label: 'Bad', children: {} } as any])).toThrow('array');
});
it('expands with one disclosure click and clears removed external selection', async () => {
  const f = createFixture(
    '<au-tree nodes.bind="nodes" selected.two-way="selected"></au-tree>',
    { nodes: nodes(), selected: null as string | null },
    [AureliaTreeConfiguration],
  );
  await f.startPromise;
  try {
    f.appHost.querySelector<HTMLButtonElement>('button')!.click();
    await tick();
    runTasks();
    expect(f.appHost.querySelectorAll('[role=treeitem]')).toHaveLength(4);
    expect(f.component.selected).toBeNull();
    f.component.selected = 'cat';
    runTasks();
    expect(f.appHost.querySelector('[data-tree-id=cat]')!.getAttribute('aria-selected')).toBe(
      'true',
    );
    f.component.nodes = [];
    runTasks();
    expect(f.component.selected).toBeNull();
  } finally {
    await f.tearDown();
  }
});

it('blocks expansions launched by abort callbacks during root replacement', async () => {
  let reentrant!: Promise<boolean>;
  let tree: TreeModel;
  const load = jest.fn((_node, signal: AbortSignal) => {
    signal.addEventListener('abort', () => { reentrant = tree.expand('b'); });
    return new Promise<never>(() => {});
  });
  tree = new TreeModel([
    { id: 'a', label: 'A', hasChildren: true },
    { id: 'b', label: 'B', hasChildren: true },
  ], load);
  const pending = tree.expand('a');
  await tick();
  tree.replace([{ id: 'new', label: 'New' }]);
  expect(await pending).toBe(false);
  expect(await reentrant).toBe(false);
  expect(load).toHaveBeenCalledTimes(1);
  tree.dispose();
});

it('does not revive a disposed tree when replacement occurs in an abort callback', async () => {
  let tree: TreeModel;
  tree = new TreeModel([{ id: 'a', label: 'A', hasChildren: true }], (_node, signal) => {
    signal.addEventListener('abort', () => tree.replace(nodes()));
    return new Promise<never>(() => {});
  });
  const pending = tree.expand('a');
  await tick();
  tree.dispose();
  expect(await pending).toBe(false);
  expect(await tree.expand('a')).toBe(false);
});

it('respects disposal triggered by an abort callback while replacing roots', async () => {
  let tree: TreeModel;
  tree = new TreeModel([{ id: 'a', label: 'A', hasChildren: true }], (_node, signal) => {
    signal.addEventListener('abort', () => tree.dispose());
    return new Promise<never>(() => {});
  });
  const pending = tree.expand('a');
  await tick();
  tree.replace(nodes());
  expect(await pending).toBe(false);
  expect(await tree.expand('a')).toBe(false);
  tree.replace(nodes());
  expect(await tree.expand('a')).toBe(false);
});

it('continues keyboard navigation from the branch whose disclosure was clicked', async () => {
  const f = createFixture('<au-tree nodes.bind="nodes" component.ref="view"></au-tree>', {
    nodes: [{id: 'a', label: 'A'}, {id: 'b', label: 'B', children: [{id:'c',label:'C'}]}], view: undefined as any,
  }, [AureliaTreeConfiguration]);
  await f.startPromise;
  try {
    const disclosure = f.appHost.querySelector('button')!;
    disclosure.focus();
    disclosure.click();
    runTasks();
    disclosure.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true, cancelable:true}));
    await Promise.resolve();
    runTasks();
    expect(f.component.view.tree.activeId).toBe('c');
  } finally { await f.tearDown(); }
});

it('preserves a selection when its node is supplied in the same turn', async () => {
  const f = createFixture('<au-tree nodes.bind="nodes" selected.two-way="selected"></au-tree>', {
    nodes: [{id:'a',label:'A'}], selected: null as string | null,
  }, [AureliaTreeConfiguration]);
  await f.startPromise;
  try {
    f.component.selected = 'b';
    f.component.nodes = [{id:'a',label:'A'}, {id:'b',label:'B'}];
    runTasks();
    await Promise.resolve();
    runTasks();
    expect(f.component.selected).toBe('b');
    expect(f.appHost.querySelector('[data-tree-id="b"]')!.getAttribute('aria-selected')).toBe('true');
  } finally { await f.tearDown(); }
});

it('keeps a current prefix match when typeahead is extended', () => {
  const tree = new TreeModel([{id:'a',label:'Ab'}, {id:'b',label:'Abc'}, {id:'z',label:'Zed'}]);
  tree.activeId = 'z';
  tree.search('a');
  expect(tree.activeId).toBe('a');
  tree.search('ab');
  expect(tree.activeId).toBe('a');
});


it('does not revive an unknown selection after its turn and rejects disabled IDs', async () => {
  const f = createFixture('<au-tree nodes.bind="nodes" selected.two-way="selected"></au-tree>', {
    nodes: [{id:'a',label:'A',disabled:false}], selected: null as string | null,
  }, [AureliaTreeConfiguration]);
  await f.startPromise;
  try {
    f.component.selected = 'missing'; runTasks();
    expect(f.component.selected).toBeNull();
    f.component.nodes = [{id:'missing',label:'Missing',disabled:false}, {id:'locked',label:'Locked',disabled:true}];
    runTasks();
    expect(f.component.selected).toBeNull();
    f.component.selected = 'locked';
    expect(f.component.selected).toBeNull();
    f.component.selected = 'another';
    f.component.selected = 'missing'; runTasks();
    expect(f.component.selected).toBe('missing');
  } finally { await f.tearDown(); }
});
