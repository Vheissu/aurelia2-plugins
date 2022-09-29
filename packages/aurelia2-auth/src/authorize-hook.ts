import { lifecycleHooks } from '@aurelia/runtime-html';
import { IRouter } from '@aurelia/router';
import { Authentication } from './authentication';

@lifecycleHooks()
export class AuthorizeHook {
  constructor(private auth: Authentication, @IRouter private router: IRouter) {
    this.auth = auth;
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
