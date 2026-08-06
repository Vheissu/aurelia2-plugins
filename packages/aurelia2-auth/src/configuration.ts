import { DI } from '@aurelia/kernel';

export type AuthMode = 'bearer' | 'cookie' | 'api-key' | 'custom';
export type AuthStatus = 'anonymous' | 'authenticated' | 'refreshing';
export type AuthStorageName = 'localStorage' | 'sessionStorage' | 'memory';
export type AuthorizationMatch = 'all' | 'any';
export type OAuthDisplay = 'redirect' | 'popup';
export type OAuthFlow = 'authorization-code' | 'implicit' | 'oauth1';
export type OAuthExchangeMode = 'backend' | 'direct' | 'none';

export interface IAuthStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface IOAuthPopupOptions {
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface IOAuthTransaction {
  provider: string;
  state: string;
  nonce?: string;
  codeVerifier?: string;
  redirectUri: string;
  issuer?: string;
  returnUrl?: string;
  createdAt: number;
}

export interface IOAuthCallback {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
  issuer?: string;
  accessToken?: string;
  idToken?: string;
  tokenType?: string;
  expiresIn?: number;
  raw: Readonly<Record<string, string>>;
}

export interface IOAuthStartOptions {
  display?: OAuthDisplay;
  returnUrl?: string;
  additionalParameters?: Readonly<Record<string, string | number | boolean>>;
  userData?: Readonly<Record<string, unknown>>;
}

export interface IOAuthAuthorizationRequest {
  provider: string;
  url: string;
  display: OAuthDisplay;
  transaction: Readonly<IOAuthTransaction>;
}

export interface IAuthProviderConfig {
  name?: string;
  clientId?: string;
  flow?: OAuthFlow;
  display?: OAuthDisplay;
  exchange?: OAuthExchangeMode;
  issuer?: string;
  discoveryUrl?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  revocationEndpoint?: string;
  userInfoEndpoint?: string;
  url?: string;
  redirectUri?: string;
  postLogoutRedirectUri?: string;
  scope?: readonly string[] | string;
  audience?: string;
  resource?: string;
  responseType?: string;
  responseMode?: 'query' | 'fragment' | 'form_post';
  prompt?: string;
  loginHint?: string;
  pkce?: boolean;
  state?: boolean | string | (() => string);
  nonce?: boolean | string | (() => string);
  validateIssuer?: boolean;
  additionalParameters?: Readonly<Record<string, string | number | boolean>>;
  tokenParameters?: Readonly<Record<string, string | number | boolean>>;
  popupOptions?: IOAuthPopupOptions;

