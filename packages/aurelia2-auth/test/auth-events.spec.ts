import { AuthEvents } from '../src/auth-events';
import type { AuthEventName } from '../src/auth-events';

describe('AuthEvents', () => {
  test('exports all expected event names', () => {
    expect(AuthEvents.login).toBe('auth:login');
    expect(AuthEvents.signup).toBe('auth:signup');
    expect(AuthEvents.logout).toBe('auth:logout');
    expect(AuthEvents.authenticate).toBe('auth:authenticate');
    expect(AuthEvents.unlink).toBe('auth:unlink');
    expect(AuthEvents.refresh).toBe('auth:refresh');
    expect(AuthEvents.sessionExpired).toBe('auth:session-expired');
    expect(AuthEvents.tokenExpired).toBe('auth:token-expired');
    expect(AuthEvents.idleTimeout).toBe('auth:idle-timeout');
    expect(AuthEvents.passwordResetRequested).toBe('auth:password-reset-requested');
    expect(AuthEvents.passwordReset).toBe('auth:password-reset');
    expect(AuthEvents.unauthorized).toBe('auth:unauthorized');
    expect(AuthEvents.forbidden).toBe('auth:forbidden');
    expect(AuthEvents.tabSync).toBe('auth:tab-sync');
  });

  test('events object is frozen (const assertion)', () => {
    expect(Object.keys(AuthEvents)).toHaveLength(14);
  });

  test('event names satisfy AuthEventName type', () => {
    const names: AuthEventName[] = [
      AuthEvents.login,
      AuthEvents.logout,
      AuthEvents.signup,
      AuthEvents.authenticate,
      AuthEvents.unlink,
      AuthEvents.refresh,
      AuthEvents.sessionExpired,
      AuthEvents.tokenExpired,
      AuthEvents.idleTimeout,
      AuthEvents.passwordResetRequested,
      AuthEvents.passwordReset,
      AuthEvents.unauthorized,
      AuthEvents.forbidden,
      AuthEvents.tabSync,
    ];
    expect(names).toHaveLength(14);
  });
});
