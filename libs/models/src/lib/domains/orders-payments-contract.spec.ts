import { describe, expect, it } from 'vitest';
import {
  ADMIN_CALLABLE_ORDER_ENDPOINTS,
  ADMIN_CALLABLE_PAYMENT_ENDPOINTS,
  ADMIN_ORDER_STATUSES,
  ADMIN_PAYMENT_STATUSES,
  ADMIN_PHASE_14_ROUTES,
  BACKEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES,
  FRONTEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES,
  NON_PAGINATED_ADMIN_ORDERS_READS,
  PAGINATED_ADMIN_ORDERS_READS,
  TERMINAL_ADMIN_ORDER_STATUSES,
  TERMINAL_ADMIN_PAYMENT_STATUSES,
  UNSUPPORTED_ADMIN_ORDER_OPERATIONS,
  UNSUPPORTED_ADMIN_PAYMENT_OPERATIONS,
  adminOrderStatusOf,
  adminPaymentStatusOf,
  isAdminCallableOrdersPaymentsEndpoint,
  isAdminOrderStatus,
  isAdminOrdersAuthFailure,
  isAdminOrdersConflictFailure,
  isAdminOrdersNotFoundFailure,
  isAdminOrdersValidationFailure,
  isAdminPaymentStatus,
  isAdminPhase14Route,
  isBackendAdminOrdersPaymentsResponsibility,
  isFailedAdminPaymentStatus,
  isFrontendAdminOrdersPaymentsResponsibility,
  isPaginatedAdminOrdersRead,
  isPendingAdminOrderStatus,
  isSuccessfulAdminPaymentStatus,
  isTerminalAdminOrderStatus,
  isTerminalAdminPaymentStatus,
  isUnsupportedAdminOrderOperation,
  isUnsupportedAdminPaymentOperation,
  isValidAdminOrderDetailsQuery,
  isValidAdminOrdersPagingQuery,
  isValidAdminPaymentByOrderQuery,
  isValidAdminPaymentStatusQuery,
  supportsAdminOrdersFiltering,
  supportsAdminOrdersSorting,
} from './orders-payments-contract';

