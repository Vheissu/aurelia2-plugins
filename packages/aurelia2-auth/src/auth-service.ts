import { IHttpClient, json } from "@aurelia/fetch-client";
import { IAuthentication } from "./authentication";
import { IOAuth1 } from "./oAuth1";
import { IOAuth2 } from "./oAuth2";
import { status, joinUrl } from "./auth-utilities";
import { DI, IEventAggregator, inject, optional } from "@aurelia/kernel";
import { IAuthOptions, IAuthConfigOptions } from "./configuration";
import { IWindow } from '@aurelia/runtime-html';
import { markAuthSkip } from './auth-request';
import { AuthEvents } from './auth-events';

export const IAuthService = DI.createInterface<IAuthService>("IAuthService", x => x.singleton(AuthService));

export type IAuthService = AuthService;

@inject(
  IHttpClient,
  IAuthentication,
  IOAuth1,
  IOAuth2,
  IAuthOptions,
  IEventAggregator,
  optional(IWindow)
)
export class AuthService {
  protected tokenInterceptor;
  private refreshPromise: Promise<unknown> | null = null;
  private autoRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private idleListeners: Array<() => void> = [];
  private tabSyncCleanup: (() => void) | null = null;

  constructor(
    readonly http: IHttpClient,
    readonly auth: IAuthentication,
    readonly oAuth1: IOAuth1,
    readonly oAuth2: IOAuth2,
    readonly config: IAuthConfigOptions,
    readonly eventAggregator: IEventAggregator,
    readonly window?: IWindow
  ) {
    this.tokenInterceptor = auth.tokenInterceptor;

    if (this.config.autoRefresh) {
      this.scheduleAutoRefresh();
    }

    if (this.config.idleTimeout && this.config.idleTimeout > 0) {
      this.startIdleTracking();
    }

    if (this.config.tabSync) {
      this.startTabSync();
    }
  }

  getMe() {
    let profileUrl = this.auth.getProfileUrl();
    return this.http.fetch(profileUrl).then(status);
  }

  isAuthenticated() {
    return this.auth.isAuthenticated();
  }

  getTokenPayload() {
    return this.auth.getPayload();
  }

  setToken(token: string) {
    this.auth.setToken(
      Object.defineProperty({}, this.config.tokenName, { value: token })
    );
  }

  // --- Role-based access control ---

  getUserRoles(): string[] {
    const payload = this.auth.getPayload();
    if (!payload) return [];
    const prop = this.config.rolesProperty ?? 'roles';
    const roles = payload[prop];
    if (Array.isArray(roles)) return roles;
    if (typeof roles === 'string') return [roles];
    return [];
  }

  getUserPermissions(): string[] {
    const payload = this.auth.getPayload();
    if (!payload) return [];
    const prop = this.config.permissionsProperty ?? 'permissions';
    const perms = payload[prop];
    if (Array.isArray(perms)) return perms;
    if (typeof perms === 'string') return [perms];
    return [];
  }

  hasRole(role: string): boolean {
    return this.getUserRoles().includes(role);
  }

  hasAnyRole(roles: string[]): boolean {
    const userRoles = this.getUserRoles();
    return roles.some(r => userRoles.includes(r));
  }

  hasAllRoles(roles: string[]): boolean {
    const userRoles = this.getUserRoles();
    return roles.every(r => userRoles.includes(r));
  }

  hasPermission(permission: string): boolean {
    return this.getUserPermissions().includes(permission);
  }

  hasAnyPermission(permissions: string[]): boolean {
    const userPerms = this.getUserPermissions();
    return permissions.some(p => userPerms.includes(p));
  }

  hasAllPermissions(permissions: string[]): boolean {
    const userPerms = this.getUserPermissions();
    return permissions.every(p => userPerms.includes(p));
  }

  // --- Core auth flows ---

