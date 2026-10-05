import { describe, expect, it } from 'vitest';
import {
  SUPPLEMENT_S2_DASHBOARD_AUTH,
  SUPPLEMENT_S2_DASHBOARD_SECTION_GATES,
  SUPPLEMENT_S2_ERROR_CODES,
  SUPPLEMENT_S2_PAGINATED_READS,
  SUPPLEMENT_S2_PERMISSION_CATALOG,
  SUPPLEMENT_S2_PERMISSION_ENDPOINTS,
  SUPPLEMENT_S2_READ_FILTERS,
  SUPPLEMENT_S2_RECORDED_GAPS,
  SUPPLEMENT_S2_REMOVED_PERMISSIONS,
  SUPPLEMENT_S2_ROUTES,
  SUPPLEMENT_S2_STILL_UNSUPPORTED_OPERATIONS,
  canViewSupplementS2GrantSection,
  isSupplementS2AuthFailure,
  isSupplementS2ConflictFailure,
  isSupplementS2DashboardSection,
  isSupplementS2ErrorCode,
  isSupplementS2ForbiddenFailure,
  isSupplementS2MatrixPermission,
  isSupplementS2NotFoundFailure,
  isSupplementS2PaginatedRead,
  isSupplementS2Permission,
  isSupplementS2RecordedGap,
  isSupplementS2RemovedPermission,
  isSupplementS2Route,
  isSupplementS2StillUnsupportedOperation,
  isSupplementS2ValidationFailure,
  isValidSupplementS2CatalogCounts,
  isValidSupplementS2IdQuery,
  supplementS2ForbiddenNextStep,
  supportsSupplementS2Filtering,
  supportsSupplementS2Sorting,
} from './supplement-s2-audit';

