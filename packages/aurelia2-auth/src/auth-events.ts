export const AuthEvents = {
  stateChanged: 'auth:state-changed',
  login: 'auth:login',
  signup: 'auth:signup',
  logout: 'auth:logout',
  authenticate: 'auth:authenticate',
  unlink: 'auth:unlink',
  refresh: 'auth:refresh',
  sessionExpired: 'auth:session-expired',
  tokenExpired: 'auth:token-expired',
  idleTimeout: 'auth:idle-timeout',
  passwordResetRequested: 'auth:password-reset-requested',
  passwordReset: 'auth:password-reset',
  unauthorized: 'auth:unauthorized',
  forbidden: 'auth:forbidden',
  tabSync: 'auth:tab-sync',
} as const;

export type AuthEventName = (typeof AuthEvents)[keyof typeof AuthEvents];

export class AuthStateChangedEvent {
  public constructor(
    public readonly authenticated: boolean,
    public readonly reason: 'login' | 'logout' | 'refresh' | 'session' | 'token' | 'tab-sync',
  ) {}
}

export class AuthUnauthorizedEvent {
  public constructor(public readonly response: Response) {}
}
