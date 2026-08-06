import { DI, optional, resolve } from '@aurelia/kernel';
import { IWindow } from '@aurelia/runtime-html';
import type {
  AuthStatus,
  IAuthConfigOptions,
  IAuthSession,
  IAuthTokenSet,
  IJwtClaims,
} from './configuration';
import { IAuthOptions } from './configuration';
import { decodeJwt, getJwtExpiration, isJwt, isJwtUsable } from './jwt';
import { IStorage } from './storage';
import { joinUrl } from './auth-utilities';

export interface IAuthentication {
  readonly session: Readonly<IAuthSession>;
  readonly tokenInterceptor: { request(request: Request): Request };
  getLoginRoute(): string;
  getLoginRedirect(): string | null;
  getLoginUrl(): string;
  getSignupUrl(): string;
  getProfileUrl(): string;
  getSessionUrl(): string;
  getRefreshUrl(): string;
  getToken(): string | null;
  getIdToken(): string | null;
  getRefreshToken(): string | null;
  getPayload(): IJwtClaims | null;
  getIdTokenPayload(): IJwtClaims | null;
  decomposeToken(token: string | null): IJwtClaims | null;
  setInitialUrl(url: string): void;
  setToken(response: unknown, redirect?: string): Readonly<IAuthTokenSet>;
  setSession(user?: unknown): void;
  setStatus(status: AuthStatus): void;
  setUser(user: unknown): void;
  clearTokens(): void;
  isTokenExpired(leewaySeconds?: number): boolean;
  isAuthenticated(): boolean;
  logout(redirect?: string): Promise<void>;
}

export const IAuthentication = DI.createInterface<IAuthentication>(
  'IAuthentication',
  x => x.singleton(Authentication),
);

type TokenKey = 'access' | 'id' | 'refresh' | 'expiresAt' | 'tokenType' | 'scope';

export class Authentication implements IAuthentication {
  private readonly storage: IStorage = resolve(IStorage);
  private readonly config: Readonly<IAuthConfigOptions> = resolve(IAuthOptions);
  private readonly window: IWindow | undefined = resolve(optional(IWindow));
  private initialUrl: string | undefined;
  private sessionUser: unknown = null;
  private explicitStatus: AuthStatus = 'anonymous';

  public get session(): Readonly<IAuthSession> {
    const accessToken = this.getToken();
    const tokens: IAuthTokenSet = {
      accessToken: accessToken ?? undefined,
      idToken: this.getIdToken() ?? undefined,
      refreshToken: this.getRefreshToken() ?? undefined,
      tokenType: this.storage.get(this.key('tokenType')) ?? undefined,
      scope: this.storage.get(this.key('scope')) ?? undefined,
      expiresAt: this.readNumber(this.key('expiresAt')) ?? undefined,
    };

    return Object.freeze({
      status: this.explicitStatus === 'refreshing'
        ? 'refreshing'
        : this.isAuthenticated() ? 'authenticated' : 'anonymous',
      user: this.sessionUser,
      claims: this.getPayload(),
      tokens: Object.freeze(tokens),
    });
  }

  public getLoginRoute(): string {
    return this.config.loginRoute ?? '/login';
  }

  public getLoginRedirect(): string | null {
    return this.initialUrl ?? this.config.loginRedirect ?? null;
  }

  public getLoginUrl(): string {
    return this.endpoint(this.config.loginUrl ?? '/auth/login');
  }

  public getSignupUrl(): string {
    return this.endpoint(this.config.signupUrl ?? '/auth/signup');
  }

  public getProfileUrl(): string {
    return this.endpoint(this.config.profileUrl ?? '/auth/me');
  }

  public getSessionUrl(): string {
    return this.endpoint(this.config.sessionUrl ?? '/auth/session');
  }

  public getRefreshUrl(): string {
    return this.endpoint(this.config.refreshUrl ?? '/auth/refresh');
  }

  public getToken(): string | null {
    return this.storage.get(this.key('access'));
  }

