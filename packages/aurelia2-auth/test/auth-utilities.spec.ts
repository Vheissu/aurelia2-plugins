import {
  camelCase,
  extend,
  forEach,
  joinUrl,
  parseOAuthResponse,
  parseQueryString,
  status,
} from '../src/auth-utilities';

describe('Authentication HTTP and URL utilities', () => {
  test('parses successful JSON, plain text and empty HTTP responses', async () => {
    await expect(status<{ ok: boolean }>(new Response('{"ok":true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))).resolves.toEqual({ ok: true });
    await expect(status<string>(new Response('accepted', { status: 200 })))
      .resolves.toBe('accepted');
    await expect(status<void>(new Response(null, { status: 204 }))).resolves.toBeUndefined();
  });

  test('throws the original unsuccessful response for status-aware callers', async () => {
    const response = new Response('{"error":"denied"}', { status: 403 });

    await expect(status(response)).rejects.toBe(response);
  });

  test('joins absolute and relative API paths without changing external URLs', () => {
    expect(joinUrl('https://api.example/v1/', '/users')).toBe('https://api.example/v1/users');
    expect(joinUrl('/api/', '/users')).toBe('/api/users');
    expect(joinUrl('/api', 'https://uploads.example/file')).toBe('https://uploads.example/file');
    expect(joinUrl(undefined, '/users')).toBe('/users');
  });

  test('parses query and fragment OAuth parameters with fragment precedence', () => {
    expect(parseQueryString('?code=one&state=two')).toEqual({ code: 'one', state: 'two' });
    expect(parseOAuthResponse(
      'https://app.example/callback?state=query#state=fragment&access_token=token',
    )).toEqual({ state: 'fragment', access_token: 'token' });
  });

  test('keeps the small legacy collection helpers deterministic', () => {
    expect(camelCase('refresh-token:value')).toBe('refreshTokenValue');
    expect(extend({ first: 1 }, { second: 2 })).toEqual({ first: 1, second: 2 });
    const entries: Array<[string | number, number]> = [];
    forEach([10, 20], (value, key) => entries.push([key, value]));
    forEach({ final: 30 }, (value, key) => entries.push([key, value]));
    expect(entries).toEqual([[0, 10], [1, 20], ['final', 30]]);
  });
});
