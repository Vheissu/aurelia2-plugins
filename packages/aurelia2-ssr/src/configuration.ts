import { DI, type IContainer, type IRegistry, Registration } from '@aurelia/kernel';
import type { SsrConfigurationRegistrationOptions, SsrRouteConfig, SsrSiteConfig } from './types.js';

export const ISsrSiteConfig = DI.createInterface<SsrSiteConfig>('ISsrSiteConfig');
export type ISsrSiteConfig = SsrSiteConfig;

export const ISsrRoutes = DI.createInterface<readonly SsrRouteConfig[]>('ISsrRoutes');
export type ISsrRoutes = readonly SsrRouteConfig[];

/**
 * The route being rendered. On the server `renderAureliaToString` registers
 * the active route (with `params` for expanded or request-matched routes); on
 * the client it is rebuilt from the embedded context script, or `null` when
 * the page was not server-rendered.
 */
export const ISsrRoute = DI.createInterface<ISsrRoute>('ISsrRoute', x => x.cachedCallback(() => routeFromSsrContext()));
export type ISsrRoute = SsrRouteConfig | null;

export function routeFromSsrContext(scriptId = 'aurelia-ssr-context'): SsrRouteConfig | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const script = document.getElementById(scriptId);
  if (!script?.textContent) {
    return null;
  }

  try {
    const context = JSON.parse(script.textContent) as {
      path?: string;
      status?: number;
      redirectTo?: string;
      params?: Record<string, string>;
      data?: Record<string, unknown>;
    };
    if (typeof context.path !== 'string') {
      return null;
    }

    return {
      path: context.path,
      status: context.status,
      redirectTo: context.redirectTo,
      params: context.params,
      data: context.data,
      seo: {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
      },
    };
  } catch {
    return null;
  }
}

function createConfiguration(options: SsrConfigurationRegistrationOptions = {}): IRegistry & {
  configure(newOptions?: SsrConfigurationRegistrationOptions): IRegistry;
} {
  return {
    register(container: IContainer): IContainer {
      const registrations: unknown[] = [
        ...(options.site ? [Registration.instance(ISsrSiteConfig, options.site)] : []),
        Registration.instance(ISsrRoutes, options.routes ?? options.site?.routes ?? []),
        ...(options.registrations ?? []),
      ];

      return container.register(...registrations);
    },
    configure(newOptions: SsrConfigurationRegistrationOptions = {}) {
      return createConfiguration({
        ...options,
        ...newOptions,
        routes: newOptions.routes ?? options.routes,
        registrations: newOptions.registrations ?? options.registrations,
      });
    },
  };
}

export const AureliaSsrConfiguration = createConfiguration();
