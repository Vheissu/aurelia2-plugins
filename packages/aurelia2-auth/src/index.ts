import { type IContainer, type IRegistry, Registration } from '@aurelia/kernel';
import { AppTask, IWindow } from '@aurelia/runtime-html';
import { HttpClient, IHttpClient } from '@aurelia/fetch-client';
import { Authentication, IAuthentication } from './authentication';
import { AuthorizationService, IAuthorizationService } from './authorization';
import { AuthCustomAttribute } from './auth-attribute';
import { AuthFilterValueConverter } from './auth-filter';
import { AuthInterceptor } from './interceptor';
import { AuthService, IAuthService } from './auth-service';
import { AuthorizeHook } from './authorize-hook';
import { createDefaultAuthConfigOptions, mergeAuthConfigOptions } from './base-config';
import type { IAuthConfigOptions } from './configuration';
import { IAuthOptions } from './configuration';
import { FetchConfig, IFetchConfig } from './auth-fetch-config';
import { IfAuthenticatedCustomAttribute } from './if-authenticated';
import { IfRolesCustomAttribute } from './if-roles';
import { OAuth1, IOAuth1 } from './oAuth1';
import { OAuth2, IOAuth2 } from './oAuth2';
import { OAuthClient, IOAuthClient } from './oauth-client';
import { Popup, IPopup } from './popup';
import { Storage, TransactionStorage, IStorage, ITransactionStorage } from './storage';

export interface IAureliaAuthConfiguration extends IRegistry {
  configure(overrides?: Partial<IAuthConfigOptions>): IAureliaAuthConfiguration;
}

export const DefaultComponents: readonly IRegistry[] = Object.freeze([
  AuthCustomAttribute as unknown as IRegistry,
  AuthFilterValueConverter as unknown as IRegistry,
  IfAuthenticatedCustomAttribute as unknown as IRegistry,
  IfRolesCustomAttribute as unknown as IRegistry,
  AuthorizeHook as unknown as IRegistry,
]);

const DefaultServices: readonly IRegistry[] = Object.freeze([
  Registration.singleton(Authentication, Authentication),
  Registration.aliasTo(Authentication, IAuthentication),
  Registration.singleton(AuthorizationService, AuthorizationService),
  Registration.aliasTo(AuthorizationService, IAuthorizationService),
  Registration.singleton(AuthService, AuthService),
  Registration.aliasTo(AuthService, IAuthService),
  Registration.singleton(OAuthClient, OAuthClient),
  Registration.aliasTo(OAuthClient, IOAuthClient),
  Registration.singleton(OAuth1, OAuth1),
  Registration.aliasTo(OAuth1, IOAuth1),
  Registration.singleton(OAuth2, OAuth2),
  Registration.aliasTo(OAuth2, IOAuth2),
  Registration.singleton(Popup, Popup),
  Registration.aliasTo(Popup, IPopup),
  Registration.singleton(Storage, Storage),
  Registration.aliasTo(Storage, IStorage),
  Registration.singleton(TransactionStorage, TransactionStorage),
  Registration.aliasTo(TransactionStorage, ITransactionStorage),
  Registration.singleton(FetchConfig, FetchConfig),
  Registration.aliasTo(FetchConfig, IFetchConfig),
  Registration.singleton(AuthInterceptor, AuthInterceptor),
]);

function createConfiguration(
  options: Partial<IAuthConfigOptions> = {},
): IAureliaAuthConfiguration {
  return Object.freeze({
    register(container: IContainer): IContainer {
      const window = container.has(IWindow, true) ? container.get(IWindow) : undefined;
      const config = mergeAuthConfigOptions(createDefaultAuthConfigOptions(window), options);
      if (!container.has(IHttpClient, false)) {
        container.register(
          Registration.singleton(HttpClient, HttpClient),
          Registration.aliasTo(HttpClient, IHttpClient),
        );
      }
      return container.register(
        Registration.instance(IAuthOptions, config),
        ...DefaultServices,
        ...DefaultComponents,
        AppTask.creating(IFetchConfig, fetchConfig => fetchConfig.configure()),
        AppTask.creating(IAuthService, authService => authService.initialize()),
      );
    },
    configure(overrides: Partial<IAuthConfigOptions> = {}) {
      return createConfiguration({
        ...options,
        ...overrides,
        providers: { ...options.providers, ...overrides.providers },
        policies: { ...options.policies, ...overrides.policies },
      });
    },
  });
}

export const AureliaAuthConfiguration = createConfiguration();

export {
  AuthCustomAttribute,
  AuthFilterValueConverter,
  AuthInterceptor,
  AuthService,
  Authentication,
  AuthorizationService,
  AuthorizeHook,
  FetchConfig,
  IfAuthenticatedCustomAttribute,
  IfRolesCustomAttribute,
  IAuthOptions,
  IAuthentication,
  IAuthorizationService,
  IAuthService,
  IFetchConfig,
  IOAuth1,
  IOAuth2,
  IOAuthClient,
  IPopup,
  IStorage,
  ITransactionStorage,
  OAuth1,
  OAuth2,
  OAuthClient,
  Popup,
  Storage,
  TransactionStorage,
};
export {
  AuthEvents,
  AuthStateChangedEvent,
  AuthUnauthorizedEvent,
  AuthError,
  MemoryStorage,
  anonymousOnly,
  authenticated,
  authorize,
  claims,
  getAuthorizationMetadata,
  mergeRequirements,
  permissions,
  policy,
  roles,
} from './public-api';

export type * from './configuration';
export type { AuthErrorCode } from './auth-error';
export type { AuthEventName } from './auth-events';
export type { IJwtValidationOptions } from './jwt';
export { decodeJwt, getJwtExpiration, isJwt, isJwtUsable } from './jwt';
export {
  authorizationRouteDataKey,
  createAuthorizationRouteData,
  getRouteRequirement,
} from './authorize-hook';
