import { AuthorizeHook } from '../src/authorize-hook';
import { IRouter, RouteNode } from '@aurelia/router';
import { IAuthService } from '../src/auth-service';
import { IAuthConfigOptions } from '../src/configuration';
import { IEventAggregator, EventAggregator } from '@aurelia/kernel';

describe('AuthorizeHook', () => {
  const createRouter = () => ({
    load: jest.fn((path: string) => path),
  }) as unknown as IRouter;

  const createAuth = (overrides?: Record<string, any>) =>
    ({
      isAuthenticated: () => false,
      getLoginRoute: () => '/login',
      setInitialUrl: jest.fn(),
      ...overrides,
    }) as AuthorizeHook['auth'];

  const createAuthService = (overrides?: Record<string, any>) =>
    ({
      hasAnyRole: () => false,
      hasAnyPermission: () => false,
      ...overrides,
    }) as unknown as IAuthService;

  const createConfig = (overrides?: Partial<IAuthConfigOptions>): IAuthConfigOptions => ({
    unauthorizedRoute: '/unauthorized',
    ...overrides,
  });

  const createRouteNode = (data?: Record<string, unknown>) =>
    ({ data }) as unknown as RouteNode;

  const createHook = (opts?: {
    auth?: Record<string, any>;
    authService?: Record<string, any>;
    router?: IRouter;
    config?: Partial<IAuthConfigOptions>;
    window?: Window;
  }) => {
    const router = opts?.router ?? createRouter();
    const auth = createAuth(opts?.auth);
    const authService = createAuthService(opts?.authService);
    const config = createConfig(opts?.config);
    const ea = new EventAggregator();
    return {
      hook: new AuthorizeHook(auth, authService, router, config, ea, opts?.window),
      router,
      auth,
      authService,
      ea,
    };
  };

  test('allows navigation when route does not require auth', () => {
    const { hook, router, auth } = createHook({ auth: { isAuthenticated: () => false } });

    const result = hook.canLoad({} as any, {}, createRouteNode(), null, {} as any);

    expect(result).toBe(true);
    expect(router.load).not.toHaveBeenCalled();
    expect(auth.setInitialUrl).not.toHaveBeenCalled();
  });

  test('allows navigation when authenticated', () => {
    const { hook, router } = createHook({ auth: { isAuthenticated: () => true } });

    const result = hook.canLoad({} as any, {}, createRouteNode({ auth: true }), null, {} as any);

    expect(result).toBe(true);
    expect(router.load).not.toHaveBeenCalled();
  });

  test('redirects to login when unauthenticated and auth required', () => {
    const { hook, router, auth } = createHook({ auth: { isAuthenticated: () => false } });

    const result = hook.canLoad({} as any, {}, createRouteNode({ auth: true }), null, {} as any);

    expect(auth.setInitialUrl).not.toHaveBeenCalled();
    expect(router.load).toHaveBeenCalledWith('/login');
    expect(result).toBe('/login');
  });

  test('stores initial URL when window is available', () => {
    const windowMock = { location: { href: 'https://app.test/secure' } } as Window;
    const { hook, router, auth } = createHook({
      auth: { isAuthenticated: () => false },
      window: windowMock,
    });

    hook.canLoad({} as any, {}, createRouteNode({ auth: true }), null, {} as any);

    expect(auth.setInitialUrl).toHaveBeenCalledWith('https://app.test/secure');
    expect(router.load).toHaveBeenCalledWith('/login');
  });
});
