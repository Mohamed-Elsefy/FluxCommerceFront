import { describe, expect, it } from 'vitest';
import {
  BACKEND_SUPPLEMENT_S1_RESPONSIBILITIES,
  FRONTEND_SUPPLEMENT_S1_RESPONSIBILITIES,
  SUPPLEMENT_S1_CALLABLE_DASHBOARD_ENDPOINTS,
  SUPPLEMENT_S1_CALLABLE_IDENTITY_ENDPOINTS,
  SUPPLEMENT_S1_CALLABLE_INVENTORY_ENDPOINTS,
  SUPPLEMENT_S1_CALLABLE_ORDER_ENDPOINTS,
  SUPPLEMENT_S1_CALLABLE_PAYMENT_ENDPOINTS,
  SUPPLEMENT_S1_ERROR_CODES,
  SUPPLEMENT_S1_NEWLY_SUPPORTED_OPERATIONS,
  SUPPLEMENT_S1_PAGINATED_READS,
  SUPPLEMENT_S1_PERMISSION_ENDPOINTS,
  SUPPLEMENT_S1_READ_FILTERS,
  SUPPLEMENT_S1_ROUTES,
  SUPPLEMENT_S1_STILL_UNSUPPORTED_OPERATIONS,
  SUPPLEMENT_S1_SUPERADMIN_ONLY_ENDPOINTS,
  isBackendSupplementS1Responsibility,
  isFrontendSupplementS1Responsibility,
  isSupplementS1CallableEndpoint,
  isSupplementS1ErrorCode,
  isSupplementS1NewlySupportedOperation,
  isSupplementS1StillUnsupportedOperation,
  isSupplementS1SuperAdminOnlyEndpoint,
  isSupplementS1AuthFailure,
  isSupplementS1ConflictFailure,
  isSupplementS1NotFoundFailure,
  isSupplementS1PaginatedRead,
  isSupplementS1Route,
  isSupplementS1ValidationFailure,
  isValidSupplementIdQuery,
  supportsSupplementS1Filtering,
  supportsSupplementS1Sorting,
} from './contract-evolution-audit';

