import { DI, optional, resolve } from '@aurelia/kernel';
import { IHttpClient, json } from '@aurelia/fetch-client';
import { IWindow } from '@aurelia/runtime-html';
import type { IAuthProviderConfig } from './configuration';
import { IAuthOptions } from './configuration';
import { AuthError } from './auth-error';
import { markAuthSkip } from './auth-request';
import { joinUrl, parseOAuthResponse, status } from './auth-utilities';
import { IPopup } from './popup';

export interface IOAuth1 {
  open(options: IAuthProviderConfig, userData?: Readonly<Record<string, unknown>>): Promise<unknown>;
}

export const IOAuth1 = DI.createInterface<IOAuth1>('IOAuth1', x => x.singleton(OAuth1));

/**
 * Server-assisted OAuth 1.0a adapter. Consumer secrets and signing always remain on the server.
 */
export class OAuth1 implements IOAuth1 {
  private readonly http = resolve(IHttpClient);
  private readonly popup = resolve(IPopup);
  private readonly config = resolve(IAuthOptions);
  private readonly window = resolve(optional(IWindow));

  public async open(
    provider: IAuthProviderConfig,
    userData: Readonly<Record<string, unknown>> = {},
  ): Promise<unknown> {
    if (!provider.url || !provider.authorizationEndpoint) {
      throw new AuthError(
        'invalid-configuration',
        `OAuth 1 provider "${provider.name}" needs url and authorizationEndpoint.`,
      );
    }
    const backendUrl = this.absoluteUrl(joinUrl(this.config.baseUrl, provider.url));
    const request = markAuthSkip(new Request(backendUrl, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: json({ action: 'request-token', redirectUri: provider.redirectUri }),
      credentials: this.config.withCredentials ? 'include' : 'same-origin',
    }));
    const requestToken = await this.http.fetch(request).then(response => status<Record<string, unknown>>(response));
    const authorizationUrl = typeof requestToken.authorization_url === 'string'
      ? requestToken.authorization_url
      : withQuery(provider.authorizationEndpoint, requestToken);

    if ((provider.display ?? 'popup') === 'redirect') {
      if (!this.window) throw new Error('Redirect OAuth requires a browser window.');
      this.window.location.assign(authorizationUrl);
      return requestToken;
    }

    const callbackUrl = await this.popup
      .open(authorizationUrl, provider.name ?? 'oauth1', provider.popupOptions, provider.redirectUri)
      .pollPopup();
    const callback = parseOAuthResponse(callbackUrl);
    const exchange = markAuthSkip(new Request(backendUrl, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: json({ ...userData, ...callback, action: 'exchange-token' }),
      credentials: this.config.withCredentials ? 'include' : 'same-origin',
    }));
    return this.http.fetch(exchange).then(status);
  }

  private absoluteUrl(value: string): string {
    if (/^[a-z][a-z\d+.-]*:/i.test(value)) return value;
    if (!this.window) throw new Error(`An absolute URL is required outside a browser: ${value}`);
    return new URL(value, this.window.location.origin).toString();
  }
}

function withQuery(url: string, values: Readonly<Record<string, unknown>>): string {
  const result = new URL(url);
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result.searchParams.set(key, String(value));
    }
  }
  return result.toString();
}
