import { DI, Registration, type IContainer } from '@aurelia/kernel';
import {
  Aurelia,
  hydrateSSRDefinition,
  IPlatform,
  StandardConfiguration,
  type ISSRDefinition,
  type ISSRScope,
} from '@aurelia/runtime-html';
import { BrowserPlatform } from '@aurelia/platform-browser';
import type { SsrHydrateOptions, SsrHydrationResult, SsrTakeoverMode } from './types.js';
import type { AureliaSsrPreboot } from './preboot.js';
import { createSsrStateRegistration, ISsrState, SsrState } from './state.js';

declare global {
  interface Window {
    __AURELIA_SSR_MANIFEST__?: unknown;
    __AURELIA_SSR_DEFINITION__?: unknown;
    __AURELIA_SSR_PREBOOT__?: AureliaSsrPreboot;
  }
}

export const SSR_CONTEXT_SCRIPT_ID = 'aurelia-ssr-context';
export const SSR_MANIFEST_SCRIPT_ID = 'aurelia-ssr-manifest';
export const SSR_DEFINITION_SCRIPT_ID = 'aurelia-ssr-definition';

export interface PrepareSsrHostOptions {
  readonly selector?: string;
  readonly mode?: SsrTakeoverMode;
  readonly clearAttribute?: string;
}

/**
 * Prepares the app host for client takeover.
 *
 * In `remount` mode this clears prerendered children synchronously. Apps with
 * async route data can keep a temporary, inert copy of the SSR markup visible
 * beside the host, hide the real host while Aurelia starts, then remove the
 * copy before calling `finishSsrTakeover()` to avoid a loading flash.
 */
export function prepareSsrHostForTakeover(options: PrepareSsrHostOptions | string = {}): Element | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const normalized = typeof options === 'string' ? { selector: options } : options;
  const selector = normalized.selector ?? 'my-app';
  const mode = normalized.mode ?? 'remount';
  const clearAttribute = normalized.clearAttribute ?? 'data-aurelia-ssr-cleared';
  const host = document.querySelector(selector);

  if (!host || !document.documentElement.hasAttribute('data-aurelia-ssr-prerendered')) {
    return host;
  }

  if (mode === 'remount') {
    host.replaceChildren();
    host.setAttribute(clearAttribute, '');
  }

  return host;
}

export function finishSsrTakeover(): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.removeAttribute('data-aurelia-ssr-prerendered');
  document.documentElement.setAttribute('data-aurelia-taken-over', '');

  try {
    window.__AURELIA_SSR_PREBOOT__?.replay?.();
  } catch {
    window.__AURELIA_SSR_PREBOOT__?.cleanup?.();
  }

  window.dispatchEvent(new CustomEvent('aurelia:ssr-takeover'));
}

/**
 * Hydrates server-rendered markup with Aurelia core's `Aurelia.hydrate()`.
 *
 * The manifest (`ssrScope`) and optional serialized definition default to the
 * JSON scripts that `buildSsrDocument` embeds, so a typical client entry is:
 *
 * ```ts
 * const { root } = await hydrateAureliaSsr({ component: MyApp });
 * ```
 *
 * `Aurelia.hydrate()` activates the app root directly; it does not go through
 * `aurelia.start()`. Use the returned `root` (or `stop()`) to tear it down.
 */
export async function hydrateAureliaSsr<TComponent extends object = object>(
  options: SsrHydrateOptions<TComponent>,
): Promise<SsrHydrationResult<TComponent>> {
  const hostSelector = options.hostSelector ?? 'my-app';
  const host = options.host ?? document.querySelector<HTMLElement>(hostSelector);

  if (!host) {
    throw new Error(`Unable to hydrate Aurelia SSR: host "${hostSelector}" was not found.`);
  }

  const ssrScope = options.ssrScope ?? readSsrManifest(options.manifestScriptId) ?? undefined;
  if (ssrScope == null) {
    throw new Error(
      'Unable to hydrate Aurelia SSR: no manifest was provided and none was found in the document. '
      + 'Render with takeoverMode "hydrate" so buildSsrDocument embeds it, pass ssrScope explicitly, '
      + 'or use prepareSsrHostForTakeover({ mode: "remount" }) instead.',
    );
  }

  const ssrDefinition = options.ssrDefinition ?? readSsrDefinition(options.definitionScriptId) ?? undefined;
  if (ssrDefinition) {
    attachSsrDefinition(options.component, ssrDefinition);
  }

  const aurelia = options.aurelia ?? new Aurelia(options.container ?? createClientContainer(options.registrations));
  if (options.registerState ?? true) {
    registerClientSsrState(aurelia.container);
  }
  await options.configureAurelia?.(aurelia);

  const root = await aurelia.hydrate({
    host,
    component: options.component,
    ssrScope,
  });

  finishSsrTakeover();

  return {
    aurelia,
    root,
    host,
    ssrScope,
    stop: async () => {
      await root.deactivate();
      root.dispose();
    },
  };
}

