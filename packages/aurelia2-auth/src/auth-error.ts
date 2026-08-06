export type AuthErrorCode =
  | 'invalid-configuration'
  | 'invalid-token'
  | 'missing-refresh-token'
  | 'oauth-cancelled'
  | 'oauth-callback-error'
  | 'oauth-popup-blocked'
  | 'oauth-popup-timeout'
  | 'oauth-transaction-expired'
  | 'oauth-transaction-mismatch'
  | 'unknown-provider';

export class AuthError extends Error {
  public override readonly name = 'AuthError';

  public constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
  }
}
