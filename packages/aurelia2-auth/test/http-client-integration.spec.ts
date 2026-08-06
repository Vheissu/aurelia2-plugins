import { Registration } from '@aurelia/kernel';
import {
  HttpClient,
  IFetchFn,
  IHttpClient,
} from '@aurelia/fetch-client';
import { Authentication, IAuthentication } from '../src/authentication';
import { IAuthService } from '../src/auth-service';
import { AuthInterceptor } from '../src/interceptor';
import { createUnitContainer } from './helpers';

describe('Aurelia HttpClient integration', () => {
  test('refreshes and replays a POST through the real interceptor pipeline once', async () => {
    const received: Array<{ authorization: string | null; body: unknown }> = [];
    const fetchFn = jest.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const request = input as Request;
      received.push({
        authorization: request.headers.get('Authorization'),
        body: await request.clone().json(),
      });
      return received.length === 1
        ? new Response(null, { status: 401 })
        : jsonResponse({ accepted: true });
    });
    const setup = createUnitContainer({
      refreshTokens: true,
      trustedOrigins: ['https://api.example'],
    }, [
      Registration.instance(IFetchFn, fetchFn as typeof fetch),
    ]);
    const auth = setup.container.invoke(Authentication);
    const authService = {
      refreshToken: jest.fn(async () => {
        auth.setToken({ access_token: 'fresh-token' });
        return { access_token: 'fresh-token' };
      }),
    };
    setup.container.register(
      Registration.instance(IAuthentication, auth),
      Registration.instance(IAuthService, authService as never),
      Registration.singleton(HttpClient, HttpClient),
      Registration.aliasTo(HttpClient, IHttpClient),
    );
    const interceptor = setup.container.invoke(AuthInterceptor);
    const client = setup.container.get(IHttpClient);
    client.configure(config => config.withInterceptor(interceptor));
    auth.setToken({ access_token: 'stale-token', refresh_token: 'refresh-token' });

    const response = await client.fetch(new Request('https://api.example/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: 'A-1', quantity: 2 }),
    }));

    await expect(response.json()).resolves.toEqual({ accepted: true });
    expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(received).toEqual([
      {
        authorization: 'Bearer stale-token',
        body: { sku: 'A-1', quantity: 2 },
      },
      {
        authorization: 'Bearer fresh-token',
        body: { sku: 'A-1', quantity: 2 },
      },
    ]);
    expect(client.activeRequestCount).toBe(0);
    expect(client.isRequesting).toBe(false);
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
