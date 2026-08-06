import { IEventAggregator, resolve } from '@aurelia/kernel';
import { lifecycleHooks, type ILifecycleHooks } from '@aurelia/runtime-html';
import type {
  INavigationOptions,
  IRouteViewModel,
  NavigationInstruction,
  Params,
  RouteNode,
} from '@aurelia/router';
import type { IAuthorizationRequirement } from './configuration';
import { IAuthOptions } from './configuration';
import { IAuthentication } from './authentication';
import { IAuthorizationService } from './authorization';
import { AuthEvents } from './auth-events';
import {
  getAuthorizationMetadata,
  mergeRequirements,
} from './decorators';

export const authorizationRouteDataKey = 'authorization';

@lifecycleHooks()
export class AuthorizeHook implements ILifecycleHooks<IRouteViewModel, 'canLoad'> {
  private readonly auth = resolve(IAuthentication);
  private readonly authorization = resolve(IAuthorizationService);
  private readonly config = resolve(IAuthOptions);
  private readonly events = resolve(IEventAggregator);

  public async canLoad(
    viewModel: IRouteViewModel,
    _params: Params,
    next: RouteNode,
    _current: RouteNode | null,
    _options: INavigationOptions,
  ): Promise<boolean | NavigationInstruction | NavigationInstruction[]> {
    const requirement = mergeRequirements(
      mergeRequirements(
        getAuthorizationMetadata(next.component.Type),
        getAuthorizationMetadata(viewModel),
      ),
      getRouteRequirement(next.data),
    );
    const decision = await this.authorization.evaluate(requirement, next);
    if (decision.allowed) return true;

    if (decision.reason === 'anonymous') {
      this.auth.setInitialUrl(routeUrl(next));
      this.events.publish(AuthEvents.unauthorized, { decision, route: next });
      return navigationInstruction(requirement.redirectTo ?? this.auth.getLoginRoute());
    }

    if (decision.reason === 'authenticated-only') {
      return navigationInstruction(requirement.redirectTo ?? this.config.authenticatedRoute ?? '/');
    }

    this.events.publish(AuthEvents.forbidden, { decision, route: next });
    return navigationInstruction(requirement.forbiddenRedirectTo
      ?? this.config.unauthorizedRoute
      ?? '/unauthorized');
  }
}

export function createAuthorizationRouteData(
  requirement: Readonly<IAuthorizationRequirement>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({ [authorizationRouteDataKey]: Object.freeze({ ...requirement }) });
}

export function getRouteRequirement(
  data: Readonly<Record<string, unknown>> | null | undefined,
): IAuthorizationRequirement {
  if (!data) return {};
  const modern = isRequirement(data[authorizationRouteDataKey])
    ? data[authorizationRouteDataKey]
    : isRequirement(data.auth) ? data.auth : undefined;
  const legacy: IAuthorizationRequirement = {
    authenticated: data.auth === true ? true : undefined,
    roles: stringArray(data.roles),
    permissions: stringArray(data.permissions),
    policies: stringArray(data.policies),
  };
  return mergeRequirements(legacy, modern);
}

function routeUrl(node: RouteNode): string {
  const path = node.finalPath.startsWith('/') ? node.finalPath : `/${node.finalPath}`;
  const query = node.queryParams.toString();
  const fragment = node.fragment ? `#${node.fragment}` : '';
  return `${path}${query ? `?${query}` : ''}${fragment}`;
}

function isRequirement(value: unknown): value is IAuthorizationRequirement {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringArray(value: unknown): readonly string[] | undefined {
  if (Array.isArray(value)) {
    const values = value.filter((entry): entry is string => typeof entry === 'string');
    return values.length ? values : undefined;
  }
  return typeof value === 'string'
    ? value.split(',').map(entry => entry.trim()).filter(Boolean)
    : undefined;
}

function navigationInstruction(value: string): string {
  return value === '/' ? '' : value.replace(/^\/+/, '');
}
