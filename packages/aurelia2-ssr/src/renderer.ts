import { DI, type IContainer, Registration } from '@aurelia/kernel';
import {
  Aurelia,
  IPlatform,
  ISSRContext,
  StandardConfiguration,
  type ISSRScope,
} from '@aurelia/runtime-html';
import { BrowserPlatform } from '@aurelia/platform-browser';
import { ISsrRoute } from './configuration.js';
import { installDomGlobals } from './globals.js';
import { ISsrHead, SsrHead } from './head.js';
import { recordSsrManifest } from './manifest.js';
import { createSsrRouterRegistrations } from './router.js';
import { createSsrStateRegistration, SsrState } from './state.js';
import { createSsrTemplateFactoryRegistration } from './template-factory.js';
import { serializeElementForSsr } from './shadow-dom.js';
import { verifySsrHydration } from './verify.js';
import type {
  SerializeHtmlOptions,
  SsrAppRenderResult,
  SsrDiagnostic,
  SsrGlobalStrategy,
  SsrRenderAureliaOptions,
  SsrRenderContext,
  SsrSiteConfig,
  SsrTakeoverMode,
} from './types.js';

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
    createSsrTemplateFactoryRegistration(),
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
  const path = route?.path ?? window.location.pathname;
  const takeoverMode: SsrTakeoverMode = route?.render?.takeoverMode
    ?? site?.rendering?.takeoverMode
    ?? 'remount';
  const globalStrategy: SsrGlobalStrategy = options.globalStrategy
    ?? site?.rendering?.globalStrategy
    ?? 'install-and-restore';
  const restoreGlobals = globalStrategy === 'none'
    ? () => undefined
    : installDomGlobals(window);
  const diagnostics: SsrDiagnostic[] = [];
  const timings: Record<string, number> = {};

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

    if (takeoverMode === 'hydrate') {
      if (!preserveMarkers || serializeOptions.stripAureliaMarkers) {
        diagnostics.push(diagnostic('error', 'hydrate_requires_markers',
          'takeoverMode "hydrate" needs Aurelia marker comments in the HTML. Remove stripAureliaMarkers or set render.preserveMarkers to true.', path));
      }
      if (serializeOptions.preserveComments === false) {
        diagnostics.push(diagnostic('error', 'hydrate_requires_comments',
          'takeoverMode "hydrate" needs comments preserved in the serialized HTML.', path));
      }
    }

    const state = options.state === false ? null : (options.state ?? SsrState.forServer());
    const head = options.head === false ? null : SsrHead.forServer();
    const routerRegistrations = await resolveRouterRegistrations(options, path, window, diagnostics);
    const server = createServerContainer(
      window,
      [
        ...routerRegistrations,
        ...(state ? [createSsrStateRegistration(state)] : []),
        ...(head ? [Registration.instance(ISsrHead, head)] : []),
        Registration.instance(ISsrRoute, route ?? null),
        ...(options.registrations ?? []),
      ],
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

    let phase = now();
    await aurelia.start();
    timings.startMs = elapsed(phase);

    phase = now();
    await settleSsr(window, options.settle, context, site);
    await options.afterStart?.(context);
    timings.settleMs = elapsed(phase);

    phase = now();
    const appHtml = serializeElementForSsr(host, serializeOptions);
    timings.serializeMs = elapsed(phase);

    let ssrScope: ISSRScope | undefined;
    if (options.manifest !== false) {
      phase = now();
      const recording = recordSsrManifest(aurelia.root.controller, {
        path,
        ...(options.manifest ?? {}),
      });
      ssrScope = recording.scope;
      diagnostics.push(...recording.diagnostics);
      timings.manifestMs = elapsed(phase);
    }

    await options.beforeStop?.(context);

    const verifyHydration = options.verifyHydration
      ?? route?.render?.verifyHydration
      ?? site?.rendering?.verifyHydration
      ?? false;

    if (verifyHydration) {
      if (ssrScope == null) {
        diagnostics.push(diagnostic('warning', 'verify_requires_manifest',
          'verifyHydration was requested but manifest recording is disabled.', path));
      } else if (typeof options.component !== 'function') {
        diagnostics.push(diagnostic('warning', 'verify_requires_component_class',
          'verifyHydration needs the root component class, not an instance.', path));
      } else {
        // Stop the server app first so the verification tree is the only
        // Aurelia instance touching this document.
        await aurelia.stop(true);
        aurelia = null;

        phase = now();
        const configureAurelia = options.configureAurelia;
        // Mirror the client: same route, the embedded state as a client store,
        // a live-document head, and the server location manager for routers.
        const verification = await verifySsrHydration({
          window,
          component: options.component,
          appHtml,
          ssrScope,
          registrations: [
            ...routerRegistrations,
            ...(state ? [createSsrStateRegistration(new SsrState(state.toJSON(), false))] : []),
            ...(head ? [Registration.instance(ISsrHead, new SsrHead(false, null))] : []),
            Registration.instance(ISsrRoute, route ?? null),
            ...(options.registrations ?? []),
          ],
          path,
          configureAurelia: configureAurelia
            ? instance => configureAurelia(instance, { ...context, container: instance.container })
            : undefined,
        });
        diagnostics.push(...verification.diagnostics);
        timings.verifyMs = elapsed(phase);
      }
    }

    const headSnapshot = head?.snapshot();

    return {
      appHtml,
      documentTitle: headSnapshot?.title ?? document.title,
      path: window.location.pathname,
      status: headSnapshot?.status ?? route?.status,
      redirectTo: headSnapshot?.redirectTo ?? route?.redirectTo,
      ssrScope,
      timings: {
        ...timings,
        renderMs: elapsed(startedAt),
      },
      diagnostics,
      data: route?.data,
      state: state && state.size > 0 ? state.toJSON() : undefined,
      head: headSnapshot,
    };
  } catch (error) {
    diagnostics.push(diagnostic('error', 'render_failed',
      error instanceof Error ? error.message : String(error), path));

    return {
      appHtml: '',
      documentTitle: document.title,
      path: window.location.pathname,
      status: 500,
      timings: {
        ...timings,
        renderMs: elapsed(startedAt),
      },
      diagnostics,
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

async function resolveRouterRegistrations(
  options: SsrRenderAureliaOptions<object>,
  path: string,
  window: Window,
  diagnostics: SsrDiagnostic[],
): Promise<readonly unknown[]> {
  const router = options.router ?? 'auto';
  if (router === false) {
    return [];
  }

  const config = typeof router === 'object' ? router : {};
  const search = window.location?.search ?? '';
  const routerPath = config.path ?? `${path}${path.includes('?') ? '' : search}`;

  try {
    return await createSsrRouterRegistrations({ path: routerPath, baseHref: config.baseHref });
  } catch (error) {
    if (router === true) {
      diagnostics.push(diagnostic('warning', 'router_unavailable',
        `router: true was set but @aurelia/router could not be loaded: ${error instanceof Error ? error.message : String(error)}`, path));
    }
    return [];
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

function diagnostic(
  severity: SsrDiagnostic['severity'],
  code: string,
  message: string,
  path: string,
  value?: unknown,
): SsrDiagnostic {
  return { severity, code, message, path, value };
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function elapsed(since: number): number {
  return Math.round(now() - since);
}
