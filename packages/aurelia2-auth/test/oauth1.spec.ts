import { Registration } from '@aurelia/kernel';
import { IHttpClient } from '@aurelia/fetch-client';
import type { IAuthProviderConfig } from '../src/configuration';
import { isAuthRequestSkipped } from '../src/auth-request';
import { OAuth1 } from '../src/oAuth1';
import { IPopup } from '../src/popup';
import { createUnitContainer } from './helpers';

describe('OAuth 1.0a server-assisted flow', () => {
  const provider: IAuthProviderConfig = {
    name: 'legacy',
    flow: 'oauth1',
    url: '/oauth/legacy',
    authorizationEndpoint: 'https://provider.example/authorize',
    redirectUri: 'https://app.example/auth/callback',
    display: 'popup',
    popupOptions: { width: 480 },
  };

  function create(browserWindow: Window = window) {
    const http = { fetch: jest.fn() };
    const popup = {
      open: jest.fn(),
      pollPopup: jest.fn(),
      close: jest.fn(),
      popupWindow: null,
    };
    popup.open.mockReturnValue(popup);
    const setup = createUnitContainer(
      { baseUrl: 'https://api.example', withCredentials: true },
      [
        Registration.instance(IHttpClient, http as never),
        Registration.instance(IPopup, popup as never),
      ],
      browserWindow,
    );
    return { ...setup, http, popup, oauth1: setup.container.invoke(OAuth1) };
  }

  test('keeps signing on the backend and exchanges the verified popup callback', async () => {
    const { http, popup, oauth1 } = create();
    http.fetch
      .mockResolvedValueOnce(jsonResponse({ oauth_token: 'request-token', extra: 7 }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-1' }));
    popup.pollPopup.mockResolvedValue(
      'https://app.example/auth/callback?oauth_token=request-token&oauth_verifier=verifier-1',
    );

    await expect(oauth1.open(provider, { invitation: 'invite-9' }))
      .resolves.toEqual({ access_token: 'access-1' });

    expect(http.fetch).toHaveBeenCalledTimes(2);
    const requestToken = http.fetch.mock.calls[0][0] as Request;
    expect(requestToken.url).toBe('https://api.example/oauth/legacy');
    expect(requestToken.credentials).toBe('include');
    expect(isAuthRequestSkipped(requestToken)).toBe(true);
    await expect(requestToken.clone().json()).resolves.toEqual({
      action: 'request-token',
      redirectUri: 'https://app.example/auth/callback',
    });

    const authorizationUrl = new URL(popup.open.mock.calls[0][0] as string);
    expect(authorizationUrl.origin).toBe('https://provider.example');
    expect(authorizationUrl.searchParams.get('oauth_token')).toBe('request-token');
    expect(authorizationUrl.searchParams.get('extra')).toBe('7');
    expect(popup.open).toHaveBeenCalledWith(
      authorizationUrl.toString(),
      'legacy',
      { width: 480 },
      'https://app.example/auth/callback',
    );

    const exchange = http.fetch.mock.calls[1][0] as Request;
    expect(isAuthRequestSkipped(exchange)).toBe(true);
    await expect(exchange.clone().json()).resolves.toEqual({
      invitation: 'invite-9',
      oauth_token: 'request-token',
      oauth_verifier: 'verifier-1',
      action: 'exchange-token',
    });
  });

  test('supports a backend-provided authorization URL in redirect mode', async () => {
    const assign = jest.fn();
    const browserWindow = {
      location: {
        origin: 'https://app.example',
        href: 'https://app.example/',
        assign,
      },
    } as unknown as Window;
    const { http, popup, oauth1 } = create(browserWindow);
    http.fetch.mockResolvedValue(jsonResponse({
      authorization_url: 'https://provider.example/authorize?oauth_token=server-token',
    }));

    await expect(oauth1.open({ ...provider, display: 'redirect' })).resolves.toMatchObject({
      authorization_url: expect.stringContaining('server-token'),
    });

    expect(assign).toHaveBeenCalledWith(
      'https://provider.example/authorize?oauth_token=server-token',
    );
    expect(popup.open).not.toHaveBeenCalled();
    expect(http.fetch).toHaveBeenCalledTimes(1);
  });

  test('rejects incomplete provider configuration before making a request', async () => {
    const { http, oauth1 } = create();

    await expect(oauth1.open({ name: 'broken', flow: 'oauth1' }))
      .rejects.toMatchObject({ code: 'invalid-configuration' });
    expect(http.fetch).not.toHaveBeenCalled();
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
