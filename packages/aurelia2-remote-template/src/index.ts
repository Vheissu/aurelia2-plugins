import {
  bindable,
  BindingMode,
  customElement,
  DI,
  IContainer,
  CustomElement,
  ITemplateCompiler,
  IPlatform,
  Registration,
  resolve,
} from 'aurelia';

export interface RemoteTemplateOptions {
  /** Templates execute with application privileges. List only origins you control. */
  allowedOrigins: readonly string[];
  fetch: typeof globalThis.fetch;
  ttl: number;
  capacity: number;
  maxBytes: number;
  /** Milliseconds for the complete request and body read; zero disables the deadline. */
  timeout: number;
}
const defaults: RemoteTemplateOptions = {
  allowedOrigins: [],
  fetch: (...args) => globalThis.fetch(...args),
  ttl: 60_000,
  capacity: 32,
  maxBytes: 256_000,
  timeout: 15_000,
};
export const IRemoteTemplateOptions =
  DI.createInterface<RemoteTemplateOptions>('IRemoteTemplateOptions');
export const IRemoteTemplates = DI.createInterface<RemoteTemplates>('IRemoteTemplates', (x) =>
  x.singleton(RemoteTemplates),
);

export class RemoteTemplates {
  private readonly options = resolve(IRemoteTemplateOptions);
  private readonly platform = resolve(IPlatform);
  private readonly cache = new Map<string, { html: string; expires: number }>();
  private revision = 0;
  private sequence = 0;
  private readonly newest = new Map<string, number>();

  async load(source: string, signal?: AbortSignal): Promise<string> {
    const url = new URL(source, this.platform.document.baseURI);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      !this.options.allowedOrigins.includes(url.origin)
    ) {
      throw new Error(`Untrusted template origin: ${url.origin}`);
    }
    url.hash = '';
    signal?.throwIfAborted();
    const key = url.href;
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached.html;
    }
    this.cache.delete(key);
    const revision = this.revision;
    const sequence = ++this.sequence;
    this.newest.set(key, sequence);
    const controller = new AbortController();
    const forward = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', forward, { once: true });
    const timer =
      this.options.timeout > 0
        ? setTimeout(
            () => controller.abort(new Error('Template request timed out')),
            this.options.timeout,
          )
        : undefined;
    try {
      const request = Promise.resolve()
        .then(() => {
          controller.signal.throwIfAborted();
          return this.options.fetch(key, {
            signal: controller.signal,
            redirect: 'error',
            credentials: 'same-origin',
            headers: { Accept: 'text/html' },
          });
        })
        .then((response) => {
          if (controller.signal.aborted) {
            void response.body?.cancel().catch(() => {});
            controller.signal.throwIfAborted();
          }
          return response;
        });
      const response = await abortable(request, controller.signal);
      if (
        !response.ok ||
        !/^text\/html(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '') ||
        Number(response.headers.get('content-length')) > this.options.maxBytes
      ) {
        void response.body?.cancel().catch(() => {});
        if (!response.ok) throw new Error(`Template request failed (${response.status})`);
        if (Number(response.headers.get('content-length')) > this.options.maxBytes)
          throw new Error('Template exceeds maxBytes');
        throw new Error('Template response must have a text/html content type');
      }
      const html = await this.read(response, controller.signal);
      if (
        revision === this.revision &&
        this.newest.get(key) === sequence &&
        this.options.capacity > 0 &&
        this.options.ttl > 0
      ) {
        this.cache.delete(key);
        this.cache.set(key, { html, expires: Date.now() + this.options.ttl });
        while (this.cache.size > this.options.capacity)
          this.cache.delete(this.cache.keys().next().value!);
      }
      return html;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forward);
      if (this.newest.get(key) === sequence) this.newest.delete(key);
    }
  }
  private async read(response: Response, signal: AbortSignal): Promise<string> {
    if (!response.body) {
      const html = await abortable(response.text(), signal);
      if (new Blob([html]).size > this.options.maxBytes)
        throw new Error('Template exceeds maxBytes');
      return html;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    const parts: string[] = [];
    const cancel = () => {
      void reader.cancel(signal.reason).catch(() => {});
    };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      while (true) {
        const { value, done } = await abortable(reader.read(), signal);
        if (done) break;
        bytes += value.byteLength;
        if (bytes > this.options.maxBytes) {
          void reader.cancel().catch(() => {});
          throw new Error('Template exceeds maxBytes');
        }
        parts.push(decoder.decode(value, { stream: true }));
      }
      parts.push(decoder.decode());
      return parts.join('');
    } finally {
      signal.removeEventListener('abort', cancel);
      reader.releaseLock();
    }
  }

  /** Clear on logout or a tenant change; in-flight responses cannot repopulate the old cache. */
  clear(): void {
    this.revision++;
    this.cache.clear();
  }
}

@customElement({
  name: 'au-remote-template',
  template: `<au-compose if.bind="html !== null" template.bind="html" component.bind="context" scope-behavior="scoped"></au-compose>
    <au-slot if.bind="pending" name="loading"></au-slot>
    <au-slot if.bind="error !== null" name="error"></au-slot>`,
})
export class AuRemoteTemplate {
  @bindable src = '';
  @bindable context: object = {};
  @bindable({ mode: BindingMode.fromView }) pending = false;
  @bindable({ mode: BindingMode.fromView }) error: unknown = null;
  html: string | null = null;
  settled: Promise<void> = Promise.resolve();
  private readonly templates = resolve(IRemoteTemplates);
  private readonly container = resolve(IContainer);
  private readonly compiler = resolve(ITemplateCompiler);
  private abort?: AbortController;
  private active = false;
  binding(): void {
    this.active = true;
    this.reload();
  }
  srcChanged(): void {
    if (this.active) this.reload();
  }
  reload(): void {
    this.abort?.abort();
    const abort = (this.abort = new AbortController());
    this.html = null;
    this.error = null;
    this.pending = this.active && !!this.src;
    if (!this.pending) {
      this.settled = Promise.resolve();
      return;
    }
    this.settled = this.templates
      .load(this.src, abort.signal)
      .then((html) => {
        if (abort.signal.aborted) return;
        // Parse before publishing so malformed server bindings use the error slot.
        const Type = CustomElement.define(
          { name: 'remote-template-content', template: html },
          class {},
        );
        this.compiler.compile(CustomElement.getDefinition(Type), this.container);
        this.html = html;
      })
      .catch((error) => {
        if (!abort.signal.aborted) this.error = error;
      })
      .finally(() => {
        if (this.abort === abort) this.pending = false;
      });
  }
  unbinding(): void {
    this.active = false;
    this.abort?.abort();
    this.html = null;
    this.pending = false;
  }
}

function configure(options: Partial<RemoteTemplateOptions> = {}) {
  const value = { ...defaults, ...options, allowedOrigins: [...(options.allowedOrigins ?? [])] };
  if (
    !Number.isFinite(value.ttl) ||
    value.ttl < 0 ||
    !Number.isInteger(value.capacity) ||
    value.capacity < 0 ||
    !Number.isFinite(value.maxBytes) ||
    value.maxBytes <= 0 ||
    !Number.isFinite(value.timeout) ||
    value.timeout < 0
  )
    throw new Error('Invalid template cache limits');
  return {
    register(container: IContainer) {
      return container.register(
        Registration.instance(IRemoteTemplateOptions, value),
        IRemoteTemplates,
        AuRemoteTemplate,
      );
    },
  };
}
export const AureliaRemoteTemplateConfiguration = { ...configure(), configure };

/** Observe settlement even when an application-supplied transport ignores AbortSignal. */
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) abort();
  });
}
