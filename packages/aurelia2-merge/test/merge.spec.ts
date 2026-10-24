import { createFixture } from '@aurelia/testing';
import { runTasks } from 'aurelia';
import {
  AureliaMergeConfiguration,
  copyMergeValue,
  diffLines,
  mergeRecords,
  MergeSession,
  MergeService,
} from '../src/index';

describe('three-way merge', () => {
  it('merges independent nested edits and identical edits without mutating inputs', () => {
    const base = Object.freeze({ title: 'Old', settings: Object.freeze({ a: 1, b: 1 }) });
    const mine = { title: 'Same', settings: { a: 2, b: 1 } };
    const theirs = { title: 'Same', settings: { a: 1, b: 3 } };
    const session = new MergeSession(base, mine, theirs);
    expect(session.conflicts).toHaveLength(0);
    expect(session.result()).toEqual({ title: 'Same', settings: { a: 2, b: 3 } });
    session.result().settings = null;
    expect(session.result().settings).toEqual({ a: 2, b: 3 });
    expect(mine.settings).toEqual({ a: 2, b: 1 });
  });
  it('distinguishes missing, undefined and null, including both deletion directions', () => {
    const session = new MergeSession(
      { a: 1, b: 1, c: undefined },
      { a: 2, c: null, d: undefined },
      { b: 2, c: 3, d: null },
    );
    expect(session.conflicts.map((c) => c.kind)).toEqual([
      'modified-deleted',
      'both-modified',
      'both-added',
      'deleted-modified',
    ]);
    const a = session.conflicts.find((c) => c.path[0] === 'a')!;
    expect(a.theirs.present).toBe(false);
    session.resolve(a.id, { choice: 'theirs' });
    for (const c of session.conflicts.filter((c) => c !== a))
      session.resolve(c.id, { choice: 'mine' });
    const result = session.result();
    expect(Object.hasOwn(result, 'a')).toBe(false);
    expect(Object.hasOwn(result, 'd')).toBe(true);
    expect(result).toEqual({ c: null, d: undefined });
  });
  it('treats arrays atomically and requires a choice for every conflict', () => {
    const session = new MergeSession({ list: [1] }, { list: [1, 2] }, { list: [1, 3] });
    expect(session.conflicts).toHaveLength(1);
    expect(() => session.result()).toThrow('Resolve all');
    session.resolve(session.conflicts[0].id, { choice: 'custom', value: [4] });
    expect(session.result()).toEqual({ list: [4] });
    session.clear(session.conflicts[0].id);
    expect(session.unresolvedCount).toBe(1);
    session.resolve(session.conflicts[0].id, { choice: 'base' });
    expect(session.result()).toEqual({ list: [1] });
    expect(() => session.resolve('missing', { choice: 'mine' })).toThrow('Unknown');
  });
  it('supports escaped-looking keys as literal paths and explicit deletion', () => {
    const session = new MergeSession(
      { 'a/b': { 'x.y': 1 } },
      { 'a/b': { 'x.y': 2 } },
      { 'a/b': { 'x.y': 3 } },
    );
    const c = session.conflicts[0];
    expect(c.path).toEqual(['a/b', 'x.y']);
    session.resolve(c.id, { choice: 'delete' });
    expect(session.result()).toEqual({ 'a/b': {} });
  });
  it('validates data, limits, classes, accessors, prototype keys and cycles', () => {
    const cyclic: any = {};
    cyclic.self = cyclic;
    const accessor = Object.defineProperty({}, 'x', {
      enumerable: true,
      get: () => {
        throw Error('must not execute');
      },
    });
    for (const value of [
      cyclic,
      new Date(),
      { n: Infinity },
      { fn: () => 1 },
      JSON.parse('{"__proto__":1}'),
      accessor,
      Array(5),
    ])
      expect(() => copyMergeValue(value)).toThrow();
    expect(() => copyMergeValue({ a: { b: 1 } }, { maxDepth: 1 })).toThrow('limits');
    expect(() => copyMergeValue([1, 2, 3], { maxNodes: 2 })).toThrow('limits');
    expect(() => copyMergeValue({}, { maxDepth: 0 })).toThrow('limits');
    expect(() => mergeRecords([] as any, {}, {})).toThrow('roots');
    const huge = new Array(1000000000);
    expect(() => copyMergeValue(huge)).toThrow('limits');
  });
  it('copies custom decisions and exposes immutable conflict snapshots', () => {
    const session = new MergeSession({ a: 1 }, { a: 2 }, { a: 3 });
    const value = { nested: [7] };
    session.resolve(session.conflicts[0].id, { choice: 'custom', value });
    value.nested.push(8);
    expect(session.result()).toEqual({ a: { nested: [7] } });
    expect(Object.isFrozen(session.conflicts[0].mine)).toBe(true);
  });
  it('keeps arrays and root inputs isolated from returned merge plans', () => {
    const mine = { x: [1, 2] };
    const plan = mergeRecords({ x: [1] }, mine, { x: [1] });
    (plan.merged.x as number[]).push(3);
    expect(mine.x).toEqual([1, 2]);
    expect(plan.changes).toEqual([['x']]);
  });
  it('preserves line endings and bounds line diff memory', () => {
    expect(diffLines('a\nb\n', 'a\nc\n').filter((x) => x.type !== 'equal')).toEqual([
      { type: 'add', after: 'c' },
      { type: 'remove', before: 'b' },
    ]);
    expect(diffLines('a', 'a')).toEqual([{ type: 'equal', before: 'a', after: 'a' }]);
    expect(diffLines('a\n', 'a', 1)).toEqual([{ type: 'replace', before: 'a\n', after: 'a' }]);
    expect(() => diffLines('a', 'b', 0)).toThrow('budget');
  });
});
async function setup() {
  const f = createFixture(
    '<au-merge base.bind="base" mine.bind="mine" theirs.bind="theirs" component.ref="view"></au-merge>',
    {
      base: { title: 'Base', count: 0 },
      mine: { title: 'Mine', count: 1 },
      theirs: { title: 'Theirs', count: 0 },
      view: undefined as any,
    },
    [AureliaMergeConfiguration],
  );
  await f.startPromise;
  return f;
}
describe('merge view', () => {
  it('renders conflicts, focuses unresolved choices, and publishes an isolated result', async () => {
    const f = await setup();
    const applied = jest.fn();
    f.appHost.addEventListener('merge-resolve', applied);
    try {
      expect(f.appHost.querySelectorAll('fieldset')).toHaveLength(1);
      expect(f.component.view.apply()).toBe(false);
      expect(document.activeElement?.getAttribute('type')).toBe('radio');
      f.appHost.querySelector<HTMLInputElement>('input[value=theirs]')!.click();
      runTasks();
      expect(f.component.view.session.unresolvedCount).toBe(0);
      expect(f.appHost.querySelector('[role=status]')!.textContent).toContain('0 conflicts');
      expect(f.component.view.apply()).toBe(true);
      expect(applied.mock.calls[0][0].detail.merged).toEqual({ title: 'Theirs', count: 1 });
      expect(f.container.get(MergeService).create({}, { x: 1 }, {}).result()).toEqual({ x: 1 });
    } finally {
      await f.tearDown();
    }
  });
  it('validates custom JSON and keeps server text as text rather than HTML', async () => {
    const f = await setup();
    try {
      const row = f.component.view.rows[0];
      row.custom = '{bad';
      f.component.view.custom(row);
      runTasks();
      expect(f.appHost.querySelector('[role=alert]')).not.toBeNull();
      row.custom = '"<img src=x onerror=alert(1)>"';
      f.component.view.custom(row);
      runTasks();
      expect(f.component.view.session.result().title).toContain('<img');
      expect(f.appHost.querySelector('img')).toBeNull();
      expect(f.component.view.session.isComplete).toBe(true);
    } finally {
      await f.tearDown();
    }
  });
  it('resets choices when inputs change, prevents stale application, and honours event veto', async () => {
    const f = await setup();
    const applied = jest.fn();
    f.appHost.addEventListener('merge-resolve', applied);
    try {
      f.component.view.choose(f.component.view.rows[0], 'mine');
      const veto = (event: Event) => event.preventDefault();
      f.appHost.addEventListener('merge-before-apply', veto);
      expect(f.component.view.apply()).toBe(false);
      f.appHost.removeEventListener('merge-before-apply', veto);
      f.appHost.addEventListener('merge-before-apply', () => {
        f.component.theirs = { title: 'New remote', count: 0 };
      });
      expect(f.component.view.apply()).toBe(false);
      runTasks();
      expect(applied).not.toHaveBeenCalled();
      expect(f.component.view.session.unresolvedCount).toBe(1);
      expect(f.component.view.rows[0].conflict.theirs.value).toBe('New remote');
    } finally {
      await f.tearDown();
    }
  });
  it('does not share mutable event data with the committed result and supports restart', async () => {
    const f = await setup();
    const applied = jest.fn();
    f.appHost.addEventListener('merge-resolve', applied);
    try {
      f.component.view.choose(f.component.view.rows[0], 'mine');
      f.appHost.addEventListener('merge-before-apply', (event: CustomEvent) => {
        event.detail.merged.title = 'Tampered';
      });
      expect(f.component.view.apply()).toBe(true);
      expect(applied.mock.calls[0][0].detail.merged.title).toBe('Mine');
      const session = f.component.view.session;
      await f.au.stop();
      await f.au.start();
      runTasks();
      expect(f.component.view.session).toBe(session);
      expect(f.component.view.session.unresolvedCount).toBe(0);
      f.component.theirs = { title: 'Newer', count: 0 };
      runTasks();
      expect(f.component.view.session).not.toBe(session);
      expect(f.component.view.session.unresolvedCount).toBe(1);
    } finally {
      await f.tearDown();
    }
  });
});

