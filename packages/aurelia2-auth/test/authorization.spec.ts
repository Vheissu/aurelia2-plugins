import { Registration } from '@aurelia/kernel';
import { Authentication, IAuthentication } from '../src/authentication';
import { AuthorizationService } from '../src/authorization';
import {
  authenticated,
  getAuthorizationMetadata,
  permissions,
  roles,
} from '../src/decorators';
import { createJwt, createUnitContainer } from './helpers';

describe('AuthorizationService', () => {
  function create(overrides = {}) {
    const setup = createUnitContainer(overrides);
    const auth = setup.container.invoke(Authentication);
    setup.container.register(Registration.instance(IAuthentication, auth));
    return { ...setup, auth, authorization: setup.container.invoke(AuthorizationService) };
  }

  test('evaluates roles, space-delimited scopes and nested claims', () => {
    const { auth, authorization } = create({
      rolesProperty: ['realm.roles', 'roles'],
      permissionsProperty: ['scope'],
    });
    auth.setToken(createJwt({
      exp: Math.floor(Date.now() / 1000) + 60,
      realm: { roles: ['admin', 'editor'] },
      scope: 'posts:read posts:write',
      tenant: { plan: 'pro' },
    }));

    expect(authorization.evaluateSync({
      roles: ['admin'],
      permissions: ['posts:write'],
      claims: { 'tenant.plan': 'pro' },
    })).toEqual({ allowed: true });
    expect(authorization.evaluateSync({ roles: ['owner'] })).toMatchObject({
      allowed: false,
      reason: 'role',
    });
  });

  test('supports any and all matching without weakening separate requirements', () => {
    const { auth, authorization } = create();
    auth.setToken(createJwt({
      exp: Math.floor(Date.now() / 1000) + 60,
      roles: ['editor'],
      permissions: ['read'],
    }));

    expect(authorization.evaluateSync({ roles: ['admin', 'editor'] }).allowed).toBe(true);
    expect(authorization.evaluateSync({ roles: ['admin', 'editor'], match: 'all' }).allowed).toBe(false);
    expect(authorization.evaluateSync({
      roles: ['editor'],
      permissions: ['write'],
    })).toMatchObject({ allowed: false, reason: 'permission' });
  });

  test('awaits named policies with the current session and resource', async () => {
    const policy = jest.fn(({ session, resource }) =>
      session.claims?.sub === 'user-1' && resource === 'invoice-1');
    const { auth, authorization } = create({ policies: { ownsInvoice: policy } });
    auth.setToken(createJwt({
      exp: Math.floor(Date.now() / 1000) + 60,
      sub: 'user-1',
    }));

    await expect(authorization.evaluate({ policies: ['ownsInvoice'] }, 'invoice-1'))
      .resolves.toEqual({ allowed: true });
    await expect(authorization.evaluate({ policies: ['ownsInvoice'] }, 'invoice-2'))
      .resolves.toMatchObject({ allowed: false, reason: 'policy' });
    expect(policy).toHaveBeenCalledTimes(2);
  });

  test('composes TC39 class decorators into immutable route metadata', () => {
    @authenticated()
    @roles('admin')
    @permissions('reports:read')
    class ReportsPage {}

    const requirement = getAuthorizationMetadata(new ReportsPage());
    expect(requirement).toEqual({
      authenticated: true,
      roles: ['admin'],
      permissions: ['reports:read'],
      policies: undefined,
      claims: undefined,
    });
    expect(Object.isFrozen(requirement)).toBe(true);
    expect(Object.isFrozen(requirement?.roles)).toBe(true);
  });
});
