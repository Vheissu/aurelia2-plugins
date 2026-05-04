import { DI, Registration, type IContainer } from '@aurelia/kernel';
import { Aurelia, hydrateSSRDefinition, IPlatform, StandardConfiguration } from '@aurelia/runtime-html';
import { BrowserPlatform } from '@aurelia/platform-browser';
import type { SsrHydrateOptions, SsrTakeoverMode } from './types';
import type { AureliaSsrPreboot } from './preboot';

declare global {
  interface Window {
    __AURELIA_SSR_MANIFEST__?: unknown;
    __AURELIA_SSR_PREBOOT__?: AureliaSsrPreboot;
  }
}

export interface PrepareSsrHostOptions {
  readonly selector?: string;
  readonly mode?: SsrTakeoverMode;
  readonly clearAttribute?: string;
}

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

export async function hydrateAureliaSsr<TComponent extends object = object>(
  options: SsrHydrateOptions<TComponent>,
): Promise<Aurelia> {
  const host = options.host
    ?? document.querySelector<HTMLElement>(options.hostSelector ?? 'my-app');

  if (!host) {
    throw new Error(`Unable to hydrate Aurelia SSR: host "${options.hostSelector ?? 'my-app'}" was not found.`);
  }

  const platform = new BrowserPlatform(window as unknown as typeof globalThis);
  BrowserPlatform.set(globalThis, platform);
  const container = options.container ?? createClientContainer(platform, options.registrations);
  const aurelia = new Aurelia(container);

  if (options.ssrDefinition) {
    attachSsrDefinition(options.component, options.ssrDefinition);
  }

  await options.configureAurelia?.(aurelia);
  aurelia.hydrate({
    host,
    component: options.component,
    ssrScope: options.ssrScope,
    container,
  });
  await aurelia.start();
  finishSsrTakeover();

  return aurelia;
}

export function attachSsrDefinition<TComponent extends object>(
  component: new (...args: never[]) => TComponent,
  ssrDefinition: NonNullable<SsrHydrateOptions<TComponent>['ssrDefinition']>,
): void {
  const hydratedDefinition = hydrateSSRDefinition(ssrDefinition);
  Object.defineProperty(component, '$au', {
    configurable: true,
    value: hydratedDefinition,
  });
}

export function readSsrContext<TContext = Record<string, unknown>>(scriptId = 'aurelia-ssr-context'): TContext | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const script = document.getElementById(scriptId);
  if (!script?.textContent) {
    return null;
  }

  try {
    return JSON.parse(script.textContent) as TContext;
  } catch {
    return null;
  }
}

function createClientContainer(platform: BrowserPlatform, registrations: readonly unknown[] = []): IContainer {
  return DI.createContainer().register(
    Registration.instance(IPlatform, platform),
    StandardConfiguration,
    ...registrations,
  );
}
