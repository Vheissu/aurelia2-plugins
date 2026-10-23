import { ReadableStream } from 'node:stream/web';
import { TextDecoder, TextEncoder } from 'node:util';
import { createFixture } from '@aurelia/testing';
import { runTasks } from 'aurelia';
import { AureliaRemoteTemplateConfiguration, IRemoteTemplates } from '../src/index';

const response = (html: string, status = 200, type = 'text/html') =>
  ({
    ok: status < 400,
    status,
    headers: { get: (key: string) => (key === 'content-type' ? type : null) },
    text: async () => html,
  }) as Response;
const tick = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await runTasks();
};
function setup(fetch = jest.fn(async () => response('<b>${name}</b>')), options = {}) {
  return createFixture(
    '<au-remote-template src.bind="src" context.bind="data" component.ref="view"></au-remote-template>',
    { src: 'https://templates.test/a', data: { name: 'Ada' }, view: undefined as any },
    [
      AureliaRemoteTemplateConfiguration.configure({
        allowedOrigins: ['https://templates.test'],
        fetch: fetch as any,
        ...options,
      }),
    ],
  );
}
describe('remote templates', () => {
  it('compiles Aurelia expressions and keeps context bindings live', async () => {
    const f = setup();
    await f.startPromise;
    await f.component.view.settled;
    await tick();
    expect(f.appHost.querySelector('b')?.textContent).toBe('Ada');
    f.component.data.name = 'Grace';
    await runTasks();
    expect(f.appHost.querySelector('b')?.textContent).toBe('Grace');
    await f.tearDown();
  });
  it('rejects untrusted origins and non-HTML responses', async () => {
    const fetch = jest.fn(async () => response('no', 200, 'application/json'));
    const f = setup(fetch);
    await f.startPromise;
    await f.component.view.settled;
    const client = f.container.get(IRemoteTemplates);
    await expect(client.load('https://evil.test/')).rejects.toThrow('Untrusted');
    await expect(client.load('javascript:alert(1)')).rejects.toThrow('Untrusted');
    await expect(client.load('https://u:p@templates.test/')).rejects.toThrow('Untrusted');
    expect(f.component.view.error.message).toContain('text/html');
    await f.tearDown();
  });
  it('ignores stale responses and aborts on detach', async () => {
    const pending: { resolve: (r: Response) => void; signal: AbortSignal }[] = [];
    const fetch = jest.fn(
      (_url, init) =>
        new Promise<Response>((resolve) => pending.push({ resolve, signal: init.signal })),
    );
    const f = setup(fetch as any);
    await f.startPromise;
    f.component.src = 'https://templates.test/b';
    await runTasks();
    expect(pending[0].signal.aborted).toBe(true);
    pending[1].resolve(response('<i>new</i>'));
    await tick();
    pending[0].resolve(response('<i>old</i>'));
    await tick();
    expect(f.appHost.textContent).toContain('new');
    expect(f.appHost.textContent).not.toContain('old');
    f.component.src = 'https://templates.test/pending';
    await tick();
    await f.tearDown();
    expect(pending[2].signal.aborted).toBe(true);
  });
  it('bounds its LRU cache and supports clear and expiry', async () => {
    const fetch = jest.fn(async () => response('ok'));
    const f = setup(fetch, { capacity: 1, ttl: 50 });
    await f.startPromise;
    await f.component.view.settled;
    const client = f.container.get(IRemoteTemplates);
    await client.load('https://templates.test/a');
    expect(fetch).toHaveBeenCalledTimes(1);
    await client.load('https://templates.test/b');
    await client.load('https://templates.test/a');
    expect(fetch).toHaveBeenCalledTimes(3);
    client.clear();
    await client.load('https://templates.test/a');
    expect(fetch).toHaveBeenCalledTimes(4);
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 100);
    await client.load('https://templates.test/a');
    expect(fetch).toHaveBeenCalledTimes(5);
    now.mockRestore();
    await f.tearDown();
  });
  it('reports HTTP errors and enforces byte limits', async () => {
    const fetch = jest.fn(async () => response('no', 500));
    const f = setup(fetch);
    await f.startPromise;
    await f.component.view.settled;
    expect(f.component.view.error.message).toContain('500');
    expect(f.component.view.pending).toBe(false);
    await f.tearDown();
    const g = setup(
      jest.fn(async () => response('€€')),
      { maxBytes: 5 },
    );
    await g.startPromise;
    await g.component.view.settled;
    expect(g.component.view.error.message).toContain('maxBytes');
    await g.tearDown();
  });
  it('validates cache configuration', () => {
    expect(() => AureliaRemoteTemplateConfiguration.configure({ capacity: -1 })).toThrow();
  });
});

