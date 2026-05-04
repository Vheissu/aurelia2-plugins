import { DI, type IContainer, type IRegistry, Registration } from '@aurelia/kernel';
import type { SsrConfigurationRegistrationOptions, SsrRouteConfig, SsrSiteConfig } from './types';

export const ISsrSiteConfig = DI.createInterface<SsrSiteConfig>('ISsrSiteConfig');
export type ISsrSiteConfig = SsrSiteConfig;

export const ISsrRoutes = DI.createInterface<readonly SsrRouteConfig[]>('ISsrRoutes');
export type ISsrRoutes = readonly SsrRouteConfig[];

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
