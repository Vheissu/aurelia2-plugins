import { DI, Registration, EventAggregator, IEventAggregator } from '@aurelia/kernel';
import { IHttpClient } from '@aurelia/fetch-client';
import { IAuthOptions } from '../src/configuration';
import { AuthService } from '../src/auth-service';
import { IAuthentication } from '../src/authentication';
import { IOAuth1 } from '../src/oAuth1';
import { IOAuth2 } from '../src/oAuth2';
import { AuthEvents } from '../src/auth-events';

const createService = (httpMock?: Partial<IHttpClient>) => {
  const httpClient = {
    fetch: jest.fn(() =>
      Promise.resolve({
        status: 200,
        json: async () => ({ success: true }),
      })
    ),
    ...httpMock,
  } as unknown as IHttpClient;

  const eventAggregator = new EventAggregator();

  const container = DI.createContainer();
  container.register(
    Registration.instance(IHttpClient, httpClient),
    Registration.instance(IAuthentication, {
      tokenInterceptor: {},
      getPayload: () => null,
      isAuthenticated: () => false,
      isTokenExpired: () => false,
      getToken: () => null,
      getRefreshToken: () => null,
      clearTokens: jest.fn(),
    } as unknown as IAuthentication),
    Registration.instance(IOAuth1, {} as IOAuth1),
    Registration.instance(IOAuth2, {} as IOAuth2),
    Registration.instance(IAuthOptions, {
      baseUrl: '/api',
      forgotPasswordUrl: '/auth/forgot-password',
      resetPasswordUrl: '/auth/reset-password',
    }),
    Registration.instance(IEventAggregator, eventAggregator)
  );

  return {
    service: container.invoke(AuthService),
    httpClient,
    eventAggregator,
  };
};

describe('Password reset flows', () => {
  describe('forgotPassword', () => {
    test('sends email to forgot-password endpoint', async () => {
      const { service, httpClient } = createService();

      await service.forgotPassword('user@example.com');

      expect(httpClient.fetch).toHaveBeenCalledWith(
        '/api/auth/forgot-password',
        expect.objectContaining({
          method: 'post',
        })
      );

      const body = JSON.parse(
        (httpClient.fetch as jest.Mock).mock.calls[0][1].body
      );
      expect(body.email).toBe('user@example.com');
    });

    test('publishes password-reset-requested event', async () => {
      const { service, eventAggregator } = createService();
      const spy = jest.spyOn(eventAggregator, 'publish');

      await service.forgotPassword('user@example.com');

      expect(spy).toHaveBeenCalledWith(
        AuthEvents.passwordResetRequested,
        { success: true }
      );
    });

    test('propagates server errors', async () => {
      const { service } = createService({
        fetch: jest.fn(() =>
          Promise.resolve({
            status: 404,
            json: async () => ({ message: 'Not found' }),
          })
        ),
      });

      await expect(service.forgotPassword('user@example.com')).rejects.toBeDefined();
    });
  });

  describe('resetPassword', () => {
    test('sends reset data to reset-password endpoint', async () => {
      const { service, httpClient } = createService();

      await service.resetPassword({
        token: 'reset-token-123',
        password: 'newPassword123',
        passwordConfirm: 'newPassword123',
      });

      expect(httpClient.fetch).toHaveBeenCalledWith(
        '/api/auth/reset-password',
        expect.objectContaining({
          method: 'post',
        })
      );

      const body = JSON.parse(
        (httpClient.fetch as jest.Mock).mock.calls[0][1].body
      );
      expect(body.token).toBe('reset-token-123');
      expect(body.password).toBe('newPassword123');
      expect(body.passwordConfirm).toBe('newPassword123');
    });

    test('publishes password-reset event', async () => {
      const { service, eventAggregator } = createService();
      const spy = jest.spyOn(eventAggregator, 'publish');

      await service.resetPassword({
        token: 'reset-token',
        password: 'newPass',
      });

      expect(spy).toHaveBeenCalledWith(
        AuthEvents.passwordReset,
        { success: true }
      );
    });

    test('does not require passwordConfirm field', async () => {
      const { service, httpClient } = createService();

      await service.resetPassword({
        token: 'reset-token',
        password: 'newPass',
      });

      const body = JSON.parse(
        (httpClient.fetch as jest.Mock).mock.calls[0][1].body
      );
      expect(body.token).toBe('reset-token');
      expect(body.password).toBe('newPass');
      expect(body.passwordConfirm).toBeUndefined();
    });
  });
});
