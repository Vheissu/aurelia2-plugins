import { DI, resolve } from '@aurelia/kernel';
import type {
  IAuthorizationContext,
  IAuthorizationDecision,
  IAuthorizationRequirement,
  IJwtClaims,
} from './configuration';
import { IAuthOptions } from './configuration';
import { IAuthentication } from './authentication';

export interface IAuthorizationService {
  evaluate(requirement?: IAuthorizationRequirement, resource?: unknown): Promise<IAuthorizationDecision>;
  evaluateSync(requirement?: IAuthorizationRequirement, resource?: unknown): IAuthorizationDecision;
  hasRole(role: string): boolean;
  hasAnyRole(roles: readonly string[]): boolean;
  hasAllRoles(roles: readonly string[]): boolean;
  hasPermission(permission: string): boolean;
  hasAnyPermission(permissions: readonly string[]): boolean;
  hasAllPermissions(permissions: readonly string[]): boolean;
  getRoles(): readonly string[];
  getPermissions(): readonly string[];
}

export const IAuthorizationService = DI.createInterface<IAuthorizationService>(
  'IAuthorizationService',
  x => x.singleton(AuthorizationService),
);

export class AuthorizationService implements IAuthorizationService {
  private readonly auth = resolve(IAuthentication);
  private readonly config = resolve(IAuthOptions);

  public async evaluate(
    requirement: IAuthorizationRequirement = {},
    resource?: unknown,
  ): Promise<IAuthorizationDecision> {
    const basic = this.evaluateSync(requirement, resource);
    if (!basic.allowed) return basic;

    const policies = requirement.policies ?? [];
    const failed: string[] = [];
    const context: IAuthorizationContext = {
      requirement,
      session: this.auth.session,
      resource,
    };

    for (const name of policies) {
      const policy = this.config.policies?.[name];
      if (!policy || !await policy(context)) failed.push(name);
    }

    return failed.length > 0
      ? { allowed: false, reason: 'policy', failed }
      : { allowed: true };
  }

  public evaluateSync(
    requirement: IAuthorizationRequirement = {},
    _resource?: unknown,
  ): IAuthorizationDecision {
    const authenticated = this.auth.isAuthenticated();
    if (requirement.anonymousOnly && authenticated) {
      return { allowed: false, reason: 'authenticated-only' };
    }

    const needsAuthentication = requirement.authenticated === true
      || hasAuthorizationRules(requirement);
    if (needsAuthentication && !authenticated) {
      return { allowed: false, reason: 'anonymous' };
    }
    if (requirement.authenticated === false && authenticated) {
      return { allowed: false, reason: 'authenticated-only' };
    }

    const all = requirement.match === 'all';
    if (requirement.roles?.length) {
      const allowed = all
        ? this.hasAllRoles(requirement.roles)
        : this.hasAnyRole(requirement.roles);
      if (!allowed) return { allowed: false, reason: 'role', failed: requirement.roles };
    }

    if (requirement.permissions?.length) {
      const allowed = all
        ? this.hasAllPermissions(requirement.permissions)
        : this.hasAnyPermission(requirement.permissions);
      if (!allowed) {
        return { allowed: false, reason: 'permission', failed: requirement.permissions };
      }
    }

    if (requirement.claims && !matchesClaims(this.auth.getPayload(), requirement.claims, all)) {
      return { allowed: false, reason: 'claim', failed: Object.keys(requirement.claims) };
    }

    return { allowed: true };
  }

  public getRoles(): readonly string[] {
    return readClaimValues(this.auth.getPayload(), this.config.rolesProperty ?? ['roles', 'role']);
  }

  public getPermissions(): readonly string[] {
    return readClaimValues(
      this.auth.getPayload(),
      this.config.permissionsProperty ?? ['permissions', 'scope'],
      true,
    );
  }

  public hasRole(role: string): boolean {
    return this.getRoles().includes(role);
  }

  public hasAnyRole(roles: readonly string[]): boolean {
    const current = this.getRoles();
    return roles.some(role => current.includes(role));
  }

  public hasAllRoles(roles: readonly string[]): boolean {
    const current = this.getRoles();
    return roles.every(role => current.includes(role));
  }

  public hasPermission(permission: string): boolean {
    return this.getPermissions().includes(permission);
  }

  public hasAnyPermission(permissions: readonly string[]): boolean {
    const current = this.getPermissions();
    return permissions.some(permission => current.includes(permission));
  }

  public hasAllPermissions(permissions: readonly string[]): boolean {
    const current = this.getPermissions();
    return permissions.every(permission => current.includes(permission));
  }
}

function hasAuthorizationRules(requirement: IAuthorizationRequirement): boolean {
  return Boolean(
    requirement.roles?.length
    || requirement.permissions?.length
    || Object.keys(requirement.claims ?? {}).length
    || requirement.policies?.length,
  );
}

function readClaimValues(
  claims: IJwtClaims | null,
  paths: string | readonly string[],
  splitWhitespace = false,
): readonly string[] {
  if (!claims) return [];
  const values = new Set<string>();
  for (const path of typeof paths === 'string' ? [paths] : paths) {
    const value = readPath(claims, path);
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (typeof entry !== 'string') continue;
      const parts = splitWhitespace ? entry.split(/\s+/) : [entry];
      for (const part of parts) if (part) values.add(part);
    }
  }
  return [...values];
}

function readPath(value: Readonly<Record<string, unknown>>, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (current, key) => current !== null && typeof current === 'object'
      ? (current as Record<string, unknown>)[key]
      : undefined,
    value,
  );
}

function matchesClaims(
  claims: IJwtClaims | null,
  expected: Readonly<Record<string, unknown | readonly unknown[]>>,
  all: boolean,
): boolean {
  if (!claims) return false;
  return Object.entries(expected).every(([path, expectedValue]) => {
    const actual = readPath(claims, path);
    const expectedValues = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
    const actualValues = Array.isArray(actual) ? actual : [actual];
    return all
      ? expectedValues.every(value => actualValues.includes(value))
      : expectedValues.some(value => actualValues.includes(value));
  });
}
