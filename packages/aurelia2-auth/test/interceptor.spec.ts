import { Registration } from '@aurelia/kernel';
import { Authentication, IAuthentication } from '../src/authentication';
import { IAuthService } from '../src/auth-service';
import { AuthInterceptor } from '../src/interceptor';
import { isAuthRequestRetried } from '../src/auth-request';
import { createUnitContainer } from './helpers';

describe('AuthInterceptor', () => {
  function create(options = {}) {
    const setup = createUnitContainer(options);
    const auth = setup.container.invoke(Authentication);
    const service = { refreshToken: jest.fn() };
    setup.container.register(
      Registration.instance(IAuthentication, auth),
      Registration.instance(IAuthService, service as never),
    );
    return { ...setup, auth, service, interceptor: setup.container.invoke(AuthInterceptor) };
  }

  test('attaches bearer credentials only to trusted origins', async () => {
    const { auth, interceptor } = create({ trustedOrigins: ['https://api.example'] });
    auth.setToken('opaque-token');

    const trusted = await interceptor.request(new Request('https://api.example/orders'));
    const untrusted = await interceptor.request(new Request('https://uploads.example/file'));

    expect(trusted.headers.get('Authorization')).toBe('Bearer opaque-token');
    expect(untrusted.headers.has('Authorization')).toBe(false);
  });

  test('supports API-key and custom request authentication modes', async () => {
    const apiKey = create({
      mode: 'api-key',
      apiKey: () => 'key-123',
      trustedOrigins: ['https://api.example'],
    });
    const keyed = await apiKey.interceptor.request(new Request('https://api.example/data'));
    expect(keyed.headers.get('X-API-Key')).toBe('key-123');

    const custom = create({
      mode: 'custom',
      trustedOrigins: ['https://api.example'],
      transformRequest: ({ request }) => {
        request.headers.set('DPoP', 'proof');
        return request;
      },
    });
    const transformed = await custom.interceptor.request(new Request('https://api.example/data'));
    expect(transformed.headers.get('DPoP')).toBe('proof');
  });

  test('scopes cookie credentials to explicit absolute trusted origins', async () => {
    const { interceptor } = create({
      mode: 'cookie',
      withCredentials: true,
      trustedOrigins: ['https://api.example', '/'],
    });

    const trusted = await interceptor.request(new Request('https://api.example/session'));
    const untrusted = await interceptor.request(new Request('https://uploads.example/file'));

    expect(trusted.credentials).toBe('include');
    expect(untrusted.credentials).toBe('same-origin');
  });

  test('refreshes once and returns a replayable request for a 401 response', async () => {
    const { auth, service, interceptor } = create({
      refreshTokens: true,
      trustedOrigins: ['https://api.example'],
    });
    auth.setToken({ access_token: 'old', refresh_token: 'refresh' });
    service.refreshToken.mockImplementation(async () => {
      auth.setToken({ access_token: 'new' });
    });

    const original = await interceptor.request(new Request('https://api.example/orders', {
      method: 'POST',
      body: JSON.stringify({ id: 1 }),
    }));
    const replay = await interceptor.response(new Response(null, { status: 401 }), original);

    expect(replay).toBeInstanceOf(Request);
    expect(isAuthRequestRetried(replay as Request)).toBe(true);
    expect(service.refreshToken).toHaveBeenCalledTimes(1);
    const retried = await interceptor.request(replay as Request);
    expect(retried.headers.get('Authorization')).toBe('Bearer new');
    await expect(retried.clone().json()).resolves.toEqual({ id: 1 });
  });

  test('does not loop when the replayed request is also unauthorized', async () => {
    const { auth, service, interceptor } = create({
      refreshTokens: true,
      trustedOrigins: ['https://api.example'],
    });
    auth.setToken({ access_token: 'old', refresh_token: 'refresh' });
    service.refreshToken.mockResolvedValue({});
    const request = await interceptor.request(new Request('https://api.example/data'));
    const replay = await interceptor.response(new Response(null, { status: 401 }), request) as Request;
    const final = await interceptor.response(new Response(null, { status: 401 }), replay);

    expect(final).toBeInstanceOf(Response);
    expect(service.refreshToken).toHaveBeenCalledTimes(1);
  });
});
