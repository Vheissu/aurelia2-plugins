import { DI, IEventAggregator, optional, resolve } from '@aurelia/kernel';
import { IHttpClient, json } from '@aurelia/fetch-client';
import { IWindow } from '@aurelia/runtime-html';
import type {
  IAuthSession,
  IAuthorizationDecision,
  IAuthorizationRequirement,
  IOAuthAuthorizationRequest,
  IOAuthStartOptions,
} from './configuration';
import { IAuthOptions } from './configuration';
import { IAuthentication } from './authentication';
import { IAuthorizationService } from './authorization';
import { AuthError } from './auth-error';
import { AuthEvents, AuthStateChangedEvent } from './auth-events';
import { markAuthSkip } from './auth-request';
import { joinUrl, status } from './auth-utilities';
import { IOAuth1 } from './oAuth1';
import { IOAuthClient } from './oauth-client';

export interface IAuthService {
  readonly session: Readonly<IAuthSession>;
  initialize(): Promise<Readonly<IAuthSession>>;
  login<T = unknown>(emailOrData: string | Record<string, unknown>, password?: string): Promise<T>;
  signup<T = unknown>(displayNameOrData: string | Record<string, unknown>, email?: string, password?: string): Promise<T>;
  logout(redirectUri?: string): Promise<void>;
  checkSession<T = unknown>(): Promise<T>;
  getMe<T = unknown>(): Promise<T>;
  refreshToken<T = unknown>(): Promise<T>;
  beginOAuth(providerName: string, options?: IOAuthStartOptions): Promise<IOAuthAuthorizationRequest>;
  authenticate(providerName: string, redirect?: string, userData?: Readonly<Record<string, unknown>>): Promise<unknown>;
  completeOAuthCallback(
    callback: string | URL | URLSearchParams | Readonly<Record<string, string>>,
    providerName?: string,
  ): Promise<unknown>;
  isAuthenticated(): boolean;
  getTokenPayload(): Readonly<Record<string, unknown>> | null;
  setToken(token: string): void;
  getUserRoles(): readonly string[];
  getUserPermissions(): readonly string[];
  hasRole(role: string): boolean;
  hasAnyRole(roles: readonly string[]): boolean;
  hasAllRoles(roles: readonly string[]): boolean;
  hasPermission(permission: string): boolean;
  hasAnyPermission(permissions: readonly string[]): boolean;
  hasAllPermissions(permissions: readonly string[]): boolean;
  authorize(requirement?: IAuthorizationRequirement, resource?: unknown): Promise<IAuthorizationDecision>;
  unlink<T = unknown>(provider: string): Promise<T>;
  forgotPassword<T = unknown>(email: string): Promise<T>;
  resetPassword<T = unknown>(data: {
    token: string;
    password: string;
    passwordConfirm?: string;
  }): Promise<T>;
  dispose(): void;
}

export const IAuthService = DI.createInterface<IAuthService>(
  'IAuthService',
  x => x.singleton(AuthService),
);

export class AuthService implements IAuthService {
  private readonly http = resolve(IHttpClient);
  private readonly auth = resolve(IAuthentication);
  private readonly oauth = resolve(IOAuthClient);
  private readonly oauth1 = resolve(IOAuth1);
  private readonly authorization = resolve(IAuthorizationService);
  private readonly config = resolve(IAuthOptions);
  private readonly eventAggregator = resolve(IEventAggregator);
  private readonly window = resolve(optional(IWindow));
  private refreshPromise: Promise<unknown> | null = null;
  private autoRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private idleCleanup: (() => void) | null = null;
  private tabSyncCleanup: (() => void) | null = null;
  private initializationPromise: Promise<Readonly<IAuthSession>> | null = null;
  private initialized = false;

  public get session(): Readonly<IAuthSession> {
    return this.auth.session;
  }

  /** @deprecated Use the configured `AuthInterceptor`. */
  public get tokenInterceptor(): { request(request: Request): Request } {
    return this.auth.tokenInterceptor;
  }

  public initialize(): Promise<Readonly<IAuthSession>> {
    if (this.initialized) return Promise.resolve(this.session);
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this.initializeSession()
      .then(session => {
        this.initialized = true;
        return session;
      })
      .catch(error => {
        this.stopIdleTracking();
        this.stopTabSync();
        throw error;
      })
      .finally(() => {
        this.initializationPromise = null;
      });
    return this.initializationPromise;
  }

