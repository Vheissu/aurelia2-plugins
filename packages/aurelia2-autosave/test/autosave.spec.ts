import { createFixture } from '@aurelia/testing';
import { runTasks } from 'aurelia';
import { AureliaAutosaveConfiguration, AutosaveFactory } from '../src/index';
const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
async function setup() {
  const f = createFixture('<div></div>', {}, [
    AureliaAutosaveConfiguration.configure({ delay: 20, maxWait: 60 }),
  ]);
  await f.startPromise;
  return f;
}
describe('autosave', () => {
  it('observes nested edits, debounces and snapshots values', async () => {
    const f = await setup();
    const model = { nested: { name: 'a' } };
    const save = jest.fn(async () => {});
    const session = f.container.get(AutosaveFactory).create(model, save);
    model.nested.name = 'b';
    runTasks();
    model.nested.name = 'c';
    runTasks();
    expect(session.dirty).toBe(true);
    expect(await session.flush()).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toEqual({ nested: { name: 'c' } });
    model.nested.name = 'd';
    runTasks();
    expect(save.mock.calls[0][0].nested.name).toBe('c');
    session.dispose();
    await f.tearDown();
  });
  it('serializes writes and coalesces edits made during a save', async () => {
    const f = await setup();
    const model = { n: 0 };
    const first = deferred();
    const values: number[] = [];
    const session = f.container.get(AutosaveFactory).create(model, async (snapshot) => {
      values.push(snapshot.n);
      if (snapshot.n === 1) await first.promise;
    });
    model.n = 1;
    runTasks();
    const done = session.flush();
    await tick();
    model.n = 2;
    runTasks();
    model.n = 3;
    runTasks();
    expect(values).toEqual([1]);
    first.resolve();
    expect(await done).toBe(true);
    expect(values).toEqual([1, 3]);
    expect(session.dirty).toBe(false);
    session.dispose();
    await f.tearDown();
  });
  it('keeps the newest draft after failure and retries explicitly', async () => {
    const f = await setup();
    const model = { n: 0 };
    const save = jest.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(undefined);
    const session = f.container.get(AutosaveFactory).create(model, save);
    model.n = 1;
    runTasks();
    expect(await session.flush()).toBe(false);
    expect(session.status).toBe('error');
    expect(session.dirty).toBe(true);
    expect(await session.flush()).toBe(true);
    expect(session.error).toBeNull();
    session.dispose();
    await f.tearDown();
  });
  it('does not save unchanged values and cancels reverted drafts before dispatch', async () => {
    const f = await setup();
    const model = { n: 0 };
    const save = jest.fn();
    const session = f.container.get(AutosaveFactory).create(model, save);
    await session.flush();
    expect(save).not.toHaveBeenCalled();
    model.n = 1;
    runTasks();
    model.n = 0;
    runTasks();
    await session.flush();
    expect(save).not.toHaveBeenCalled();
    session.dispose();
    await f.tearDown();
  });
  it('enforces maxWait during continuous editing', async () => {
    const f = await setup();
    jest.useFakeTimers();
    const model = { n: 0 };
    const save = jest.fn();
    const session = f.container.get(AutosaveFactory).create(model, save);
    for (let n = 1; n <= 6; n++) {
      model.n = n;
      runTasks();
      await jest.advanceTimersByTimeAsync(10);
    }
    expect(save).toHaveBeenCalled();
    session.dispose();
    jest.useRealTimers();
    await f.tearDown();
  });
  it('stops observation and aborts the current request on disposal', async () => {
    const f = await setup();
    const model = { n: 0 };
    const pending = deferred();
    let signal!: AbortSignal;
    const save = jest.fn((_snapshot, s) => {
      signal = s;
      return pending.promise;
    });
    const session = f.container.get(AutosaveFactory).create(model, save);
    model.n = 1;
    runTasks();
    const done = session.flush();
    await tick();
    session.dispose();
    session.dispose();
    expect(signal.aborted).toBe(true);
    model.n = 2;
    runTasks();
    pending.resolve();
    expect(await done).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    expect(session.status).toBe('disposed');
    await f.tearDown();
  });
  it('owns sessions through an Aurelia attribute and replaces them when models change', async () => {
    const save = jest.fn();
    const f = createFixture(
      '<section autosave="model.bind: model; save.bind: save; session.from-view: session"></section>',
      { model: { title: 'a' }, save, session: undefined as any },
      [AureliaAutosaveConfiguration],
    );
    await f.startPromise;
    const oldSession = f.component.session;
    expect(oldSession).toBeDefined();
    f.component.model = { title: 'b' };
    runTasks();
    expect(oldSession.status).toBe('disposed');
    expect(f.component.session).not.toBe(oldSession);
    const current = f.component.session;
    await f.tearDown();
    expect(current.status).toBe('disposed');
  });
  it('validates timing options', () => {
    expect(() => AureliaAutosaveConfiguration.configure({ delay: -1 })).toThrow();
    expect(() => AureliaAutosaveConfiguration.configure({ delay: 100, maxWait: 50 })).toThrow();
  });
});

