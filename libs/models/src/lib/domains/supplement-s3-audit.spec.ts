import { describe, expect, it } from 'vitest';
import {
  SUPPLEMENT_S3_DASHBOARD_AUTH,
  SUPPLEMENT_S3_DASHBOARD_SECTION_GATES,
  SUPPLEMENT_S3_DELEGATED_READS,
  SUPPLEMENT_S3_PAGINATED_READS,
  SUPPLEMENT_S3_PERMISSION_CATALOG,
  SUPPLEMENT_S3_RECORDED_GAPS,
  SUPPLEMENT_S3_RETIRED_PERMISSIONS,
  SUPPLEMENT_S3_ROUTE_GATES,
  SUPPLEMENT_S3_STILL_UNSUPPORTED_OPERATIONS,
  SUPPLEMENT_S3_SUPERADMIN_WRITES,
  SUPPLEMENT_S3_USER_LIST_FILTERS,
  canViewSupplementS3GrantSection,
  isSupplementS3DashboardSection,
  isSupplementS3DelegatedRead,
  isSupplementS3PaginatedRead,
  isSupplementS3Permission,
  isSupplementS3RecordedGap,
  isSupplementS3RetiredPermission,
  isSupplementS3StillUnsupportedOperation,
  isSupplementS3SuperAdminWrite,
  isValidSupplementS3IdQuery,
} from './supplement-s3-audit';

