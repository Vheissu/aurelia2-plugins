import { valueConverter } from '@aurelia/runtime-html';

@valueConverter('auth-filter')
export class AuthFilterValueConverter {
  toView(routes, isAuthenticated) {
    return routes.filter(
      (r) => !r?.data?.auth === undefined || r?.data?.auth === isAuthenticated
    );
  }
}
