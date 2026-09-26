import { Registration } from '@aurelia/kernel';
import type { SsrRenderContext } from './types.js';

export interface SsrRouterRegistrationOptions {
  readonly path: string;
  readonly baseHref?: string;
}

export interface WaitForRouterIdleOptions {
  /**
   * Upper bound on follow-up navigations to await (redirects, `canLoad`
   * rerouting). Defaults to 10.
   */
  readonly maxTransitions?: number;
}

interface RouterLike {
  readonly isNavigating: boolean;
  readonly currentTr: { readonly promise: Promise<unknown> | null };
}

interface ContainerLike {
  get<T>(key: T): unknown;
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

/**
 * Resolves once the router has no transition in flight.
 *
 * `aurelia.start()` already awaits the initial navigation, but components
 * that redirect from `canLoad`/`loading` or call `router.load()` during
 * startup queue another transition. Await this before serializing so the
 * HTML reflects the final route.
 */
export async function waitForRouterIdle(
  container: ContainerLike,
  options: WaitForRouterIdleOptions = {},
): Promise<void> {
  const { IRouter } = await import('@aurelia/router');
  const router = container.get(IRouter) as RouterLike;
  const maxTransitions = options.maxTransitions ?? 10;

  for (let iteration = 0; iteration < maxTransitions; iteration++) {
    const promise = router.currentTr.promise;
    if (promise != null) {
      await promise.catch(() => undefined);
    }

    // Give queued follow-up navigations a turn to start.
    await new Promise<void>(resolve => {
      setTimeout(resolve, 0);
    });

    if (!router.isNavigating) {
      return;
    }
  }
}

/**
 * A `settle` function for `renderAureliaToString` that waits for the router
 * to become idle. Compose it with your own data readiness check if needed:
 *
 * ```ts
 * settle: async context => {
 *   await createRouterSettle()(context);
 *   await context.container.get(IDataLoader).ready;
 * }
 * ```
 */
export function createRouterSettle(options: WaitForRouterIdleOptions = {}): (context: SsrRenderContext) => Promise<void> {
  return context => waitForRouterIdle(context.container, options);
}
