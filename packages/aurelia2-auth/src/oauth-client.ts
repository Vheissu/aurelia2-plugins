import { DI, optional, resolve } from '@aurelia/kernel';
import { IHttpClient, json } from '@aurelia/fetch-client';
import { IWindow } from '@aurelia/runtime-html';
import type {
  IAuthProviderConfig,
  IOAuthAuthorizationRequest,
  IOAuthCallback,
  IOAuthStartOptions,
  IOAuthTransaction,
} from './configuration';
import { IAuthOptions } from './configuration';
import { IAuthentication } from './authentication';
import { AuthError } from './auth-error';
import { decodeJwt } from './jwt';
import { markAuthSkip } from './auth-request';
import { joinUrl, parseOAuthResponse, status } from './auth-utilities';
import { IPopup } from './popup';
import { ITransactionStorage } from './storage';

interface IOidcMetadata {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  revocation_endpoint?: string;
  userinfo_endpoint?: string;
}

export interface IOAuthClient {
  begin(providerName: string, options?: IOAuthStartOptions): Promise<IOAuthAuthorizationRequest>;
  start(providerName: string, options?: IOAuthStartOptions): Promise<unknown>;
  complete(
    callback: string | URL | URLSearchParams | Readonly<Record<string, string>>,
    providerName?: string,
    userData?: Readonly<Record<string, unknown>>,
  ): Promise<unknown>;
}

export const IOAuthClient = DI.createInterface<IOAuthClient>(
  'IOAuthClient',
  x => x.singleton(OAuthClient),
);

export class OAuthClient implements IOAuthClient {
  private readonly http = resolve(IHttpClient);
  private readonly auth = resolve(IAuthentication);
  private readonly config = resolve(IAuthOptions);
  private readonly transactions = resolve(ITransactionStorage);
  private readonly popup = resolve(IPopup);
  private readonly window = resolve(optional(IWindow));
  private readonly discovery = new Map<string, Promise<IOidcMetadata>>();

  public async begin(
    providerName: string,
    options: IOAuthStartOptions = {},
  ): Promise<IOAuthAuthorizationRequest> {
    const provider = await this.resolveProvider(providerName);
    const flow = provider.flow ?? legacyFlow(provider);
    if (flow === 'oauth1') {
      throw new AuthError(
        'invalid-configuration',
        'OAuth 1 providers use the explicit OAuth1 adapter.',
      );
    }
    if (!provider.clientId) {
      throw new AuthError('invalid-configuration', `OAuth provider "${providerName}" needs a clientId.`);
    }
    if (!provider.authorizationEndpoint) {
      throw new AuthError(
        'invalid-configuration',
        `OAuth provider "${providerName}" has no authorization endpoint or discovery document.`,
      );
    }

    const redirectUri = provider.redirectUri ?? this.defaultRedirectUri();
    const state = secureRandomString(32);
    const usePkce = flow === 'authorization-code'
      && (provider.pkce ?? this.config.pkce ?? true);
    const codeVerifier = usePkce ? secureRandomString(64) : undefined;
    const nonce = shouldUseNonce(provider) ? secureRandomString(32) : undefined;
    const transaction: IOAuthTransaction = Object.freeze({
      provider: providerName,
      state,
      nonce,
      codeVerifier,
      redirectUri,
      issuer: provider.issuer,
      returnUrl: options.returnUrl,
      createdAt: Date.now(),
    });
    this.transactions.set(this.transactionKey(state), JSON.stringify(transaction));

    const params = new URLSearchParams({
      response_type: provider.responseType ?? (flow === 'implicit' ? 'token' : 'code'),
      client_id: provider.clientId,
      redirect_uri: redirectUri,
      state,
    });
    const scope = serializeScope(provider.scope);
    if (scope) params.set('scope', scope);
    if (nonce) params.set('nonce', nonce);
    if (provider.responseMode) params.set('response_mode', provider.responseMode);
    if (provider.audience) params.set('audience', provider.audience);
    if (provider.resource) params.set('resource', provider.resource);
    if (provider.prompt) params.set('prompt', provider.prompt);
    if (provider.loginHint) params.set('login_hint', provider.loginHint);
    if (codeVerifier) {
      params.set('code_challenge', await createPkceChallenge(codeVerifier));
      params.set('code_challenge_method', 'S256');
    }
    addParameters(params, provider.additionalParameters);
    addParameters(params, options.additionalParameters);

    const url = new URL(this.absoluteUrl(provider.authorizationEndpoint));
    for (const [key, value] of params) url.searchParams.set(key, value);
    return Object.freeze({
      provider: providerName,
      url: url.toString(),
      display: options.display ?? provider.display ?? 'redirect',
      transaction,
    });
  }

