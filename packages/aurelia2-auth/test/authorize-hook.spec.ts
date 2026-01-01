import { AuthorizeHook } from '../src/authorize-hook';
import { IRouter, RouteNode } from '@aurelia/router';

describe('AuthorizeHook', () => {
  const createRouter = () => ({
    load: jest.fn((path: string) => path),
  }) as unknown as IRouter;

  const createAuth = (overrides?: Partial<AuthorizeHook['auth']>) =>
    ({
      isAuthenticated: () => false,
      getLoginRoute: () => '/login',
      setInitialUrl: jest.fn(),
      ...overrides,
    }) as AuthorizeHook['auth'];

  const createRouteNode = (auth?: boolean) =>
    ({
      data: auth === undefined ? undefined : { auth },
    }) as unknown as RouteNode;

  test('allows navigation when route does not require auth', () => {
    const router = createRouter();
    const auth = createAuth({ isAuthenticated: () => false });
    const hook = new AuthorizeHook(auth, router);

    const result = hook.canLoad({} as any, {}, createRouteNode(), null, {} as any);

    expect(result).toBe(true);
    expect(router.load).not.toHaveBeenCalled();
    expect(auth.setInitialUrl).not.toHaveBeenCalled();
  });

  test('allows navigation when authenticated', () => {
    const router = createRouter();
    const auth = createAuth({ isAuthenticated: () => true });
    const hook = new AuthorizeHook(auth, router);

    const result = hook.canLoad({} as any, {}, createRouteNode(true), null, {} as any);

    expect(result).toBe(true);
    expect(router.load).not.toHaveBeenCalled();
  });

  test('redirects to login when unauthenticated and auth required', () => {
    const router = createRouter();
    const auth = createAuth({ isAuthenticated: () => false });
    const hook = new AuthorizeHook(auth, router);

    const result = hook.canLoad({} as any, {}, createRouteNode(true), null, {} as any);

    expect(auth.setInitialUrl).not.toHaveBeenCalled();
    expect(router.load).toHaveBeenCalledWith('/login');
    expect(result).toBe('/login');
  });

  test('stores initial URL when window is available', () => {
    const router = createRouter();
    const auth = createAuth({ isAuthenticated: () => false });
    const windowMock = { location: { href: 'https://app.test/secure' } } as Window;
    const hook = new AuthorizeHook(auth, router, windowMock);

    hook.canLoad({} as any, {}, createRouteNode(true), null, {} as any);

    expect(auth.setInitialUrl).toHaveBeenCalledWith('https://app.test/secure');
    expect(router.load).toHaveBeenCalledWith('/login');
  });
});
