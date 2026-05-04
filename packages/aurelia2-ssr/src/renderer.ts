import { DI, type IContainer, Registration } from '@aurelia/kernel';
import {
  Aurelia,
  IPlatform,
  ISSRContext,
  StandardConfiguration,
  type ISSRScope,
} from '@aurelia/runtime-html';
import { BrowserPlatform } from '@aurelia/platform-browser';
import { installDomGlobals } from './globals';
import { serializeElementForSsr } from './shadow-dom';
import type {
  SerializeHtmlOptions,
  SsrAppRenderResult,
  SsrDiagnostic,
  SsrGlobalStrategy,
  SsrRenderAureliaOptions,
  SsrRenderContext,
  SsrSiteConfig,
} from './types';

export function createServerContainer(
  window: Window,
  registrations: readonly unknown[] = [],
  preserveMarkers = true,
  container: IContainer = DI.createContainer(),
): { container: IContainer; platform: BrowserPlatform; restorePlatform: () => void } {
  const previousGlobalPlatform = BrowserPlatform.getOrCreate(globalThis);
  const previousWindowPlatform = BrowserPlatform.getOrCreate(window as unknown as typeof globalThis);
  const platform = new BrowserPlatform(window as unknown as typeof globalThis);
  BrowserPlatform.set(globalThis, platform);
  BrowserPlatform.set(window as unknown as typeof globalThis, platform);

  container.register(
    Registration.instance(IPlatform, platform),
    Registration.instance(ISSRContext, { preserveMarkers }),
    StandardConfiguration,
    ...registrations,
  );

  return {
    container,
    platform,
    restorePlatform: () => {
      BrowserPlatform.set(globalThis, previousGlobalPlatform);
      BrowserPlatform.set(window as unknown as typeof globalThis, previousWindowPlatform);
    },
  };
}

export async function renderAureliaToString<TComponent extends object = object>(
  options: SsrRenderAureliaOptions<TComponent>,
): Promise<SsrAppRenderResult> {
  const startedAt = now();
  const site = options.site;
  const route = options.route;
  const timeoutMs = options.timeoutMs
    ?? route?.render?.timeoutMs
    ?? site?.rendering?.timeoutMs
    ?? 5000;

  return withTimeout(renderAureliaCore(options, startedAt), timeoutMs, `Timed out rendering ${route?.path ?? options.window.location.pathname}`);
}

export function ensureSsrHost(
  document: Document,
  host?: HTMLElement,
  selector?: string,
  tagName?: string,
): HTMLElement {
  if (host) {
    return host;
  }

  const resolvedSelector = selector ?? tagName ?? 'my-app';
  const existing = document.querySelector<HTMLElement>(resolvedSelector);
  if (existing) {
    return existing;
  }

  const element = document.createElement(tagName ?? selector?.replace(/^[#.]/u, '') ?? 'my-app');
  document.body.append(element);
  return element;
}

export async function settleSsr(
  window: Window,
  settle: SsrRenderAureliaOptions['settle'],
  context: SsrRenderContext,
  site?: SsrSiteConfig,
): Promise<void> {
  if (typeof settle === 'function') {
    await settle(context);
    return;
  }

  const settleMs = settle
    ?? context.route?.render?.settleMs
    ?? site?.rendering?.settleMs
    ?? 0;

  if (settleMs > 0) {
    await new Promise<void>(resolve => {
      window.setTimeout(resolve, settleMs);
    });
  }
}

export function withTimeout<TResult>(
  promise: Promise<TResult>,
  timeoutMs: number,
  message: string,
): Promise<TResult> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

async function renderAureliaCore<TComponent extends object>(
  options: SsrRenderAureliaOptions<TComponent>,
  startedAt: number,
): Promise<SsrAppRenderResult> {
  const window = options.window;
  const document = window.document;
  const site = options.site;
  const route = options.route;
  const globalStrategy: SsrGlobalStrategy = options.globalStrategy
    ?? site?.rendering?.globalStrategy
    ?? 'install-and-restore';
  const restoreGlobals = globalStrategy === 'none'
    ? () => undefined
    : installDomGlobals(window);

  let aurelia: Aurelia | null = null;
  let restorePlatform = () => undefined;

  try {
    const host = ensureSsrHost(
      document,
      options.host,
      options.hostSelector ?? site?.rendering?.hostSelector,
      options.hostTagName ?? site?.rendering?.hostTagName,
    );
    const serializeOptions = normalizeSerializeOptions(options.serialize, site);
    const preserveMarkers = route?.render?.preserveMarkers
      ?? !serializeOptions.stripAureliaMarkers;
    const server = createServerContainer(
      window,
      options.registrations ?? [],
      preserveMarkers,
      options.container,
    );
    const { container, platform } = server;
    restorePlatform = server.restorePlatform;
    const context: SsrRenderContext<TComponent> = {
      window,
      document,
      host,
      component: options.component,
      container,
      platform,
      route,
      site,
    };

    aurelia = new Aurelia(container);
    await options.configureAurelia?.(aurelia, context);
    await options.beforeStart?.(context);
    aurelia.app({
      host,
      component: options.component,
    });
    await aurelia.start();
    await settleSsr(window, options.settle, context, site);
    await options.afterStart?.(context);

    const appHtml = serializeElementForSsr(host, serializeOptions);
    const ssrScope = getControllerSsrScope(aurelia);

    await options.beforeStop?.(context);

    return {
      appHtml,
      documentTitle: document.title,
      path: window.location.pathname,
      status: route?.status,
      redirectTo: route?.redirectTo,
      ssrScope,
      timings: {
        renderMs: Math.round(now() - startedAt),
      },
      diagnostics: [],
      data: route?.data,
    };
  } catch (error) {
    const diagnostic: SsrDiagnostic = {
      severity: 'error',
      code: 'render_failed',
      message: error instanceof Error ? error.message : String(error),
      path: route?.path ?? window.location.pathname,
    };

    return {
      appHtml: '',
      documentTitle: document.title,
      path: window.location.pathname,
      status: 500,
      diagnostics: [diagnostic],
    };
  } finally {
    if (aurelia?.isRunning) {
      await aurelia.stop(true);
    }

    if (globalStrategy === 'install-and-restore') {
      restorePlatform();
      restoreGlobals();
    }
  }
}

function normalizeSerializeOptions(
  serialize: SerializeHtmlOptions | undefined,
  site: SsrSiteConfig | undefined,
): SerializeHtmlOptions {
  return {
    shadowDom: {
      serialize: true,
      includeSerializableAttribute: true,
      includeAdoptedStyleSheets: true,
      ...(site?.shadowDom ?? {}),
      ...(serialize?.shadowDom ?? {}),
    },
    stripAureliaMarkers: serialize?.stripAureliaMarkers
      ?? site?.rendering?.stripAureliaMarkers
      ?? false,
    preserveComments: serialize?.preserveComments ?? true,
    onWarning: serialize?.onWarning,
  };
}

function getControllerSsrScope(aurelia: Aurelia): ISSRScope | undefined {
  const controller = (aurelia.root as unknown as { controller?: { ssrScope?: ISSRScope } }).controller;
  return controller?.ssrScope;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
