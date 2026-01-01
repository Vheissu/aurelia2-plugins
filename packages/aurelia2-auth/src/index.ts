import { IAuthentication, Authentication } from './authentication';
import { IFetchConfig, FetchConfig } from './auth-fetch-config';
import { IAuthConfigOptions, IAuthOptions, IAuthProviderConfig } from './configuration';
import { createDefaultAuthConfigOptions } from './base-config';
import { IAuthService, AuthService } from './auth-service';
import { AuthorizeHook } from './authorize-hook';
import { AuthFilterValueConverter } from './auth-filter';
import { IContainer, IRegistry, Registration } from '@aurelia/kernel';
import { Auth } from './helpers';
import { IOAuth1, OAuth1 } from './oAuth1';
import { IOAuth2, OAuth2 } from './oAuth2';
import { IPopup, Popup } from './popup';
import { IStorage, Storage } from './storage';
import { AppTask, IWindow } from '@aurelia/runtime-html';
import { AuthInterceptor } from './interceptor';

export const DefaultComponents: IRegistry[] = [
  AuthFilterValueConverter as unknown as IRegistry,
];

const DefaultServices: IRegistry[] = [
  Registration.singleton(Authentication, Authentication),
  Registration.aliasTo(Authentication, IAuthentication),
  Registration.singleton(AuthService, AuthService),
  Registration.aliasTo(AuthService, IAuthService),
  Registration.singleton(OAuth1, OAuth1),
  Registration.aliasTo(OAuth1, IOAuth1),
  Registration.singleton(OAuth2, OAuth2),
  Registration.aliasTo(OAuth2, IOAuth2),
  Registration.singleton(Popup, Popup),
  Registration.aliasTo(Popup, IPopup),
  Registration.singleton(Storage, Storage),
  Registration.aliasTo(Storage, IStorage),
  Registration.singleton(FetchConfig, FetchConfig),
  Registration.aliasTo(FetchConfig, IFetchConfig),
  Registration.singleton(AuthInterceptor, AuthInterceptor),
];

function mergeProviderConfig(
  baseProvider: Partial<IAuthProviderConfig>,
  overrideProvider: Partial<IAuthProviderConfig>
): IAuthProviderConfig {
  const merged: Partial<IAuthProviderConfig> = {
    ...baseProvider,
    ...overrideProvider,
  };

  if (baseProvider.popupOptions || overrideProvider.popupOptions) {
    merged.popupOptions = {
      ...(baseProvider.popupOptions ?? {}),
      ...(overrideProvider.popupOptions ?? {}),
    };
  }

  return merged as IAuthProviderConfig;
}

function mergeAuthConfigOptions(
  defaults: IAuthConfigOptions,
  options?: Partial<IAuthConfigOptions>
): IAuthConfigOptions {
  if (!options) {
    return defaults;
  }

  const mergedProviders: Record<string, IAuthProviderConfig> = {
    ...(defaults.providers || {}),
  };

  if (options.providers) {
    for (const [key, provider] of Object.entries(options.providers)) {
      mergedProviders[key] = mergeProviderConfig(
        mergedProviders[key] || {},
        provider
      );
    }
  }

  return {
    ...defaults,
    ...options,
    providers: mergedProviders as IAuthConfigOptions['providers'],
  };
}

function createConfiguration(options?: Partial<IAuthConfigOptions>) {
  return {
    register(container: IContainer): IContainer {
      Auth.container = container;
      const windowResolver = container.getResolver(IWindow, false);
      const wnd = windowResolver ? container.get(IWindow) : undefined;
      const defaults = createDefaultAuthConfigOptions(wnd);
      const mergedOptions = mergeAuthConfigOptions(defaults, options);

      return container.register(
        Registration.instance(IAuthOptions, mergedOptions),
        AppTask.creating(IFetchConfig, (config) => config.configure()),
        ...DefaultServices,
        ...DefaultComponents
      );
    },
    configure(options?: IAuthConfigOptions) {
      return createConfiguration(options);
    },
  };
}

export const AureliaAuthConfiguration = createConfiguration({});

export { AuthorizeHook, IAuthOptions, IFetchConfig, IAuthService, IAuthentication, Auth };
export type { IAuthConfigOptions, IAuthProviderConfig, IOAuthPopupOptions } from './configuration';
