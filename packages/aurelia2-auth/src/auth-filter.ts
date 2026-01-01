import { valueConverter } from '@aurelia/runtime-html';

@valueConverter('auth-filter')
export class AuthFilterValueConverter {
  toView(routes, isAuthenticated) {
    if (!Array.isArray(routes)) {
      return routes;
    }

    return routes.filter(
      (route) =>
        route?.data?.auth === undefined || route?.data?.auth === isAuthenticated
    );
  }
}
