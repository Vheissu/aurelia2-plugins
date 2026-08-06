import { IEventAggregator, Registration } from '@aurelia/kernel';
import { IHttpClient } from '@aurelia/fetch-client';
import { Authentication, IAuthentication } from '../src/authentication';
import { AuthorizationService, IAuthorizationService } from '../src/authorization';
import { AuthEvents } from '../src/auth-events';
import { AuthService } from '../src/auth-service';
import { IOAuth1 } from '../src/oAuth1';
import { IOAuthClient } from '../src/oauth-client';
import { createUnitContainer } from './helpers';

describe('AuthService session lifecycle', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function create(options = {}) {
    const http = { fetch: jest.fn() };
    const setup = createUnitContainer(options, [
      Registration.instance(IHttpClient, http as never),
      Registration.instance(IOAuthClient, { begin: jest.fn(), start: jest.fn(), complete: jest.fn() }),
      Registration.instance(IOAuth1, { open: jest.fn() }),
    ]);
    const auth = setup.container.invoke(Authentication);
    setup.container.register(
      Registration.instance(IAuthentication, auth),
      Registration.singleton(IAuthorizationService, AuthorizationService),
    );
    return {
      ...setup,
      auth,
      http,
      events: setup.container.get(IEventAggregator),
      service: setup.container.invoke(AuthService),
    };
  }

  test('refreshes at the configured pre-expiry boundary and tears down its timer', async () => {
    jest.useFakeTimers({ now: new Date('2026-08-07T00:00:00Z') });
    const { auth, http, service } = create({
      refreshTokens: true,
      autoRefresh: true,
      autoRefreshBuffer: 60,
      tabSync: false,
    });
    auth.setToken({ access_token: 'old', refresh_token: 'refresh', expires_in: 120 });
    http.fetch.mockResolvedValue(jsonResponse({ access_token: 'new' }));

    await service.initialize();
    await jest.advanceTimersByTimeAsync(59_999);
    expect(http.fetch).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(http.fetch).toHaveBeenCalledTimes(1);
    expect(auth.getToken()).toBe('new');

    service.dispose();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('resets idle logout on activity and disposes its event listeners', async () => {
    jest.useFakeTimers({ now: 0 });
    const add = jest.spyOn(window, 'addEventListener');
    const remove = jest.spyOn(window, 'removeEventListener');
    const { auth, events, service } = create({
      idleTimeout: 10,
      idleEvents: ['pointerdown'],
      logoutUrl: null,
      tabSync: false,
    });
    const idle = jest.fn();
    events.subscribe(AuthEvents.idleTimeout, idle);
    auth.setToken('opaque-token');

    await service.initialize();
    await jest.advanceTimersByTimeAsync(9_000);
    window.dispatchEvent(new Event('pointerdown'));
    await jest.advanceTimersByTimeAsync(9_000);
    expect(auth.isAuthenticated()).toBe(true);
    expect(idle).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1_000);
    await Promise.resolve();
    expect(auth.isAuthenticated()).toBe(false);
    expect(idle).toHaveBeenCalledTimes(1);

    service.dispose();
    expect(add).toHaveBeenCalledWith('pointerdown', expect.any(Function), { passive: true });
    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(jest.getTimerCount()).toBe(0);
  });

  test('applies login and logout storage events once and removes the tab listener', async () => {
    const add = jest.spyOn(window, 'addEventListener');
    const remove = jest.spyOn(window, 'removeEventListener');
    const { auth, storage, events, service } = create({
      storage: 'localStorage',
      tabSync: true,
      autoRefresh: false,
    });
    const tabSync = jest.fn();
    const stateChanged = jest.fn();
    events.subscribe(AuthEvents.tabSync, tabSync);
    events.subscribe(AuthEvents.stateChanged, stateChanged);

    await service.initialize();
    storage.set('aurelia-auth_access_token', 'remote-token');
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'aurelia-auth_access_token',
      newValue: 'remote-token',
    }));

    expect(auth.isAuthenticated()).toBe(true);
    expect(tabSync).toHaveBeenLastCalledWith({ action: 'login' }, AuthEvents.tabSync);
    expect(stateChanged).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'some-other-key',
      newValue: null,
    }));
    expect(tabSync).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'aurelia-auth_access_token',
      newValue: null,
    }));
    expect(auth.isAuthenticated()).toBe(false);
    expect(tabSync).toHaveBeenLastCalledWith({ action: 'logout' }, AuthEvents.tabSync);
    expect(stateChanged).toHaveBeenCalledTimes(2);

    service.dispose();
    expect(add).toHaveBeenCalledWith('storage', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
