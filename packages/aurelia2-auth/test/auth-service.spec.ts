import { IEventAggregator, Registration } from '@aurelia/kernel';
import { IHttpClient } from '@aurelia/fetch-client';
import { Authentication, IAuthentication } from '../src/authentication';
import { AuthorizationService, IAuthorizationService } from '../src/authorization';
import { AuthEvents } from '../src/auth-events';
import { isAuthRequestSkipped } from '../src/auth-request';
import { AuthService } from '../src/auth-service';
import { IOAuth1 } from '../src/oAuth1';
import { IOAuthClient } from '../src/oauth-client';
import { createUnitContainer } from './helpers';

describe('AuthService session flows', () => {
  function create(options = {}, browserWindow: Window = window) {
    const http = { fetch: jest.fn() };
    const oauth = { begin: jest.fn(), start: jest.fn(), complete: jest.fn() };
    const oauth1 = { open: jest.fn() };
    const setup = createUnitContainer(options, [
      Registration.instance(IHttpClient, http as never),
      Registration.instance(IOAuthClient, oauth),
      Registration.instance(IOAuth1, oauth1),
    ], browserWindow);
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
      oauth1,
      events: setup.container.get(IEventAggregator),
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

  test('logs in, stores tokens and hydrates the current user through explicit endpoints', async () => {
    const { auth, events, http, service } = create();
    const loginEvent = jest.fn();
    events.subscribe(AuthEvents.login, loginEvent);
    http.fetch
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'access-1',
        refresh_token: 'refresh-1',
      }))
      .mockResolvedValueOnce(jsonResponse({ id: 'user-1', name: 'Taylor' }));

    await service.login({ email: 'taylor@example.com', password: 'correct horse' });

    expect(auth.getToken()).toBe('access-1');
    expect(auth.getRefreshToken()).toBe('refresh-1');
    expect(loginEvent).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: 'access-1' }),
      AuthEvents.login,
    );
    const loginRequest = http.fetch.mock.calls[0][0] as Request;
    expect(new URL(loginRequest.url).pathname).toBe('/auth/login');
    expect(isAuthRequestSkipped(loginRequest)).toBe(true);
    await expect(loginRequest.clone().json()).resolves.toEqual({
      email: 'taylor@example.com',
      password: 'correct horse',
    });

    await expect(service.getMe()).resolves.toEqual({ id: 'user-1', name: 'Taylor' });
    expect(service.session.user).toEqual({ id: 'user-1', name: 'Taylor' });
    expect(new URL((http.fetch.mock.calls[1][0] as Request).url).pathname).toBe('/auth/me');
  });

  test('sends password and unlink requests with exact payloads and publishes completion events', async () => {
    const { events, http, service } = create();
    const requested = jest.fn();
    const reset = jest.fn();
    const unlinked = jest.fn();
    events.subscribe(AuthEvents.passwordResetRequested, requested);
    events.subscribe(AuthEvents.passwordReset, reset);
    events.subscribe(AuthEvents.unlink, unlinked);
    http.fetch
      .mockResolvedValueOnce(jsonResponse({ accepted: true }))
      .mockResolvedValueOnce(jsonResponse({ changed: true }))
      .mockResolvedValueOnce(jsonResponse({ provider: 'github', unlinked: true }));

    await service.forgotPassword('person@example.com');
    await service.resetPassword({
      token: 'reset-token',
      password: 'new password',
      passwordConfirm: 'new password',
    });
    await service.unlink('github');

    const [forgot, password, unlink] = http.fetch.mock.calls
      .map(call => call[0] as Request);
    expect(new URL(forgot.url).pathname).toBe('/auth/forgot-password');
    expect(forgot.method).toBe('POST');
    await expect(forgot.clone().json()).resolves.toEqual({ email: 'person@example.com' });
    expect(new URL(password.url).pathname).toBe('/auth/reset-password');
    await expect(password.clone().json()).resolves.toEqual({
      token: 'reset-token',
      password: 'new password',
      passwordConfirm: 'new password',
    });
    expect(new URL(unlink.url).pathname).toBe('/auth/unlink/');
    expect(unlink.method).toBe('DELETE');
    await expect(unlink.clone().json()).resolves.toEqual({ provider: 'github' });
    expect(requested).toHaveBeenCalledWith(
      { accepted: true },
      AuthEvents.passwordResetRequested,
    );
    expect(reset).toHaveBeenCalledWith({ changed: true }, AuthEvents.passwordReset);
    expect(unlinked).toHaveBeenCalledWith(
      { provider: 'github', unlinked: true },
      AuthEvents.unlink,
    );
  });

  test('encodes the provider in GET-style unlink URLs without sending a body', async () => {
    const { http, service } = create({ unlinkMethod: 'get' });
    http.fetch.mockResolvedValue(jsonResponse({ unlinked: true }));

    await service.unlink('work account/google');

    const request = http.fetch.mock.calls[0][0] as Request;
    expect(request.method).toBe('GET');
    expect(new URL(request.url).pathname).toBe('/auth/unlink/work%20account%2Fgoogle');
    expect(await request.clone().text()).toBe('');
  });

  test('signs up without fabricating a login and follows only its configured local redirect', async () => {
    const assign = jest.fn();
    const browserWindow = {
      location: { origin: 'https://app.example', assign },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as unknown as Window;
    const { auth, events, http, service } = create({
      loginOnSignup: false,
      signupRedirect: '/verify-email',
      tabSync: false,
    }, browserWindow);
    const signedUp = jest.fn();
    events.subscribe(AuthEvents.signup, signedUp);
    http.fetch.mockResolvedValue(jsonResponse({ id: 'pending-user' }));

    await service.signup('Taylor', 'taylor@example.com', 'password');

    expect(auth.isAuthenticated()).toBe(false);
    const request = http.fetch.mock.calls[0][0] as Request;
    await expect(request.clone().json()).resolves.toEqual({
      displayName: 'Taylor',
      email: 'taylor@example.com',
      password: 'password',
    });
    expect(assign).toHaveBeenCalledWith('https://app.example/verify-email');
    expect(signedUp).toHaveBeenCalledWith({ id: 'pending-user' }, AuthEvents.signup);
  });

  test('treats rejected cookie initialization as anonymous but surfaces network failures', async () => {
    const unauthorized = create({ mode: 'cookie', autoInitialize: true, tabSync: false });
    unauthorized.auth.setSession({ id: 'stale-user' });
    unauthorized.http.fetch.mockResolvedValue(new Response(null, { status: 401 }));

    await expect(unauthorized.service.initialize()).resolves.toMatchObject({ status: 'anonymous' });
    expect(unauthorized.auth.isAuthenticated()).toBe(false);

    const offline = create({ mode: 'cookie', autoInitialize: true, tabSync: false });
    offline.http.fetch.mockRejectedValue(new TypeError('offline'));
    await expect(offline.service.initialize()).rejects.toThrow('offline');

    offline.http.fetch.mockResolvedValue(jsonResponse({
      authenticated: true,
      user: { id: 'recovered-user' },
    }));
    await expect(offline.service.initialize()).resolves.toMatchObject({
      status: 'authenticated',
      user: { id: 'recovered-user' },
    });
    expect(offline.http.fetch).toHaveBeenCalledTimes(2);
  });

  test('shares one in-flight cookie initialization across simultaneous callers', async () => {
    const { http, service } = create({ mode: 'cookie', autoInitialize: true, tabSync: false });
    let resolveResponse!: (response: Response) => void;
    http.fetch.mockReturnValue(new Promise<Response>(resolve => { resolveResponse = resolve; }));

    const first = service.initialize();
    const second = service.initialize();

    expect(first).toBe(second);
    expect(http.fetch).toHaveBeenCalledTimes(1);
    resolveResponse(jsonResponse({ authenticated: true, user: { id: 'user-1' } }));
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ status: 'authenticated' }),
      expect.objectContaining({ status: 'authenticated' }),
    ]);
  });

  test('clears a rejected refresh session but preserves it after a transient network failure', async () => {
    const rejected = create({ refreshTokens: true });
    const expired = jest.fn();
    rejected.events.subscribe(AuthEvents.sessionExpired, expired);
    rejected.auth.setToken({ access_token: 'old', refresh_token: 'refresh' });
    const response = new Response(null, { status: 401 });
    rejected.http.fetch.mockResolvedValue(response);

    await expect(rejected.service.refreshToken()).rejects.toBe(response);
    expect(rejected.auth.isAuthenticated()).toBe(false);
    expect(expired).toHaveBeenCalledWith(response, AuthEvents.sessionExpired);

    const transient = create({ refreshTokens: true });
    transient.auth.setToken({ access_token: 'still-valid', refresh_token: 'refresh' });
    transient.http.fetch.mockRejectedValue(new TypeError('offline'));
    await expect(transient.service.refreshToken()).rejects.toThrow('offline');
    expect(transient.auth.getToken()).toBe('still-valid');
    expect(transient.service.session.status).toBe('authenticated');
  });

  test('routes OAuth providers through the correct adapter and publishes authenticated state', async () => {
    const legacy = create({
      providers: {
        legacy: {
          name: 'legacy',
          flow: 'oauth1',
          url: '/oauth/legacy',
          authorizationEndpoint: 'https://legacy.example/authorize',
        },
      },
    });
    const authenticated = jest.fn();
    legacy.events.subscribe(AuthEvents.authenticate, authenticated);
    legacy.oauth1.open.mockResolvedValue({ access_token: 'legacy-access' });

    await legacy.service.authenticate('legacy', undefined, { invitation: 'one' });

    expect(legacy.oauth1.open).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'legacy', flow: 'oauth1' }),
      { invitation: 'one' },
    );
    expect(legacy.oauth.start).not.toHaveBeenCalled();
    expect(legacy.auth.getToken()).toBe('legacy-access');
    expect(authenticated).toHaveBeenCalledWith(
      { access_token: 'legacy-access' },
      AuthEvents.authenticate,
    );

    const assign = jest.fn();
    const modernWindow = {
      location: { origin: 'https://app.example', assign },
    } as unknown as Window;
    const modern = create({
      providers: {
        custom: {
          name: 'custom',
          clientId: 'client',
          authorizationEndpoint: 'https://issuer.example/authorize',
        },
      },
    }, modernWindow);
    modern.oauth.start.mockImplementation(async () => {
      modern.auth.setToken({ access_token: 'modern-access' });
      return { access_token: 'modern-access' };
    });
    await modern.service.authenticate('custom', '/after-login', { invitation: 'two' });
    expect(modern.oauth.start).toHaveBeenCalledWith('custom', {
      returnUrl: '/after-login',
      userData: { invitation: 'two' },
    });
    expect(assign).toHaveBeenCalledWith('https://app.example/after-login');

    await expect(modern.service.authenticate('missing'))
      .rejects.toMatchObject({ code: 'unknown-provider' });
  });

  test('delegates OAuth begin and callback completion through the public service', async () => {
    const { auth, events, oauth, service } = create();
    const completed = jest.fn();
    events.subscribe(AuthEvents.authenticate, completed);
    oauth.begin.mockResolvedValue({ provider: 'google', url: 'https://issuer.example/authorize' });
    oauth.complete.mockImplementation(async () => {
      auth.setToken({ access_token: 'callback-access' });
      return { access_token: 'callback-access' };
    });

    await expect(service.beginOAuth('google', { display: 'popup' }))
      .resolves.toMatchObject({ provider: 'google' });
    await expect(service.completeOAuthCallback('?code=one&state=two', 'google'))
      .resolves.toEqual({ access_token: 'callback-access' });

    expect(oauth.begin).toHaveBeenCalledWith('google', { display: 'popup' });
    expect(oauth.complete).toHaveBeenCalledWith('?code=one&state=two', 'google');
    expect(completed).toHaveBeenCalledWith(
      { access_token: 'callback-access' },
      AuthEvents.authenticate,
    );
  });
});

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
