import { AuthorizeHook } from '../src/authorize-hook';
import { IRouter, RouteNode } from '@aurelia/router';
import { IAuthService } from '../src/auth-service';
import { IAuthConfigOptions } from '../src/configuration';
import { EventAggregator, IEventAggregator } from '@aurelia/kernel';
import { AuthEvents } from '../src/auth-events';

describe('AuthorizeHook role-based guards', () => {
  const createRouter = () => ({
    load: jest.fn((path: string) => path),
  }) as unknown as IRouter;

  const createAuth = (overrides?: Record<string, any>) =>
    ({
      isAuthenticated: () => true,
      getLoginRoute: () => '/login',
      setInitialUrl: jest.fn(),
      ...overrides,
    }) as AuthorizeHook['auth'];

  const createAuthService = (overrides?: Record<string, any>) =>
    ({
      hasAnyRole: jest.fn(() => false),
      hasAnyPermission: jest.fn(() => false),
      ...overrides,
    }) as unknown as IAuthService;

  const createConfig = (overrides?: Partial<IAuthConfigOptions>): IAuthConfigOptions => ({
    unauthorizedRoute: '/unauthorized',
    ...overrides,
  });

  const createRouteNode = (data?: Record<string, unknown>) =>
    ({ data }) as unknown as RouteNode;

  test('allows access when user has required role', () => {
    const router = createRouter();
    const authService = createAuthService({ hasAnyRole: jest.fn(() => true) });
    const ea = new EventAggregator();
    const hook = new AuthorizeHook(
      createAuth({ isAuthenticated: () => true }),
      authService,
      router,
      createConfig(),
      ea
    );

    const result = hook.canLoad(
      {} as any, {},
      createRouteNode({ auth: true, roles: ['admin'] }),
      null, {} as any
    );

    expect(result).toBe(true);
    expect(authService.hasAnyRole).toHaveBeenCalledWith(['admin']);
    expect(router.load).not.toHaveBeenCalled();
  });

  test('redirects to unauthorized when user lacks required role', () => {
    const router = createRouter();
    const authService = createAuthService({ hasAnyRole: jest.fn(() => false) });
    const ea = new EventAggregator();
    const hook = new AuthorizeHook(
      createAuth({ isAuthenticated: () => true }),
      authService,
      router,
      createConfig(),
      ea
    );

    const result = hook.canLoad(
      {} as any, {},
      createRouteNode({ auth: true, roles: ['admin'] }),
      null, {} as any
    );

    expect(authService.hasAnyRole).toHaveBeenCalledWith(['admin']);
    expect(router.load).toHaveBeenCalledWith('/unauthorized');
  });

  test('publishes forbidden event when role check fails', () => {
    const router = createRouter();
    const authService = createAuthService({ hasAnyRole: jest.fn(() => false) });
    const ea = new EventAggregator();
    const spy = jest.spyOn(ea, 'publish');
    const hook = new AuthorizeHook(
      createAuth({ isAuthenticated: () => true }),
      authService,
      router,
      createConfig(),
      ea
    );

    const routeNode = createRouteNode({ auth: true, roles: ['admin', 'superadmin'] });
    hook.canLoad({} as any, {}, routeNode, null, {} as any);

    expect(spy).toHaveBeenCalledWith(AuthEvents.forbidden, {
      requiredRoles: ['admin', 'superadmin'],
      route: routeNode,
    });
  });

  test('allows access when route has auth but no roles', () => {
    const router = createRouter();
    const authService = createAuthService();
    const ea = new EventAggregator();
    const hook = new AuthorizeHook(
      createAuth({ isAuthenticated: () => true }),
      authService,
      router,
      createConfig(),
      ea
    );

    const result = hook.canLoad(
      {} as any, {},
      createRouteNode({ auth: true }),
      null, {} as any
    );

    expect(result).toBe(true);
    expect(authService.hasAnyRole).not.toHaveBeenCalled();
  });

  test('redirects to login before checking roles when not authenticated', () => {
    const router = createRouter();
    const authService = createAuthService();
    const ea = new EventAggregator();
    const hook = new AuthorizeHook(
      createAuth({ isAuthenticated: () => false }),
      authService,
      router,
      createConfig(),
      ea
    );

    const result = hook.canLoad(
      {} as any, {},
      createRouteNode({ auth: true, roles: ['admin'] }),
      null, {} as any
    );

    expect(router.load).toHaveBeenCalledWith('/login');
    expect(authService.hasAnyRole).not.toHaveBeenCalled();
  });

  test('uses custom unauthorizedRoute from config', () => {
    const router = createRouter();
    const authService = createAuthService({ hasAnyRole: jest.fn(() => false) });
    const ea = new EventAggregator();
    const hook = new AuthorizeHook(
      createAuth({ isAuthenticated: () => true }),
      authService,
      router,
      createConfig({ unauthorizedRoute: '/forbidden' }),
      ea
    );

    hook.canLoad(
      {} as any, {},
      createRouteNode({ auth: true, roles: ['admin'] }),
      null, {} as any
    );

    expect(router.load).toHaveBeenCalledWith('/forbidden');
  });

  test('checks permissions when specified on route', () => {
    const router = createRouter();
    const authService = createAuthService({
      hasAnyRole: jest.fn(() => true),
      hasAnyPermission: jest.fn(() => false),
    });
    const ea = new EventAggregator();
    const hook = new AuthorizeHook(
      createAuth({ isAuthenticated: () => true }),
      authService,
      router,
      createConfig(),
      ea
    );

    hook.canLoad(
      {} as any, {},
      createRouteNode({ auth: true, permissions: ['manage:users'] }),
      null, {} as any
    );

    expect(authService.hasAnyPermission).toHaveBeenCalledWith(['manage:users']);
    expect(router.load).toHaveBeenCalledWith('/unauthorized');
  });

  test('publishes forbidden event with permissions when permission check fails', () => {
    const router = createRouter();
    const authService = createAuthService({ hasAnyPermission: jest.fn(() => false) });
    const ea = new EventAggregator();
    const spy = jest.spyOn(ea, 'publish');
    const hook = new AuthorizeHook(
      createAuth({ isAuthenticated: () => true }),
      authService,
      router,
      createConfig(),
      ea
    );

    const routeNode = createRouteNode({ auth: true, permissions: ['write', 'delete'] });
    hook.canLoad({} as any, {}, routeNode, null, {} as any);

    expect(spy).toHaveBeenCalledWith(AuthEvents.forbidden, {
      requiredPermissions: ['write', 'delete'],
      route: routeNode,
    });
  });

  test('allows access when user has both required roles and permissions', () => {
    const router = createRouter();
    const authService = createAuthService({
      hasAnyRole: jest.fn(() => true),
      hasAnyPermission: jest.fn(() => true),
    });
    const ea = new EventAggregator();
    const hook = new AuthorizeHook(
      createAuth({ isAuthenticated: () => true }),
      authService,
      router,
      createConfig(),
      ea
    );

    const result = hook.canLoad(
      {} as any, {},
      createRouteNode({ auth: true, roles: ['admin'], permissions: ['write'] }),
      null, {} as any
    );

    expect(result).toBe(true);
    expect(authService.hasAnyRole).toHaveBeenCalledWith(['admin']);
    expect(authService.hasAnyPermission).toHaveBeenCalledWith(['write']);
  });
});