it('observes array edits and isolates saves from later mutations', async () => {
  const f = await setup();
  const model = { tags: ['a'] };
  const save = jest.fn();
  const session = f.container.get(AutosaveFactory).create(model, save);
  model.tags.push('b');
  runTasks();
  await session.flush();
  expect(save.mock.calls[0][0].tags).toEqual(['a', 'b']);
  model.tags.splice(0, 1);
  runTasks();
  await session.flush();
  expect(save.mock.calls[1][0].tags).toEqual(['b']);
  session.dispose();
  await f.tearDown();
});

it('writes a revert after an in-flight edit and shares flush promises', async () => {
  const f = await setup();
  const model = { n: 0 };
  const pending = deferred();
  const values: number[] = [];
  const session = f.container.get(AutosaveFactory).create(model, async (snapshot) => {
    values.push(snapshot.n);
    if (snapshot.n === 1) await pending.promise;
  });
  model.n = 1;
  runTasks();
  const done = session.flush();
  expect(session.flush()).toBe(done);
  await tick();
  model.n = 0;
  runTasks();
  expect(session.dirty).toBe(true);
  pending.resolve();
  expect(await done).toBe(true);
  expect(values).toEqual([1, 0]);
  session.dispose();
  await f.tearDown();
});

it('replaces save callbacks and codecs without leaking the old session', async () => {
  const save = jest.fn();
  const f = createFixture(
    '<div autosave="model.bind: model; save.bind: save; options.bind: options; session.from-view: session"></div>',
    { model: { n: 1 }, save, options: {}, session: undefined as any },
    [AureliaAutosaveConfiguration],
  );
  await f.startPromise;
  const old = f.component.session;
  f.component.save = jest.fn();
  runTasks();
  expect(old.status).toBe('disposed');
  const second = f.component.session;
  f.component.options = {
    serialize: (value) => String(value.n),
    deserialize: (value) => ({ n: Number(value) }),
    delay: 0,
    maxWait: 0,
  };
  runTasks();
  expect(second.status).toBe('disposed');
  f.component.model.n = 2;
  runTasks();
  await f.component.session.flush();
  expect(f.component.save.mock.calls[0][0]).toEqual({ n: 2 });
  expect(save).not.toHaveBeenCalled();
  await f.tearDown();
});

it('flush reads edits made before Aurelia delivers observation notifications', async () => {
  const f = await setup();
  const model = { n: 0 };
  const save = jest.fn();
  const session = f.container.get(AutosaveFactory).create(model, save);
  try {
    model.n = 7;
    expect(await session.flush()).toBe(true);
    expect(save).toHaveBeenCalledWith({ n: 7 }, expect.any(AbortSignal));
  } finally {
    session.dispose();
    await f.tearDown();
  }
});
it('disposal settles flush even if the transport ignores cancellation', async () => {
  const f = await setup();
  const model = { n: 0 };
  const session = f.container.get(AutosaveFactory).create(model, () => new Promise(() => {}));
  model.n = 1;
  runTasks();
  const pending = session.flush();
  await tick();
  session.dispose();
  const outcome = await Promise.race([pending, tick().then(() => 'still pending')]);
  await f.tearDown();
  expect(outcome).toBe(false);
});

