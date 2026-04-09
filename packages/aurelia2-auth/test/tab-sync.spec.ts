import { DI, Registration, EventAggregator, IEventAggregator } from '@aurelia/kernel';
import { IHttpClient } from '@aurelia/fetch-client';
import { IAuthOptions } from '../src/configuration';
import { AuthService } from '../src/auth-service';
import { IAuthentication } from '../src/authentication';
import { IOAuth1 } from '../src/oAuth1';
import { IOAuth2 } from '../src/oAuth2';
import { AuthEvents } from '../src/auth-events';
import { IWindow } from '@aurelia/runtime-html';

const createService = (opts?: { tokenPrefix?: string; tokenName?: string }) => {
  const auth = {
    tokenInterceptor: {},
    getPayload: () => ({ sub: 'user1' }),
    isAuthenticated: () => true,
    isTokenExpired: () => false,
    getToken: () => 'token',
    getRefreshToken: () => null,
    setToken: jest.fn(),
    clearTokens: jest.fn(),
  } as unknown as IAuthentication;

  const eventAggregator = new EventAggregator();

  const storageListeners: Array<(e: StorageEvent) => void> = [];
  const mockWindow = {
    addEventListener: jest.fn((event: string, handler: Function) => {
      if (event === 'storage') {
        storageListeners.push(handler as (e: StorageEvent) => void);
      }
    }),
    removeEventListener: jest.fn((event: string, handler: Function) => {
      if (event === 'storage') {
        const idx = storageListeners.indexOf(handler as (e: StorageEvent) => void);
        if (idx >= 0) storageListeners.splice(idx, 1);
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
      tabSync: true,
      tabSyncChannel: 'aurelia-auth-sync',
      tokenPrefix: opts?.tokenPrefix ?? 'aurelia',
      tokenName: opts?.tokenName ?? 'token',
    }),
    Registration.instance(IEventAggregator, eventAggregator),
    Registration.instance(IWindow, mockWindow)
  );

  const service = container.invoke(AuthService);

  return { service, auth, eventAggregator, mockWindow, storageListeners };
};

describe('Multi-tab sync', () => {
  test('registers storage event listener', () => {
    const { service, mockWindow } = createService();

    expect(mockWindow.addEventListener).toHaveBeenCalledWith(
      'storage',
      expect.any(Function)
    );

    service.dispose();
  });

  test('publishes logout sync event when token is removed', () => {
    const { service, eventAggregator, storageListeners, auth } = createService();
    const spy = jest.spyOn(eventAggregator, 'publish');

    // Simulate token removal in another tab
    const storageEvent = {
      key: 'aurelia_token',
      oldValue: 'old-token',
      newValue: null,
    } as StorageEvent;

    storageListeners[0](storageEvent);

    expect(auth.clearTokens).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(AuthEvents.tabSync, { action: 'logout' });

    service.dispose();
  });

  test('publishes login sync event when token is added', () => {
    const { service, eventAggregator, storageListeners } = createService();
    const spy = jest.spyOn(eventAggregator, 'publish');

    // Simulate token added in another tab
    const storageEvent = {
      key: 'aurelia_token',
      oldValue: null,
      newValue: 'new-token',
    } as StorageEvent;

    storageListeners[0](storageEvent);

    expect(spy).toHaveBeenCalledWith(AuthEvents.tabSync, { action: 'login' });

    service.dispose();
  });

  test('ignores storage events for unrelated keys', () => {
    const { service, eventAggregator, storageListeners, auth } = createService();
    const spy = jest.spyOn(eventAggregator, 'publish');

    const storageEvent = {
      key: 'some_other_key',
      oldValue: 'old',
      newValue: null,
    } as StorageEvent;

    storageListeners[0](storageEvent);

    expect(auth.clearTokens).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalledWith(
      AuthEvents.tabSync,
      expect.anything()
    );

    service.dispose();
  });

  test('uses custom token prefix and name', () => {
    const { service, eventAggregator, storageListeners, auth } = createService({
      tokenPrefix: 'myapp',
      tokenName: 'jwt',
    });
    const spy = jest.spyOn(eventAggregator, 'publish');

    // Should listen for 'myapp_jwt'
    const storageEvent = {
      key: 'myapp_jwt',
      oldValue: 'old-token',
      newValue: null,
    } as StorageEvent;

    storageListeners[0](storageEvent);

    expect(auth.clearTokens).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(AuthEvents.tabSync, { action: 'logout' });

    service.dispose();
  });

  test('stopTabSync removes storage listener', () => {
    const { service, mockWindow, storageListeners } = createService();

    expect(storageListeners).toHaveLength(1);

    service.stopTabSync();

    expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
      'storage',
      expect.any(Function)
    );

    service.dispose();
  });

  test('ignores token value updates (not add/remove)', () => {
    const { service, eventAggregator, storageListeners, auth } = createService();
    const spy = jest.spyOn(eventAggregator, 'publish');

    // Both old and new have values - just a token update
    const storageEvent = {
      key: 'aurelia_token',
      oldValue: 'old-token',
      newValue: 'new-token',
    } as StorageEvent;

    storageListeners[0](storageEvent);

    expect(auth.clearTokens).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalledWith(
      AuthEvents.tabSync,
      expect.anything()
    );

    service.dispose();
  });
});