it('does not repopulate a cleared cache from an older in-flight request', async () => {
  let complete!: (response: Response) => void;
  const fetch = jest.fn(
    () =>
      new Promise<Response>((resolve) => {
        complete = resolve;
      }),
  );
  const f = setup(fetch as any);
  await f.startPromise;
  const client = f.container.get(IRemoteTemplates);
  client.clear();
  complete(response('first'));
  await f.component.view.settled;
  fetch.mockImplementation(async () => response('second'));
  expect(await client.load('https://templates.test/a')).toBe('second');
  expect(fetch).toHaveBeenCalledTimes(2);
  await f.tearDown();
});

it('supports disabled caching, aborted callers and clearing an active source', async () => {
  const fetch = jest.fn(async () => response('ok'));
  const f = setup(fetch, { ttl: 0 });
  await f.startPromise;
  await f.component.view.settled;
  const client = f.container.get(IRemoteTemplates);
  await client.load('https://templates.test/a');
  expect(fetch).toHaveBeenCalledTimes(2);
  const abort = new AbortController();
  abort.abort();
  await expect(client.load('https://templates.test/a', abort.signal)).rejects.toBeDefined();
  expect(fetch).toHaveBeenCalledTimes(2);
  f.component.src = '';
  await tick();
  expect(f.component.view.html).toBeNull();
  expect(f.component.view.pending).toBe(false);
  await f.component.view.settled;
  await f.tearDown();
});

it('uses the configured fetch contract and rejects an oversized declared length before reading', async () => {
  const read = jest.fn(async () => 'small');
  const fetch = jest.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        headers: { get: (key) => (key === 'content-type' ? 'text/html; charset=utf-8' : '1000') },
        text: read,
      }) as unknown as Response,
  );
  const f = setup(fetch, { maxBytes: 100 });
  await f.startPromise;
  await f.component.view.settled;
  expect(read).not.toHaveBeenCalled();
  expect(fetch.mock.calls[0][1]).toMatchObject({
    redirect: 'error',
    credentials: 'same-origin',
    headers: { Accept: 'text/html' },
  });
  await f.tearDown();
});

