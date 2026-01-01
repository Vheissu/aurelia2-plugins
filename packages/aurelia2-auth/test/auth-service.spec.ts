import { DI, Registration } from '@aurelia/kernel';
import { IHttpClient } from '@aurelia/fetch-client';
import { IAuthOptions } from '../src/configuration';
import { AuthService } from '../src/auth-service';
import { IAuthentication } from '../src/authentication';
import { IOAuth1 } from '../src/oAuth1';
import { IOAuth2 } from '../src/oAuth2';
import { EventAggregator, IEventAggregator } from '@aurelia/kernel';

describe('AuthService', () => {
  test('refreshToken posts refresh token and stores new tokens', async () => {
    const httpClient = {
      fetch: jest.fn(() =>
        Promise.resolve({
          status: 200,
          json: async () => ({ access_token: 'new-token' }),
        })
      ),
    } as unknown as IHttpClient;

    const auth = {
      tokenInterceptor: {},
      getRefreshToken: () => 'refresh-token',
      getRefreshUrl: () => '/auth/refresh',
      setToken: jest.fn(),
      clearTokens: jest.fn(),
      isAuthenticated: () => true,
      isTokenExpired: () => false,
      getToken: () => 'token',
    } as unknown as IAuthentication;

    const eventAggregator = new EventAggregator();
    const publishSpy = jest.spyOn(eventAggregator, 'publish');

    const container = DI.createContainer();
    container.register(
      Registration.instance(IHttpClient, httpClient),
      Registration.instance(IAuthentication, auth),
      Registration.instance(IOAuth1, {} as IOAuth1),
      Registration.instance(IOAuth2, {} as IOAuth2),
      Registration.instance(IAuthOptions, {
        refreshTokenName: 'refresh_token',
        withCredentials: false,
      }),
      Registration.instance(IEventAggregator, eventAggregator)
    );

    const service = container.invoke(AuthService);

    await service.refreshToken();

    expect(httpClient.fetch).toHaveBeenCalled();
    expect(auth.setToken).toHaveBeenCalledWith({ access_token: 'new-token' });
    expect(publishSpy).toHaveBeenCalledWith('auth:refresh', { access_token: 'new-token' });
  });
});