describe('contract-evolution-audit (Step S1.1 audit)', () => {
  describe('permission matrix (API_CONTRACT.md §0.5)', () => {
    it('covers all nine catalog permissions as matrix keys', () => {
      expect(Object.keys(SUPPLEMENT_S1_PERMISSION_ENDPOINTS).sort()).toEqual(
        [
          'orders.read',
          'orders.cancel',
          'orders.refund',
          'payments.read',
          'payments.stats',
          'inventory.read',
          'inventory.manage',
          'catalog.manage',
          'dashboard.read',
        ].sort(),
      );
    });

    it('maps orders.read to the three order reads', () => {
      expect([...SUPPLEMENT_S1_PERMISSION_ENDPOINTS['orders.read']]).toEqual([
        '/orders-list',
        '/orders/{orderId}',
        '/orders/counts',
      ]);
    });

    it('keeps user/permission management SuperAdmin-only (no permission grants it)', () => {
      expect([...SUPPLEMENT_S1_SUPERADMIN_ONLY_ENDPOINTS]).toContain('POST /auth/register-admin');
      expect([...SUPPLEMENT_S1_SUPERADMIN_ONLY_ENDPOINTS]).toContain(
        'POST /users/{id}/permissions',
      );
      expect([...SUPPLEMENT_S1_SUPERADMIN_ONLY_ENDPOINTS]).toContain('GET /users/permissions');
      expect(isSupplementS1SuperAdminOnlyEndpoint('GET /users')).toBe(true);
      expect(isSupplementS1SuperAdminOnlyEndpoint('PUT /auth/profile')).toBe(false);
      expect(isSupplementS1SuperAdminOnlyEndpoint('GET /orders-list')).toBe(false);
      expect(isSupplementS1SuperAdminOnlyEndpoint(null)).toBe(false);
    });
  });

  describe('SPA-callable endpoints (audited new surface)', () => {
    it('pins the eight identity endpoints', () => {
      expect([...SUPPLEMENT_S1_CALLABLE_IDENTITY_ENDPOINTS]).toEqual([
        'PUT /auth/profile',
        'GET /users',
        'GET /users/counts',
        'GET /users/{id}',
        'POST /users/{id}/permissions',
        'DELETE /users/{id}/permissions/{permission}',
        'GET /users/{id}/permissions',
        'GET /users/permissions',
      ]);
    });

    it('pins the six order endpoints (customer status filter + five admin rows)', () => {
      expect([...SUPPLEMENT_S1_CALLABLE_ORDER_ENDPOINTS]).toEqual([
        'GET /orders',
        'GET /orders-list',
        'GET /orders/counts',
        'GET /orders/{orderId}',
        'POST /orders/{orderId}/cancel',
        'POST /orders/{orderId}/refund',
      ]);
    });

    it('pins the four payment endpoints (mine + three admin, webhook excluded)', () => {
      expect([...SUPPLEMENT_S1_CALLABLE_PAYMENT_ENDPOINTS]).toEqual([
        'GET /api/payments/mine',
        'GET /payments',
        'GET /payments/stats',
        'GET /payments/{paymentId}',
      ]);
    });

    it('pins the three inventory endpoints + the dashboard endpoint', () => {
      expect([...SUPPLEMENT_S1_CALLABLE_INVENTORY_ENDPOINTS]).toEqual([
        'GET /inventory',
        'GET /inventory/counts',
        'GET /inventory/reservations',
      ]);
      expect([...SUPPLEMENT_S1_CALLABLE_DASHBOARD_ENDPOINTS]).toEqual(['GET /dashboard']);
    });

    it('classifies callable endpoints (webhook + checkout rejected)', () => {
      expect(isSupplementS1CallableEndpoint('PUT /auth/profile')).toBe(true);
      expect(isSupplementS1CallableEndpoint('POST /orders/{orderId}/refund')).toBe(true);
      expect(isSupplementS1CallableEndpoint('GET /api/payments/mine')).toBe(true);
      expect(isSupplementS1CallableEndpoint('GET /dashboard')).toBe(true);
      expect(isSupplementS1CallableEndpoint('POST /api/payments/webhook')).toBe(false);
      expect(isSupplementS1CallableEndpoint('/orders/checkout')).toBe(false);
      expect(isSupplementS1CallableEndpoint('/orders/{id}/payments')).toBe(false);
      expect(isSupplementS1CallableEndpoint(null)).toBe(false);
      expect(isSupplementS1CallableEndpoint(undefined)).toBe(false);
    });
  });

  describe('supported/unsupported pins (delta vs 14.1)', () => {
    it('pins newly-supported operations flipped by the evolution', () => {
      expect([...SUPPLEMENT_S1_NEWLY_SUPPORTED_OPERATIONS]).toContain('orders-list-all');
      expect([...SUPPLEMENT_S1_NEWLY_SUPPORTED_OPERATIONS]).toContain('order-refund');
      expect([...SUPPLEMENT_S1_NEWLY_SUPPORTED_OPERATIONS]).toContain('payment-list');
      expect([...SUPPLEMENT_S1_NEWLY_SUPPORTED_OPERATIONS]).toContain('inventory-stock-list');
      expect([...SUPPLEMENT_S1_NEWLY_SUPPORTED_OPERATIONS]).toContain('dashboard-snapshot');
      expect(isSupplementS1NewlySupportedOperation('profile-edit')).toBe(true);
      expect(isSupplementS1NewlySupportedOperation('payment-history')).toBe(false);
      expect(isSupplementS1NewlySupportedOperation(null)).toBe(false);
    });

    it('pins operations that stay unsupported (never fabricated)', () => {
      expect([...SUPPLEMENT_S1_STILL_UNSUPPORTED_OPERATIONS]).toEqual([
        'payment-history',
        'payment-timeline',
        'webhook-spa-call',
        'checkout-from-admin',
      ]);
      expect(isSupplementS1StillUnsupportedOperation('payment-history')).toBe(true);
      expect(isSupplementS1StillUnsupportedOperation('payment-list')).toBe(false);
      expect(isSupplementS1StillUnsupportedOperation(undefined)).toBe(false);
    });
  });

  describe('pagination / filtering / sorting matrix', () => {
    it('pins the six paginated reads', () => {
      expect([...SUPPLEMENT_S1_PAGINATED_READS]).toEqual([
        'userList',
        'orderList',
        'paymentList',
        'paymentsMine',
        'inventoryList',
        'reservationList',
      ]);
      expect(isSupplementS1PaginatedRead('orderList')).toBe(true);
      expect(isSupplementS1PaginatedRead('orderDetails')).toBe(false);
      expect(isSupplementS1PaginatedRead(null)).toBe(false);
    });

    it('pins sorting as unsupported on every read', () => {
      expect(supportsSupplementS1Sorting('orderList')).toBe(false);
      expect(supportsSupplementS1Sorting('inventoryList')).toBe(false);
      expect(supportsSupplementS1Sorting(null)).toBe(false);
      expect(supportsSupplementS1Sorting(undefined)).toBe(false);
    });

    it('pins per-read filter support (admin orders fully filterable)', () => {
      expect(SUPPLEMENT_S1_READ_FILTERS.orderList).toEqual([
        'status',
        'customerId',
        'search',
        'from',
        'to',
      ]);
      expect(SUPPLEMENT_S1_READ_FILTERS.paymentsMine).toEqual(['status']);
      expect(SUPPLEMENT_S1_READ_FILTERS.inventoryList).toEqual(['search', 'maxAvailable']);
      expect(supportsSupplementS1Filtering('orderList')).toBe(true);
      expect(supportsSupplementS1Filtering('orderDetails')).toBe(false);
      expect(supportsSupplementS1Filtering(null)).toBe(false);
    });
  });

  describe('single-id route scaffolding', () => {
    it('validates single-id queries', () => {
      expect(isValidSupplementIdQuery({ id: 'guid-value' })).toBe(true);
      expect(isValidSupplementIdQuery({ id: '   ' })).toBe(false);
      expect(isValidSupplementIdQuery(null)).toBe(false);
      expect(isValidSupplementIdQuery(undefined)).toBe(false);
    });
  });

  describe('error codes + status-first classifiers', () => {
    it('pins the five new error codes with their statuses', () => {
      expect(SUPPLEMENT_S1_ERROR_CODES.map((e) => e.code)).toEqual([
        'Identity.InvalidPermission',
        'Identity.PermissionAlreadyGranted',
        'Order.RefundConflict',
        'Inventory.ValidationFailed',
        'Payment.ValidationFailed',
      ]);
      expect(isSupplementS1ErrorCode('Order.RefundConflict')).toBe(true);
      expect(isSupplementS1ErrorCode('Order.NotFound')).toBe(false);
      expect(isSupplementS1ErrorCode(null)).toBe(false);
    });

    it('branches on status first (404/409/400/401-403)', () => {
      expect(isSupplementS1NotFoundFailure({ status: 404 })).toBe(true);
      expect(isSupplementS1NotFoundFailure({ status: 400 })).toBe(false);
      expect(isSupplementS1NotFoundFailure(null)).toBe(false);
      expect(isSupplementS1ConflictFailure({ status: 409 })).toBe(true);
      expect(isSupplementS1ConflictFailure({ status: 404 })).toBe(false);
      expect(isSupplementS1ValidationFailure({ status: 400 })).toBe(true);
      expect(isSupplementS1ValidationFailure({ status: 409 })).toBe(false);
      expect(isSupplementS1AuthFailure({ status: 401 })).toBe(true);
      expect(isSupplementS1AuthFailure({ status: 403 })).toBe(true);
      expect(isSupplementS1AuthFailure({ status: 404 })).toBe(false);
      expect(isSupplementS1AuthFailure(undefined)).toBe(false);
    });
  });

  describe('routes + responsibility boundary', () => {
    it('pins the supplement route segments (users new, dashboard reused)', () => {
      expect(SUPPLEMENT_S1_ROUTES.users).toBe('users');
      expect(SUPPLEMENT_S1_ROUTES.dashboard).toBe('dashboard');
      expect(isSupplementS1Route('users')).toBe(true);
      expect(isSupplementS1Route('payments')).toBe(false);
      expect(isSupplementS1Route(null)).toBe(false);
    });

    it('keeps frontend/backend responsibilities disjoint', () => {
      expect([...FRONTEND_SUPPLEMENT_S1_RESPONSIBILITIES]).toContain('permission-presentation');
      expect([...BACKEND_SUPPLEMENT_S1_RESPONSIBILITIES]).toContain('permission-grants');
      expect([...BACKEND_SUPPLEMENT_S1_RESPONSIBILITIES]).toContain('saga-orchestration');
      const overlap = FRONTEND_SUPPLEMENT_S1_RESPONSIBILITIES.filter((r) =>
        (BACKEND_SUPPLEMENT_S1_RESPONSIBILITIES as readonly string[]).includes(r),
      );
      expect(overlap).toEqual([]);
      expect(isFrontendSupplementS1Responsibility('profile-editing')).toBe(true);
      expect(isFrontendSupplementS1Responsibility('order-state')).toBe(false);
      expect(isBackendSupplementS1Responsibility('webhook-processing')).toBe(true);
      expect(isBackendSupplementS1Responsibility('navigation')).toBe(false);
    });
  });
});