  private async initializeSession(): Promise<Readonly<IAuthSession>> {
    this.startTabSync();
    this.startIdleTracking();

    if (this.config.mode === 'cookie' && this.config.autoInitialize) {
      try {
        await this.checkSession();
      } catch (error) {
        if (isResponse(error) && (error.status === 401 || error.status === 403)) {
          this.auth.clearTokens();
        } else {
          throw error;
        }
      }
    }
    this.scheduleAutoRefresh();
    return this.session;
  }

  public async getMe<T = unknown>(): Promise<T> {
    const response = await this.fetchJson<T>(this.auth.getProfileUrl());
    this.auth.setUser(response);
    return response;
  }

  public async checkSession<T = unknown>(): Promise<T> {
    const response = await this.fetchJson<T>(this.auth.getSessionUrl());
    const record = isRecord(response) ? response : null;
    if (record?.authenticated === false) {
      this.auth.clearTokens();
      this.publishState('session');
      return response;
    }
    this.auth.setToken(response);
    this.auth.setSession(record?.user ?? record?.profile ?? response);
    this.onAuthenticated('session');
    return response;
  }

  public isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  public getTokenPayload(): Readonly<Record<string, unknown>> | null {
    return this.auth.getPayload();
  }

  public setToken(token: string): void {
    this.auth.setToken(token);
    this.onAuthenticated('token');
  }

  public getUserRoles(): readonly string[] {
    return this.authorization.getRoles();
  }

  public getUserPermissions(): readonly string[] {
    return this.authorization.getPermissions();
  }

  public hasRole(role: string): boolean {
    return this.authorization.hasRole(role);
  }

  public hasAnyRole(roles: readonly string[]): boolean {
    return this.authorization.hasAnyRole(roles);
  }

  public hasAllRoles(roles: readonly string[]): boolean {
    return this.authorization.hasAllRoles(roles);
  }

  public hasPermission(permission: string): boolean {
    return this.authorization.hasPermission(permission);
  }

  public hasAnyPermission(permissions: readonly string[]): boolean {
    return this.authorization.hasAnyPermission(permissions);
  }

  public hasAllPermissions(permissions: readonly string[]): boolean {
    return this.authorization.hasAllPermissions(permissions);
  }

  public authorize(
    requirement: IAuthorizationRequirement = {},
    resource?: unknown,
  ): Promise<IAuthorizationDecision> {
    return this.authorization.evaluate(requirement, resource);
  }

  public async signup<T = unknown>(
    displayNameOrData: string | Record<string, unknown>,
    email?: string,
    password?: string,
  ): Promise<T> {
    const content = typeof displayNameOrData === 'object'
      ? displayNameOrData
      : { displayName: displayNameOrData, email, password };
    const response = await this.fetchJson<T>(this.auth.getSignupUrl(), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: json(content),
    }, true);

