import { DI, Registration, EventAggregator, IEventAggregator } from '@aurelia/kernel';
import { IHttpClient } from '@aurelia/fetch-client';
import { IAuthOptions } from '../src/configuration';
import { AuthService } from '../src/auth-service';
import { IAuthentication } from '../src/authentication';
import { IOAuth1 } from '../src/oAuth1';
import { IOAuth2 } from '../src/oAuth2';
import { AuthEvents } from '../src/auth-events';

const createService = (opts: {
  exp?: number;
  authenticated?: boolean;
  refreshToken?: string;
  autoRefreshBuffer?: number;
}) => {
  const now = Math.round(Date.now() / 1000);
  const payload = opts.exp !== undefined ? { exp: opts.exp, sub: 'user1' } : { sub: 'user1' };
  const authenticated = opts.authenticated ?? true;

  const auth = {
    tokenInterceptor: {},
    getPayload: () => (authenticated ? payload : null),
    isAuthenticated: () => authenticated,
    isTokenExpired: () => false,
    getToken: () => (authenticated ? 'token' : null),
    getRefreshToken: () => opts.refreshToken ?? null,
    getRefreshUrl: () => '/auth/refresh',
    setToken: jest.fn(),
    clearTokens: jest.fn(),
  } as unknown as IAuthentication;

  const httpClient = {
    fetch: jest.fn(() =>
      Promise.resolve({
        status: 200,
        json: async () => ({
          access_token: 'new-token',
          refresh_token: 'new-refresh',
        }),
      })
    ),
  } as unknown as IHttpClient;

  const eventAggregator = new EventAggregator();

  const container = DI.createContainer();
  container.register(
    Registration.instance(IHttpClient, httpClient),
    Registration.instance(IAuthentication, auth),
    Registration.instance(IOAuth1, {} as IOAuth1),
    Registration.instance(IOAuth2, {} as IOAuth2),
    Registration.instance(IAuthOptions, {
      autoRefresh: true,
      autoRefreshBuffer: opts.autoRefreshBuffer ?? 30,
      refreshTokenName: 'refresh_token',
      withCredentials: false,
    }),
    Registration.instance(IEventAggregator, eventAggregator)
  );

  const service = container.invoke(AuthService);

  return { service, httpClient, auth, eventAggregator };
};

describe('Auto-refresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('schedules refresh before token expiry', () => {
    const now = Math.round(Date.now() / 1000);
    const exp = now + 120; // expires in 2 min
    const { service, httpClient } = createService({
      exp,
      refreshToken: 'rt',
      autoRefreshBuffer: 30,
    });

    // Should schedule at exp - 30 = 90s from now
    // Advance 89 seconds - should not have refreshed
    jest.advanceTimersByTime(89 * 1000);
    expect(httpClient.fetch).not.toHaveBeenCalled();

    // Advance 2 more seconds (91s total) - should have refreshed
    jest.advanceTimersByTime(2 * 1000);
    expect(httpClient.fetch).toHaveBeenCalled();

    service.dispose();
  });

  test('does not schedule when not authenticated', () => {
    const { service, httpClient } = createService({
      authenticated: false,
    });

    jest.advanceTimersByTime(100 * 1000);
    expect(httpClient.fetch).not.toHaveBeenCalled();

    service.dispose();
  });

  test('does not schedule when token has no exp claim', () => {
    const { service, httpClient } = createService({
      refreshToken: 'rt',
    });

    jest.advanceTimersByTime(100 * 1000);
    expect(httpClient.fetch).not.toHaveBeenCalled();

    service.dispose();
  });

  test('publishes tokenExpired event when refresh fails', async () => {
    const now = Math.round(Date.now() / 1000);
    const exp = now + 35;
    const { service, httpClient, eventAggregator } = createService({
      exp,
      refreshToken: 'rt',
      autoRefreshBuffer: 30,
    });

    (httpClient.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({ status: 401, json: async () => ({}) })
    );

    const spy = jest.spyOn(eventAggregator, 'publish');

    jest.advanceTimersByTime(6 * 1000);
    // The timer fires, which calls refreshToken(), which calls http.fetch() (returns rejected-ish),
    // then .then(status) throws (401 status), then .catch() publishes tokenExpired.
    // We need to flush the full promise chain.
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    expect(spy).toHaveBeenCalledWith(AuthEvents.tokenExpired);

    service.dispose();
  });

  test('clearAutoRefresh cancels pending timer', () => {
    const now = Math.round(Date.now() / 1000);
    const exp = now + 120;
    const { service, httpClient } = createService({
      exp,
      refreshToken: 'rt',
      autoRefreshBuffer: 30,
    });

    service.clearAutoRefresh();

    jest.advanceTimersByTime(120 * 1000);
    expect(httpClient.fetch).not.toHaveBeenCalled();

    service.dispose();
  });

  test('refreshes immediately when token already within buffer', () => {
    const now = Math.round(Date.now() / 1000);
    const exp = now + 10; // 10s left, buffer is 30
    const { service, httpClient } = createService({
      exp,
      refreshToken: 'rt',
      autoRefreshBuffer: 30,
    });

    // delay is max(0, (exp - buffer - now) * 1000) = max(0, -20000) = 0
    jest.advanceTimersByTime(0);
    expect(httpClient.fetch).toHaveBeenCalled();

    service.dispose();
  });
});