it('does not allow an older concurrent request to overwrite a newer cached template', async () => {
  const f = setup();
  await f.startPromise;
  await f.component.view.settled;
  const complete: ((response: Response) => void)[] = [];
  const fetch = f.container.get(require('../src/index').IRemoteTemplateOptions).fetch as jest.Mock;
  fetch.mockImplementation(() => new Promise((resolve) => complete.push(resolve)));
  const client = f.container.get(IRemoteTemplates);
  client.clear();
  const old = client.load('https://templates.test/race');
  const newer = client.load('https://templates.test/race');
  await tick();
  complete[1](response('new'));
  await newer;
  complete[0](response('old'));
  await old;
  try {
    expect(await client.load('https://templates.test/race')).toBe('new');
  } finally {
    await f.tearDown();
  }
});
it('cancels an oversized stream without consuming the remaining response', async () => {
  const original = globalThis.TextDecoder;
  globalThis.TextDecoder = TextDecoder as any;
  const cancel = jest.fn();
  let pulls = 0;
  const body = new ReadableStream({
    pull(controller) {
      pulls++;
      controller.enqueue(new Uint8Array(4));
    },
    cancel,
  });
  const f = setup(
    jest.fn(async () => ({ ...response('unused'), body }) as Response),
    { maxBytes: 5 },
  );
  try {
    await f.startPromise;
    await f.component.view.settled;
    expect(f.component.view.error.message).toContain('maxBytes');
    expect(cancel).toHaveBeenCalled();
    expect(pulls).toBeLessThan(5);
  } finally {
    await f.tearDown();
    globalThis.TextDecoder = original;
  }
});
it('decodes UTF-8 characters split across streamed chunks', async () => {
  const original = globalThis.TextDecoder;
  globalThis.TextDecoder = TextDecoder as any;
  const bytes = new TextEncoder().encode('<b>€</b>');
  const body = new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  });
  const f = setup(jest.fn(async () => ({ ...response('unused'), body }) as Response));
  try {
    await f.startPromise;
    await f.component.view.settled;
    await tick();
    expect(f.appHost.querySelector('b')!.textContent).toBe('€');
  } finally {
    await f.tearDown();
    globalThis.TextDecoder = original;
  }
});
it('times out a transport that ignores its abort signal and clears pending state', async () => {
  jest.useFakeTimers();
  const f = setup(jest.fn(() => new Promise(() => {})) as any, { timeout: 10 });
  try {
    await f.startPromise;
    await jest.advanceTimersByTimeAsync(10);
    await f.component.view.settled;
    expect(f.component.view.pending).toBe(false);
    expect(f.component.view.error.message).toContain('timed out');
  } finally {
    await f.tearDown();
    jest.useRealTimers();
  }
});
it('cancels an unfinished body read on detachment', async () => {
  const original = globalThis.TextDecoder;
  globalThis.TextDecoder = TextDecoder as any;
  const cancel = jest.fn();
  const body = new ReadableStream({ pull() {}, cancel });
  const f = setup(jest.fn(async () => ({ ...response('unused'), body }) as Response));
  await f.startPromise;
  await tick();
  const settled = f.component.view.settled;
  await f.tearDown();
  try {
    await settled;
    expect(cancel).toHaveBeenCalledTimes(1);
  } finally {
    globalThis.TextDecoder = original;
  }
});

it('reports malformed Aurelia expressions through its error output before rendering', async () => {
  const f = setup(jest.fn(async () => response('<p>${(}</p>')));
  try {
    await f.startPromise;
    await f.component.view.settled;
    await tick();
    expect(f.component.view.error).toBeInstanceOf(Error);
    expect(f.appHost.querySelector('p')).toBeNull();
  } finally {
    await f.tearDown();
  }
});

it('activates and disposes DI-created resources inside fetched templates across restart', async () => {
  const { CustomElement, resolve, DI, Registration } = await import('aurelia');
  const counts = { bound: 0, unbound: 0 };
  const token = DI.createInterface<typeof counts>('ProbeCounts');
  const Probe = CustomElement.define(
    { name: 'remote-probe', template: '<b>Probe</b>' },
    class {
      counts = resolve(token);
      binding() {
        this.counts.bound++;
      }
      unbinding() {
        this.counts.unbound++;
      }
    },
  );
  const f = createFixture(
    '<au-remote-template src="https://templates.test/probe" component.ref="view"></au-remote-template>',
    { view: undefined as any },
    [
      Registration.instance(token, counts),
      Probe,
      AureliaRemoteTemplateConfiguration.configure({
        allowedOrigins: ['https://templates.test'],
        fetch: jest.fn(async () => response('<remote-probe></remote-probe>')) as any,
      }),
    ],
  );
  await f.startPromise;
  try {
    await f.component.view.settled;
    await tick();
    expect(counts).toEqual({ bound: 1, unbound: 0 });
    await f.au.stop();
    expect(counts.unbound).toBe(1);
    await f.au.start();
    await f.component.view.settled;
    await tick();
    expect(counts.bound).toBe(2);
  } finally {
    await f.tearDown();
  }
  expect(counts.unbound).toBe(2);
});
