import { Registration } from '@aurelia/kernel';

export interface SsrRouterRegistrationOptions {
  readonly path: string;
  readonly baseHref?: string;
}

export async function createSsrRouterRegistrations(options: SsrRouterRegistrationOptions): Promise<readonly unknown[]> {
  const router = await import('@aurelia/router');

  return [
    Registration.instance(
      router.ILocationManager,
      new router.ServerLocationManager(options.path, options.baseHref ?? '/'),
    ),
  ];
}

export async function registerSsrLocationManager(
  container: { register(...params: readonly unknown[]): unknown },
  options: SsrRouterRegistrationOptions,
): Promise<void> {
  const registrations = await createSsrRouterRegistrations(options);
  container.register(...registrations);
}
