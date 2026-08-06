import { Registration } from '@aurelia/kernel';
import { IHttpClient } from '@aurelia/fetch-client';
import { Authentication, IAuthentication } from '../src/authentication';
import { OAuthClient } from '../src/oauth-client';
import { IPopup } from '../src/popup';
import { createJwt, createUnitContainer } from './helpers';

describe('OAuthClient', () => {
  function create(provider = {}, options = {}, browserWindow: Window = window) {
    const http = { fetch: jest.fn() };
    const popup = { open: jest.fn(), pollPopup: jest.fn(), close: jest.fn(), popupWindow: null };
    popup.open.mockReturnValue(popup);
    const setup = createUnitContainer({
      baseUrl: 'https://app.example/api',
      providers: {
        test: {
          name: 'test',
          clientId: 'client-1',
          authorizationEndpoint: 'https://issuer.example/authorize',
          url: '/oauth/test',
          redirectUri: 'https://app.example/auth/callback',
          scope: ['openid', 'profile'],
          flow: 'authorization-code',
          display: 'redirect',
          exchange: 'backend',
          nonce: false,
          state: true,
          pkce: true,
          ...provider,
        },
      },
      ...options,
    }, [
      Registration.instance(IHttpClient, http as never),
      Registration.instance(IPopup, popup as never),
    ], browserWindow);
    const auth = setup.container.invoke(Authentication);
    setup.container.register(Registration.instance(IAuthentication, auth));
    return { ...setup, auth, http, popup, oauth: setup.container.invoke(OAuthClient) };
  }

  test('creates one-time state and S256 PKCE transactions using Web Crypto', async () => {
    const { oauth, transactions } = create();
    const first = await oauth.begin('test', { returnUrl: '/reports' });
    const second = await oauth.begin('test');
    const url = new URL(first.url);

    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('client-1');
    expect(url.searchParams.get('state')).toBe(first.transaction.state);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.transaction.codeVerifier).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    expect(first.transaction.state).not.toBe(second.transaction.state);
    expect(first.transaction.returnUrl).toBe('/reports');
    expect(transactions.get(`aurelia-auth:oauth:${first.transaction.state}`)).not.toBeNull();
  });

  test('validates state, exchanges the code and consumes the transaction once', async () => {
    const { oauth, auth, http, transactions } = create();
    const request = await oauth.begin('test');
    http.fetch.mockResolvedValue(jsonResponse({ access_token: 'access-1', refresh_token: 'refresh-1' }));

    await expect(oauth.complete(
      `https://app.example/auth/callback?code=code-1&state=${request.transaction.state}`,
      'test',
    )).resolves.toMatchObject({ access_token: 'access-1' });

    expect(auth.getToken()).toBe('access-1');
    expect(transactions.get(`aurelia-auth:oauth:${request.transaction.state}`)).toBeNull();
    const exchange = http.fetch.mock.calls[0][0] as Request;
    await expect(exchange.clone().json()).resolves.toMatchObject({
      code: 'code-1',
      code_verifier: request.transaction.codeVerifier,
      redirect_uri: 'https://app.example/auth/callback',
    });
    await expect(oauth.complete(
      `https://app.example/auth/callback?code=replay&state=${request.transaction.state}`,
      'test',
    )).rejects.toMatchObject({ code: 'oauth-transaction-mismatch' });
  });

  test('does not exchange forged or expired callbacks', async () => {
    const { oauth, http, transactions } = create(undefined, { oauthTransactionTtl: 1 });
    await expect(oauth.complete(
      'https://app.example/auth/callback?code=stolen&state=forged',
      'test',
    )).rejects.toMatchObject({ code: 'oauth-transaction-mismatch' });

    const request = await oauth.begin('test');
    transactions.set(`aurelia-auth:oauth:${request.transaction.state}`, JSON.stringify({
      ...request.transaction,
      createdAt: Date.now() - 2_000,
    }));
    await expect(oauth.complete(
      `https://app.example/auth/callback?code=late&state=${request.transaction.state}`,
      'test',
    )).rejects.toMatchObject({ code: 'oauth-transaction-expired' });
    expect(http.fetch).not.toHaveBeenCalled();
  });

  test('uses and caches OpenID discovery metadata', async () => {
    const { oauth, http } = create({
      authorizationEndpoint: undefined,
      discoveryUrl: 'https://issuer.example/.well-known/openid-configuration',
    });
    http.fetch.mockResolvedValue(jsonResponse({
      issuer: 'https://issuer.example',
      authorization_endpoint: 'https://issuer.example/oauth2/authorize',
      token_endpoint: 'https://issuer.example/oauth2/token',
    }));

    const first = await oauth.begin('test');
    const second = await oauth.begin('test');
    expect(first.url.startsWith('https://issuer.example/oauth2/authorize?')).toBe(true);
    expect(second.url.startsWith('https://issuer.example/oauth2/authorize?')).toBe(true);
    expect(http.fetch).toHaveBeenCalledTimes(1);
  });

  test('rejects an ID token with the wrong nonce before storing tokens', async () => {
    const { oauth, auth, http, transactions } = create({ nonce: true });
    const request = await oauth.begin('test');
    http.fetch.mockResolvedValue(jsonResponse({
      access_token: 'should-not-be-stored',
      id_token: createJwt({ nonce: 'wrong' }),
    }));

    await expect(oauth.complete(
      `https://app.example/auth/callback?code=code&state=${request.transaction.state}`,
      'test',
    )).rejects.toMatchObject({ code: 'oauth-transaction-mismatch' });
    expect(auth.getToken()).toBeNull();
    expect(transactions.get(`aurelia-auth:oauth:${request.transaction.state}`)).toBeNull();
  });

  test('keeps the implicit flow available only when explicitly requested', async () => {
    const { oauth, auth } = create({ flow: 'implicit', exchange: 'none', nonce: false });
    const request = await oauth.begin('test');
    expect(new URL(request.url).searchParams.get('code_challenge')).toBeNull();

    await oauth.complete(
      `https://app.example/auth/callback#access_token=legacy&state=${request.transaction.state}`,
      'test',
    );
    expect(auth.getToken()).toBe('legacy');
  });

  test('runs popup authorization through the same callback exchange and forwards user data', async () => {
    const { oauth, auth, http, popup } = create({ display: 'popup' });
    popup.pollPopup.mockImplementation(async () => {
      const authorizationUrl = new URL(popup.open.mock.calls[0][0] as string);
      return `https://app.example/auth/callback?code=popup-code&state=${authorizationUrl.searchParams.get('state')}`;
    });
    http.fetch.mockResolvedValue(jsonResponse({ access_token: 'popup-access' }));

    await expect(oauth.start('test', { userData: { invitation: 'invite-1' } }))
      .resolves.toEqual({ access_token: 'popup-access' });

    expect(popup.open).toHaveBeenCalledWith(
      expect.stringContaining('https://issuer.example/authorize'),
      'test',
      undefined,
      'https://app.example/auth/callback',
    );
    const exchange = http.fetch.mock.calls[0][0] as Request;
    await expect(exchange.clone().json()).resolves.toMatchObject({
      code: 'popup-code',
      invitation: 'invite-1',
    });
    expect(auth.getToken()).toBe('popup-access');
  });

  test('returns the authorization request after starting a redirect flow', async () => {
    const assign = jest.fn();
    const browserWindow = {
      location: {
        origin: 'https://app.example',
        href: 'https://app.example/',
        assign,
      },
    } as unknown as Window;
    const { oauth, http, popup } = create({}, {}, browserWindow);

    const request = await oauth.start('test') as { url: string; transaction: { state: string } };

    expect(assign).toHaveBeenCalledWith(request.url);
    expect(new URL(request.url).searchParams.get('state')).toBe(request.transaction.state);
    expect(http.fetch).not.toHaveBeenCalled();
    expect(popup.open).not.toHaveBeenCalled();
  });

  test('exchanges public-client codes directly as form data without a client secret', async () => {
    const { oauth, auth, http } = create({
      exchange: 'direct',
      tokenEndpoint: 'https://issuer.example/token',
      tokenParameters: { resource: 'calendar' },
    });
    const request = await oauth.begin('test');
    http.fetch.mockResolvedValue(jsonResponse({ access_token: 'direct-access' }));

    await oauth.complete(new URLSearchParams({
      code: 'direct-code',
      state: request.transaction.state,
    }), 'test');

    const tokenRequest = http.fetch.mock.calls[0][0] as Request;
    expect(tokenRequest.url).toBe('https://issuer.example/token');
    expect(tokenRequest.headers.get('Content-Type')).toBe('application/x-www-form-urlencoded');
    const form = new URLSearchParams(await tokenRequest.clone().text());
    expect(Object.fromEntries(form)).toMatchObject({
      grant_type: 'authorization_code',
      code: 'direct-code',
      client_id: 'client-1',
      redirect_uri: 'https://app.example/auth/callback',
      code_verifier: request.transaction.codeVerifier,
      resource: 'calendar',
    });
    expect(form.has('client_secret')).toBe(false);
    expect(auth.getToken()).toBe('direct-access');
  });

  test('consumes provider errors and incomplete callbacks without contacting an exchange endpoint', async () => {
    const { oauth, http, transactions } = create();
    const denied = await oauth.begin('test');
    await expect(oauth.complete({
      error: 'access_denied',
      error_description: 'The user declined.',
      state: denied.transaction.state,
    }, 'test')).rejects.toMatchObject({
      code: 'oauth-callback-error',
      message: 'The user declined.',
    });
    expect(transactions.get(`aurelia-auth:oauth:${denied.transaction.state}`)).toBeNull();

    const incomplete = await oauth.begin('test');
    await expect(oauth.complete({ state: incomplete.transaction.state }, 'test'))
      .rejects.toMatchObject({ code: 'oauth-callback-error' });
    expect(transactions.get(`aurelia-auth:oauth:${incomplete.transaction.state}`)).toBeNull();
    expect(http.fetch).not.toHaveBeenCalled();
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
