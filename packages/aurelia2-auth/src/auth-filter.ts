import { resolve } from '@aurelia/kernel';
import { valueConverter } from '@aurelia/runtime-html';
import { IAuthorizationService } from './authorization';
import { getRouteRequirement } from './authorize-hook';

interface IRouteLike {
  data?: Readonly<Record<string, unknown>>;
}

@valueConverter('auth-filter')
export class AuthFilterValueConverter {
  private readonly authorization = resolve(IAuthorizationService);

  public toView<T extends IRouteLike>(routes: readonly T[], authenticated?: boolean): readonly T[] {
    if (!Array.isArray(routes)) return routes;
    return routes.filter(route => {
      if (typeof authenticated === 'boolean' && typeof route.data?.auth === 'boolean') {
        return route.data.auth === authenticated;
      }
      return this.authorization.evaluateSync(getRouteRequirement(route.data)).allowed;
    });
  }
}
