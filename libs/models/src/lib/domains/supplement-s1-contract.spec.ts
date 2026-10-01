import { describe, expect, it } from 'vitest';
import { VariantStatus } from '../common/enums';
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
  SUPPLEMENT_S1_PERMISSIONS,
  SUPPLEMENT_S1_PERMISSION_ENDPOINTS,
  SUPPLEMENT_S1_READ_FILTERS,
  SUPPLEMENT_S1_ROUTES,
  SUPPLEMENT_S1_STILL_UNSUPPORTED_OPERATIONS,
  SUPPLEMENT_S1_SUPERADMIN_ONLY_ENDPOINTS,
  isBackendSupplementS1Responsibility,
  isFrontendSupplementS1Responsibility,
  isSupplementOrderStatusFilter,
  isSupplementPaymentStatusFilter,
  isSupplementS1CallableEndpoint,
  isSupplementS1ErrorCode,
  isSupplementS1NewlySupportedOperation,
  isSupplementS1Permission,
  isSupplementS1StillUnsupportedOperation,
  isSupplementS1SuperAdminOnlyEndpoint,
  isSupplementS1AuthFailure,
  isSupplementS1ConflictFailure,
  isSupplementS1NotFoundFailure,
  isSupplementS1PaginatedRead,
  isSupplementS1Route,
  isSupplementS1ValidationFailure,
  isValidSupplementDashboardQuery,
  isValidSupplementIdQuery,
  isValidSupplementInventoryListQuery,
  isValidSupplementOrderListQuery,
  isValidSupplementPagingQuery,
  isValidSupplementPaymentListQuery,
  isValidSupplementPaymentsMineQuery,
  isValidSupplementPermissionGrant,
  isValidSupplementRefundSubmission,
  isValidSupplementReservationListQuery,
  isValidSupplementUserListQuery,
  isValidSupplementVariantUpdate,
  supportsSupplementS1Filtering,
  supportsSupplementS1Sorting,
} from './supplement-s1-contract';

