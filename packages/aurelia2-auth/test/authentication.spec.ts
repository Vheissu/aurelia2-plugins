import { Authentication } from '../src/authentication';
import { decodeJwt } from '../src/jwt';
import { createJwt, createUnitContainer } from './helpers';

describe('Authentication token state', () => {
  afterEach(() => jest.restoreAllMocks());

  test('extracts nested token responses and preserves a rotating refresh token', () => {
    const { container, storage } = createUnitContainer({ tokenRoot: 'payload' });
    const auth = container.invoke(Authentication);

    auth.setToken({ payload: { access_token: 'access-1' }, refresh_token: 'refresh-1' });
    auth.setToken({ payload: { access_token: 'access-2' } });

    expect(auth.getToken()).toBe('access-2');
    expect(auth.getRefreshToken()).toBe('refresh-1');
    expect(storage.values).toEqual(new Map([
      ['aurelia-auth_access_token', 'access-2'],
      ['aurelia-auth_refresh_token', 'refresh-1'],
    ]));
  });

  test('decodes UTF-8 JWT claims without presenting them as signature verification', () => {
    const token = createJwt({ sub: '42', name: 'José 👋' });
    expect(decodeJwt(token)).toMatchObject({ sub: '42', name: 'José 👋' });
    expect(decodeJwt('not-a-jwt')).toBeNull();
  });

  test('enforces exp, nbf, issuer, audience and custom claim validation', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const { container } = createUnitContainer({
      issuer: 'https://issuer.example',
      audience: ['web', 'api'],
      clockTolerance: 0,
      validateJwt: claims => claims.kind === 'access',
    });
    const auth = container.invoke(Authentication);

    auth.setToken(createJwt({
      exp: 1_700_000_100,
      nbf: 1_699_999_900,
      iss: 'https://issuer.example',
      aud: ['api'],
      kind: 'access',
    }));
    expect(auth.isAuthenticated()).toBe(true);

    auth.setToken(createJwt({
      exp: 1_700_000_100,
      iss: 'https://attacker.example',
      aud: ['api'],
      kind: 'access',
    }));
    expect(auth.isAuthenticated()).toBe(false);
  });

  test('uses expires_in for opaque access tokens and supports early-expiry checks', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const { container } = createUnitContainer();
    const auth = container.invoke(Authentication);
    auth.setToken({ access_token: 'opaque', expires_in: 120 });

    expect(auth.isTokenExpired()).toBe(false);
    expect(auth.isTokenExpired(121)).toBe(true);
    expect(auth.session.tokens.expiresAt).toBe(1_700_000_120);
  });

  test('does not apply an old opaque-token expiry to a replacement token', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const { container } = createUnitContainer();
    const auth = container.invoke(Authentication);
    auth.setToken({ access_token: 'short-lived', expires_in: 30 });

    auth.setToken({ access_token: 'replacement-with-server-managed-expiry' });

    expect(auth.session.tokens.expiresAt).toBeUndefined();
    expect(auth.isAuthenticated()).toBe(true);
  });

  test('supports cookie sessions without fabricating a browser-readable token', () => {
    const { container } = createUnitContainer({ mode: 'cookie' });
    const auth = container.invoke(Authentication);

    expect(auth.isAuthenticated()).toBe(false);
    auth.setSession({ id: 'user-1' });
    expect(auth.session).toMatchObject({
      status: 'authenticated',
      user: { id: 'user-1' },
      tokens: {},
    });
    auth.clearTokens();
    expect(auth.isAuthenticated()).toBe(false);
  });

  test('preserves only same-origin return URLs', () => {
    const { container } = createUnitContainer({ loginRedirect: '/dashboard' });
    const auth = container.invoke(Authentication);

    auth.setInitialUrl('https://attacker.example/phish');
    expect(auth.getLoginRedirect()).toBe('/dashboard');

    auth.setInitialUrl('javascript:alert(1)');
    expect(auth.getLoginRedirect()).toBe('/dashboard');

    auth.setInitialUrl('/account?tab=security#sessions');
    expect(auth.getLoginRedirect()).toBe('/account?tab=security#sessions');
  });

  test('clears local state but refuses an external logout redirect', async () => {
    const assign = jest.fn();
    const browserWindow = {
      location: { origin: 'https://app.example', assign },
    } as unknown as Window;
    const { container } = createUnitContainer({}, [], browserWindow);
    const auth = container.invoke(Authentication);
    auth.setToken('opaque-token');

    await auth.logout('https://attacker.example/signed-out');

    expect(auth.isAuthenticated()).toBe(false);
    expect(assign).not.toHaveBeenCalled();

    auth.setToken('second-token');
    await auth.logout('/signed-out');
    expect(assign).toHaveBeenCalledWith('/signed-out');
  });
});