  public async start(providerName: string, options: IOAuthStartOptions = {}): Promise<unknown> {
    const request = await this.begin(providerName, options);
    if (request.display === 'redirect') {
      if (!this.window) throw new Error('Redirect OAuth requires a browser window.');
      this.window.location.assign(request.url);
      return request;
    }

    const provider = this.getProvider(providerName);
    const callbackUrl = await this.popup
      .open(request.url, providerName, provider.popupOptions, request.transaction.redirectUri)
      .pollPopup();
    return this.complete(callbackUrl, providerName, options.userData);
  }

  public async complete(
    callbackInput: string | URL | URLSearchParams | Readonly<Record<string, string>>,
    providerName?: string,
    userData: Readonly<Record<string, unknown>> = {},
  ): Promise<unknown> {
    const callback = parseCallback(callbackInput);
    if (!callback.state) {
      throw new AuthError('oauth-transaction-mismatch', 'The OAuth callback did not include state.');
    }

    const key = this.transactionKey(callback.state);
    const transaction = parseTransaction(this.transactions.get(key));
    if (!transaction || transaction.state !== callback.state) {
      throw new AuthError('oauth-transaction-mismatch', 'The OAuth callback state did not match an active transaction.');
    }
    if (providerName && transaction.provider !== providerName) {
      throw new AuthError('oauth-transaction-mismatch', 'The OAuth callback provider did not match the active transaction.');
    }
    const maxAge = (this.config.oauthTransactionTtl ?? 600) * 1000;
    if (Date.now() - transaction.createdAt > maxAge) {
      this.transactions.remove(key);
      throw new AuthError('oauth-transaction-expired', 'The OAuth transaction expired. Start sign-in again.');
    }
    this.transactions.remove(key);

    const provider = await this.resolveProvider(transaction.provider);
    if (callback.error) {
      throw new AuthError(
        'oauth-callback-error',
        callback.errorDescription || `The provider returned ${callback.error}.`,
      );
    }
    if (provider.validateIssuer && callback.issuer && callback.issuer !== provider.issuer) {
      throw new AuthError('oauth-transaction-mismatch', 'The OAuth response issuer did not match the provider.');
    }

    const response = await this.exchange(provider, transaction, callback, userData);
    this.validateOidcResponse(provider, transaction, callback, response);
    this.auth.setToken(response);
    return response;
  }

  private async resolveProvider(name: string): Promise<IAuthProviderConfig> {
    const provider = { ...this.getProvider(name) };
    if (!provider.discoveryUrl) return provider;

    let pending = this.discovery.get(provider.discoveryUrl);
    if (!pending) {
      pending = this.fetchDiscovery(provider.discoveryUrl);
      this.discovery.set(provider.discoveryUrl, pending);
    }
    const metadata = await pending;
    return {
      ...provider,
      issuer: provider.issuer ?? metadata.issuer,
      authorizationEndpoint: provider.authorizationEndpoint ?? metadata.authorization_endpoint,
      tokenEndpoint: provider.tokenEndpoint ?? metadata.token_endpoint,
      revocationEndpoint: provider.revocationEndpoint ?? metadata.revocation_endpoint,
      userInfoEndpoint: provider.userInfoEndpoint ?? metadata.userinfo_endpoint,
    };
  }

  private getProvider(name: string): IAuthProviderConfig {
    const provider = this.config.providers?.[name];
    if (!provider) throw new AuthError('unknown-provider', `Unknown auth provider: ${name}.`);
    return provider;
  }

  private async fetchDiscovery(url: string): Promise<IOidcMetadata> {
    const request = markAuthSkip(new Request(this.absoluteUrl(url), {
      headers: { Accept: 'application/json' },
    }));
    return this.http.fetch(request).then(response => status<IOidcMetadata>(response));
  }

