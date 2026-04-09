import { createFixture, onFixtureCreated } from '@aurelia/testing';
import { Registration, EventAggregator, IEventAggregator } from '@aurelia/kernel';
import { IfAuthenticatedCustomAttribute } from '../src/if-authenticated';
import { IAuthService } from '../src/auth-service';
import { AuthEvents } from '../src/auth-events';

const fixtures: any[] = [];

onFixtureCreated((fixture) => {
  fixtures.push(fixture);
});

afterEach(async () => {
  for (const fixture of fixtures) {
    await fixture.stop(true);
  }
  fixtures.length = 0;
});

const createAuthServiceStub = (authenticated: boolean) => ({
  isAuthenticated: jest.fn(() => authenticated),
  hasRole: jest.fn(() => false),
  hasAnyRole: jest.fn(() => false),
  hasAllRoles: jest.fn(() => false),
  getUserRoles: jest.fn(() => []),
});

describe('IfAuthenticatedCustomAttribute', () => {
  test('shows element when authenticated and value is true', async () => {
    const authService = createAuthServiceStub(true);
    const ea = new EventAggregator();

    const { appHost, startPromise } = createFixture(
      '<div if-authenticated>Authenticated Content</div>',
      {},
      [
        IfAuthenticatedCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const div = appHost.querySelector('div') as HTMLElement;
    expect(div).not.toBeNull();
    expect(div.style.display).not.toBe('none');
    expect(div.textContent).toBe('Authenticated Content');
  });

  test('hides element when not authenticated and value is true', async () => {
    const authService = createAuthServiceStub(false);
    const ea = new EventAggregator();

    const { appHost, startPromise } = createFixture(
      '<div if-authenticated>Should Be Hidden</div>',
      {},
      [
        IfAuthenticatedCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const div = appHost.querySelector('div') as HTMLElement;
    expect(div.style.display).toBe('none');
  });

  test('shows element when not authenticated and value is false (inverted)', async () => {
    const authService = createAuthServiceStub(false);
    const ea = new EventAggregator();

    const { appHost, startPromise } = createFixture(
      '<div if-authenticated.bind="false">Guest Content</div>',
      {},
      [
        IfAuthenticatedCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const div = appHost.querySelector('div') as HTMLElement;
    expect(div.style.display).not.toBe('none');
    expect(div.textContent).toBe('Guest Content');
  });

  test('hides element when authenticated and value is false (inverted)', async () => {
    const authService = createAuthServiceStub(true);
    const ea = new EventAggregator();

    const { appHost, startPromise } = createFixture(
      '<div if-authenticated.bind="false">Guest Only</div>',
      {},
      [
        IfAuthenticatedCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const div = appHost.querySelector('div') as HTMLElement;
    expect(div.style.display).toBe('none');
  });

  test('updates visibility when auth state changes via event', async () => {
    let authenticated = false;
    const authService = {
      isAuthenticated: jest.fn(() => authenticated),
    };
    const ea = new EventAggregator();

    const { appHost, startPromise } = createFixture(
      '<div if-authenticated>Dynamic</div>',
      {},
      [
        IfAuthenticatedCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const div = appHost.querySelector('div') as HTMLElement;
    expect(div.style.display).toBe('none');

    // Simulate login
    authenticated = true;
    ea.publish(AuthEvents.login, {});
    await Promise.resolve();

    expect(div.style.display).not.toBe('none');
  });

  test('reacts to logout event', async () => {
    let authenticated = true;
    const authService = {
      isAuthenticated: jest.fn(() => authenticated),
    };
    const ea = new EventAggregator();

    const { appHost, startPromise } = createFixture(
      '<div if-authenticated>Will Disappear</div>',
      {},
      [
        IfAuthenticatedCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const div = appHost.querySelector('div') as HTMLElement;
    expect(div.style.display).not.toBe('none');

    // Simulate logout
    authenticated = false;
    ea.publish(AuthEvents.logout);
    await Promise.resolve();

    expect(div.style.display).toBe('none');
  });

  test('reacts to tab-sync event', async () => {
    let authenticated = true;
    const authService = {
      isAuthenticated: jest.fn(() => authenticated),
    };
    const ea = new EventAggregator();

    const { appHost, startPromise } = createFixture(
      '<div if-authenticated>Synced</div>',
      {},
      [
        IfAuthenticatedCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const div = appHost.querySelector('div') as HTMLElement;
    expect(div.style.display).not.toBe('none');

    authenticated = false;
    ea.publish(AuthEvents.tabSync, { action: 'logout' });
    await Promise.resolve();

    expect(div.style.display).toBe('none');
  });

  test('works with multiple elements on the page', async () => {
    const authService = createAuthServiceStub(true);
    const ea = new EventAggregator();

    const { appHost, startPromise } = createFixture(
      `<div>
        <span if-authenticated class="auth-only">For Users</span>
        <span if-authenticated.bind="false" class="guest-only">For Guests</span>
      </div>`,
      {},
      [
        IfAuthenticatedCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const authOnly = appHost.querySelector('.auth-only') as HTMLElement;
    const guestOnly = appHost.querySelector('.guest-only') as HTMLElement;

    expect(authOnly.style.display).not.toBe('none');
    expect(guestOnly.style.display).toBe('none');
  });
});
