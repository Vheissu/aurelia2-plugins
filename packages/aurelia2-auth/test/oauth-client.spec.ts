import { Registration } from '@aurelia/kernel';
import { IHttpClient } from '@aurelia/fetch-client';
import { Authentication, IAuthentication } from '../src/authentication';
import { OAuthClient } from '../src/oauth-client';
import { IPopup } from '../src/popup';
import { createJwt, createUnitContainer } from './helpers';

describe('OAuthClient', () => {
  function create(provider = {}, options = {}) {
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
    ]);
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
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
