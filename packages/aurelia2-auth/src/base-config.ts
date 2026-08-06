import type { IAuthConfigOptions, IAuthProviderConfig } from './configuration';

const provider = (
  name: string,
  config: Omit<IAuthProviderConfig, 'name'>,
): IAuthProviderConfig => ({ name, ...config });

function getOrigin(window?: Window): string | undefined {
  const origin = window?.location?.origin;
  return origin && origin !== 'null' ? origin : undefined;
}

export function createDefaultAuthConfigOptions(window?: Window): IAuthConfigOptions {
  const origin = getOrigin(window);
  const callback = origin ? `${origin}/auth/callback` : '/auth/callback';

  return {
    mode: 'bearer',
    httpInterceptor: true,
    baseUrl: '/',
    withCredentials: false,
    trustedOrigins: origin ? [origin] : [],
    authHeader: 'Authorization',
    authToken: 'Bearer',
    apiKeyHeader: 'X-API-Key',

    loginOnSignup: true,
    loginRedirect: null,
    logoutRedirect: null,
    signupRedirect: null,
    loginUrl: '/auth/login',
    signupUrl: '/auth/signup',
    profileUrl: '/auth/me',
    sessionUrl: '/auth/session',
    refreshUrl: '/auth/refresh',
    logoutUrl: '/auth/logout',
    forgotPasswordUrl: '/auth/forgot-password',
    resetPasswordUrl: '/auth/reset-password',
    unlinkUrl: '/auth/unlink/',
    unlinkMethod: 'delete',

    loginRoute: '/login',
    signupRoute: '/signup',
    unauthorizedRoute: '/unauthorized',
    authenticatedRoute: '/',
    preserveReturnUrl: true,

    storage: 'sessionStorage',
    transactionStorage: 'sessionStorage',
    storageFallback: 'memory',
    tokenPrefix: 'aurelia-auth',
    tokenName: 'access_token',
    idTokenName: 'id_token',
    refreshTokenName: 'refresh_token',
    responseTokenProp: 'access_token',
    responseIdTokenProp: 'id_token',
    responseRefreshTokenProp: 'refresh_token',

    refreshTokens: false,
    refreshOnUnauthorized: true,
    tokenExpirationLeeway: 0,
    clockTolerance: 30,
    autoRefresh: false,
    autoRefreshBuffer: 60,

    oauthTransactionTtl: 10 * 60,
    popupTimeout: 5 * 60 * 1000,
    pkce: true,
    pkceMethod: 'S256',

    rolesProperty: ['roles', 'role'],
    permissionsProperty: ['permissions', 'scope'],
    policies: {},

    idleTimeout: 0,
    idleEvents: ['pointerdown', 'keydown', 'touchstart', 'scroll'],
    tabSync: true,
    tabSyncChannel: 'aurelia-auth-sync',
    autoInitialize: false,
    platform: 'browser',

    providers: {
      google: provider('google', {
        issuer: 'https://accounts.google.com',
        discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
        url: '/auth/google',
        redirectUri: callback,
        scope: ['openid', 'profile', 'email'],
        flow: 'authorization-code',
        display: 'redirect',
        exchange: 'backend',
        pkce: true,
        state: true,
        nonce: true,
        validateIssuer: true,
      }),
      microsoft: provider('microsoft', {
        issuer: 'https://login.microsoftonline.com/common/v2.0',
        discoveryUrl: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
        url: '/auth/microsoft',
        redirectUri: callback,
        scope: ['openid', 'profile', 'email'],
        flow: 'authorization-code',
        display: 'redirect',
        exchange: 'backend',
        pkce: true,
        state: true,
        nonce: true,
      }),
      apple: provider('apple', {
        issuer: 'https://appleid.apple.com',
        discoveryUrl: 'https://appleid.apple.com/.well-known/openid-configuration',
        url: '/auth/apple',
        redirectUri: callback,
        scope: ['openid', 'name', 'email'],
        responseMode: 'form_post',
        flow: 'authorization-code',
        display: 'redirect',
        exchange: 'backend',
        pkce: true,
        state: true,
        nonce: true,
        validateIssuer: true,
      }),
      github: provider('github', {
        authorizationEndpoint: 'https://github.com/login/oauth/authorize',
        url: '/auth/github',
        redirectUri: callback,
        scope: ['read:user', 'user:email'],
        flow: 'authorization-code',
        display: 'redirect',
        exchange: 'backend',
        pkce: true,
        state: true,
      }),
      facebook: provider('facebook', {
        authorizationEndpoint: 'https://www.facebook.com/dialog/oauth',
        url: '/auth/facebook',
        redirectUri: callback,
        scope: ['email'],
        flow: 'authorization-code',
        display: 'redirect',
        exchange: 'backend',
        pkce: true,
        state: true,
      }),
      linkedin: provider('linkedin', {
        authorizationEndpoint: 'https://www.linkedin.com/oauth/v2/authorization',
        url: '/auth/linkedin',
        redirectUri: callback,
        scope: ['openid', 'profile', 'email'],
        flow: 'authorization-code',
        display: 'redirect',
        exchange: 'backend',
        pkce: true,
        state: true,
        nonce: true,
      }),
      x: provider('x', {
        authorizationEndpoint: 'https://x.com/i/oauth2/authorize',
        url: '/auth/x',
        redirectUri: callback,
        scope: ['tweet.read', 'users.read'],
        flow: 'authorization-code',
        display: 'redirect',
        exchange: 'backend',
        pkce: true,
        state: true,
      }),
    },
  };
}

function mergeProviderConfig(
  base: IAuthProviderConfig | undefined,
  override: IAuthProviderConfig,
): IAuthProviderConfig {
  return {
    ...base,
    ...override,
    name: override.name || base?.name || '',
    popupOptions: base?.popupOptions || override.popupOptions
      ? { ...base?.popupOptions, ...override.popupOptions }
      : undefined,
    additionalParameters: base?.additionalParameters || override.additionalParameters
      ? { ...base?.additionalParameters, ...override.additionalParameters }
      : undefined,
    tokenParameters: base?.tokenParameters || override.tokenParameters
      ? { ...base?.tokenParameters, ...override.tokenParameters }
      : undefined,
  };
}

export function mergeAuthConfigOptions(
  defaults: IAuthConfigOptions,
  options: Partial<IAuthConfigOptions> = {},
): Readonly<IAuthConfigOptions> {
  const providers: Record<string, IAuthProviderConfig> = {
    ...(defaults.providers ?? {}),
  };

  for (const [key, value] of Object.entries(options.providers ?? {})) {
    providers[key] = mergeProviderConfig(providers[key], { ...value, name: value.name || key });
  }

  const mode = options.mode ?? defaults.mode ?? 'bearer';
  const merged: IAuthConfigOptions = {
    ...defaults,
    ...options,
    mode,
    withCredentials: options.withCredentials ?? (mode === 'cookie'),
    providers,
    policies: { ...defaults.policies, ...options.policies },
  };

  return Object.freeze(merged);
}
