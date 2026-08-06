import type { IJwtClaims } from './configuration';

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  if (typeof globalThis.atob === 'function') {
    const bytes = Uint8Array.from(globalThis.atob(padded), char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  const BufferCtor = (globalThis as typeof globalThis & {
    Buffer?: { from(input: string, encoding: string): { toString(encoding: string): string } };
  }).Buffer;
  if (BufferCtor) {
    return BufferCtor.from(padded, 'base64').toString('utf8');
  }

  throw new Error('No base64 decoder is available in this environment.');
}

/**
 * Decodes JWT claims without verifying the token signature. Signature and authorization
 * checks remain the responsibility of the issuer and resource server.
 */
export function decodeJwt(token: string | null | undefined): IJwtClaims | null {
  if (!token) return null;
  const segments = token.split('.');
  if (segments.length !== 3 || !segments[1]) return null;

  try {
    const value: unknown = JSON.parse(decodeBase64Url(segments[1]));
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as IJwtClaims
      : null;
  } catch {
    return null;
  }
}

export function isJwt(token: string | null | undefined): token is string {
  return typeof token === 'string' && token.split('.').length === 3;
}

export function getJwtExpiration(token: string | null | undefined): number | null {
  const exp = decodeJwt(token)?.exp;
  return typeof exp === 'number' && Number.isFinite(exp) ? exp : null;
}

export interface IJwtValidationOptions {
  now?: number;
  clockTolerance?: number;
  expiresEarlyBy?: number;
  issuer?: string;
  audience?: string | readonly string[];
  validate?: (claims: Readonly<IJwtClaims>, token: string) => boolean;
}

export function isJwtUsable(token: string, options: IJwtValidationOptions = {}): boolean {
  const claims = decodeJwt(token);
  if (!claims) return false;

  const now = options.now ?? Math.floor(Date.now() / 1000);
  const tolerance = Math.max(options.clockTolerance ?? 0, 0);
  const expiresEarlyBy = Math.max(options.expiresEarlyBy ?? 0, 0);

  if (typeof claims.nbf === 'number' && now + tolerance < claims.nbf) return false;
  if (typeof claims.exp === 'number' && now - tolerance >= claims.exp - expiresEarlyBy) return false;
  if (options.issuer && claims.iss !== options.issuer) return false;
  if (options.audience && !hasAudience(claims.aud, options.audience)) return false;
  if (options.validate && !options.validate(claims, token)) return false;

  return true;
}

function hasAudience(
  actual: string | readonly string[] | undefined,
  expected: string | readonly string[],
): boolean {
  const actualValues = typeof actual === 'string' ? [actual] : actual ?? [];
  const expectedValues = typeof expected === 'string' ? [expected] : expected;
  return expectedValues.some(value => actualValues.includes(value));
}
