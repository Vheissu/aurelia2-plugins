import { DI, Registration, EventAggregator, IEventAggregator } from '@aurelia/kernel';
import { IHttpClient } from '@aurelia/fetch-client';
import { IAuthOptions } from '../src/configuration';
import { AuthService } from '../src/auth-service';
import { IAuthentication } from '../src/authentication';
import { IOAuth1 } from '../src/oAuth1';
import { IOAuth2 } from '../src/oAuth2';
import { AuthEvents } from '../src/auth-events';

const createService = (opts?: {
  httpMock?: Partial<IHttpClient>;
  authMock?: Record<string, any>;
  configOverrides?: Record<string, unknown>;
}) => {
  const httpClient = {
    fetch: jest.fn(() =>
      Promise.resolve({
        status: 200,
        json: async () => ({ token: 'new-token' }),
      })
    ),
    ...opts?.httpMock,
  } as unknown as IHttpClient;

  const auth = {
    tokenInterceptor: {},
    getPayload: () => ({ sub: 'user1' }),
    isAuthenticated: () => true,
    isTokenExpired: () => false,
    getToken: () => 'token',
    getRefreshToken: () => null,
    getRefreshUrl: () => '/auth/refresh',
    getLoginUrl: () => '/auth/login',
    getSignupUrl: () => '/auth/signup',
    getProfileUrl: () => '/auth/me',
    setToken: jest.fn(),
    clearTokens: jest.fn(),
    logout: jest.fn(() => Promise.resolve()),
    ...opts?.authMock,
  } as unknown as IAuthentication;

  const oAuth2 = {
    open: jest.fn(() =>
      Promise.resolve({ access_token: 'oauth-token' })
    ),
  } as unknown as IOAuth2;

  const eventAggregator = new EventAggregator();

  const container = DI.createContainer();
  container.register(
    Registration.instance(IHttpClient, httpClient),
    Registration.instance(IAuthentication, auth),
    Registration.instance(IOAuth1, {} as IOAuth1),
    Registration.instance(IOAuth2, oAuth2),
    Registration.instance(IAuthOptions, {
      loginOnSignup: true,
      loginRedirect: '',
      signupRedirect: '',
      logoutRedirect: '',
      baseUrl: '',
      unlinkUrl: '/auth/unlink/',
      unlinkMethod: 'get',
      tokenName: 'token',
      providers: {
        google: { name: 'google', url: '/auth/google', type: '2.0' },
      },
      ...opts?.configOverrides,
    }),
    Registration.instance(IEventAggregator, eventAggregator)
  );

  return {
    service: container.invoke(AuthService),
    httpClient,
    auth,
    oAuth2,
    eventAggregator,
  };
};

