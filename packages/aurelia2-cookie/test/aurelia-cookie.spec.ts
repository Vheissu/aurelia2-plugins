import { AureliaCookie } from '../src/aurelia-cookie';

describe('AureliaCookie', () => {
  const originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  let cookieValue = '';

  beforeEach(() => {
    cookieValue = '';
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get() {
        return cookieValue;
      },
      set(value: string) {
        cookieValue = value;
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();

    if (originalCookieDescriptor) {
      Object.defineProperty(Document.prototype, 'cookie', originalCookieDescriptor);
    }

    delete (document as Partial<Document> & { cookie?: string }).cookie;
  });

  test('parses encoded cookie pairs and ignores an empty cookie header', () => {
    expect(AureliaCookie.parse('')).toEqual({});

    expect(AureliaCookie.parse('first%20name=Dwayne%20Charrington; theme=dark')).toEqual({
      'first name': 'Dwayne Charrington',
      theme: 'dark',
    });
  });

  test('reads all cookies and returns a cookie by name', () => {
    cookieValue = 'session=abc123; preferences=compact';

    expect(AureliaCookie.all()).toEqual({
      session: 'abc123',
      preferences: 'compact',
    });
    expect(AureliaCookie.get('preferences')).toBe('compact');
    expect(AureliaCookie.get('missing')).toBeNull();
  });

  test('preserves empty values and equals signs inside a cookie value', () => {
    cookieValue = 'token=abc==; empty=; constructor=literal';

    expect(AureliaCookie.get('token')).toBe('abc==');
    expect(AureliaCookie.get('empty')).toBe('');
    expect(AureliaCookie.get('constructor')).toBe('literal');
    expect(AureliaCookie.get('toString')).toBeNull();
  });

  test('serializes cookie options when setting a cookie', () => {
    const expires = new Date('2026-04-10T12:00:00.000Z');

    AureliaCookie.set('user name', 'Dwayne Charrington', {
      expires,
      path: '/',
      domain: 'example.test',
      secure: true,
      sameSite: 'Lax',
    });

    expect(cookieValue).toBe(
      'user%20name=Dwayne%20Charrington; path=/; domain=example.test; expires=Fri, 10 Apr 2026 12:00:00 GMT; secure; SameSite=Lax'
    );
  });

  test('converts expiry hours into an expires date when setting a cookie', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-09T10:00:00.000Z'));

    const options = Object.freeze({ expiry: 2 });
    AureliaCookie.set('token', 'abc', options);

    expect(cookieValue).toContain('token=abc');
    expect(cookieValue).toContain('expires=Thu, 09 Apr 2026 12:00:00 GMT');
  });

  test('deletes a cookie by writing an expired cookie string', () => {
    AureliaCookie.delete('user name', 'example.test', '/admin');

    expect(cookieValue).toBe(
      'user%20name=; path=/admin; domain=example.test; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    );
  });

  test('returns null for malformed encoded values', () => {
    expect(AureliaCookie.decode('%E0%A4%A')).toBeNull();
  });
});