  private async exchange(
    provider: IAuthProviderConfig,
    transaction: IOAuthTransaction,
    callback: IOAuthCallback,
    userData: Readonly<Record<string, unknown>>,
  ): Promise<unknown> {
    const flow = provider.flow ?? legacyFlow(provider);
    if (flow === 'implicit' || provider.exchange === 'none') {
      return {
        access_token: callback.accessToken,
        id_token: callback.idToken,
        token_type: callback.tokenType,
        expires_in: callback.expiresIn,
      };
    }
    if (!callback.code) {
      throw new AuthError('oauth-callback-error', 'The OAuth callback did not include an authorization code.');
    }

    const body = {
      ...userData,
      ...provider.tokenParameters,
      code: callback.code,
      clientId: provider.clientId,
      client_id: provider.clientId,
      redirectUri: transaction.redirectUri,
      redirect_uri: transaction.redirectUri,
      code_verifier: transaction.codeVerifier,
      state: transaction.state,
    };

    if ((provider.exchange ?? 'backend') === 'direct') {
      if (!provider.tokenEndpoint) {
        throw new AuthError('invalid-configuration', `OAuth provider "${provider.name}" has no token endpoint.`);
      }
      const form = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null) form.set(key, String(value));
      }
      form.set('grant_type', 'authorization_code');
      const request = markAuthSkip(new Request(this.absoluteUrl(provider.tokenEndpoint), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      }));
      return this.http.fetch(request).then(status);
    }

    if (!provider.url) {
      throw new AuthError('invalid-configuration', `OAuth provider "${provider.name}" has no backend exchange URL.`);
    }
    const url = joinUrl(this.config.baseUrl, provider.url);
    const request = markAuthSkip(new Request(this.absoluteUrl(url), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: json(body),
      credentials: this.config.withCredentials ? 'include' : 'same-origin',
    }));
    return this.http.fetch(request).then(status);
  }

  private validateOidcResponse(
    provider: IAuthProviderConfig,
    transaction: IOAuthTransaction,
    callback: IOAuthCallback,
    response: unknown,
  ): void {
    if (!transaction.nonce && !provider.validateIssuer) return;
    const record = isRecord(response) ? response : {};
    const idToken = readString(record, this.config.responseIdTokenProp ?? 'id_token')
      ?? callback.idToken;
    const claims = decodeJwt(idToken);

    if (transaction.nonce && (!claims || claims.nonce !== transaction.nonce)) {
      throw new AuthError('oauth-transaction-mismatch', 'The OpenID Connect nonce did not match.');
    }
    if (provider.validateIssuer && provider.issuer && claims?.iss !== provider.issuer) {
      throw new AuthError('oauth-transaction-mismatch', 'The OpenID Connect issuer did not match.');
    }
  }

  private transactionKey(state: string): string {
    return `${this.config.tokenPrefix ?? 'aurelia-auth'}:oauth:${state}`;
  }

  private defaultRedirectUri(): string {
    if (!this.window) throw new Error('OAuth redirectUri is required outside a browser.');
    return `${this.window.location.origin}/auth/callback`;
  }

  private absoluteUrl(value: string): string {
    if (/^[a-z][a-z\d+.-]*:/i.test(value)) return value;
    if (!this.window) throw new Error(`An absolute URL is required outside a browser: ${value}`);
    return new URL(value, this.window.location.origin).toString();
  }
}

function parseCallback(
  input: string | URL | URLSearchParams | Readonly<Record<string, string>>,
): IOAuthCallback {
  const raw = input instanceof URLSearchParams
    ? Object.fromEntries(input.entries())
    : input instanceof URL
      ? parseOAuthResponse(input)
      : typeof input === 'string'
        ? parseOAuthResponse(input)
        : { ...input };
  return {
    code: raw.code,
    state: raw.state,
    error: raw.error,
    errorDescription: raw.error_description,
    issuer: raw.iss,
    accessToken: raw.access_token,
    idToken: raw.id_token,
    tokenType: raw.token_type,
    expiresIn: raw.expires_in ? Number(raw.expires_in) : undefined,
    raw: Object.freeze(raw),
  };
}

function parseTransaction(value: string | null): IOAuthTransaction | null {
  if (!value) return null;
  try {
    const transaction = JSON.parse(value) as Partial<IOAuthTransaction>;
    return transaction.provider && transaction.state && transaction.redirectUri
      && typeof transaction.createdAt === 'number'
      ? transaction as IOAuthTransaction
      : null;
  } catch {
    return null;
  }
}

function legacyFlow(provider: IAuthProviderConfig): 'authorization-code' | 'implicit' | 'oauth1' {
  if (provider.type === '1.0') return 'oauth1';
  return provider.responseType?.toLowerCase().includes('token') ? 'implicit' : 'authorization-code';
}

function shouldUseNonce(provider: IAuthProviderConfig): boolean {
  if (provider.nonce === false) return false;
  if (provider.nonce !== undefined) return true;
  return serializeScope(provider.scope).split(/\s+/).includes('openid');
}

function serializeScope(scope: readonly string[] | string | undefined): string {
  return typeof scope === 'string' ? scope : scope?.join(' ') ?? '';
}

function addParameters(
  target: URLSearchParams,
  values: Readonly<Record<string, string | number | boolean>> | undefined,
): void {
  for (const [key, value] of Object.entries(values ?? {})) target.set(key, String(value));
}

function secureRandomString(byteLength: number): string {
  const crypto = globalThis.crypto;
  if (!crypto?.getRandomValues) {
    throw new Error('OAuth requires a cryptographically secure random number generator.');
  }
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return base64Url(bytes);
}

async function createPkceChallenge(verifier: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('S256 PKCE requires Web Crypto.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const value = typeof globalThis.btoa === 'function'
    ? globalThis.btoa(binary)
    : (globalThis as typeof globalThis & {
      Buffer?: { from(input: Uint8Array): { toString(encoding: string): string } };
    }).Buffer?.from(bytes).toString('base64');
  if (!value) throw new Error('OAuth requires a base64 encoder.');
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: Record<string, unknown>, key: string): string | undefined {
  const result = value[key];
  return typeof result === 'string' ? result : undefined;
}