describe('AuthService extended', () => {
  describe('login', () => {
    test('publishes auth:login event with response', async () => {
      const { service, eventAggregator } = createService();
      const spy = jest.spyOn(eventAggregator, 'publish');

      await service.login('user@test.com', 'pass');

      expect(spy).toHaveBeenCalledWith(AuthEvents.login, { token: 'new-token' });
    });

    test('accepts object data for login', async () => {
      const { service, httpClient } = createService();

      await service.login({ username: 'admin', password: 'secret' });

      const callArgs = (httpClient.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.username).toBe('admin');
      expect(body.password).toBe('secret');
    });

    test('sets token on successful login', async () => {
      const { service, auth } = createService();

      await service.login('user@test.com', 'pass');

      expect(auth.setToken).toHaveBeenCalledWith({ token: 'new-token' });
    });
  });

  describe('signup', () => {
    test('publishes auth:signup event', async () => {
      const { service, eventAggregator } = createService();
      const spy = jest.spyOn(eventAggregator, 'publish');

      await service.signup('John', 'john@test.com', 'pass');

      expect(spy).toHaveBeenCalledWith(AuthEvents.signup, { token: 'new-token' });
    });

    test('accepts object data for signup', async () => {
      const { service, httpClient } = createService();

      await service.signup({ email: 'user@test.com', password: 'pass', name: 'User' });

      const callArgs = (httpClient.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.email).toBe('user@test.com');
      expect(body.name).toBe('User');
    });

    test('auto-logs in on signup when loginOnSignup is true', async () => {
      const { service, auth } = createService({
        configOverrides: { loginOnSignup: true },
      });

      await service.signup('John', 'john@test.com', 'pass');

      expect(auth.setToken).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    test('publishes auth:logout event', async () => {
      const { service, eventAggregator } = createService();
      const spy = jest.spyOn(eventAggregator, 'publish');

      await service.logout();

      expect(spy).toHaveBeenCalledWith(AuthEvents.logout);
    });

    test('calls auth.logout with redirect URI', async () => {
      const { service, auth } = createService();

      await service.logout('/goodbye');

      expect(auth.logout).toHaveBeenCalledWith('/goodbye');
    });
  });

  describe('authenticate (OAuth)', () => {
    test('publishes auth:authenticate event', async () => {
      const { service, eventAggregator } = createService();
      const spy = jest.spyOn(eventAggregator, 'publish');

      await service.authenticate('google');

      expect(spy).toHaveBeenCalledWith(AuthEvents.authenticate, {
        access_token: 'oauth-token',
      });
    });

    test('rejects unknown provider', async () => {
      const { service } = createService();

      await expect(service.authenticate('unknown')).rejects.toThrow(
        'Unknown auth provider: unknown'
      );
    });

    test('sets token from OAuth response', async () => {
      const { service, auth } = createService();

      await service.authenticate('google');

      expect(auth.setToken).toHaveBeenCalledWith(
        { access_token: 'oauth-token' },
        undefined
      );
    });
  });

  describe('unlink', () => {
    test('publishes auth:unlink event on GET unlink', async () => {
      const { service, eventAggregator } = createService();
      const spy = jest.spyOn(eventAggregator, 'publish');

      await service.unlink('google');

      expect(spy).toHaveBeenCalledWith(AuthEvents.unlink, { token: 'new-token' });
    });

    test('uses POST method when configured', async () => {
      const { service, httpClient } = createService({
        configOverrides: { unlinkMethod: 'post' },
      });

      await service.unlink('google');

      const callArgs = (httpClient.fetch as jest.Mock).mock.calls[0];
      expect(callArgs[1].method).toBe('post');
    });
  });

  describe('refreshToken', () => {
    test('deduplicates concurrent refresh calls', async () => {
      const { service, httpClient } = createService({
        authMock: {
          getRefreshToken: () => 'refresh-token',
          getRefreshUrl: () => '/auth/refresh',
        },
        configOverrides: { refreshTokenName: 'refresh_token', withCredentials: false },
      });

      const p1 = service.refreshToken();
      const p2 = service.refreshToken();

      await Promise.all([p1, p2]);

      expect(httpClient.fetch).toHaveBeenCalledTimes(1);
    });

    test('rejects when no refresh token available', async () => {
      const { service } = createService({
        authMock: { getRefreshToken: () => null },
      });

      await expect(service.refreshToken()).rejects.toThrow(
        'No refresh token available.'
      );
    });

    test('rejects when no refresh URL configured', async () => {
      const { service } = createService({
        authMock: {
          getRefreshToken: () => 'token',
          getRefreshUrl: () => '',
        },
      });

      await expect(service.refreshToken()).rejects.toThrow(
        'No refresh URL configured.'
      );
    });
  });

  describe('getMe', () => {
    test('fetches profile from profile URL', async () => {
      const { service, httpClient } = createService();

      await service.getMe();

      expect(httpClient.fetch).toHaveBeenCalledWith('/auth/me');
    });
  });

  describe('isAuthenticated', () => {
    test('delegates to authentication service', () => {
      const { service } = createService({
        authMock: { isAuthenticated: () => true },
      });
      expect(service.isAuthenticated()).toBe(true);
    });

    test('returns false when not authenticated', () => {
      const { service } = createService({
        authMock: { isAuthenticated: () => false },
      });
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('getTokenPayload', () => {
    test('returns decoded payload', () => {
      const { service } = createService({
        authMock: { getPayload: () => ({ sub: 'user1', email: 'test@test.com' }) },
      });
      expect(service.getTokenPayload()).toEqual({ sub: 'user1', email: 'test@test.com' });
    });

    test('returns null when no token', () => {
      const { service } = createService({
        authMock: { getPayload: () => null },
      });
      expect(service.getTokenPayload()).toBeNull();
    });
  });

  describe('setToken', () => {
    test('sets token via authentication service', () => {
      const { service, auth } = createService({
        configOverrides: { tokenName: 'token' },
      });

      service.setToken('my-custom-token');

      expect(auth.setToken).toHaveBeenCalled();
      const call = (auth.setToken as jest.Mock).mock.calls[0][0];
      expect(call.token).toBe('my-custom-token');
    });
  });

  describe('dispose', () => {
    test('cleans up all timers and listeners', () => {
      jest.useFakeTimers();
      const { service } = createService();

      service.dispose();

      // Should not throw
      jest.advanceTimersByTime(100000);
      jest.useRealTimers();
    });
  });
});