  /** @deprecated Compatibility with the Aurelia 1 provider shape. */
  type?: '1.0' | '2.0';
  /** @deprecated Use `display: 'redirect' | 'popup'`. */
  platform?: string;
  /** @deprecated Parameters are generated from the typed provider options. */
  requiredUrlParams?: readonly string[];
  /** @deprecated Parameters are generated from the typed provider options. */
  optionalUrlParams?: readonly string[];
  /** @deprecated Parameters are generated from the typed provider options. */
  defaultUrlParams?: readonly string[];
  /** @deprecated Use `tokenParameters`. */
  responseParams?: readonly string[];
  /** @deprecated Scope is serialized according to OAuth 2.0 using a space. */
  scopeDelimiter?: string;
  /** @deprecated Put the complete scope in `scope`. */
  scopePrefix?: string;
}

export interface IJwtClaims extends Record<string, unknown> {
  aud?: string | readonly string[];
  exp?: number;
  iat?: number;
  iss?: string;
  jti?: string;
  nbf?: number;
  nonce?: string;
  sub?: string;
}

export interface IAuthTokenSet {
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  expiresAt?: number;
  scope?: string;
  raw?: unknown;
}

export interface IAuthSession<TUser = unknown> {
  status: AuthStatus;
  user: TUser | null;
  claims: IJwtClaims | null;
  tokens: Readonly<IAuthTokenSet>;
}

export interface IAuthorizationRequirement {
  authenticated?: boolean;
  anonymousOnly?: boolean;
  roles?: readonly string[];
  permissions?: readonly string[];
  claims?: Readonly<Record<string, unknown | readonly unknown[]>>;
  policies?: readonly string[];
  match?: AuthorizationMatch;
  redirectTo?: string;
  forbiddenRedirectTo?: string;
}

export interface IAuthorizationContext<TUser = unknown> {
  requirement: Readonly<IAuthorizationRequirement>;
  session: Readonly<IAuthSession<TUser>>;
  resource?: unknown;
}

export type AuthPolicy<TUser = unknown> = (
  context: Readonly<IAuthorizationContext<TUser>>
) => boolean | Promise<boolean>;

export interface IAuthorizationDecision {
  allowed: boolean;
  reason?: 'anonymous' | 'authenticated-only' | 'role' | 'permission' | 'claim' | 'policy';
  failed?: readonly string[];
}

export interface IAuthRequestContext {
  request: Request;
  accessToken: string | null;
  session: Readonly<IAuthSession>;
}

export type AuthRequestMatcher = (request: Request) => boolean;
export type AuthRequestTransformer = (
  context: Readonly<IAuthRequestContext>
) => Request | Promise<Request>;

export interface IAuthConfigOptions {
  mode?: AuthMode;
  httpInterceptor?: boolean;
  baseUrl?: string;
  withCredentials?: boolean;
  trustedOrigins?: readonly string[] | AuthRequestMatcher;
  transformRequest?: AuthRequestTransformer;
  authHeader?: string;
  authToken?: string;
  apiKey?: string | (() => string | null);
  apiKeyHeader?: string;

  loginOnSignup?: boolean;
  loginRedirect?: string | null;
  logoutRedirect?: string | null;
  signupRedirect?: string | null;
  loginUrl?: string;
  signupUrl?: string;
  profileUrl?: string;
  sessionUrl?: string;
  refreshUrl?: string;
  logoutUrl?: string | null;
  forgotPasswordUrl?: string;
  resetPasswordUrl?: string;
  unlinkUrl?: string;
  unlinkMethod?: 'get' | 'post' | 'delete';

  loginRoute?: string;
  signupRoute?: string;
  unauthorizedRoute?: string;
  authenticatedRoute?: string;
  preserveReturnUrl?: boolean;

  storage?: AuthStorageName | IAuthStorageLike;
  transactionStorage?: AuthStorageName | IAuthStorageLike;
  storageFallback?: 'memory' | 'error';
  tokenPrefix?: string;
  tokenName?: string;
  idTokenName?: string;
  refreshTokenName?: string;
  tokenRoot?: string;
  refreshTokenRoot?: string;
  responseTokenProp?: string;
  responseIdTokenProp?: string;
  responseRefreshTokenProp?: string;

  refreshTokens?: boolean;
  refreshOnUnauthorized?: boolean;
  refreshTokenPayload?: Record<string, unknown> | ((refreshToken: string) => Record<string, unknown>);
  tokenExpirationLeeway?: number;
  clockTolerance?: number;
  autoRefresh?: boolean;
  autoRefreshBuffer?: number;
  validateJwt?: (claims: Readonly<IJwtClaims>, token: string) => boolean;
  issuer?: string;
  audience?: string | readonly string[];

  providers?: Readonly<Record<string, IAuthProviderConfig>>;
  /** OAuth transaction lifetime in seconds. */
  oauthTransactionTtl?: number;
  /** Popup lifetime in milliseconds. */
  popupTimeout?: number;
  pkce?: boolean;
  pkceMethod?: 'S256';

  rolesProperty?: string | readonly string[];
  permissionsProperty?: string | readonly string[];
  policies?: Readonly<Record<string, AuthPolicy>>;

  /** Idle session lifetime in seconds. Zero disables idle logout. */
  idleTimeout?: number;
  idleEvents?: readonly string[];
  tabSync?: boolean;
  tabSyncChannel?: string;

  autoInitialize?: boolean;
  platform?: 'browser' | 'mobile' | 'server';
}

export const IAuthOptions = DI.createInterface<Readonly<IAuthConfigOptions>>('IAuthOptions');