/**
 * Registers `ISsrState` seeded from the embedded state script when the
 * container has no explicit registration yet. `hydrateAureliaSsr` does this
 * automatically; call it yourself in a `remount` bootstrap:
 *
 * ```ts
 * const au = new Aurelia();
 * registerClientSsrState(au.container);
 * ```
 */
export function registerClientSsrState(container: IContainer, scriptId?: string): SsrState | null {
  if (container.has(ISsrState, true)) {
    return null;
  }

  const state = SsrState.fromDocument(scriptId);
  container.register(createSsrStateRegistration(state));
  return state;
}

export function attachSsrDefinition<TComponent extends object>(
  component: new (...args: never[]) => TComponent,
  ssrDefinition: ISSRDefinition,
): void {
  const hydratedDefinition = hydrateSSRDefinition(ssrDefinition);
  Object.defineProperty(component, '$au', {
    configurable: true,
    value: hydratedDefinition,
  });
}

export function readSsrContext<TContext = Record<string, unknown>>(scriptId = SSR_CONTEXT_SCRIPT_ID): TContext | null {
  return readJsonScript<TContext>(scriptId);
}

/**
 * Reads the SSR manifest embedded by `buildSsrDocument`, or the
 * `window.__AURELIA_SSR_MANIFEST__` global when a custom pipeline set it.
 */
export function readSsrManifest(scriptId = SSR_MANIFEST_SCRIPT_ID): ISSRScope | null {
  if (typeof window !== 'undefined' && isScopeLike(window.__AURELIA_SSR_MANIFEST__)) {
    return window.__AURELIA_SSR_MANIFEST__;
  }

  const parsed = readJsonScript<unknown>(scriptId);
  if (isScopeLike(parsed)) {
    return parsed;
  }

  if (parsed !== null && typeof parsed === 'object' && isScopeLike((parsed as { manifest?: unknown }).manifest)) {
    return (parsed as { manifest: ISSRScope }).manifest;
  }

  return null;
}

/**
 * Reads a serialized AOT definition embedded by `buildSsrDocument`, or the
 * `window.__AURELIA_SSR_DEFINITION__` global.
 */
export function readSsrDefinition(scriptId = SSR_DEFINITION_SCRIPT_ID): ISSRDefinition | null {
  if (typeof window !== 'undefined' && isDefinitionLike(window.__AURELIA_SSR_DEFINITION__)) {
    return window.__AURELIA_SSR_DEFINITION__;
  }

  const parsed = readJsonScript<unknown>(scriptId);
  return isDefinitionLike(parsed) ? parsed : null;
}

function readJsonScript<T>(scriptId: string): T | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const script = document.getElementById(scriptId);
  if (!script?.textContent) {
    return null;
  }

  try {
    return JSON.parse(script.textContent) as T;
  } catch {
    return null;
  }
}

function isScopeLike(value: unknown): value is ISSRScope {
  return typeof value === 'object'
    && value !== null
    && Array.isArray((value as ISSRScope).children);
}

function isDefinitionLike(value: unknown): value is ISSRDefinition {
  return typeof value === 'object'
    && value !== null
    && typeof (value as ISSRDefinition).template === 'string'
    && Array.isArray((value as ISSRDefinition).expressions);
}

function createClientContainer(registrations: readonly unknown[] = []): IContainer {
  const platform = BrowserPlatform.getOrCreate(globalThis);

  return DI.createContainer().register(
    Registration.instance(IPlatform, platform),
    StandardConfiguration,
    ...registrations,
  );
}
