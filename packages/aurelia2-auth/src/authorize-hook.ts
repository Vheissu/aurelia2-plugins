import { lifecycleHooks, ILifecycleHooks, IWindow } from '@aurelia/runtime-html';
import { inject, optional } from '@aurelia/kernel';
import { IRouter, IRouteViewModel, INavigationOptions, Params, RouteNode } from '@aurelia/router';
import { IAuthentication } from './authentication';
 
@lifecycleHooks()
@inject(IAuthentication, IRouter, optional(IWindow))
export class AuthorizeHook implements ILifecycleHooks {
  constructor(
    readonly auth: IAuthentication,
    private router: IRouter,
    private window?: IWindow
  ) {

  }
 
  canLoad(
    _vm: IRouteViewModel,
    _params: Params,
    next: RouteNode,
    _current: RouteNode | null,
    _options: INavigationOptions
  ) { 
    let isLoggedIn = this.auth.isAuthenticated(); 
    let loginRoute = this.auth.getLoginRoute(); 
 
    if (next?.data?.auth) { 
      if (!isLoggedIn) { 
        if (this.window?.location) { 
          this.auth.setInitialUrl(this.window.location.href); 
        } 
        return this.router.load(loginRoute); 
      } 
    } 
 
    return true; 
  } 
} 
