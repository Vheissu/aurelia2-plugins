import { createDefaultAuthConfigOptions } from '../src/base-config';

describe('Provider defaults', () => {
  const config = createDefaultAuthConfigOptions();
  const providers = config.providers ?? {};

  test('does not include Twitter OAuth 1.0 by default', () => {
    expect(providers.twitter).toBeUndefined();
  });

  test('google uses current OAuth authorize endpoint', () => {
    expect(providers.google?.authorizationEndpoint).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth'
    );
  });

  test('apple uses current OAuth authorize endpoint', () => {
    expect(providers.apple?.authorizationEndpoint).toBe(
      'https://appleid.apple.com/auth/authorize'
    );
  });

  test('microsoft uses v2 OAuth authorize endpoint', () => {
    expect(providers.microsoft?.authorizationEndpoint).toBe(
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
    );
  });

  test('x uses OAuth 2.0 authorize endpoint with PKCE defaults', () => {
    expect(providers.x?.authorizationEndpoint).toBe(
      'https://twitter.com/i/oauth2/authorize'
    );
    expect(providers.x?.pkce).toBe(true);
    expect(providers.x?.pkceMethod).toBe('S256');
    expect(providers.x?.responseType).toBe('code');
  });

  test('github uses OAuth authorize endpoint', () => {
    expect(providers.github?.authorizationEndpoint).toBe(
      'https://github.com/login/oauth/authorize'
    );
  });

  test('linkedin uses OAuth authorize endpoint', () => {
    expect(providers.linkedin?.authorizationEndpoint).toBe(
      'https://www.linkedin.com/oauth/v2/authorization'
    );
  });

  test('facebook uses versioned OAuth dialog endpoint', () => {
    expect(providers.facebook?.authorizationEndpoint).toBe(
      'https://www.facebook.com/v2.9/dialog/oauth'
    );
  });

  test('instagram uses Basic Display OAuth defaults', () => {
    expect(providers.instagram?.authorizationEndpoint).toBe(
      'https://api.instagram.com/oauth/authorize'
    );
    expect(providers.instagram?.scope).toEqual(['user_profile', 'user_media']);
    expect(providers.instagram?.scopeDelimiter).toBe(',');
  });

  test('yahoo uses OAuth authorize endpoint', () => {
    expect(providers.yahoo?.authorizationEndpoint).toBe(
      'https://api.login.yahoo.com/oauth2/request_auth'
    );
  });

  test('live uses Microsoft account OAuth authorize endpoint', () => {
    expect(providers.live?.authorizationEndpoint).toBe(
      'https://login.live.com/oauth20_authorize.srf'
    );
  });
});
