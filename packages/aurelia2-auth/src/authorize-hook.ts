import { lifecycleHooks, ILifecycleHooks, IWindow } from '@aurelia/runtime-html';
import { inject, optional, IEventAggregator } from '@aurelia/kernel';
import { IRouter, IRouteViewModel, INavigationOptions, Params, RouteNode } from '@aurelia/router';
import { IAuthentication } from './authentication';
import { IAuthService } from './auth-service';
import { IAuthOptions, IAuthConfigOptions } from './configuration';
import { AuthEvents } from './auth-events';

@lifecycleHooks()
@inject(IAuthentication, IAuthService, IRouter, IAuthOptions, IEventAggregator, optional(IWindow))
export class AuthorizeHook implements ILifecycleHooks {
  constructor(
    readonly auth: IAuthentication,
    private readonly authService: IAuthService,
    private router: IRouter,
    private config: IAuthConfigOptions,
    private ea: IEventAggregator,
    private window?: IWindow
  ) {}

  canLoad(
    _vm: IRouteViewModel,
    _params: Params,
    next: RouteNode,
    _current: RouteNode | null,
    _options: INavigationOptions
  ) {
    const isLoggedIn = this.auth.isAuthenticated();
    const loginRoute = this.auth.getLoginRoute();
    const requiresAuth = next?.data?.auth;
    const requiredRoles = next?.data?.roles as string[] | undefined;
    const requiredPermissions = next?.data?.permissions as string[] | undefined;

    // Route requires authentication
    if (requiresAuth) {
      if (!isLoggedIn) {
        if (this.window?.location) {
          this.auth.setInitialUrl(this.window.location.href);
        }
        return this.router.load(loginRoute);
      }

      // Check roles if specified
      if (requiredRoles && requiredRoles.length > 0) {
        if (!this.authService.hasAnyRole(requiredRoles)) {
          this.ea.publish(AuthEvents.forbidden, { requiredRoles, route: next });
          const unauthorizedRoute = this.config.unauthorizedRoute ?? '/unauthorized';
          return this.router.load(unauthorizedRoute);
        }
      }

      // Check permissions if specified
      if (requiredPermissions && requiredPermissions.length > 0) {
        if (!this.authService.hasAnyPermission(requiredPermissions)) {
          this.ea.publish(AuthEvents.forbidden, { requiredPermissions, route: next });
          const unauthorizedRoute = this.config.unauthorizedRoute ?? '/unauthorized';
          return this.router.load(unauthorizedRoute);
        }
      }
    }

    return true;
  }
}
