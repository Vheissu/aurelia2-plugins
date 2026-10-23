import { bindable, customAttribute, DI, IContainer, INode, Registration, resolve } from 'aurelia';

export type TaskPolicy = 'restart' | 'drop' | 'enqueue';
export type TaskOutcome<T> =
  | { status: 'completed'; value: T }
  | { status: 'failed'; error: unknown }
  | { status: 'cancelled' | 'dropped' };
export interface TaskOptions {
  policy: TaskPolicy;
  maxQueued: number;
}
interface Job<A, R> {
  args: A;
  abort: AbortController;
  settle: (outcome: TaskOutcome<R>) => void;
}
export class AsyncTask<A, R> {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled' = 'idle';
  value: R | undefined;
  error: unknown = null;
  queued = 0;
  private current?: Job<A, R>;
  private queue: Job<A, R>[] = [];
  private disposed = false;
  private cancelling = false;
  get running(): boolean {
    return this.current !== undefined;
  }
  constructor(
    private readonly action: (args: A, signal: AbortSignal) => R | Promise<R>,
    private readonly options: TaskOptions,
  ) {
    if (
      !['restart', 'drop', 'enqueue'].includes(options.policy) ||
      !Number.isInteger(options.maxQueued) ||
      options.maxQueued < 0
    )
      throw new Error('Invalid task policy or queue limit');
    this.options = { ...options };
  }
  run(args: A): Promise<TaskOutcome<R>> {
    if (this.disposed || this.cancelling) return Promise.resolve({ status: 'cancelled' });
    if (
      this.current &&
      (this.options.policy === 'drop' ||
        (this.options.policy === 'enqueue' && this.queue.length >= this.options.maxQueued))
    )
      return Promise.resolve({ status: 'dropped' });
    if (this.options.policy === 'restart') this.cancel();
    // Abort listeners can dispose the task synchronously during cancellation.
    if (this.disposed) return Promise.resolve({ status: 'cancelled' });
    return new Promise((resolve) => {
      const job: Job<A, R> = { args, abort: new AbortController(), settle: resolve };
      if (this.current) {
        this.queue.push(job);
        this.queued = this.queue.length;
      } else this.start(job);
    });
  }
  cancel(): void {
    if (this.cancelling) return;
    const current = this.current;
    this.current = undefined;
    const jobs = [...(current ? [current] : []), ...this.queue];
    this.queue = [];
    this.queued = 0;
    if (jobs.length) this.status = 'cancelled';
    this.cancelling = true;
    try {
      for (const job of jobs) {
        job.abort.abort();
        job.settle({ status: 'cancelled' });
      }
    } finally {
      this.cancelling = false;
    }
  }
  dispose(): void {
    this.disposed = true;
    this.cancel();
  }
  private start(job: Job<A, R>): void {
    this.current = job;
    this.status = 'running';
    this.error = null;
    void Promise.resolve()
      .then(() => {
        job.abort.signal.throwIfAborted();
        return this.action(job.args, job.abort.signal);
      })
      .then(
        (value) => this.finish(job, { status: 'completed', value }),
        (error) => this.finish(job, { status: 'failed', error }),
      );
  }
  private finish(job: Job<A, R>, outcome: TaskOutcome<R>): void {
    if (this.current !== job) return;
    if (outcome.status === 'completed') {
      this.value = outcome.value;
      this.status = 'completed';
    } else if (outcome.status === 'failed') {
      this.error = outcome.error;
      this.status = 'failed';
    }
    this.current = undefined;
    const next = this.queue.shift();
    this.queued = this.queue.length;
    if (next) this.start(next);
    job.settle(outcome);
  }
}
export const ITaskOptions = DI.createInterface<TaskOptions>('ITaskOptions');
export class TaskFactory {
  private readonly defaults = resolve(ITaskOptions);
  create<A, R>(
    action: (args: A, signal: AbortSignal) => R | Promise<R>,
    options: Partial<TaskOptions> = {},
  ): AsyncTask<A, R> {
    return new AsyncTask(action, { ...this.defaults, ...options });
  }
}
/** The attribute owns the supplied task for its attachment lifetime. */
@customAttribute({ name: 'task-run', defaultProperty: 'task' })
export class TaskRun {
  @bindable task?: AsyncTask<unknown, unknown>;
  @bindable args: unknown;
  @bindable on = 'click';
  private readonly host = resolve(INode) as HTMLElement;
  private listening = '';
  private epoch = 0;
  private readonly handle = (event: Event) => {
    if (event.defaultPrevented || !this.task) return;
    event.preventDefault();
    const epoch = this.epoch;
    void this.task.run(this.args).then((outcome) => {
      if (epoch === this.epoch)
        this.host.dispatchEvent(
          new CustomEvent('task-settled', { bubbles: true, detail: outcome }),
        );
    });
  };
  attached(): void {
    this.listening = this.on;
    this.host.addEventListener(this.listening, this.handle);
  }
  onChanged(): void {
    if (this.listening) {
      this.host.removeEventListener(this.listening, this.handle);
      this.attached();
    }
  }
  taskChanged(_next: AsyncTask<unknown, unknown>, previous?: AsyncTask<unknown, unknown>): void {
    this.epoch++;
    previous?.cancel();
  }
  detaching(): void {
    this.epoch++;
    this.host.removeEventListener(this.listening, this.handle);
    this.listening = '';
    this.task?.cancel();
  }
}
function configure(options: Partial<TaskOptions> = {}) {
  const value: TaskOptions = { policy: 'restart', maxQueued: 20, ...options };
  if (
    !['restart', 'drop', 'enqueue'].includes(value.policy) ||
    !Number.isInteger(value.maxQueued) ||
    value.maxQueued < 0
  )
    throw new Error('Invalid task options');
  return {
    register(container: IContainer) {
      return container.register(
        Registration.instance(ITaskOptions, value),
        Registration.singleton(TaskFactory, TaskFactory),
        TaskRun,
      );
    },
  };
}
export const AureliaAsyncTaskConfiguration = { ...configure(), configure };
