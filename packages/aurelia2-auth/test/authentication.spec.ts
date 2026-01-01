import { DI, Registration } from '@aurelia/kernel';
import { IAuthOptions } from '../src/configuration';
import { Authentication } from '../src/authentication';
import { Storage } from '../src/storage';
import { IStorage } from '../src/storage';

const encodeBase64Url = (value: string) => {
  if (typeof btoa === 'function') {
    return btoa(value)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // @ts-expect-error
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const createJwt = (payload: Record<string, unknown>) => {
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = encodeBase64Url(JSON.stringify(payload));
  return `${header}.${body}.signature`;
};

describe('Authentication', () => {
  const config = {
    tokenName: 'token',
    idTokenName: 'id_token',
    refreshTokenName: 'refresh_token',
    tokenPrefix: 'test',
    responseTokenProp: 'access_token',
    responseIdTokenProp: 'id_token',
    responseRefreshTokenProp: 'refresh_token',
    loginRedirect: '',
    logoutRedirect: '',
    storage: 'memory',
  };

  test('stores access, id, and refresh tokens', () => {
    const container = DI.createContainer();
    container.register(Registration.instance(IAuthOptions, config));
    const storage = container.invoke(Storage);
    container.register(Registration.instance(IStorage, storage));

    const auth = container.invoke(Authentication);

    auth.setToken({
      access_token: 'access',
      id_token: 'id',
      refresh_token: 'refresh',
    });

    expect(storage.get('test_token')).toBe('access');
    expect(storage.get('test_id_token')).toBe('id');
    expect(storage.get('test_refresh_token')).toBe('refresh');
  });

  test('isAuthenticated respects token expiration', () => {
    const container = DI.createContainer();
    container.register(
      Registration.instance(IAuthOptions, {
        ...config,
        tokenExpirationLeeway: 0,
      })
    );
    const storage = container.invoke(Storage);
    container.register(Registration.instance(IStorage, storage));

    const auth = container.invoke(Authentication);

    const future = Math.round(Date.now() / 1000) + 60;
    storage.set('test_token', createJwt({ exp: future }));
    expect(auth.isAuthenticated()).toBe(true);

    const past = Math.round(Date.now() / 1000) - 60;
    storage.set('test_token', createJwt({ exp: past }));
    expect(auth.isAuthenticated()).toBe(false);
  });

  test('isTokenExpired uses leeway', () => {
    const container = DI.createContainer();
    container.register(
      Registration.instance(IAuthOptions, {
        ...config,
        tokenExpirationLeeway: 60,
      })
    );
    const storage = container.invoke(Storage);
    container.register(Registration.instance(IStorage, storage));

    const auth = container.invoke(Authentication);
    const expSoon = Math.round(Date.now() / 1000) + 30;
    storage.set('test_token', createJwt({ exp: expSoon }));

    expect(auth.isTokenExpired()).toBe(true);
  });
});
