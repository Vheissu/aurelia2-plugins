import { createFixture } from '@aurelia/testing';
import { AsyncTask, AureliaAsyncTaskConfiguration, TaskFactory } from '../src/index';
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
describe('async tasks', () => {
  it('restarts and prevents stale completions from replacing the result', async () => {
    const a = deferred<string>();
    const b = deferred<string>();
    const signals: AbortSignal[] = [];
    const task = new AsyncTask(
      (arg: string, signal) => {
        signals.push(signal);
        return arg === 'a' ? a.promise : b.promise;
      },
      { policy: 'restart', maxQueued: 2 },
    );
    const first = task.run('a');
    await tick();
    const second = task.run('b');
    await tick();
    expect(signals[0].aborted).toBe(true);
    expect(await first).toEqual({ status: 'cancelled' });
    b.resolve('new');
    expect(await second).toEqual({ status: 'completed', value: 'new' });
    a.resolve('old');
    await tick();
    expect(task.value).toBe('new');
  });
  it('drops competing work and reports failures without an unhandled rejection', async () => {
    const a = deferred<number>();
    const task = new AsyncTask(() => a.promise, { policy: 'drop', maxQueued: 0 });
    const first = task.run(undefined);
    expect(await task.run(undefined)).toEqual({ status: 'dropped' });
    a.reject('failed');
    expect(await first).toEqual({ status: 'failed', error: 'failed' });
    expect(task.error).toBe('failed');
  });
  it('runs queued jobs in order and bounds the queue', async () => {
    const a = deferred<number>();
    const calls: number[] = [];
    const task = new AsyncTask(
      (n: number) => {
        calls.push(n);
        return n === 1 ? a.promise : n;
      },
      { policy: 'enqueue', maxQueued: 1 },
    );
    const first = task.run(1);
    const second = task.run(2);
    expect(await task.run(3)).toEqual({ status: 'dropped' });
    expect(task.queued).toBe(1);
    await tick();
    expect(calls).toEqual([1]);
    a.resolve(1);
    await first;
    expect(await second).toEqual({ status: 'completed', value: 2 });
    expect(calls).toEqual([1, 2]);
  });
  it('settles all cancelled promises even when actions never settle', async () => {
    const task = new AsyncTask(() => new Promise(() => {}), { policy: 'enqueue', maxQueued: 2 });
    const results = [task.run(1), task.run(2), task.run(3)];
    task.dispose();
    expect(await Promise.all(results)).toEqual(Array(3).fill({ status: 'cancelled' }));
    expect(task.running).toBe(false);
    expect(await task.run(4)).toEqual({ status: 'cancelled' });
  });
  it('handles synchronous failures and validates configuration', async () => {
    const task = new AsyncTask(
      () => {
        throw Error('oops');
      },
      { policy: 'restart', maxQueued: 1 },
    );
    expect((await task.run(null)).status).toBe('failed');
    expect(() => AureliaAsyncTaskConfiguration.configure({ maxQueued: -1 })).toThrow();
  });
  it('connects DOM actions and cancels work when the view detaches', async () => {
    const f = createFixture(
      '<button task-run="task.bind: task; args.bind: 4">Go</button>',
      { task: undefined as any },
      [AureliaAsyncTaskConfiguration],
    );
    await f.startPromise;
    const action = deferred<number>();
    let signal!: AbortSignal;
    f.component.task = f.container.get(TaskFactory).create((_n: number, s) => {
      signal = s;
      return action.promise;
    });
    await tick();
    const button = f.appHost.querySelector('button')!;
    const listener = jest.fn();
    button.addEventListener('task-settled', listener);
    button.click();
    await tick();
    expect(f.component.task.running).toBe(true);
    await f.tearDown();
    expect(signal.aborted).toBe(true);
    action.resolve(4);
    await tick();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('task completion boundaries', () => {
  it('can immediately run again after awaiting a drop-policy task', async () => {
    const task = new AsyncTask((n: number) => n, { policy: 'drop', maxQueued: 0 });
    await task.run(1);
    expect(task.running).toBe(false);
    expect(await task.run(2)).toEqual({ status: 'completed', value: 2 });
  });
  it('changes the listened event and cancels a replaced task', async () => {
    const f = createFixture(
      '<button task-run="task.bind: task; on.bind: event">Run</button>',
      { task: undefined as any, event: 'click' },
      [AureliaAsyncTaskConfiguration],
    );
    await f.startPromise;
    const factory = f.container.get(TaskFactory);
    const first = factory.create(() => new Promise(() => {}));
    const second = factory.create(() => 'done');
    f.component.task = first;
    await tick();
    const button = f.appHost.querySelector('button')!;
    button.click();
    await tick();
    f.component.task = second;
    f.component.event = 'dblclick';
    await tick();
    expect(first.running).toBe(false);
    button.click();
    expect(second.status).toBe('idle');
    button.dispatchEvent(new Event('dblclick'));
    await tick();
    expect(second.value).toBe('done');
    await f.tearDown();
  });
});

it('does not enqueue a restart behind work launched reentrantly by an abort listener', async () => {
  let task: AsyncTask<number, number>;
  const calls: number[] = [];
  task = new AsyncTask(
    (n, signal) => {
      calls.push(n);
      if (n === 1)
        signal.addEventListener('abort', () => {
          void task.run(2);
        });
      return n === 3 ? 3 : new Promise(() => {});
    },
    { policy: 'restart', maxQueued: 1 },
  );
  void task.run(1);
  await tick();
  const third = task.run(3);
  await tick();
  const result = await Promise.race([third, tick().then(() => 'blocked')]);
  task.dispose();
  expect(result).toEqual({ status: 'completed', value: 3 });
  expect(calls).not.toContain(2);
});