it('merges records whose fields Aurelia already observes', async () => {
  const f = createFixture(
    '<input value.bind="mine.title"><au-merge base.bind="base" mine.bind="mine" theirs.bind="theirs" component.ref="view"></au-merge>',
    {
      base: { title: 'base' },
      mine: { title: 'mine' },
      theirs: { title: 'theirs' },
      view: undefined as any,
    },
    [AureliaMergeConfiguration],
  );
  await f.startPromise;
  try {
    const session = f.component.view.session;
    session.resolve(session.conflicts[0].id, { choice: 'mine' });
    expect(session.result()).toEqual({ title: 'mine' });
  } finally {
    await f.tearDown();
  }
});

it('shows malformed server data as an error and recovers when replaced', async () => {
  const f = createFixture(
    '<au-merge base.bind="base" mine.bind="mine" theirs.bind="theirs" component.ref="view"></au-merge>',
    { base: { x: 1 }, mine: { x: 2 }, theirs: null as any, view: undefined as any },
    [AureliaMergeConfiguration],
  );
  await f.startPromise;
  try {
    expect(f.appHost.querySelector('[role=alert]')).not.toBeNull();
    expect(f.component.view.apply()).toBe(false);
    f.component.theirs = { x: 3 };
    runTasks();
    expect(f.component.view.error).toBe('');
    expect(f.component.view.session.conflicts).toHaveLength(1);
  } finally {
    await f.tearDown();
  }
});