describe('supplement-s3-audit (Step S3.1 delta audit)', () => {
  describe('permission catalog v3 (API_CONTRACT.md §0.5)', () => {
    it('pins the nine catalog values', () => {
      expect([...SUPPLEMENT_S3_PERMISSION_CATALOG].sort()).toEqual(
        [
          'orders.read',
          'orders.cancel',
          'orders.refund',
          'payments.read',
          'payments.stats',
          'inventory.read',
          'inventory.manage',
          'catalog.manage',
          'users.read',
        ].sort(),
      );
    });

    it('retires users.manage and admins.create', () => {
      expect([...SUPPLEMENT_S3_RETIRED_PERMISSIONS].sort()).toEqual(
        ['admins.create', 'users.manage'].sort(),
      );
      expect(isSupplementS3Permission('users.read')).toBe(true);
      expect(isSupplementS3Permission('users.manage')).toBe(false);
      expect(isSupplementS3Permission('admins.create')).toBe(false);
      expect(isSupplementS3RetiredPermission('users.manage')).toBe(true);
      expect(isSupplementS3RetiredPermission('admins.create')).toBe(true);
      expect(isSupplementS3RetiredPermission('users.read')).toBe(false);
      expect(isSupplementS3RetiredPermission(null)).toBe(false);
    });
  });

  describe('re-centralized writes vs delegated reads', () => {
    it('pins the six SuperAdmin-only endpoints', () => {
      expect([...SUPPLEMENT_S3_SUPERADMIN_WRITES]).toEqual([
        'POST /auth/register-admin',
        'POST /admin/users/{id}/roles',
        'POST /admin/users/{id}/unlock',
        'POST /admin/users/{id}/permissions',
        'DELETE /admin/users/{id}/permissions/{permission}',
        'GET /admin/users/permissions',
      ]);
      expect(isSupplementS3SuperAdminWrite('POST /auth/register-admin')).toBe(true);
      expect(isSupplementS3SuperAdminWrite('GET /admin/users')).toBe(false);
      expect(isSupplementS3SuperAdminWrite(null)).toBe(false);
    });

    it('pins the four users.read-delegated reads', () => {
      expect([...SUPPLEMENT_S3_DELEGATED_READS]).toEqual([
        'GET /admin/users',
        'GET /admin/users/counts',
        'GET /admin/users/{id}',
        'GET /admin/users/{id}/permissions',
      ]);
      expect(isSupplementS3DelegatedRead('GET /admin/users')).toBe(true);
      expect(isSupplementS3DelegatedRead('POST /auth/register-admin')).toBe(false);
      expect(isSupplementS3DelegatedRead(null)).toBe(false);
    });
  });

  describe('dashboard v3 gates (API_CONTRACT.md §8)', () => {
    it('keeps any-JWT dashboard auth', () => {
      expect(SUPPLEMENT_S3_DASHBOARD_AUTH).toEqual({
        endpoint: 'GET /admin/dashboard',
        auth: 'authenticated',
      });
    });

    it('moves only the users section gate to users.read', () => {
      expect(SUPPLEMENT_S3_DASHBOARD_SECTION_GATES.users).toEqual({
        permissions: ['users.read'],
      });
      expect(SUPPLEMENT_S3_DASHBOARD_SECTION_GATES.orders).toEqual({
        permissions: ['orders.read'],
      });
      expect(SUPPLEMENT_S3_DASHBOARD_SECTION_GATES.payments).toEqual({
        permissions: ['payments.read', 'payments.stats'],
      });
      expect(isSupplementS3DashboardSection('users')).toBe(true);
      expect(isSupplementS3DashboardSection('nope')).toBe(false);
      expect(isSupplementS3DashboardSection(null)).toBe(false);
    });
  });

  describe('grant-visibility rule (re-centralized: SuperAdmin only)', () => {
    it('shows grant UI to SuperAdmin and nobody else', () => {
      expect(canViewSupplementS3GrantSection({ isSuperAdmin: true })).toBe(true);
      expect(canViewSupplementS3GrantSection({ isSuperAdmin: false })).toBe(false);
      expect(canViewSupplementS3GrantSection(null)).toBe(false);
      expect(canViewSupplementS3GrantSection(undefined)).toBe(false);
    });
  });

  describe('route gates, paging, and pins', () => {
    it('pins the mount and creation gates', () => {
      expect(SUPPLEMENT_S3_ROUTE_GATES).toEqual({
        usersMount: { permissions: ['users.read'] },
        usersNew: { roles: ['SuperAdmin'] },
      });
    });

    it('validates single-id queries structurally', () => {
      expect(isValidSupplementS3IdQuery({ id: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })).toBe(true);
      expect(isValidSupplementS3IdQuery({ id: '  ' })).toBe(false);
      expect(isValidSupplementS3IdQuery(null)).toBe(false);
      expect(isValidSupplementS3IdQuery(undefined)).toBe(false);
    });

    it('keeps users paging/filtering unchanged (no new surface)', () => {
      expect([...SUPPLEMENT_S3_PAGINATED_READS]).toEqual(['userList']);
      expect(isSupplementS3PaginatedRead('userList')).toBe(true);
      expect(isSupplementS3PaginatedRead('dashboard')).toBe(false);
      expect(isSupplementS3PaginatedRead(null)).toBe(false);
      expect([...SUPPLEMENT_S3_USER_LIST_FILTERS]).toEqual(['status', 'role', 'search']);
    });

    it('records still-unsupported operations (incl. delegated writes)', () => {
      expect([...SUPPLEMENT_S3_STILL_UNSUPPORTED_OPERATIONS]).toContain('delegated-user-writes');
      expect(isSupplementS3StillUnsupportedOperation('webhook-spa-call')).toBe(true);
      expect(isSupplementS3StillUnsupportedOperation('dashboard-snapshot')).toBe(false);
      expect(isSupplementS3StillUnsupportedOperation(null)).toBe(false);
    });

    it('records the S3 contract notes', () => {
      expect([...SUPPLEMENT_S3_RECORDED_GAPS].sort()).toEqual(
        [
          'catalog-doc-superadmin-note',
          'dashboard-users-read-gate',
          'forbidden-code-retired',
          'user-response-permissions-authoritative',
        ].sort(),
      );
      expect(isSupplementS3RecordedGap('forbidden-code-retired')).toBe(true);
      expect(isSupplementS3RecordedGap('nope')).toBe(false);
    });
  });
});