it('reports serialization errors without escaping Aurelia observation and recovers on edit', async () => {
  const f = await setup();
  const model = { n: 0 };
  const save = jest.fn();
  const session = f.container.get(AutosaveFactory).create(model, save, {
    serialize: (value) => {
      if (value.n < 0) throw Error('invalid snapshot');
      return JSON.stringify(value);
    },
  });
  try {
    model.n = -1;
    expect(() => runTasks()).not.toThrow();
    expect(session.status).toBe('error');
    expect(await session.flush()).toBe(false);
    expect(save).not.toHaveBeenCalled();
    model.n = 2;
    runTasks();
    expect(await session.flush()).toBe(true);
    expect(save).toHaveBeenCalledWith({ n: 2 }, expect.any(AbortSignal));
  } finally {
    session.dispose();
    await f.tearDown();
  }
});

it('restarts lifecycle-owned observation without duplicate writes', async () => {
  const save = jest.fn();
  const f = createFixture(
    '<div autosave="model.bind: model; save.bind: save; session.from-view: session"></div>',
    { model: { n: 0 }, save, session: undefined as any },
    [AureliaAutosaveConfiguration],
  );
  await f.startPromise;
  try {
    for (let n = 1; n <= 3; n++) {
      const old = f.component.session;
      await f.au.stop();
      expect(old.status).toBe('disposed');
      await f.au.start();
      f.component.model.n = n;
      expect(await f.component.session.flush()).toBe(true);
    }
    expect(save).toHaveBeenCalledTimes(3);
  } finally {
    await f.tearDown();
  }
});

it('carries pending edits across save callback or timing changes', async () => {
  const oldSave = jest.fn();
  const newSave = jest.fn();
  const f = createFixture(
    '<div autosave="model.bind: model; save.bind: save; options.bind: options; session.from-view: session"></div>',
    { model: { n: 0 }, save: oldSave, options: {}, session: undefined as any },
    [AureliaAutosaveConfiguration],
  );
  await f.startPromise;
  try {
    f.component.model.n = 1;
    f.component.save = newSave;
    runTasks();
    expect(await f.component.session.flush()).toBe(true);
    expect(oldSave).not.toHaveBeenCalled();
    expect(newSave).toHaveBeenCalledWith({ n: 1 }, expect.any(AbortSignal));
    f.component.model.n = 2;
    f.component.options = { delay: 100 };
    runTasks();
    await f.component.session.flush();
    expect(newSave).toHaveBeenLastCalledWith({ n: 2 }, expect.any(AbortSignal));
  } finally {
    await f.tearDown();
  }
});
it('supports explicit initial saves for newly created drafts', async () => {
  const f = await setup();
  const save = jest.fn();
  const session = f.container
    .get(AutosaveFactory)
    .create({ title: 'New' }, save, { saveInitial: true });
  try {
    expect(session.hasPendingChanges).toBe(true);
    expect(await session.flush()).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(session.hasPendingChanges).toBe(false);
  } finally {
    session.dispose();
    await f.tearDown();
  }
});

it('clears a serialization error when a flush returns to the acknowledged model', async () => {
  const f = await setup();
  const model: { n: number; cycle?: unknown } = { n: 0 };
  const save = jest.fn();
  const session = f.container.get(AutosaveFactory).create(model, save);
  try {
    model.cycle = model;
    expect(await session.flush()).toBe(false);
    expect(session.status).toBe('error');
    delete model.cycle;
    expect(await session.flush()).toBe(true);
    expect(session.status).toBe('idle');
    expect(session.error).toBeNull();
    expect(session.dirty).toBe(false);
    expect(save).not.toHaveBeenCalled();
  } finally {
    session.dispose();
    await f.tearDown();
  }
});