    if (this.config.loginOnSignup) {
      this.auth.setToken(response);
      if (this.config.mode === 'cookie') this.auth.setSession(extractUser(response));
      this.onAuthenticated('login');
    } else {
      this.safeNavigate(this.config.signupRedirect);
    }
    this.eventAggregator.publish(AuthEvents.signup, response);
    return response;
  }

  public async login<T = unknown>(
    emailOrData: string | Record<string, unknown>,
    password?: string,
  ): Promise<T> {
    const content = typeof emailOrData === 'object'
      ? emailOrData
      : { email: emailOrData, password };
    const response = await this.fetchJson<T>(this.auth.getLoginUrl(), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: json(content),
    }, true);
    this.auth.setToken(response);
    if (this.config.mode === 'cookie') this.auth.setSession(extractUser(response));
    this.onAuthenticated('login');
    this.eventAggregator.publish(AuthEvents.login, response);
    this.safeNavigate(this.auth.getLoginRedirect());
    return response;
  }

  public async logout(redirectUri?: string): Promise<void> {
    let failure: unknown;
    try {
      if (this.config.logoutUrl) {
        await this.fetchJson(this.endpoint(this.config.logoutUrl), {
          method: 'POST',
          headers: { Accept: 'application/json' },
        });
      }
    } catch (error) {
      failure = error;
    } finally {
      this.auth.clearTokens();
      this.onDeauthenticated('logout');
      this.eventAggregator.publish(AuthEvents.logout);
      this.safeNavigate(redirectUri ?? this.config.logoutRedirect);
    }
    if (failure) throw failure;
  }

  public beginOAuth(
    providerName: string,
    options?: IOAuthStartOptions,
  ): Promise<IOAuthAuthorizationRequest> {
    return this.oauth.begin(providerName, options);
  }

  public async authenticate(
    providerName: string,
    redirect?: string,
    userData: Readonly<Record<string, unknown>> = {},
  ): Promise<unknown> {
    const provider = this.config.providers?.[providerName];
    if (!provider) throw new AuthError('unknown-provider', `Unknown auth provider: ${providerName}.`);
    const response = (provider.flow === 'oauth1' || provider.type === '1.0')
      ? await this.oauth1.open(provider, userData)
      : await this.oauth.start(providerName, { returnUrl: redirect, userData });

    if (provider.flow === 'oauth1' || provider.type === '1.0') this.auth.setToken(response);
    if (this.auth.isAuthenticated()) {
      this.onAuthenticated('login');
      this.eventAggregator.publish(AuthEvents.authenticate, response);
      this.safeNavigate(redirect);
    }
    return response;
  }

  public async completeOAuthCallback(
    callback: string | URL | URLSearchParams | Readonly<Record<string, string>>,
    providerName?: string,
  ): Promise<unknown> {
    const response = await this.oauth.complete(callback, providerName);
    this.onAuthenticated('login');
    this.eventAggregator.publish(AuthEvents.authenticate, response);
    return response;
  }

  public unlink<T = unknown>(provider: string): Promise<T> {
    const url = this.endpoint(this.config.unlinkUrl ?? '/auth/unlink/');
    const method = this.config.unlinkMethod ?? 'delete';
    return this.fetchJson<T>(method === 'get' ? `${url}${encodeURIComponent(provider)}` : url, {
      method: method.toUpperCase(),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: method === 'get' ? undefined : json({ provider }),
    }).then(response => {
      this.eventAggregator.publish(AuthEvents.unlink, response);
      return response;
    });
  }

  public refreshToken<T = unknown>(): Promise<T> {
    if (this.refreshPromise) return this.refreshPromise as Promise<T>;

    const refreshToken = this.auth.getRefreshToken();
    if (this.config.mode === 'bearer' && !refreshToken) {
      return Promise.reject(new AuthError('missing-refresh-token', 'No refresh token is available.'));
    }

    const payload = typeof this.config.refreshTokenPayload === 'function' && refreshToken
      ? this.config.refreshTokenPayload(refreshToken)
      : {
        ...(refreshToken ? { [this.config.refreshTokenName ?? 'refresh_token']: refreshToken } : {}),
        ...this.config.refreshTokenPayload,
      };
    this.auth.setStatus('refreshing');
    this.refreshPromise = this.fetchJson<T>(this.auth.getRefreshUrl(), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: json(payload),
    }, true)
      .then(response => {
        this.auth.setToken(response);
        if (this.config.mode === 'cookie') this.auth.setSession(extractUser(response));
        this.onAuthenticated('refresh');
        this.eventAggregator.publish(AuthEvents.refresh, response);
        return response;
      })
      .catch(error => {
        if (isResponse(error) && (error.status === 400 || error.status === 401 || error.status === 403)) {
          this.auth.clearTokens();
          this.onDeauthenticated('logout');
          this.eventAggregator.publish(AuthEvents.sessionExpired, error);
        } else {
          this.auth.setStatus(this.auth.getToken() ? 'authenticated' : 'anonymous');
        }
        throw error;
      })
      .finally(() => {
        this.refreshPromise = null;
      });
    return this.refreshPromise as Promise<T>;
  }

  public forgotPassword<T = unknown>(email: string): Promise<T> {
    return this.fetchJson<T>(this.endpoint(this.config.forgotPasswordUrl ?? '/auth/forgot-password'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: json({ email }),
    }, true).then(response => {
      this.eventAggregator.publish(AuthEvents.passwordResetRequested, response);
      return response;
    });
  }

  public resetPassword<T = unknown>(
    data: { token: string; password: string; passwordConfirm?: string },
  ): Promise<T> {
    return this.fetchJson<T>(this.endpoint(this.config.resetPasswordUrl ?? '/auth/reset-password'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: json(data),
    }, true).then(response => {
      this.eventAggregator.publish(AuthEvents.passwordReset, response);
      return response;
    });
  }

  public scheduleAutoRefresh(): void {
    this.clearAutoRefresh();
    if (!this.config.autoRefresh || !this.auth.isAuthenticated()) return;

    const expiration = this.session.tokens.expiresAt;
    if (!expiration) return;
    const refreshAt = expiration - (this.config.autoRefreshBuffer ?? 60);
    const delay = Math.max((refreshAt - Math.floor(Date.now() / 1000)) * 1000, 0);
    this.autoRefreshTimer = setTimeout(() => {
      void this.refreshToken().catch(error => {
        this.eventAggregator.publish(AuthEvents.tokenExpired, error);
      });
    }, delay);
  }

  public clearAutoRefresh(): void {
    if (this.autoRefreshTimer !== null) clearTimeout(this.autoRefreshTimer);
    this.autoRefreshTimer = null;
  }

  public startIdleTracking(): void {
    if (!this.window || !this.config.idleTimeout || this.idleCleanup) return;
    const reset = (): void => this.resetIdleTimer();
    const events = this.config.idleEvents ?? ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    for (const event of events) this.window.addEventListener(event, reset, { passive: true });
    this.idleCleanup = () => {
      for (const event of events) this.window?.removeEventListener(event, reset);
    };
    this.resetIdleTimer();
  }

  public stopIdleTracking(): void {
    this.clearIdleTimer();
    this.idleCleanup?.();
    this.idleCleanup = null;
  }

  public startTabSync(): void {
    if (!this.window || !this.config.tabSync || this.tabSyncCleanup) return;
    const tokenName = this.config.tokenName ?? 'access_token';
    const tokenKey = this.config.tokenPrefix ? `${this.config.tokenPrefix}_${tokenName}` : tokenName;
    const listener = (event: StorageEvent): void => {
      if (event.key !== tokenKey) return;
      if (event.newValue === null) {
        this.auth.clearTokens();
        this.onDeauthenticated('tab-sync');
      } else {
        this.auth.setStatus('authenticated');
        this.onAuthenticated('tab-sync');
      }
      this.eventAggregator.publish(AuthEvents.tabSync, {
        action: event.newValue === null ? 'logout' : 'login',
      });
    };
    this.window.addEventListener('storage', listener);
    this.tabSyncCleanup = () => this.window?.removeEventListener('storage', listener);
  }

  public stopTabSync(): void {
    this.tabSyncCleanup?.();
    this.tabSyncCleanup = null;
  }

  public dispose(): void {
    this.clearAutoRefresh();
    this.stopIdleTracking();
    this.stopTabSync();
  }

  private onAuthenticated(reason: 'login' | 'refresh' | 'session' | 'token' | 'tab-sync'): void {
    this.auth.setStatus('authenticated');
    this.scheduleAutoRefresh();
    this.resetIdleTimer();
    this.publishState(reason);
  }

  private onDeauthenticated(reason: 'logout' | 'tab-sync'): void {
    this.clearAutoRefresh();
    this.clearIdleTimer();
    this.publishState(reason);
  }

  private publishState(reason: ConstructorParameters<typeof AuthStateChangedEvent>[1]): void {
    const event = new AuthStateChangedEvent(this.auth.isAuthenticated(), reason);
    this.eventAggregator.publish(event);
    this.eventAggregator.publish(AuthEvents.stateChanged, event);
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    if (!this.config.idleTimeout || !this.auth.isAuthenticated()) return;
    this.idleTimer = setTimeout(() => {
      this.eventAggregator.publish(AuthEvents.idleTimeout);
      void this.logout().catch(() => undefined);
    }, this.config.idleTimeout * 1000);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private endpoint(path: string): string {
    return joinUrl(this.config.baseUrl, path);
  }

  private async fetchJson<T = unknown>(
    url: string,
    init?: RequestInit,
    skipAuth = false,
  ): Promise<T> {
    const absolute = this.absoluteUrl(url);
    const request = new Request(absolute, {
      credentials: this.config.withCredentials ? 'include' : 'same-origin',
      ...init,
    });
    return this.http.fetch(skipAuth ? markAuthSkip(request) : request).then(response => status<T>(response));
  }

  private absoluteUrl(value: string): string {
    if (/^[a-z][a-z\d+.-]*:/i.test(value)) return value;
    if (!this.window) throw new Error(`An absolute baseUrl is required outside a browser: ${value}`);
    return new URL(value, this.window.location.origin).toString();
  }

  private safeNavigate(destination: string | null | undefined): void {
    if (!destination || !this.window?.location) return;
    const url = new URL(destination, this.window.location.origin);
    if (url.origin === this.window.location.origin) this.window.location.assign(url.toString());
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function extractUser(value: unknown): unknown {
  return isRecord(value) ? value.user ?? value.profile ?? null : null;
}

function isResponse(value: unknown): value is Response {
  return typeof Response !== 'undefined' && value instanceof Response;
}
