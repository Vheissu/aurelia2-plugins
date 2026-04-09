import { DI, Registration, EventAggregator, IEventAggregator } from '@aurelia/kernel';
import { IHttpClient } from '@aurelia/fetch-client';
import { IAuthOptions } from '../src/configuration';
import { AuthService } from '../src/auth-service';
import { IAuthentication } from '../src/authentication';
import { IOAuth1 } from '../src/oAuth1';
import { IOAuth2 } from '../src/oAuth2';

const createService = (payload: Record<string, unknown> | null, config?: Record<string, unknown>) => {
  const container = DI.createContainer();
  container.register(
    Registration.instance(IHttpClient, {} as IHttpClient),
    Registration.instance(IAuthentication, {
      tokenInterceptor: {},
      getPayload: () => payload,
      isAuthenticated: () => payload !== null,
      isTokenExpired: () => false,
      getToken: () => 'token',
      getRefreshToken: () => null,
      clearTokens: jest.fn(),
    } as unknown as IAuthentication),
    Registration.instance(IOAuth1, {} as IOAuth1),
    Registration.instance(IOAuth2, {} as IOAuth2),
    Registration.instance(IAuthOptions, {
      rolesProperty: 'roles',
      permissionsProperty: 'permissions',
      ...config,
    }),
    Registration.instance(IEventAggregator, new EventAggregator())
  );

  return container.invoke(AuthService);
};

describe('Role-based access control', () => {
  describe('getUserRoles', () => {
    test('returns roles array from token payload', () => {
      const service = createService({ roles: ['admin', 'editor'] });
      expect(service.getUserRoles()).toEqual(['admin', 'editor']);
    });

    test('wraps single string role into array', () => {
      const service = createService({ roles: 'admin' });
      expect(service.getUserRoles()).toEqual(['admin']);
    });

    test('returns empty array when no roles in payload', () => {
      const service = createService({ sub: 'user1' });
      expect(service.getUserRoles()).toEqual([]);
    });

    test('returns empty array when not authenticated', () => {
      const service = createService(null);
      expect(service.getUserRoles()).toEqual([]);
    });

    test('uses custom rolesProperty from config', () => {
      const service = createService(
        { groups: ['staff', 'moderator'] },
        { rolesProperty: 'groups' }
      );
      expect(service.getUserRoles()).toEqual(['staff', 'moderator']);
    });
  });

  describe('getUserPermissions', () => {
    test('returns permissions array from token payload', () => {
      const service = createService({ permissions: ['read', 'write'] });
      expect(service.getUserPermissions()).toEqual(['read', 'write']);
    });

    test('wraps single string permission into array', () => {
      const service = createService({ permissions: 'read' });
      expect(service.getUserPermissions()).toEqual(['read']);
    });

    test('returns empty array when no permissions in payload', () => {
      const service = createService({ sub: 'user1' });
      expect(service.getUserPermissions()).toEqual([]);
    });

    test('returns empty array when not authenticated', () => {
      const service = createService(null);
      expect(service.getUserPermissions()).toEqual([]);
    });

    test('uses custom permissionsProperty from config', () => {
      const service = createService(
        { scopes: ['api:read', 'api:write'] },
        { permissionsProperty: 'scopes' }
      );
      expect(service.getUserPermissions()).toEqual(['api:read', 'api:write']);
    });
  });

  describe('hasRole', () => {
    test('returns true when user has the role', () => {
      const service = createService({ roles: ['admin', 'editor'] });
      expect(service.hasRole('admin')).toBe(true);
    });

    test('returns false when user does not have the role', () => {
      const service = createService({ roles: ['editor'] });
      expect(service.hasRole('admin')).toBe(false);
    });

    test('returns false when not authenticated', () => {
      const service = createService(null);
      expect(service.hasRole('admin')).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    test('returns true when user has at least one matching role', () => {
      const service = createService({ roles: ['editor'] });
      expect(service.hasAnyRole(['admin', 'editor'])).toBe(true);
    });

    test('returns false when user has no matching roles', () => {
      const service = createService({ roles: ['viewer'] });
      expect(service.hasAnyRole(['admin', 'editor'])).toBe(false);
    });

    test('returns false for empty roles array', () => {
      const service = createService({ roles: ['admin'] });
      expect(service.hasAnyRole([])).toBe(false);
    });
  });

  describe('hasAllRoles', () => {
    test('returns true when user has all specified roles', () => {
      const service = createService({ roles: ['admin', 'editor', 'viewer'] });
      expect(service.hasAllRoles(['admin', 'editor'])).toBe(true);
    });

    test('returns false when user is missing a required role', () => {
      const service = createService({ roles: ['admin'] });
      expect(service.hasAllRoles(['admin', 'editor'])).toBe(false);
    });

    test('returns true for empty roles array', () => {
      const service = createService({ roles: ['admin'] });
      expect(service.hasAllRoles([])).toBe(true);
    });
  });

  describe('hasPermission', () => {
    test('returns true when user has the permission', () => {
      const service = createService({ permissions: ['read', 'write'] });
      expect(service.hasPermission('write')).toBe(true);
    });

    test('returns false when user does not have the permission', () => {
      const service = createService({ permissions: ['read'] });
      expect(service.hasPermission('delete')).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    test('returns true when user has at least one matching permission', () => {
      const service = createService({ permissions: ['read'] });
      expect(service.hasAnyPermission(['read', 'write'])).toBe(true);
    });

    test('returns false when user has no matching permissions', () => {
      const service = createService({ permissions: ['read'] });
      expect(service.hasAnyPermission(['write', 'delete'])).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    test('returns true when user has all specified permissions', () => {
      const service = createService({ permissions: ['read', 'write', 'delete'] });
      expect(service.hasAllPermissions(['read', 'write'])).toBe(true);
    });

    test('returns false when user is missing a required permission', () => {
      const service = createService({ permissions: ['read'] });
      expect(service.hasAllPermissions(['read', 'write'])).toBe(false);
    });
  });
});