it('cancels application if a before-apply listener changes conflict choices', async () => {
  const f = await setup();
  const applied = jest.fn();
  f.appHost.addEventListener('merge-resolve', applied);
  try {
    const session = f.component.view.session;
    const id = session.conflicts[0].id;
    session.resolve(id, { choice: 'mine' });
    f.appHost.addEventListener('merge-before-apply', () =>
      session.resolve(id, { choice: 'theirs' }),
    );
    expect(f.component.view.apply()).toBe(false);
    expect(applied).not.toHaveBeenCalled();
    expect(session.result().title).toBe('Theirs');
  } finally {
    await f.tearDown();
  }
});

it('builds line comparisons on demand and bounds their rendered size', async () => {
  const base: Record<string, string> = {},
    mine: Record<string, string> = {},
    theirs: Record<string, string> = {};
  for (let i = 0; i < 40; i++) {
    base['f' + i] = 'base\n'.repeat(500);
    mine['f' + i] = 'mine\n'.repeat(500);
    theirs['f' + i] = 'theirs\n'.repeat(500);
  }
  const f = createFixture(
    '<au-merge base.bind="base" mine.bind="mine" theirs.bind="theirs" component.ref="view"></au-merge>',
    { base, mine, theirs, view: undefined as any },
    [AureliaMergeConfiguration],
  );
  await f.startPromise;
  try {
    expect(f.component.view.rows.every((row) => row.diff.length === 0)).toBe(true);
    expect(f.appHost.querySelectorAll('details code')).toHaveLength(0);
    const row = f.component.view.rows[0];
    f.component.view.toggleDiff(row, true);
    runTasks();
    expect(row.largeDiff).toBe(true);
    expect(f.appHost.querySelectorAll('details code')).toHaveLength(0);
    f.component.view.toggleDiff(row, false);
    runTasks();
    expect(row.diff).toHaveLength(0);
  } finally {
    await f.tearDown();
  }
});

