import { DI, Registration } from '@aurelia/kernel';
import { IHttpClient } from '@aurelia/fetch-client';
import { IAuthOptions } from '../src/configuration';
import { OAuth2 } from '../src/oAuth2';
import { IAuthentication } from '../src/authentication';
import { IStorage, Storage } from '../src/storage';
import { IPopup } from '../src/popup';

describe('OAuth2 PKCE', () => {
  test('adds code_challenge and code_verifier when PKCE is enabled', async () => {
    let lastBody: string | undefined;

    const httpClient = {
      fetch: jest.fn((_input: string, init?: RequestInit) => {
        lastBody = init?.body as string;
        return Promise.resolve({
          status: 200,
          json: async () => ({ access_token: 'token' }),
        });
      }),
    } as unknown as IHttpClient;

    const container = DI.createContainer();
    container.register(
      Registration.instance(IAuthOptions, {
        storage: 'memory',
        withCredentials: false,
      })
    );
    const storage = container.invoke(Storage);

    const popup = {
      open: jest.fn((_url: string) => {
        return {
          pollPopup: () =>
            Promise.resolve({
              code: 'auth-code',
              state: storage.get('test_state'),
            }),
          eventListener: () =>
            Promise.resolve({
              code: 'auth-code',
              state: storage.get('test_state'),
            }),
        };
      }),
    } as unknown as IPopup;

    container.register(
      Registration.instance(IStorage, storage),
      Registration.instance(IPopup, popup),
      Registration.instance(IHttpClient, httpClient),
      Registration.instance(IAuthentication, {
        decomposeToken: () => null,
      } as IAuthentication)
    );

    const oauth2 = container.invoke(OAuth2);

    await oauth2.open(
      {
        name: 'test',
        url: '/auth/test',
        authorizationEndpoint: 'https://example.com/auth',
        redirectUri: 'https://app/callback',
        clientId: 'client',
        responseType: 'code',
        requiredUrlParams: ['state'],
        state: 'STATE',
        pkce: true,
        pkceMethod: 'plain',
      },
      {}
    );

    const openUrl = (popup.open as jest.Mock).mock.calls[0][0];
    expect(openUrl).toContain('code_challenge=');
    expect(openUrl).toContain('code_challenge_method=plain');

    const body = JSON.parse(lastBody ?? '{}');
    expect(body.code_verifier).toBeDefined();
  });
});
