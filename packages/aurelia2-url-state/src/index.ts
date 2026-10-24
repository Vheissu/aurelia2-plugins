import { AppTask, Registration, type Constructable, type IContainer } from 'aurelia';
import {
  HistoryUrlStateAdapter,
  IUrlStateAdapter,
  IUrlStateAdapterSettings,
  type UrlStateAdapter,
} from './adapter.js';
import { UrlStateCustomAttribute } from './attribute.js';
import { IUrlState, UrlStateService } from './url-state.js';

export * from './params.js';
export * from './adapter.js';
export * from './url-state.js';
export { UrlStateCustomAttribute } from './attribute.js';

export interface UrlStateConfigurationOptions {
  /**
   * Where the query string lives. A class is constructed by DI once per app; an instance is used as is.
   * Defaults to `HistoryUrlStateAdapter`. Apps that use `@aurelia/router` must pass
   * `RouterUrlStateAdapter` from `aurelia2-url-state/router`.
   */
  adapter?: Constructable<UrlStateAdapter> | UrlStateAdapter;
  /** Let `HistoryUrlStateAdapter` run in an app with a router registered. Defaults to false. */
  ignoreRouter?: boolean;
}

function isAdapter(value: unknown): value is UrlStateAdapter {
  const adapter = value as UrlStateAdapter | null;
  return (
    typeof adapter === 'object' &&
    adapter !== null &&
    typeof adapter.read === 'function' &&
    typeof adapter.write === 'function' &&
    typeof adapter.subscribe === 'function'
  );
}

function configure(options: UrlStateConfigurationOptions = {}) {
  const { adapter = HistoryUrlStateAdapter, ignoreRouter = false } = options;
  if (typeof adapter !== 'function' && !isAdapter(adapter))
    throw new TypeError(
      'url-state: adapter must be a class or an object with read, write and subscribe',
    );
  const settings = Object.freeze({ ignoreRouter: ignoreRouter === true });
  return {
    register(container: IContainer) {
      return container.register(
        Registration.instance(IUrlStateAdapterSettings, settings),
        typeof adapter === 'function'
          ? Registration.singleton(IUrlStateAdapter, adapter)
          : Registration.instance(IUrlStateAdapter, adapter),
        Registration.singleton(IUrlState, UrlStateService),
        UrlStateCustomAttribute,
        // Create the adapter at startup so router listeners exist before the first navigation and
        // a history adapter in a routed app fails immediately.
        AppTask.creating(IUrlState, () => {}),
        AppTask.deactivated(IUrlState, (urlState) => urlState.dispose()),
      );
    },
  };
}

export const AureliaUrlStateConfiguration = { ...configure(), configure };