  signup(displayNameOrData: string | Record<string, any>, email?: string, password?: string) {
    let signupUrl = this.auth.getSignupUrl();
    let content;
    if (typeof displayNameOrData === "object") {
      content = displayNameOrData;
    } else {
      content = {
        displayName: displayNameOrData,
        email: email,
        password: password,
      };
    }

    return this.http
      .fetch(signupUrl, {
        method: "post",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: json(content),
      })
      .then(status)
      .then((response) => {
        if (this.config.loginOnSignup) {
          this.auth.setToken(response);
          this.onAuthenticated();
        } else if (this.config.signupRedirect) {
          this.window?.location &&
            (this.window.location.href = this.config.signupRedirect);
        }
        this.eventAggregator.publish(AuthEvents.signup, response);
        return response;
      });
  }

  login(emailOrData: string | Record<string, any>, password?: string) {
    let loginUrl = this.auth.getLoginUrl();
    let content;
    if (typeof emailOrData === "object") {
      content = emailOrData;
    } else {
      content = {
        email: emailOrData,
        password: password,
      };
    }

    return this.http
      .fetch(loginUrl, {
        method: "post",
        headers:
          typeof content === "string"
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {},
        body: typeof content === "string" ? content : json(content),
      })
      .then(status)
      .then((response) => {
        this.auth.setToken(response);
        this.onAuthenticated();
        this.eventAggregator.publish(AuthEvents.login, response);
        return response;
      });
  }

  logout(redirectUri?: string) {
    return this.auth.logout(redirectUri).then(() => {
      this.onDeauthenticated();
      this.eventAggregator.publish(AuthEvents.logout);
    });
  }

  authenticate(name: string, redirect?: string, userData?: any) {
    const providerConfig = this.config.providers?.[name];
    if (!providerConfig) {
      return Promise.reject(new Error(`Unknown auth provider: ${name}`));
    }

    let provider: IOAuth1 | IOAuth2 = this.oAuth2;

    if (providerConfig.type === "1.0") {
      provider = this.oAuth1;
    }

    return provider.open(providerConfig, userData || {}).then((response) => {
      this.auth.setToken(response, redirect);
      this.onAuthenticated();
      this.eventAggregator.publish(AuthEvents.authenticate, response);
      return response;
    });
  }

  unlink(provider: string) {
    let unlinkUrl = this.config.baseUrl
      ? joinUrl(this.config.baseUrl, this.config.unlinkUrl)
      : this.config.unlinkUrl;

    if (this.config.unlinkMethod === "get") {
      return this.http
        .fetch(unlinkUrl + provider)
        .then(status)
        .then((response) => {
          this.eventAggregator.publish(AuthEvents.unlink, response);
          return response;
        });
    } else if (this.config.unlinkMethod === "post") {
      return this.http
        .fetch(unlinkUrl, {
          method: "post",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: json(provider),
        })
        .then(status)
        .then((response) => {
          this.eventAggregator.publish(AuthEvents.unlink, response);
          return response;
        });
    }
  }

  refreshToken() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.auth.getRefreshToken();
    if (!refreshToken) {
      return Promise.reject(new Error("No refresh token available."));
    }

    const refreshUrl = this.auth.getRefreshUrl();
    if (!refreshUrl) {
      return Promise.reject(new Error("No refresh URL configured."));
    }

    const refreshTokenProp = this.config.refreshTokenName || 'refresh_token';
    const payload =
      typeof this.config.refreshTokenPayload === "function"
        ? this.config.refreshTokenPayload(refreshToken)
        : {
            [refreshTokenProp]: refreshToken,
            ...(this.config.refreshTokenPayload ?? {}),
          };

    const credentials: RequestCredentials = this.config.withCredentials
      ? "include"
      : "same-origin";

    const requestInit: RequestInit = {
      method: "post",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: json(payload),
      credentials,
    };

    const requestInput =
      typeof Request === "undefined"
        ? refreshUrl
        : markAuthSkip(new Request(refreshUrl, requestInit));