it('paginates conflicts and reveals the first unresolved choice when applying', async () => {
  const f = createFixture(
    '<au-merge base.bind="base" mine.bind="mine" theirs.bind="theirs" page-size="1" component.ref="view"></au-merge>',
    { base: { a: 0, b: 0 }, mine: { a: 1, b: 1 }, theirs: { a: 2, b: 2 }, view: undefined as any },
    [AureliaMergeConfiguration],
  );
  await f.startPromise;
  try {
    expect(f.appHost.querySelectorAll('fieldset')).toHaveLength(1);
    const view = f.component.view;
    view.session.resolve(view.rows[0].conflict.id, { choice: 'mine' });
    expect(view.apply()).toBe(false);
    runTasks();
    expect(view.page).toBe(1);
    expect(document.activeElement?.getAttribute('name')).toBe(view.rows[1].id);
    view.session.resolve(view.rows[1].conflict.id, { choice: 'theirs' });
    expect(view.session.result()).toEqual({ a: 1, b: 2 });
  } finally {
    await f.tearDown();
  }
});

describe('review regressions', () => {
  const radios = (host: Element, name: string) =>
    Array.from(host.querySelectorAll<HTMLInputElement>('input[type=radio]')).filter(
      (input) => input.name === name,
    );
  const checked = (host: Element, name: string) =>
    radios(host, name).find((input) => input.checked)?.value ?? '';

  it('relabels rows without discarding choices', async () => {
    const f = createFixture(
      '<au-merge base.bind="base" mine.bind="mine" theirs.bind="theirs" field-label.bind="labeler" component.ref="view"></au-merge>',
      {
        base: { a: 1, b: 1 },
        mine: { a: 2, b: 2 },
        theirs: { a: 3, b: 3 },
        labeler: (path: readonly string[]) => 'EN ' + path.join('.'),
        view: undefined as any,
      },
      [AureliaMergeConfiguration],
    );
    await f.startPromise;
    const resets = jest.fn();
    f.appHost.addEventListener('merge-reset', resets);
    try {
      const view = f.component.view;
      const session = view.session;
      for (const row of view.rows) view.choose(row, 'theirs');
      f.component.labeler = (path: readonly string[]) => 'FR ' + path.join('.');
      runTasks();
      expect(view.session).toBe(session);
      expect(session.unresolvedCount).toBe(0);
      expect(Array.from(f.appHost.querySelectorAll('legend')).map((l) => l.textContent)).toEqual([
        'FR a',
        'FR b',
      ]);
      expect(resets).not.toHaveBeenCalled();
      f.component.labeler = () => {
        throw new Error('labels unavailable');
      };
      runTasks();
      expect(f.appHost.querySelector('legend')!.textContent).toBe('a');
    } finally {
      await f.tearDown();
    }
  });

  it('keeps the session when a cached if view rebinds to unchanged inputs', async () => {
    const f = createFixture(
      '<au-merge if.bind="show" base.bind="base" mine.bind="mine" theirs.bind="theirs" component.ref="view"></au-merge>',
      { show: true, base: { a: 1 }, mine: { a: 2 }, theirs: { a: 3 }, view: undefined as any },
      [AureliaMergeConfiguration],
    );
    await f.startPromise;
    try {
      const view = f.component.view;
      const session = view.session;
      view.choose(view.rows[0], 'mine');
      f.component.show = false;
      runTasks();
      f.component.show = true;
      runTasks();
      expect(f.component.view).toBe(view);
      expect(view.session).toBe(session);
      expect(session.unresolvedCount).toBe(0);
      expect(checked(f.appHost, view.rows[0].id)).toBe('mine');
      f.component.show = false;
      runTasks();
      f.component.theirs = { a: 4 };
      f.component.show = true;
      runTasks();
      expect(view.session).not.toBe(session);
      expect(view.session.conflicts[0].theirs.value).toBe(4);
    } finally {
      await f.tearDown();
    }
  });

  it('publishes one resolution when a listener applies again', async () => {
    const f = await setup();
    const resolved = jest.fn();
    f.appHost.addEventListener('merge-resolve', resolved);
    try {
      const view = f.component.view;
      view.choose(view.rows[0], 'mine');
      let nested: boolean | undefined;
      f.appHost.addEventListener('merge-before-apply', () => {
        nested ??= view.apply();
      });
      f.appHost.addEventListener('merge-resolve', () => view.apply(), { once: true });
      expect(view.apply()).toBe(true);
      expect(nested).toBe(false);
      expect(resolved).toHaveBeenCalledTimes(1);
      expect(view.apply()).toBe(true);
      expect(resolved).toHaveBeenCalledTimes(2);
    } finally {
      await f.tearDown();
    }
  });

  it('derives radio, custom and cleared status from session choices', async () => {
    const f = createFixture(
      '<au-merge base.bind="base" mine.bind="mine" theirs.bind="theirs" session.from-view="session" component.ref="view"></au-merge>',
      {
        base: { a: 1 },
        mine: { a: 2 },
        theirs: { a: 3 },
        session: undefined as any,
        view: undefined as any,
      },
      [AureliaMergeConfiguration],
    );
    await f.startPromise;
    try {
      const view = f.component.view;
      const row = view.rows[0];
      const status = () => f.appHost.querySelector('[data-merge-status]')!.textContent;
      const fieldset = f.appHost.querySelector('fieldset')!;
      expect(
        f.appHost.querySelector('#' + fieldset.getAttribute('aria-describedby')),
      ).not.toBeNull();
      expect(status()).toBe('Unresolved');
      radios(f.appHost, row.id)
        .find((input) => input.value === 'theirs')!
        .click();
      runTasks();
      expect(status()).toBe('Resolved: using the server version');
      f.component.session.clear(row.conflict.id);
      runTasks();
      expect(checked(f.appHost, row.id)).toBe('');
      expect(status()).toBe('Unresolved');
      f.component.session.resolve(row.conflict.id, { choice: 'base' });
      runTasks();
      expect(checked(f.appHost, row.id)).toBe('base');
      row.custom = '{"n":null}';
      expect(view.custom(row)).toBe(true);
      runTasks();
      expect(checked(f.appHost, row.id)).toBe('');
      expect(status()).toContain('Resolved with a custom value');
      expect(status()).toContain('"n": null');
      expect(f.component.session.decision(row.conflict.id)).toMatchObject({
        choice: 'custom',
        present: true,
        value: { n: null },
      });
      const stale = { ...row };
      const mineRadio = radios(f.appHost, row.id).find((input) => input.value === 'mine')!;
      mineRadio.checked = true;
      expect(view.choose(stale, 'mine', mineRadio)).toBe(false);
      expect(checked(f.appHost, row.id)).toBe('');
    } finally {
      await f.tearDown();
    }
  });

  it('uses fresh row identities for each session so native details state is not reused', async () => {
    const f = createFixture(
      '<au-merge base.bind="base" mine.bind="mine" theirs.bind="theirs" component.ref="view"></au-merge>',
      { base: { t: 'a\nb' }, mine: { t: 'a\nm' }, theirs: { t: 'a\nc' }, view: undefined as any },
      [AureliaMergeConfiguration],
    );
    await f.startPromise;
    try {
      const details = f.appHost.querySelector('details')!;
      const id = f.component.view.rows[0].id;
      details.open = true;
      f.component.view.toggleDiff(f.component.view.rows[0], true);
      runTasks();
      f.component.theirs = { t: 'a\nz' };
      runTasks();
      expect(f.component.view.rows[0].id).not.toBe(id);
      expect(f.appHost.querySelector('details')).not.toBe(details);
      expect(f.appHost.querySelector('details')!.open).toBe(false);
    } finally {
      await f.tearDown();
    }
  });

  it('treats negative zero as zero and displays nested undefined distinctly from null', async () => {
    const session = new MergeSession({ balance: 0 }, { balance: 0 * -1 }, { balance: 5 });
    expect(session.conflicts).toHaveLength(0);
    expect(session.result()).toEqual({ balance: 5 });
    expect(mergeRecords({ x: 1 }, { x: -0 }, { x: 0 }).conflicts).toHaveLength(0);
    const f = createFixture(
      '<au-merge base.bind="base" mine.bind="mine" theirs.bind="theirs" component.ref="view"></au-merge>',
      {
        base: { list: [] },
        mine: { list: [null, { a: null }] },
        theirs: { list: [undefined, { a: undefined }] },
        view: undefined as any,
      },
      [AureliaMergeConfiguration],
    );
    await f.startPromise;
    try {
      const [, yours, server] = Array.from(f.appHost.querySelectorAll('pre')).map((pre) =>
        pre.textContent!.replace(/\s+/g, ''),
      );
      expect(yours).toBe('[null,{"a":null}]');
      expect(server).toBe('[undefined,{"a":undefined}]');
    } finally {
      await f.tearDown();
    }
  });
});
