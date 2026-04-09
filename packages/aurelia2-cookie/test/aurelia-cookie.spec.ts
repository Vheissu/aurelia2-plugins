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

    AureliaCookie.set('token', 'abc', { expiry: 2 });

    expect(cookieValue).toContain('token=abc');
    expect(cookieValue).toContain('expires=Thu, 09 Apr 2026 12:00:00 GMT');
  });

  test('deletes a cookie by writing an expired cookie string', () => {
    AureliaCookie.delete('session', 'example.test', '/admin');

    expect(cookieValue).toBe(
      'session=;expires=Thu, 01 Jan 1970 00:00:01 GMT;; domain=example.test; path=/admin'
    );
  });

  test('returns null for malformed encoded values', () => {
    expect(AureliaCookie.decode('%E0%A4%A')).toBeNull();
  });
});