    this.refreshPromise = this.http
      .fetch(requestInput as Request | string, typeof Request === "undefined" ? requestInit : undefined)
      .then(status)
      .then((response) => {
        this.auth.setToken(response);
        this.scheduleAutoRefresh();
        this.eventAggregator.publish(AuthEvents.refresh, response);
        return response;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  // --- Password reset ---

  forgotPassword(email: string) {
    const url = this.config.baseUrl
      ? joinUrl(this.config.baseUrl, this.config.forgotPasswordUrl)
      : this.config.forgotPasswordUrl;

    return this.http
      .fetch(url, {
        method: "post",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: json({ email }),
      })
      .then(status)
      .then((response) => {
        this.eventAggregator.publish(AuthEvents.passwordResetRequested, response);
        return response;
      });
  }

  resetPassword(data: { token: string; password: string; passwordConfirm?: string }) {
    const url = this.config.baseUrl
      ? joinUrl(this.config.baseUrl, this.config.resetPasswordUrl)
      : this.config.resetPasswordUrl;

    return this.http
      .fetch(url, {
        method: "post",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: json(data),
      })
      .then(status)
      .then((response) => {
        this.eventAggregator.publish(AuthEvents.passwordReset, response);
        return response;
      });
  }

  // --- Auto-refresh ---

  scheduleAutoRefresh() {
    this.clearAutoRefresh();

    if (!this.config.autoRefresh || !this.isAuthenticated()) {
      return;
    }

    const payload = this.auth.getPayload();
    if (!payload?.exp) return;

    const bufferSeconds = this.config.autoRefreshBuffer ?? 30;
    const now = Math.round(Date.now() / 1000);
    const refreshAt = payload.exp - bufferSeconds;
    const delayMs = Math.max((refreshAt - now) * 1000, 0);

    this.autoRefreshTimer = setTimeout(() => {
      if (this.isAuthenticated()) {
        this.refreshToken().catch(() => {
          this.eventAggregator.publish(AuthEvents.tokenExpired);
        });
      }
    }, delayMs);
  }

  clearAutoRefresh() {
    if (this.autoRefreshTimer !== null) {
      clearTimeout(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  // --- Idle timeout ---

  startIdleTracking() {
    if (!this.window || !this.config.idleTimeout) return;

    const resetIdle = () => this.resetIdleTimer();
    const events = this.config.idleEvents ?? ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];

    for (const event of events) {
      this.window.addEventListener(event, resetIdle, { passive: true });
    }
    this.idleListeners = [() => {
      for (const event of events) {
        this.window?.removeEventListener(event, resetIdle);
      }
    }];

    this.resetIdleTimer();
  }

  stopIdleTracking() {
    this.clearIdleTimer();
    for (const cleanup of this.idleListeners) {
      cleanup();
    }
    this.idleListeners = [];
  }

  private resetIdleTimer() {
    this.clearIdleTimer();

    if (!this.config.idleTimeout || !this.isAuthenticated()) return;

    this.idleTimer = setTimeout(() => {
      if (this.isAuthenticated()) {
        this.eventAggregator.publish(AuthEvents.idleTimeout);
        this.logout();
      }
    }, this.config.idleTimeout * 1000);
  }

  private clearIdleTimer() {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  // --- Multi-tab sync ---

  startTabSync() {
    if (!this.window) return;

    const tokenKey = this.config.tokenPrefix
      ? `${this.config.tokenPrefix}_${this.config.tokenName ?? 'token'}`
      : this.config.tokenName ?? 'token';

    const onStorage = (e: StorageEvent) => {
      if (e.key !== tokenKey) return;

      if (e.newValue === null && e.oldValue !== null) {
        // token removed in another tab
        this.auth.clearTokens();
        this.onDeauthenticated();
        this.eventAggregator.publish(AuthEvents.tabSync, { action: 'logout' });
      } else if (e.newValue !== null && e.oldValue === null) {
        // token added in another tab
        this.onAuthenticated();
        this.eventAggregator.publish(AuthEvents.tabSync, { action: 'login' });
      }
    };

    this.window.addEventListener('storage', onStorage);
    this.tabSyncCleanup = () => {
      this.window?.removeEventListener('storage', onStorage);
    };
  }

  stopTabSync() {
    this.tabSyncCleanup?.();
    this.tabSyncCleanup = null;
  }

  // --- Lifecycle helpers ---

  private onAuthenticated() {
    this.scheduleAutoRefresh();
    this.resetIdleTimer();
  }

  private onDeauthenticated() {
    this.clearAutoRefresh();
    this.clearIdleTimer();
  }

  dispose() {
    this.clearAutoRefresh();
    this.stopIdleTracking();
    this.stopTabSync();
  }
}