describe('supplement-s2-audit (Step S2.1 audit)', () => {
  describe('permission catalog v2 (API_CONTRACT.md §0.5)', () => {
    it('pins all eleven catalog values', () => {
      expect([...SUPPLEMENT_S2_PERMISSION_CATALOG].sort()).toEqual(
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
          'users.manage',
          'admins.create',
        ].sort(),
      );
    });

    it('drops dashboard.read from the catalog', () => {
      expect([...SUPPLEMENT_S2_PERMISSION_CATALOG]).not.toContain('dashboard.read');
      expect([...SUPPLEMENT_S2_REMOVED_PERMISSIONS]).toEqual(['dashboard.read']);
      expect(isSupplementS2Permission('dashboard.read')).toBe(false);
      expect(isSupplementS2RemovedPermission('dashboard.read')).toBe(true);
      expect(isSupplementS2RemovedPermission('users.read')).toBe(false);
      expect(isSupplementS2RemovedPermission(null)).toBe(false);
    });

    it('recognizes the three new values', () => {
      expect(isSupplementS2Permission('users.read')).toBe(true);
      expect(isSupplementS2Permission('users.manage')).toBe(true);
      expect(isSupplementS2Permission('admins.create')).toBe(true);
      expect(isSupplementS2Permission('orders.read')).toBe(true);
      expect(isSupplementS2Permission('nope')).toBe(false);
      expect(isSupplementS2Permission(null)).toBe(false);
    });
  });

  describe('permission → endpoints matrix v2', () => {
    it('covers every v2 catalog value as a matrix key', () => {
      expect(Object.keys(SUPPLEMENT_S2_PERMISSION_ENDPOINTS).sort()).toEqual(
        [...SUPPLEMENT_S2_PERMISSION_CATALOG].sort(),
      );
      expect(isSupplementS2MatrixPermission('users.manage')).toBe(true);
      expect(isSupplementS2MatrixPermission('dashboard.read')).toBe(false);
      expect(isSupplementS2MatrixPermission(null)).toBe(false);
    });

    it('maps admins.create to register-admin only', () => {
      expect([...SUPPLEMENT_S2_PERMISSION_ENDPOINTS['admins.create']]).toEqual([
        'POST /auth/register-admin',
      ]);
    });

    it('maps users.read to the four user reads', () => {
      expect([...SUPPLEMENT_S2_PERMISSION_ENDPOINTS['users.read']]).toEqual([
        'GET /admin/users',
        'GET /admin/users/counts',
        'GET /admin/users/{id}',
        'GET /admin/users/{id}/permissions',
      ]);
    });

    it('maps users.manage to writes plus the permission catalog read', () => {
      expect([...SUPPLEMENT_S2_PERMISSION_ENDPOINTS['users.manage']]).toEqual([
        'POST /admin/users/{id}/roles',
        'POST /admin/users/{id}/unlock',
        'POST /admin/users/{id}/permissions',
        'DELETE /admin/users/{id}/permissions/{permission}',
        'GET /admin/users/permissions',
      ]);
    });

    it('keeps the dashboard out of the matrix (any-JWT auth)', () => {
      expect(SUPPLEMENT_S2_DASHBOARD_AUTH).toEqual({
        endpoint: 'GET /admin/dashboard',
        auth: 'authenticated',
      });
    });
  });

  describe('dashboard section gates (API_CONTRACT.md §8)', () => {
    it('pins all six sections', () => {
      expect(Object.keys(SUPPLEMENT_S2_DASHBOARD_SECTION_GATES).sort()).toEqual(
        ['catalog', 'inventory', 'orders', 'payments', 'recentOrders', 'users'].sort(),
      );
      expect(isSupplementS2DashboardSection('catalog')).toBe(true);
      expect(isSupplementS2DashboardSection('recentOrders')).toBe(true);
      expect(isSupplementS2DashboardSection('nope')).toBe(false);
      expect(isSupplementS2DashboardSection(null)).toBe(false);
    });

    it('gates orders and recentOrders together on orders.read', () => {
      expect(SUPPLEMENT_S2_DASHBOARD_SECTION_GATES.orders).toEqual({
        permissions: ['orders.read'],
      });
      expect(SUPPLEMENT_S2_DASHBOARD_SECTION_GATES.recentOrders).toEqual({
        permissions: ['orders.read'],
      });
    });

    it('opens payments on either payments.read or payments.stats', () => {
      expect(SUPPLEMENT_S2_DASHBOARD_SECTION_GATES.payments).toEqual({
        permissions: ['payments.read', 'payments.stats'],
      });
    });

    it('sources the users section from the SuperAdmin role directly', () => {
      expect(SUPPLEMENT_S2_DASHBOARD_SECTION_GATES.users).toEqual({
        roles: ['SuperAdmin'],
      });
    });

    it('validates catalog-counts sections structurally', () => {
      expect(
        isValidSupplementS2CatalogCounts({
          totalProducts: 10,
          activeProducts: 7,
          totalCategories: 3,
          totalVariants: 20,
        }),
      ).toBe(true);
      expect(
        isValidSupplementS2CatalogCounts({
          totalProducts: -1,
          activeProducts: 0,
          totalCategories: 0,
          totalVariants: 0,
        }),
      ).toBe(false);
      expect(
        isValidSupplementS2CatalogCounts({
          totalProducts: 1.5,
          activeProducts: 1,
          totalCategories: 1,
          totalVariants: 1,
        }),
      ).toBe(false);
      expect(isValidSupplementS2CatalogCounts(null)).toBe(false);
      expect(isValidSupplementS2CatalogCounts(undefined)).toBe(false);
    });
  });

  describe('grant-visibility rule (recorded product decision)', () => {
    it('shows grant UI to SuperAdmin and users.manage holders only', () => {
      expect(canViewSupplementS2GrantSection({ isSuperAdmin: true, permissions: [] })).toBe(true);
      expect(
        canViewSupplementS2GrantSection({
          isSuperAdmin: false,
          permissions: ['users.manage'],
        }),
      ).toBe(true);
      expect(
        canViewSupplementS2GrantSection({ isSuperAdmin: false, permissions: ['users.read'] }),
      ).toBe(false);
      expect(canViewSupplementS2GrantSection({ isSuperAdmin: false, permissions: [] })).toBe(false);
      expect(canViewSupplementS2GrantSection(null)).toBe(false);
      expect(canViewSupplementS2GrantSection(undefined)).toBe(false);
    });
  });

  describe('status-first failure classifiers (ERROR_CATALOG.md)', () => {
    it('pins Identity.Forbidden as the single S2 error code (403)', () => {
      expect(SUPPLEMENT_S2_ERROR_CODES).toEqual([
        {
          code: 'Identity.Forbidden',
          status: 403,
          meaning: 'Delegation guard: SuperAdmin role/target or unheld-permission grant',
        },
      ]);
      expect(isSupplementS2ErrorCode('Identity.Forbidden')).toBe(true);
      expect(isSupplementS2ErrorCode('Identity.InvalidPermission')).toBe(false);
      expect(isSupplementS2ErrorCode(null)).toBe(false);
    });

    it('branches on status first, never on message text', () => {
      expect(isSupplementS2ForbiddenFailure({ status: 403 })).toBe(true);
      expect(isSupplementS2ForbiddenFailure({ status: 403, code: 'Identity.Forbidden' })).toBe(
        true,
      );
      expect(isSupplementS2ForbiddenFailure({ status: 401 })).toBe(false);
      expect(isSupplementS2ForbiddenFailure(null)).toBe(false);
      expect(isSupplementS2ValidationFailure({ status: 400 })).toBe(true);
      expect(isSupplementS2ValidationFailure({ status: 403 })).toBe(false);
      expect(isSupplementS2NotFoundFailure({ status: 404 })).toBe(true);
      expect(isSupplementS2NotFoundFailure(undefined)).toBe(false);
      expect(isSupplementS2ConflictFailure({ status: 409 })).toBe(true);
      expect(isSupplementS2ConflictFailure({ status: 400 })).toBe(false);
      expect(isSupplementS2AuthFailure({ status: 401 })).toBe(true);
      expect(isSupplementS2AuthFailure({ status: 403 })).toBe(true);
      expect(isSupplementS2AuthFailure({ status: 404 })).toBe(false);
      expect(isSupplementS2AuthFailure(null)).toBe(false);
    });

    it('pins the single-refresh-then-locked 403 discipline', () => {
      expect(supplementS2ForbiddenNextStep(false)).toBe('refresh-once');
      expect(supplementS2ForbiddenNextStep(true)).toBe('render-locked');
    });
  });

  describe('pagination / filtering / sorting matrix', () => {
    it('keeps the six S1 paginated reads and never paginates the dashboard', () => {
      expect([...SUPPLEMENT_S2_PAGINATED_READS].sort()).toEqual(
        [
          'inventoryList',
          'orderList',
          'paymentList',
          'paymentsMine',
          'reservationList',
          'userList',
        ].sort(),
      );
      expect(isSupplementS2PaginatedRead('userList')).toBe(true);
      expect(isSupplementS2PaginatedRead('dashboard')).toBe(false);
      expect(isSupplementS2PaginatedRead(null)).toBe(false);
    });

    it('never invents sorting', () => {
      expect(supportsSupplementS2Sorting('userList')).toBe(false);
      expect(supportsSupplementS2Sorting(null)).toBe(false);
      expect(supportsSupplementS2Sorting(undefined)).toBe(false);
    });

    it('keeps userList filters (status/role/search)', () => {
      expect([...SUPPLEMENT_S2_READ_FILTERS.userList]).toEqual(['status', 'role', 'search']);
      expect(supportsSupplementS2Filtering('userList')).toBe(true);
      expect(supportsSupplementS2Filtering('unknown')).toBe(false);
      expect(supportsSupplementS2Filtering(null)).toBe(false);
    });
  });

  describe('route pins + still-unsupported + recorded gaps', () => {
    it('pins dashboard, users, and the new child route', () => {
      expect(SUPPLEMENT_S2_ROUTES).toEqual({
        dashboard: 'dashboard',
        users: 'users',
        usersNew: 'new',
      });
      expect(isSupplementS2Route('users')).toBe(true);
      expect(isSupplementS2Route('new')).toBe(true);
      expect(isSupplementS2Route('nope')).toBe(false);
    });

    it('validates single-id queries structurally', () => {
      expect(isValidSupplementS2IdQuery({ id: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })).toBe(true);
      expect(isValidSupplementS2IdQuery({ id: '  ' })).toBe(false);
      expect(isValidSupplementS2IdQuery(null)).toBe(false);
      expect(isValidSupplementS2IdQuery(undefined)).toBe(false);
    });

    it('records still-unsupported operations instead of fabricating them', () => {
      expect([...SUPPLEMENT_S2_STILL_UNSUPPORTED_OPERATIONS]).toContain('payment-history');
      expect([...SUPPLEMENT_S2_STILL_UNSUPPORTED_OPERATIONS]).toContain(
        'client-permission-derivation',
      );
      expect(isSupplementS2StillUnsupportedOperation('webhook-spa-call')).toBe(true);
      expect(isSupplementS2StillUnsupportedOperation('dashboard-snapshot')).toBe(false);
      expect(isSupplementS2StillUnsupportedOperation(null)).toBe(false);
    });

    it('records the contract gaps', () => {
      expect([...SUPPLEMENT_S2_RECORDED_GAPS].sort()).toEqual(
        [
          'permission-catalog-superadmin-note',
          'dashboard-users-section-role-gated',
          'user-response-permissions-authoritative',
        ].sort(),
      );
      expect(isSupplementS2RecordedGap('dashboard-users-section-role-gated')).toBe(true);
      expect(isSupplementS2RecordedGap('nope')).toBe(false);
    });
  });
});
