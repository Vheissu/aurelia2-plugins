import { Registration } from '@aurelia/kernel';
import { IHttpClient } from '@aurelia/fetch-client';
import { Authentication, IAuthentication } from '../src/authentication';
import { AuthorizationService, IAuthorizationService } from '../src/authorization';
import { AuthService } from '../src/auth-service';
import { IOAuth1 } from '../src/oAuth1';
import { IOAuthClient } from '../src/oauth-client';
import { createUnitContainer } from './helpers';

describe('AuthService session flows', () => {
  function create(options = {}) {
    const http = { fetch: jest.fn() };
    const oauth = { begin: jest.fn(), start: jest.fn(), complete: jest.fn() };
    const oauth1 = { open: jest.fn() };
    const setup = createUnitContainer(options, [
      Registration.instance(IHttpClient, http as never),
      Registration.instance(IOAuthClient, oauth),
      Registration.instance(IOAuth1, oauth1),
    ]);
    const auth = setup.container.invoke(Authentication);
    setup.container.register(
      Registration.instance(IAuthentication, auth),
      Registration.singleton(IAuthorizationService, AuthorizationService),
    );
    return {
      ...setup,
      auth,
      http,
      oauth,
      service: setup.container.invoke(AuthService),
    };
  }

  test('deduplicates simultaneous refreshes and keeps a rotating refresh token', async () => {
    const { auth, http, service } = create({ refreshTokens: true });
    auth.setToken({ access_token: 'old-access', refresh_token: 'refresh-1' });
    let resolveResponse!: (response: Response) => void;
    http.fetch.mockReturnValue(new Promise<Response>(resolve => { resolveResponse = resolve; }));

    const first = service.refreshToken();
    const second = service.refreshToken();
    expect(first).toBe(second);
    expect(http.fetch).toHaveBeenCalledTimes(1);

    resolveResponse(jsonResponse({ access_token: 'new-access' }));
    await expect(first).resolves.toMatchObject({ access_token: 'new-access' });
    expect(auth.getToken()).toBe('new-access');
    expect(auth.getRefreshToken()).toBe('refresh-1');

    const request = http.fetch.mock.calls[0][0] as Request;
    await expect(request.clone().json()).resolves.toEqual({ refresh_token: 'refresh-1' });
  });

  test('hydrates a cookie session without requiring a JavaScript token', async () => {
    const { auth, http, service } = create({ mode: 'cookie', withCredentials: true });
    http.fetch.mockResolvedValue(jsonResponse({ authenticated: true, user: { id: 'u1' } }));

    await service.checkSession();

    expect(auth.getToken()).toBeNull();
    expect(service.session).toMatchObject({
      status: 'authenticated',
      user: { id: 'u1' },
    });
    const request = http.fetch.mock.calls[0][0] as Request;
    expect(request.credentials).toBe('include');
  });

  test('clears local state even when the server-side logout request fails', async () => {
    const { auth, http, service } = create({ logoutUrl: '/auth/logout' });
    auth.setToken('opaque-access-token');
    http.fetch.mockRejectedValue(new TypeError('offline'));

    await expect(service.logout()).rejects.toThrow('offline');
    expect(auth.isAuthenticated()).toBe(false);
  });

  test('fails refresh clearly when bearer mode has no refresh token', async () => {
    const { service, http } = create({ refreshTokens: true });
    await expect(service.refreshToken()).rejects.toMatchObject({
      name: 'AuthError',
      code: 'missing-refresh-token',
    });
    expect(http.fetch).not.toHaveBeenCalled();
  });
});

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
