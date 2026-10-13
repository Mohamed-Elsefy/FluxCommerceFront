import { describe, expect, it } from 'vitest';
import { PaymentsAdminApiService } from './data-access/payments-admin-api.service';
import { paymentsRoutes } from './payments.routes';
import { PaymentDetailsState } from './state/payment-details-state';
import { PaymentsListState } from './state/payments-list-state';
import { PaymentsStatsState } from './state/payments-stats-state';

describe('paymentsRoutes', () => {
  it('provides the feature transport seam and states once at the feature root', () => {
    expect(paymentsRoutes).toHaveLength(1);
    expect(paymentsRoutes[0]?.path).toBe('');
    expect(paymentsRoutes[0]?.providers).toEqual([
      PaymentsAdminApiService,
      PaymentsStatsState,
      PaymentsListState,
      PaymentDetailsState,
    ]);
  });

  it('serves the landing page plus the payments list and details slices', () => {
    const children = paymentsRoutes[0]?.children ?? [];

    expect(children.map((route) => route.path)).toEqual(['', 'list', ':id']);
    for (const child of children) {
      expect(typeof child.loadComponent).toBe('function');
    }
  });
});
