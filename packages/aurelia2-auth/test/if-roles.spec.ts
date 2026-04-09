import { createFixture, onFixtureCreated } from '@aurelia/testing';
import { Registration, EventAggregator, IEventAggregator } from '@aurelia/kernel';
import { IfRolesCustomAttribute } from '../src/if-roles';
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

describe('IfRolesCustomAttribute', () => {
  test('shows element when user has matching role', async () => {
    const authService = {
      hasAnyRole: jest.fn((roles: string[]) => roles.includes('admin')),
      hasAllRoles: jest.fn(() => true),
    };
    const ea = new EventAggregator();

    const { appHost, startPromise } = createFixture(
      '<div if-roles="admin">Admin Panel</div>',
      {},
      [
        IfRolesCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const div = appHost.querySelector('div') as HTMLElement;
    expect(div.style.display).not.toBe('none');
    expect(div.textContent).toBe('Admin Panel');
  });

  test('hides element when user lacks required role', async () => {
    const authService = {
      hasAnyRole: jest.fn(() => false),
      hasAllRoles: jest.fn(() => false),
    };
    const ea = new EventAggregator();

    const { appHost, startPromise } = createFixture(
      '<div if-roles="admin">Admin Only</div>',
      {},
      [
        IfRolesCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const div = appHost.querySelector('div') as HTMLElement;
    expect(div.style.display).toBe('none');
  });

  test('supports comma-separated role list', async () => {
    const authService = {
      hasAnyRole: jest.fn((roles: string[]) => roles.includes('editor')),
      hasAllRoles: jest.fn(() => false),
    };
    const ea = new EventAggregator();

    const { appHost, startPromise } = createFixture(
      '<div if-roles="admin,editor,moderator">Content</div>',
      {},
      [
        IfRolesCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const div = appHost.querySelector('div') as HTMLElement;
    expect(div.style.display).not.toBe('none');
    expect(authService.hasAnyRole).toHaveBeenCalledWith(['admin', 'editor', 'moderator']);
  });

  test('supports bound array of roles', async () => {
    const authService = {
      hasAnyRole: jest.fn((roles: string[]) => roles.includes('admin')),
      hasAllRoles: jest.fn(() => true),
    };
    const ea = new EventAggregator();

    const { appHost, startPromise } = createFixture(
      '<div if-roles.bind="requiredRoles">Content</div>',
      { requiredRoles: ['admin', 'superadmin'] },
      [
        IfRolesCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const div = appHost.querySelector('div') as HTMLElement;
    expect(div.style.display).not.toBe('none');
    expect(authService.hasAnyRole).toHaveBeenCalledWith(['admin', 'superadmin']);
  });

  test('shows element when no roles specified', async () => {
    const authService = {
      hasAnyRole: jest.fn(() => false),
      hasAllRoles: jest.fn(() => false),
    };
    const ea = new EventAggregator();

    const { appHost, startPromise } = createFixture(
      '<div if-roles="">Always Visible</div>',
      {},
      [
        IfRolesCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const div = appHost.querySelector('div') as HTMLElement;
    expect(div.style.display).not.toBe('none');
  });

  test('uses "all" mode to require all roles', async () => {
    const authService = {
      hasAnyRole: jest.fn(() => true),
      hasAllRoles: jest.fn(() => false),
    };
    const ea = new EventAggregator();

    const { appHost, startPromise } = createFixture(
      '<div if-roles="value.bind: roles; mode.bind: matchMode">Needs Both</div>',
      { roles: ['admin', 'editor'], matchMode: 'all' },
      [
        IfRolesCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const div = appHost.querySelector('div') as HTMLElement;
    expect(div.style.display).toBe('none');
    expect(authService.hasAllRoles).toHaveBeenCalledWith(['admin', 'editor']);
  });

  test('updates visibility when auth event fires', async () => {
    let hasRole = false;
    const authService = {
      hasAnyRole: jest.fn(() => hasRole),
      hasAllRoles: jest.fn(() => hasRole),
    };
    const ea = new EventAggregator();

    const { appHost, startPromise } = createFixture(
      '<div if-roles="admin">Dynamic</div>',
      {},
      [
        IfRolesCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const div = appHost.querySelector('div') as HTMLElement;
    expect(div.style.display).toBe('none');

    // Simulate gaining admin role after login
    hasRole = true;
    ea.publish(AuthEvents.login, {});
    await Promise.resolve();

    expect(div.style.display).not.toBe('none');
  });

  test('works alongside if-authenticated on sibling elements', async () => {
    const authService = {
      isAuthenticated: jest.fn(() => true),
      hasAnyRole: jest.fn((roles: string[]) => roles.includes('editor')),
      hasAllRoles: jest.fn(() => false),
    };
    const ea = new EventAggregator();

    // We need both attributes registered
    const { IfAuthenticatedCustomAttribute } = await import('../src/if-authenticated');

    const { appHost, startPromise } = createFixture(
      `<div>
        <span if-roles="admin" class="admin-content">Admin</span>
        <span if-roles="editor" class="editor-content">Editor</span>
      </div>`,
      {},
      [
        IfRolesCustomAttribute,
        IfAuthenticatedCustomAttribute,
        Registration.instance(IAuthService, authService),
        Registration.instance(IEventAggregator, ea),
      ]
    );

    await startPromise;
    await Promise.resolve();

    const adminContent = appHost.querySelector('.admin-content') as HTMLElement;
    const editorContent = appHost.querySelector('.editor-content') as HTMLElement;

    expect(adminContent.style.display).toBe('none');
    expect(editorContent.style.display).not.toBe('none');
  });
});
