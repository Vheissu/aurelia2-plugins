import { DI } from '@aurelia/kernel';

export interface IOAuthPopupOptions {
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface IAuthProviderConfig {
  name: string;
  url: string;
  authorizationEndpoint?: string;
  redirectUri?: string;
  scope?: string[] | string;
  scopeDelimiter?: string;
  scopePrefix?: string;
  requiredUrlParams?: string[];
  optionalUrlParams?: string[];
  defaultUrlParams?: string[];
  responseParams?: string[];
  responseType?: string;
  display?: string;
  state?: string | (() => string);
  nonce?: string | (() => string);
  popupOptions?: IOAuthPopupOptions;
  type?: '1.0' | '2.0';
  clientId?: string;
  pkce?: boolean;
  pkceMethod?: 'S256' | 'plain';
}

export interface IAuthConfigOptions {
  httpInterceptor?: boolean;
  loginOnSignup?: boolean;
  baseUrl?: string;
  loginRedirect?: string;
  logoutRedirect?: string;
  signupRedirect?: string;
  loginUrl?: string;
  signupUrl?: string;
  profileUrl?: string;
  refreshUrl?: string;
  loginRoute?: string;
  signupRoute?: string;
  unauthorizedRoute?: string;
  tokenRoot?: string;
  tokenName?: string;
  idTokenName?: string;
  refreshTokenRoot?: string;
  refreshTokenName?: string;
  tokenPrefix?: string;
  responseTokenProp?: string;
  responseIdTokenProp?: string;
  responseRefreshTokenProp?: string;
  unlinkUrl?: string;
  unlinkMethod?: 'get' | 'post';
  authHeader?: string;
  authToken?: string;
  withCredentials?: boolean;
  platform?: string;
  storage?: 'localStorage' | 'sessionStorage' | 'memory' | Storage;
  providers?: Record<string, IAuthProviderConfig>;
  refreshTokens?: boolean;
  refreshTokenPayload?: Record<string, unknown> | ((refreshToken: string) => Record<string, unknown>);
  tokenExpirationLeeway?: number;
  pkce?: boolean;
  pkceMethod?: 'S256' | 'plain';

  // Role-based access control
  rolesProperty?: string;
  permissionsProperty?: string;

  // Password reset
  forgotPasswordUrl?: string;
  resetPasswordUrl?: string;

  // Auto-refresh
  autoRefresh?: boolean;
  autoRefreshBuffer?: number;

  // Idle timeout
  idleTimeout?: number;
  idleEvents?: string[];

  // Multi-tab sync
  tabSync?: boolean;
  tabSyncChannel?: string;
}

export const IAuthOptions = DI.createInterface<IAuthConfigOptions>('IAuthOptions');