describe('admin-orders-payments-contract (Sub-Phase 14.1 audit)', () => {
  describe('SPA-callable endpoints (audited backend surface)', () => {
    it('pins the customer plus admin order endpoints (checkout-from-admin excluded)', () => {
      expect([...ADMIN_CALLABLE_ORDER_ENDPOINTS]).toEqual([
        '/orders',
        '/orders/{orderId}',
        '/orders/{orderId}/cancel',
        '/admin/orders',
        '/admin/orders/counts',
        '/admin/orders/{orderId}',
        '/admin/orders/{orderId}/cancel',
        '/admin/orders/{orderId}/refund',
      ]);
    });

    it('pins the two payment reads (webhook excluded by design)', () => {
      expect([...ADMIN_CALLABLE_PAYMENT_ENDPOINTS]).toEqual([
        '/api/payments/{paymentId}',
        '/api/payments/by-order/{orderId}',
      ]);
    });

    it('classifies callable endpoints (checkout + webhook rejected)', () => {
      expect(isAdminCallableOrdersPaymentsEndpoint('/orders')).toBe(true);
      expect(isAdminCallableOrdersPaymentsEndpoint('/admin/orders')).toBe(true);
      expect(isAdminCallableOrdersPaymentsEndpoint('/admin/orders/{orderId}/refund')).toBe(true);
      expect(isAdminCallableOrdersPaymentsEndpoint('/api/payments/by-order/{orderId}')).toBe(true);
      expect(isAdminCallableOrdersPaymentsEndpoint('/orders/checkout')).toBe(false);
      expect(isAdminCallableOrdersPaymentsEndpoint('/api/payments/webhook')).toBe(false);
      expect(isAdminCallableOrdersPaymentsEndpoint('/orders/{id}/payments')).toBe(false);
      expect(isAdminCallableOrdersPaymentsEndpoint(null)).toBe(false);
      expect(isAdminCallableOrdersPaymentsEndpoint(undefined)).toBe(false);
    });
  });

  describe('unsupported operations (no invented capability)', () => {
    it('pins order operations that must never be implemented', () => {
      expect([...UNSUPPORTED_ADMIN_ORDER_OPERATIONS]).toEqual([
        'order-sorting',
        'order-customer-identity',
        'order-payment-linkage',
        'order-confirm',
        'checkout-from-admin',
      ]);
    });

    it('pins payment operations that must never be implemented (no list/history)', () => {
      expect([...UNSUPPORTED_ADMIN_PAYMENT_OPERATIONS]).toContain('payment-list');
      expect([...UNSUPPORTED_ADMIN_PAYMENT_OPERATIONS]).toContain('payment-history');
      expect([...UNSUPPORTED_ADMIN_PAYMENT_OPERATIONS]).toContain('failed-payments-list');
      expect([...UNSUPPORTED_ADMIN_PAYMENT_OPERATIONS]).toContain('payment-refund-admin');
      expect([...UNSUPPORTED_ADMIN_PAYMENT_OPERATIONS]).toContain('webhook-spa-call');
    });

    it('classifies unsupported operations (supported names pass through)', () => {
      expect(isUnsupportedAdminOrderOperation('order-sorting')).toBe(true);
      expect(isUnsupportedAdminOrderOperation('order-payment-linkage')).toBe(true);
      expect(isUnsupportedAdminOrderOperation('orders-list-all')).toBe(false);
      expect(isUnsupportedAdminOrderOperation('order-refund')).toBe(false);
      expect(isUnsupportedAdminOrderOperation('order-details')).toBe(false);
      expect(isUnsupportedAdminPaymentOperation('payment-history')).toBe(true);
      expect(isUnsupportedAdminPaymentOperation('payment-status')).toBe(false);
      expect(isUnsupportedAdminOrderOperation(null)).toBe(false);
      expect(isUnsupportedAdminPaymentOperation(42)).toBe(false);
    });
  });

  describe('pagination / filtering / sorting capability', () => {
    it('pins the two paginated reads (customer plus admin lists)', () => {
      expect([...PAGINATED_ADMIN_ORDERS_READS]).toEqual(['listOrders', 'listAdminOrders']);
      expect([...NON_PAGINATED_ADMIN_ORDERS_READS]).toEqual([
        'orderDetails',
        'cancelOrder',
        'paymentStatus',
        'paymentByOrder',
      ]);
    });

    it('classifies paginated reads (payment reads never paged)', () => {
      expect(isPaginatedAdminOrdersRead('listOrders')).toBe(true);
      expect(isPaginatedAdminOrdersRead('listAdminOrders')).toBe(true);
      expect(isPaginatedAdminOrdersRead('paymentStatus')).toBe(false);
      expect(isPaginatedAdminOrdersRead('paymentByOrder')).toBe(false);
      expect(isPaginatedAdminOrdersRead(null)).toBe(false);
    });

    it('pins no sorting support on any read (newest-first fixed)', () => {
      expect(supportsAdminOrdersSorting('listOrders')).toBe(false);
      expect(supportsAdminOrdersSorting('orderDetails')).toBe(false);
      expect(supportsAdminOrdersSorting(null)).toBe(false);
      expect(supportsAdminOrdersSorting(undefined)).toBe(false);
    });

      it('pins filtering support on the two list reads (Supplement S1 matrix)', () => {
        expect(supportsAdminOrdersFiltering('listOrders')).toBe(true);
        expect(supportsAdminOrdersFiltering('listAdminOrders')).toBe(true);
        expect(supportsAdminOrdersFiltering('paymentStatus')).toBe(false);
        expect(supportsAdminOrdersFiltering(null)).toBe(false);
        expect(supportsAdminOrdersFiltering(undefined)).toBe(false);
      });

    it('pre-checks paging bounds (1-based page, 1..100 size)', () => {
      expect(isValidAdminOrdersPagingQuery(null)).toBe(true);
      expect(isValidAdminOrdersPagingQuery({})).toBe(true);
      expect(isValidAdminOrdersPagingQuery({ pageNumber: 1, pageSize: 20 })).toBe(true);
      expect(isValidAdminOrdersPagingQuery({ pageNumber: 0 })).toBe(false);
      expect(isValidAdminOrdersPagingQuery({ pageSize: 0 })).toBe(false);
      expect(isValidAdminOrdersPagingQuery({ pageSize: 101 })).toBe(false);
      expect(isValidAdminOrdersPagingQuery({ pageNumber: 1.5 })).toBe(false);
    });
  });

  describe('query pre-checks (structural only)', () => {
    it('pre-checks order-details queries (non-blank id)', () => {
      expect(
        isValidAdminOrderDetailsQuery({ orderId: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }),
      ).toBe(true);
      expect(isValidAdminOrderDetailsQuery({ orderId: '  ' })).toBe(false);
      expect(isValidAdminOrderDetailsQuery(null)).toBe(false);
      expect(isValidAdminOrderDetailsQuery(undefined)).toBe(false);
    });

    it('pre-checks payment-status queries (non-blank id)', () => {
      expect(
        isValidAdminPaymentStatusQuery({ paymentId: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }),
      ).toBe(true);
      expect(isValidAdminPaymentStatusQuery({ paymentId: '' })).toBe(false);
      expect(isValidAdminPaymentStatusQuery(null)).toBe(false);
    });

    it('pre-checks payment by-order queries (non-blank id)', () => {
      expect(
        isValidAdminPaymentByOrderQuery({ orderId: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }),
      ).toBe(true);
      expect(isValidAdminPaymentByOrderQuery({ orderId: '' })).toBe(false);
      expect(isValidAdminPaymentByOrderQuery(null)).toBe(false);
    });
  });

  describe('order / payment statuses (strings on the wire)', () => {
    it('pins the three order statuses', () => {
      expect([...ADMIN_ORDER_STATUSES]).toEqual(['Pending', 'Cancelled', 'Confirmed']);
      expect([...TERMINAL_ADMIN_ORDER_STATUSES]).toEqual(['Cancelled', 'Confirmed']);
    });

    it('pins the six payment statuses', () => {
      expect([...ADMIN_PAYMENT_STATUSES]).toEqual([
        'Pending',
        'Processing',
        'Succeeded',
        'Failed',
        'Cancelled',
        'Refunded',
      ]);
      expect([...TERMINAL_ADMIN_PAYMENT_STATUSES]).toEqual([
        'Succeeded',
        'Failed',
        'Cancelled',
        'Refunded',
      ]);
    });

    it('classifies status names (unknown strings rejected)', () => {
      expect(isAdminOrderStatus('Pending')).toBe(true);
      expect(isAdminOrderStatus('Shipped')).toBe(false);
      expect(isAdminOrderStatus(0)).toBe(false);
      expect(isAdminPaymentStatus('Succeeded')).toBe(true);
      expect(isAdminPaymentStatus('Refunding')).toBe(false);
      expect(isAdminPaymentStatus(null)).toBe(false);
    });

    it('classifies terminal orders (unknown future strings keep polling)', () => {
      expect(isTerminalAdminOrderStatus('Confirmed')).toBe(true);
      expect(isTerminalAdminOrderStatus('Cancelled')).toBe(true);
      expect(isTerminalAdminOrderStatus('Pending')).toBe(false);
      expect(isTerminalAdminOrderStatus('Refunding')).toBe(false);
    });

    it('classifies pending orders (the only cancellable status)', () => {
      expect(isPendingAdminOrderStatus('Pending')).toBe(true);
      expect(isPendingAdminOrderStatus('Confirmed')).toBe(false);
      expect(isPendingAdminOrderStatus('Cancelled')).toBe(false);
    });

    it('classifies terminal payments (unknown future strings keep polling)', () => {
      expect(isTerminalAdminPaymentStatus('Succeeded')).toBe(true);
      expect(isTerminalAdminPaymentStatus('Refunded')).toBe(true);
      expect(isTerminalAdminPaymentStatus('Pending')).toBe(false);
      expect(isTerminalAdminPaymentStatus('Processing')).toBe(false);
      expect(isTerminalAdminPaymentStatus('SomethingNew')).toBe(false);
    });

    it('classifies payment success/failure (Refunded is not retryable)', () => {
      expect(isSuccessfulAdminPaymentStatus('Succeeded')).toBe(true);
      expect(isSuccessfulAdminPaymentStatus('Processing')).toBe(false);
      expect(isFailedAdminPaymentStatus('Failed')).toBe(true);
      expect(isFailedAdminPaymentStatus('Cancelled')).toBe(true);
      expect(isFailedAdminPaymentStatus('Refunded')).toBe(false);
      expect(isFailedAdminPaymentStatus('Succeeded')).toBe(false);
    });

    it('projects statuses verbatim (no derivation)', () => {
      expect(adminOrderStatusOf(null)).toBeNull();
      expect(adminOrderStatusOf(undefined)).toBeNull();
      expect(
        adminOrderStatusOf({ status: 'Pending' } as unknown as Parameters<
          typeof adminOrderStatusOf
        >[0]),
      ).toBe('Pending');
      expect(adminPaymentStatusOf(null)).toBeNull();
      expect(
        adminPaymentStatusOf({ status: 'Failed' } as unknown as Parameters<
          typeof adminPaymentStatusOf
        >[0]),
      ).toBe('Failed');
    });
  });

  describe('routes (portal shell conventions)', () => {
    it('pins the Phase 14 route segments (orders + reserved payments)', () => {
      expect(ADMIN_PHASE_14_ROUTES.orders).toBe('orders');
      expect(ADMIN_PHASE_14_ROUTES.payments).toBe('payments');
    });

    it('classifies Phase 14 routes (Phase 13 segments excluded)', () => {
      expect(isAdminPhase14Route('orders')).toBe(true);
      expect(isAdminPhase14Route('payments')).toBe(true);
      expect(isAdminPhase14Route('catalog')).toBe(false);
      expect(isAdminPhase14Route('inventory')).toBe(false);
      expect(isAdminPhase14Route(null)).toBe(false);
    });
  });

  describe('failure classifiers (status-first)', () => {
    it('classifies 404 as not-found (incl. masked ownership)', () => {
      expect(isAdminOrdersNotFoundFailure({ status: 404 })).toBe(true);
      expect(isAdminOrdersNotFoundFailure({ status: 404, code: 'Order.NotFound' })).toBe(true);
      expect(isAdminOrdersNotFoundFailure({ status: 400 })).toBe(false);
      expect(isAdminOrdersNotFoundFailure(null)).toBe(false);
    });

    it('classifies 409 as conflict (incl. NotReady saga lag)', () => {
      expect(isAdminOrdersConflictFailure({ status: 409 })).toBe(true);
      expect(isAdminOrdersConflictFailure({ status: 404 })).toBe(false);
      expect(isAdminOrdersConflictFailure(undefined)).toBe(false);
    });

    it('classifies 400 as validation', () => {
      expect(isAdminOrdersValidationFailure({ status: 400 })).toBe(true);
      expect(isAdminOrdersValidationFailure({ status: 409 })).toBe(false);
      expect(isAdminOrdersValidationFailure(null)).toBe(false);
    });

    it('classifies 401/403 as auth (never business logic)', () => {
      expect(isAdminOrdersAuthFailure({ status: 401 })).toBe(true);
      expect(isAdminOrdersAuthFailure({ status: 403 })).toBe(true);
      expect(isAdminOrdersAuthFailure({ status: 404 })).toBe(false);
      expect(isAdminOrdersAuthFailure(null)).toBe(false);
    });
  });

  describe('responsibility boundary (disjoint by construction)', () => {
    it('pins frontend-owned concerns (presentation only)', () => {
      expect([...FRONTEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES]).toEqual([
        'orders-ux',
        'payment-presentation',
        'feature-state',
        'loading-error-handling',
        'navigation',
        'notifications',
      ]);
    });

    it('pins backend-owned concerns (truth + orchestration)', () => {
      expect([...BACKEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES]).toContain('order-state');
      expect([...BACKEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES]).toContain('payment-state');
      expect([...BACKEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES]).toContain('payment-verification');
      expect([...BACKEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES]).toContain('compensation');
      expect([...BACKEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES]).toContain('ownership');
      expect([...BACKEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES]).toContain('idempotency');
    });

    it('keeps the two sets disjoint (zero business-logic duplication)', () => {
      const frontend = new Set<string>([...FRONTEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES]);
      for (const concern of BACKEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES) {
        expect(frontend.has(concern)).toBe(false);
      }
      expect(isFrontendAdminOrdersPaymentsResponsibility('orders-ux')).toBe(true);
      expect(isFrontendAdminOrdersPaymentsResponsibility('order-state')).toBe(false);
      expect(isBackendAdminOrdersPaymentsResponsibility('payment-state')).toBe(true);
      expect(isBackendAdminOrdersPaymentsResponsibility('orders-ux')).toBe(false);
      expect(isFrontendAdminOrdersPaymentsResponsibility(null)).toBe(false);
      expect(isBackendAdminOrdersPaymentsResponsibility(undefined)).toBe(false);
    });
  });
});
