import { lifecycleHooks, ILifecycleHooks } from '@aurelia/runtime-html';
import { IRouter } from '@aurelia/router';
import { IAuthentication } from './authentication';

@lifecycleHooks()
export class AuthorizeHook implements ILifecycleHooks {
  constructor(@IAuthentication readonly auth: IAuthentication, @IRouter private router: IRouter) {

  }

  canLoad(vm, params, next, current) {
    let isLoggedIn = this.auth.isAuthenticated();
    let loginRoute = this.auth.getLoginRoute();

    if (next?.data?.auth) {
      if (!isLoggedIn) {
        this.auth.setInitialUrl(window.location.href);
        return this.router.load(loginRoute);
      }
    }

    return true;
  }
}
