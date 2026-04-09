import { DI, Registration, EventAggregator, IEventAggregator } from '@aurelia/kernel';
import { IHttpClient } from '@aurelia/fetch-client';
import { IAuthOptions } from '../src/configuration';
import { AuthService } from '../src/auth-service';
import { IAuthentication } from '../src/authentication';
import { IOAuth1 } from '../src/oAuth1';
import { IOAuth2 } from '../src/oAuth2';
import { AuthEvents } from '../src/auth-events';
import { IWindow } from '@aurelia/runtime-html';

const createService = (opts: {
  idleTimeout?: number;
  idleEvents?: string[];
  authenticated?: boolean;
}) => {
  const authenticated = opts.authenticated ?? true;

  const auth = {
    tokenInterceptor: {},
    getPayload: () => (authenticated ? { sub: 'user1' } : null),
    isAuthenticated: jest.fn(() => authenticated),
    isTokenExpired: () => false,
    getToken: () => (authenticated ? 'token' : null),
    getRefreshToken: () => null,
    getRefreshUrl: () => '/auth/refresh',
    setToken: jest.fn(),
    clearTokens: jest.fn(),
    logout: jest.fn(() => Promise.resolve()),
  } as unknown as IAuthentication;

  const eventAggregator = new EventAggregator();

  const listeners: Record<string, Function[]> = {};
  const mockWindow = {
    addEventListener: jest.fn((event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    removeEventListener: jest.fn((event: string, handler: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler);
      }
    }),
  } as unknown as IWindow;

  const container = DI.createContainer();
  container.register(
    Registration.instance(IHttpClient, {} as IHttpClient),
    Registration.instance(IAuthentication, auth),
    Registration.instance(IOAuth1, {} as IOAuth1),
    Registration.instance(IOAuth2, {} as IOAuth2),
    Registration.instance(IAuthOptions, {
      idleTimeout: opts.idleTimeout ?? 300,
      idleEvents: opts.idleEvents ?? ['mousemove', 'keydown'],
      logoutRedirect: '',
    }),
    Registration.instance(IEventAggregator, eventAggregator),
    Registration.instance(IWindow, mockWindow)
  );

  const service = container.invoke(AuthService);

  return { service, auth, eventAggregator, mockWindow, listeners };
};

describe('Idle timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('registers event listeners on configured idle events', () => {
    const { service, mockWindow } = createService({
      idleTimeout: 300,
      idleEvents: ['mousemove', 'keydown', 'click'],
    });

    expect(mockWindow.addEventListener).toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function),
      { passive: true }
    );
    expect(mockWindow.addEventListener).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function),
      { passive: true }
    );
    expect(mockWindow.addEventListener).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
      { passive: true }
    );

    service.dispose();
  });

  test('publishes idle-timeout event and logs out after timeout', async () => {
    const { service, auth, eventAggregator } = createService({ idleTimeout: 60 });
    const spy = jest.spyOn(eventAggregator, 'publish');

    jest.advanceTimersByTime(60 * 1000);

    expect(spy).toHaveBeenCalledWith(AuthEvents.idleTimeout);
    expect(auth.logout).toHaveBeenCalled();

    service.dispose();
  });

  test('resets idle timer on user activity', () => {
    const { service, auth, listeners } = createService({
      idleTimeout: 60,
      idleEvents: ['mousemove'],
    });

    // Advance 50s, then simulate activity
    jest.advanceTimersByTime(50 * 1000);
    expect(auth.logout).not.toHaveBeenCalled();

    // Simulate mousemove
    if (listeners.mousemove) {
      listeners.mousemove[0]();
    }

    // Advance another 50s (total 100s, but timer reset at 50s)
    jest.advanceTimersByTime(50 * 1000);
    expect(auth.logout).not.toHaveBeenCalled();

    // Advance 11 more seconds (61s since last activity)
    jest.advanceTimersByTime(11 * 1000);
    expect(auth.logout).toHaveBeenCalled();

    service.dispose();
  });

  test('does not trigger timeout when not authenticated', () => {
    const { service, auth } = createService({
      idleTimeout: 10,
      authenticated: false,
    });

    jest.advanceTimersByTime(20 * 1000);
    expect(auth.logout).not.toHaveBeenCalled();

    service.dispose();
  });

  test('stopIdleTracking removes event listeners', () => {
    const { service, mockWindow } = createService({
      idleTimeout: 60,
      idleEvents: ['mousemove', 'keydown'],
    });

    service.stopIdleTracking();

    expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function)
    );
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    );

    service.dispose();
  });

  test('does not start tracking when idleTimeout is 0', () => {
    const { service, mockWindow } = createService({ idleTimeout: 0 });

    // addEventListener should not be called for idle events
    const idleEventCalls = (mockWindow.addEventListener as jest.Mock).mock.calls.filter(
      call => ['mousemove', 'keydown'].includes(call[0])
    );
    expect(idleEventCalls).toHaveLength(0);

    service.dispose();
  });
});
