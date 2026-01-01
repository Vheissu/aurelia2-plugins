import { AuthFilterValueConverter } from '../src/auth-filter';

describe('AuthFilterValueConverter', () => {
  test('filters routes based on auth flag', () => {
    const converter = new AuthFilterValueConverter();
    const routes = [
      { path: 'public' },
      { path: 'private', data: { auth: true } },
      { path: 'guest', data: { auth: false } },
    ];

    const forAuthenticated = converter.toView(routes, true);
    const forAnonymous = converter.toView(routes, false);

    expect(forAuthenticated.map((r) => r.path)).toEqual(['public', 'private']);
    expect(forAnonymous.map((r) => r.path)).toEqual(['public', 'guest']);
  });

  test('returns input when routes is not an array', () => {
    const converter = new AuthFilterValueConverter();

    expect(converter.toView(null, true)).toBeNull();
    expect(converter.toView(undefined, true)).toBeUndefined();
  });
});