  public getIdToken(): string | null {
    return this.storage.get(this.key('id'));
  }

  public getRefreshToken(): string | null {
    return this.storage.get(this.key('refresh'));
  }

  public getPayload(): IJwtClaims | null {
    return decodeJwt(this.getToken()) ?? decodeJwt(this.getIdToken());
  }

  public getIdTokenPayload(): IJwtClaims | null {
    return decodeJwt(this.getIdToken());
  }

  public decomposeToken(token: string | null): IJwtClaims | null {
    return decodeJwt(token);
  }

  public setInitialUrl(url: string): void {
    if (!this.config.preserveReturnUrl || !url) return;
    this.initialUrl = this.isSafeRedirect(url) ? url : undefined;
  }

  public setToken(response: unknown, redirect?: string): Readonly<IAuthTokenSet> {
    const tokens = this.extractTokenSet(response);
    if (tokens.accessToken) this.storage.set(this.key('access'), tokens.accessToken);
    if (tokens.idToken) this.storage.set(this.key('id'), tokens.idToken);
    if (tokens.refreshToken) this.storage.set(this.key('refresh'), tokens.refreshToken);
    if (tokens.tokenType) this.storage.set(this.key('tokenType'), tokens.tokenType);
    if (tokens.scope) this.storage.set(this.key('scope'), tokens.scope);

    const expiresAt = tokens.expiresAt
      ?? (tokens.expiresIn ? Math.floor(Date.now() / 1000) + tokens.expiresIn : null)
      ?? getJwtExpiration(tokens.accessToken);
    if (expiresAt) this.storage.set(this.key('expiresAt'), String(expiresAt));
    else if (tokens.accessToken) this.storage.remove(this.key('expiresAt'));

    if (tokens.accessToken || tokens.idToken || this.config.mode === 'cookie') {
      this.explicitStatus = 'authenticated';
    }
    if (redirect) this.navigate(redirect);
    return Object.freeze({ ...tokens, expiresAt: expiresAt ?? undefined, raw: response });
  }

  public setSession(user?: unknown): void {
    this.sessionUser = user ?? null;
    this.explicitStatus = 'authenticated';
  }

  public setStatus(status: AuthStatus): void {
    this.explicitStatus = status;
  }

  public setUser(user: unknown): void {
    this.sessionUser = user ?? null;
  }

  public removeToken(): void {
    this.storage.remove(this.key('access'));
  }

  public removeIdToken(): void {
    this.storage.remove(this.key('id'));
  }

  public removeRefreshToken(): void {
    this.storage.remove(this.key('refresh'));
  }

  public clearTokens(): void {
    this.storage.clear([
      this.key('access'),
      this.key('id'),
      this.key('refresh'),
      this.key('expiresAt'),
      this.key('tokenType'),
      this.key('scope'),
    ]);
    this.explicitStatus = 'anonymous';
    this.sessionUser = null;
  }

  public isTokenExpired(leewaySeconds = this.config.tokenExpirationLeeway ?? 0): boolean {
    const token = this.getToken();
    if (!token) return true;
    if (isJwt(token)) {
      return !isJwtUsable(token, {
        clockTolerance: this.config.clockTolerance,
        expiresEarlyBy: leewaySeconds,
        issuer: this.config.issuer,
        audience: this.config.audience,
        validate: this.config.validateJwt,
      });
    }

    const expiresAt = this.readNumber(this.key('expiresAt'));
    return expiresAt !== null
      ? Math.floor(Date.now() / 1000) >= expiresAt - Math.max(leewaySeconds, 0)
      : false;
  }

  public isAuthenticated(): boolean {
    if (this.config.mode === 'cookie' || this.config.mode === 'custom') {
      return this.explicitStatus === 'authenticated';
    }
    if (this.config.mode === 'api-key') {
      const key = typeof this.config.apiKey === 'function' ? this.config.apiKey() : this.config.apiKey;
      return Boolean(key) || this.explicitStatus === 'authenticated';
    }

    const token = this.getToken();
    if (!token) return false;
    return !this.isTokenExpired();
  }

