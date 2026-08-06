import type { IAuthorizationRequirement } from './configuration';

type Class = abstract new (...args: never[]) => unknown;
type AuthClassDecorator = <T extends Class>(target: T, context: ClassDecoratorContext<T>) => T;

const metadata = new WeakMap<object, Readonly<IAuthorizationRequirement>>();

export function authorize(requirement: Readonly<IAuthorizationRequirement> = {}): AuthClassDecorator {
  return function <T extends Class>(target: T, _context: ClassDecoratorContext<T>): T {
    metadata.set(target, freezeRequirement(mergeRequirements(metadata.get(target), requirement)));
    return target;
  };
}

export function authenticated(): AuthClassDecorator {
  return authorize({ authenticated: true });
}

export function anonymousOnly(): AuthClassDecorator {
  return authorize({ anonymousOnly: true });
}

export function roles(...values: string[]): AuthClassDecorator {
  return authorize({ roles: values });
}

export function permissions(...values: string[]): AuthClassDecorator {
  return authorize({ permissions: values });
}

export function policy(...names: string[]): AuthClassDecorator {
  return authorize({ policies: names });
}

export function claims(values: Readonly<Record<string, unknown | readonly unknown[]>>): AuthClassDecorator {
  return authorize({ claims: values });
}

export function getAuthorizationMetadata(
  value: object | null | undefined,
): Readonly<IAuthorizationRequirement> | undefined {
  if (!value) return undefined;
  let type: object | null = typeof value === 'function' ? value : value.constructor;
  let result: IAuthorizationRequirement | undefined;
  while (type && type !== Function.prototype) {
    result = mergeRequirements(result, metadata.get(type));
    type = Object.getPrototypeOf(type);
  }
  return result ? freezeRequirement(result) : undefined;
}

export function mergeRequirements(
  first?: Readonly<IAuthorizationRequirement>,
  second?: Readonly<IAuthorizationRequirement>,
): IAuthorizationRequirement {
  if (!first) return { ...second };
  if (!second) return { ...first };
  return {
    ...first,
    ...second,
    roles: union(first.roles, second.roles),
    permissions: union(first.permissions, second.permissions),
    policies: union(first.policies, second.policies),
    claims: first.claims || second.claims
      ? { ...first.claims, ...second.claims }
      : undefined,
  };
}

function union(first?: readonly string[], second?: readonly string[]): readonly string[] | undefined {
  return first || second ? [...new Set([...(first ?? []), ...(second ?? [])])] : undefined;
}

function freezeRequirement(requirement: IAuthorizationRequirement): Readonly<IAuthorizationRequirement> {
  return Object.freeze({
    ...requirement,
    roles: requirement.roles ? Object.freeze([...requirement.roles]) : undefined,
    permissions: requirement.permissions ? Object.freeze([...requirement.permissions]) : undefined,
    policies: requirement.policies ? Object.freeze([...requirement.policies]) : undefined,
    claims: requirement.claims ? Object.freeze({ ...requirement.claims }) : undefined,
  });
}