describe('supplement-s1-contract (Step S1.1 audit)', () => {
  describe('permission catalog (API_CONTRACT.md §0.5)', () => {
    it('pins the nine catalog permissions', () => {
      expect([...SUPPLEMENT_S1_PERMISSIONS]).toEqual([
        'orders.read',
        'orders.cancel',
        'orders.refund',
        'payments.read',
        'payments.stats',
        'inventory.read',
        'inventory.manage',
        'catalog.manage',
        'dashboard.read',
      ]);
    });

    it('classifies permission values (unknown rejected)', () => {
      expect(isSupplementS1Permission('orders.read')).toBe(true);
      expect(isSupplementS1Permission('dashboard.read')).toBe(true);
      expect(isSupplementS1Permission('orders.delete')).toBe(false);
      expect(isSupplementS1Permission('Admin')).toBe(false);
      expect(isSupplementS1Permission(null)).toBe(false);
      expect(isSupplementS1Permission(undefined)).toBe(false);
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

  describe('status filter values (case-insensitive)', () => {
    it('accepts order statuses case-insensitively', () => {
      expect(isSupplementOrderStatusFilter('Pending')).toBe(true);
      expect(isSupplementOrderStatusFilter('confirmed')).toBe(true);
      expect(isSupplementOrderStatusFilter('CANCELLED')).toBe(true);
      expect(isSupplementOrderStatusFilter('Shipped')).toBe(false);
      expect(isSupplementOrderStatusFilter(null)).toBe(false);
    });

    it('accepts the six payment statuses case-insensitively', () => {
      expect(isSupplementPaymentStatusFilter('Succeeded')).toBe(true);
      expect(isSupplementPaymentStatusFilter('refunded')).toBe(true);
      expect(isSupplementPaymentStatusFilter('Paid')).toBe(false);
      expect(isSupplementPaymentStatusFilter(undefined)).toBe(false);
    });
  });

  describe('structural pre-checks (never substitutes for backend validation)', () => {
    it('validates paging bounds (1/20 defaults pass as null)', () => {
      expect(isValidSupplementPagingQuery(null)).toBe(true);
      expect(isValidSupplementPagingQuery(undefined)).toBe(true);
      expect(isValidSupplementPagingQuery({})).toBe(true);
      expect(isValidSupplementPagingQuery({ pageNumber: 1, pageSize: 20 })).toBe(true);
      expect(isValidSupplementPagingQuery({ pageNumber: 0 })).toBe(false);
      expect(isValidSupplementPagingQuery({ pageSize: 0 })).toBe(false);
      expect(isValidSupplementPagingQuery({ pageSize: 101 })).toBe(false);
      expect(isValidSupplementPagingQuery({ pageNumber: 1.5 })).toBe(false);
    });

    it('validates order-list queries (unknown status + from>to rejected)', () => {
      expect(isValidSupplementOrderListQuery(null)).toBe(true);
      expect(isValidSupplementOrderListQuery({ status: 'Pending' })).toBe(true);
      expect(isValidSupplementOrderListQuery({ status: 'Shipped' })).toBe(false);
      expect(isValidSupplementOrderListQuery({ from: '2026-02-01', to: '2026-01-01' })).toBe(false);
      expect(isValidSupplementOrderListQuery({ from: '2026-01-01', to: '2026-02-01' })).toBe(true);
      expect(isValidSupplementOrderListQuery({ customerId: '  ' })).toBe(false);
      expect(isValidSupplementOrderListQuery({ pageSize: 101 })).toBe(false);
    });

    it('validates payment-list queries (unknown status + empty ids rejected)', () => {
      expect(isValidSupplementPaymentListQuery({ status: 'Succeeded' })).toBe(true);
      expect(isValidSupplementPaymentListQuery({ status: 'Paid' })).toBe(false);
      expect(isValidSupplementPaymentListQuery({ orderId: '' })).toBe(false);
      expect(isValidSupplementPaymentListQuery({ from: '2026-03-01', to: '2026-01-01' })).toBe(
        false,
      );
    });

    it('validates payments-mine queries (status only)', () => {
      expect(isValidSupplementPaymentsMineQuery({})).toBe(true);
      expect(isValidSupplementPaymentsMineQuery({ status: 'Failed' })).toBe(true);
      expect(isValidSupplementPaymentsMineQuery({ status: 'Bogus' })).toBe(false);
    });

    it('validates inventory-list queries (negative ceiling rejected)', () => {
      expect(isValidSupplementInventoryListQuery({ search: 'SKU-' })).toBe(true);
      expect(isValidSupplementInventoryListQuery({ maxAvailable: 0 })).toBe(true);
      expect(isValidSupplementInventoryListQuery({ maxAvailable: -1 })).toBe(false);
      expect(isValidSupplementInventoryListQuery({ search: '   ' })).toBe(false);
    });

    it('validates reservation-list queries (unknown status rejected)', () => {
      expect(isValidSupplementReservationListQuery({ status: 'Committed' })).toBe(true);
      expect(isValidSupplementReservationListQuery({ status: 'Lost' })).toBe(false);
      expect(isValidSupplementReservationListQuery({ orderId: '' })).toBe(false);
    });

    it('validates user-list queries (unknown status/role rejected)', () => {
      expect(isValidSupplementUserListQuery({ status: 'Locked', role: 'Admin' })).toBe(true);
      expect(isValidSupplementUserListQuery({ role: 'Manager' })).toBe(false);
      expect(isValidSupplementUserListQuery({ status: 'Banned' })).toBe(false);
      expect(isValidSupplementUserListQuery({ search: '' })).toBe(false);
    });

    it('validates single-id queries', () => {
      expect(isValidSupplementIdQuery({ id: 'guid-value' })).toBe(true);
      expect(isValidSupplementIdQuery({ id: '   ' })).toBe(false);
      expect(isValidSupplementIdQuery(null)).toBe(false);
      expect(isValidSupplementIdQuery(undefined)).toBe(false);
    });

    it('validates refund submissions (reason 1..500)', () => {
      expect(isValidSupplementRefundSubmission({ orderId: 'o', reason: 'Duplicate charge' })).toBe(
        true,
      );
      expect(isValidSupplementRefundSubmission({ orderId: 'o', reason: '' })).toBe(false);
      expect(isValidSupplementRefundSubmission({ orderId: '  ', reason: 'x' })).toBe(false);
      expect(isValidSupplementRefundSubmission({ orderId: 'o', reason: 'x'.repeat(501) })).toBe(
        false,
      );
      expect(isValidSupplementRefundSubmission({ orderId: 'o', reason: 'x'.repeat(500) })).toBe(
        true,
      );
      expect(isValidSupplementRefundSubmission(null)).toBe(false);
    });

    it('validates permission grants (catalog values only)', () => {
      expect(isValidSupplementPermissionGrant({ userId: 'u', permission: 'orders.read' })).toBe(
        true,
      );
      expect(isValidSupplementPermissionGrant({ userId: 'u', permission: 'orders.delete' })).toBe(
        false,
      );
      expect(isValidSupplementPermissionGrant({ userId: '', permission: 'orders.read' })).toBe(
        false,
      );
      expect(isValidSupplementPermissionGrant(null)).toBe(false);
    });

    it('validates dashboard queries (negative threshold rejected)', () => {
      expect(isValidSupplementDashboardQuery(null)).toBe(true);
      expect(isValidSupplementDashboardQuery({})).toBe(true);
      expect(isValidSupplementDashboardQuery({ lowStockThreshold: 5 })).toBe(true);
      expect(isValidSupplementDashboardQuery({ lowStockThreshold: -1 })).toBe(false);
    });

    it('validates variant updates (amount+currency paired)', () => {
      expect(isValidSupplementVariantUpdate({ sku: 'A-1' })).toBe(true);
      expect(isValidSupplementVariantUpdate({ unitPriceAmount: 10, currency: 'USD' })).toBe(true);
      expect(isValidSupplementVariantUpdate({ unitPriceAmount: 10 })).toBe(false);
      expect(isValidSupplementVariantUpdate({ currency: 'USD' })).toBe(false);
      expect(isValidSupplementVariantUpdate({ unitPriceAmount: 0, currency: 'USD' })).toBe(false);
      expect(isValidSupplementVariantUpdate({ status: VariantStatus.Inactive })).toBe(true);
      expect(isValidSupplementVariantUpdate({ status: 99 as VariantStatus })).toBe(false);
      expect(isValidSupplementVariantUpdate(null)).toBe(false);
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