  public async logout(redirect?: string): Promise<void> {
    this.clearTokens();
    const destination = redirect ?? this.config.logoutRedirect;
    if (destination) this.navigate(destination);
  }

  /** @deprecated Register `AuthInterceptor`; this adapter remains for source compatibility. */
  public get tokenInterceptor(): { request(request: Request): Request } {
    return {
      request: request => {
        const token = this.getToken();
        if (token && this.config.authHeader) {
          request.headers.set(
            this.config.authHeader,
            this.config.authToken ? `${this.config.authToken} ${token}` : token,
          );
        }
        return request;
      },
    };
  }

  private endpoint(path: string): string {
    return this.config.baseUrl ? joinUrl(this.config.baseUrl, path) : path;
  }

  private key(type: TokenKey): string {
    const name = type === 'access'
      ? this.config.tokenName ?? 'access_token'
      : type === 'id'
        ? this.config.idTokenName ?? 'id_token'
        : type === 'refresh'
          ? this.config.refreshTokenName ?? 'refresh_token'
          : type === 'expiresAt'
            ? 'expires_at'
            : type === 'tokenType'
              ? 'token_type'
              : 'scope';
    return this.config.tokenPrefix ? `${this.config.tokenPrefix}_${name}` : name;
  }

  private extractTokenSet(response: unknown): IAuthTokenSet {
    if (typeof response === 'string') return { accessToken: response };
    if (!isRecord(response)) return {};

    const access = this.readToken(response, this.config.responseTokenProp, this.config.tokenRoot, this.config.tokenName);
    const id = this.readToken(response, this.config.responseIdTokenProp, undefined, this.config.idTokenName);
    const refresh = this.readToken(response, this.config.responseRefreshTokenProp, this.config.refreshTokenRoot, this.config.refreshTokenName);

    return {
      accessToken: access,
      idToken: id,
      refreshToken: refresh,
      tokenType: readString(response, 'token_type') ?? readString(response, 'tokenType'),
      scope: readString(response, 'scope'),
      expiresIn: readNumber(response, 'expires_in') ?? readNumber(response, 'expiresIn') ?? undefined,
      expiresAt: readNumber(response, 'expires_at') ?? readNumber(response, 'expiresAt') ?? undefined,
    };
  }

  private readToken(
    response: Record<string, unknown>,
    responseProperty: string | undefined,
    root: string | undefined,
    fallbackName: string | undefined,
  ): string | undefined {
    const direct = readPath(response, responseProperty ?? fallbackName ?? '');
    if (typeof direct === 'string') return direct;
    if (isRecord(direct) && isRecord(direct.data)) {
      const nested = readPath(direct.data, fallbackName ?? '');
      if (typeof nested === 'string') return nested;
    }
    const rooted = root ? readPath(response, `${root}.${fallbackName ?? ''}`) : undefined;
    return typeof rooted === 'string' ? rooted : undefined;
  }

  private readNumber(key: string): number | null {
    const value = this.storage.get(key);
    if (value === null) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private navigate(destination: string): void {
    if (this.window?.location && this.isSafeRedirect(destination)) {
      this.window.location.assign(destination);
      this.initialUrl = undefined;
    }
  }

  private isSafeRedirect(destination: string): boolean {
    if (!destination) return false;
    if (!this.window?.location) return destination.startsWith('/');
    try {
      return new URL(destination, this.window.location.origin).origin === this.window.location.origin;
    } catch {
      return false;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readPath(value: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>(
    (current, key) => isRecord(current) ? current[key] : undefined,
    value,
  );
}

function readString(value: Record<string, unknown>, path: string): string | undefined {
  const result = readPath(value, path);
  return typeof result === 'string' ? result : undefined;
}

function readNumber(value: Record<string, unknown>, path: string): number | null {
  const result = readPath(value, path);
  return typeof result === 'number' && Number.isFinite(result) ? result : null;
}
