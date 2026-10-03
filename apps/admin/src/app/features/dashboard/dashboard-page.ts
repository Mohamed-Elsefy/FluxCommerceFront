/**
 * Admin dashboard page for Supplement S1, Step S1.10 — Admin Dashboard
 * (Real API).
 *
 * Smart page (route-level composition): reads the shared `AuthService`
 * for the live session card (no API call, no invented data) and the
 * feature-scoped `DashboardState` (route-provided on the `dashboard`
 * entry in `app.routes.ts` — never a global store) for the live
 * snapshot: per-module overview cards (orders, payments, inventory,
 * users — backend-issued counts, display only) plus the recent-orders
 * drill-down widget (newest 5, deep links to the existing admin order
 * details — no parallel detail view ships).
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * DashboardPage (this file — orchestration only)
 *     ↓ DashboardState (../state — feature-owned, local Signals)
 *     ↓ DashboardApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Dashboard API
 * ```
 *
 * Display contract (S1.1 audit — only backend-exposed data): every
 * section echoes verbatim for display (culture-formatted, never inputs
 * to math). Card links drill into the owning feature lists
 * (`/orders/list`, `/payments/list`, `/inventory/stock`, `/users/list`
 * for SuperAdmin only — the users surface stays `SuperAdmin`-only, so
 * other admins see counts without the link); recent rows link to the
 * existing admin order details (`/orders/:id`). Failures (including the
 * first failing snapshot section) resolve through
 * `resolveApiErrorMessage` (never backend text) with retry.
 *
 * Copy is localized per the active `CultureService.culture()`: feature
 * copy through the dashboard bundle, retry through
 * `common.actions.retry`.
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * grid auto-flow follows the document direction; logical properties
 * only.
 */

import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@flux/auth';
import {
  CultureService,
  formatCurrency,
  formatDate,
  formatNumber,
  resolveApiErrorMessage,
  translateKey,
} from '@flux/i18n';
import { Card, EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { DashboardState } from './state/dashboard-state';
import { DASHBOARD_TRANSLATION_KEYS, translateDashboardKey } from './i18n/dashboard-translations';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, Card, EmptyState, ErrorState, LoadingIndicator],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly cultures = inject(CultureService);
  private readonly overview = inject(DashboardState);

  /** Signed-in administrator facts (route guards guarantee a session). */
  protected readonly session = computed(() => {
    const user = this.auth.currentUser();
    if (user === null) {
      return null;
    }
    return {
      displayName: user.displayName ?? user.email,
      email: user.email,
      roles: user.roles.join(', '),
    };
  });

  /** Whether the users-list drill-down shows (users surface is SuperAdmin-only). */
  protected readonly canBrowseUsers = this.auth.isSuperAdmin;

  /** Current snapshot (idle → loading → success | error). */
  protected readonly slot = this.overview.snapshot;

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const snapshot = this.slot().data;
    return {
      title: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.title),
      subtitle: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.subtitle),
      sessionHeading: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.sessionHeading),
      sessionName: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.sessionName),
      sessionEmail: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.sessionEmail),
      sessionRoles: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.sessionRoles),
      snapshotLoading: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.snapshotLoading),
      snapshotErrorTitle: translateDashboardKey(
        culture,
        DASHBOARD_TRANSLATION_KEYS.snapshotErrorTitle,
      ),
      retry: translateKey(culture, 'common.actions.retry'),
      ordersTitle: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.ordersTitle),
      ordersLink: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.ordersLink),
      ordersTotal: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.ordersTotal, {
        count: formatNumber(snapshot?.orders.total ?? 0, culture),
      }),
      ordersPending: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.ordersPending),
      ordersConfirmed: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.ordersConfirmed),
      ordersCancelled: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.ordersCancelled),
      paymentsTitle: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.paymentsTitle),
      paymentsLink: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.paymentsLink),
      paymentsTotal: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.paymentsTotal, {
        count: formatNumber(snapshot?.payments.total ?? 0, culture),
      }),
      paymentsSucceeded: translateDashboardKey(
        culture,
        DASHBOARD_TRANSLATION_KEYS.paymentsSucceeded,
      ),
      paymentsFailed: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.paymentsFailed),
      paymentsRefunded: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.paymentsRefunded),
      inventoryTitle: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.inventoryTitle),
      inventoryLink: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.inventoryLink),
      inventoryTotal: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.inventoryTotal, {
        count: formatNumber(snapshot?.inventory.totalItems ?? 0, culture),
      }),
      inventoryOnHand: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.inventoryOnHand),
      inventoryReserved: translateDashboardKey(
        culture,
        DASHBOARD_TRANSLATION_KEYS.inventoryReserved,
      ),
      inventoryLowStock: translateDashboardKey(
        culture,
        DASHBOARD_TRANSLATION_KEYS.inventoryLowStock,
      ),
      usersTitle: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.usersTitle),
      usersLink: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.usersLink),
      usersTotal: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.usersTotal, {
        count: formatNumber(snapshot?.users.total ?? 0, culture),
      }),
      usersAdmins: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.usersAdmins),
      usersSuperAdmins: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.usersSuperAdmins),
      usersCustomers: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.usersCustomers),
      recentTitle: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.recentTitle),
      recentEmpty: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.recentEmpty),
      recentLink: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.recentLink),
    };
  });

  /** Culture-formatted section facts (display only — never inputs to math). */
  protected readonly facts = computed(() => {
    const culture = this.cultures.culture();
    const snapshot = this.slot().data;
    if (snapshot === null) {
      return null;
    }
    const copy = this.copy();
    return {
      orders: [
        { label: copy.ordersPending, value: formatNumber(snapshot.orders.pending, culture) },
        { label: copy.ordersConfirmed, value: formatNumber(snapshot.orders.confirmed, culture) },
        { label: copy.ordersCancelled, value: formatNumber(snapshot.orders.cancelled, culture) },
      ],
      payments: [
        {
          label: copy.paymentsSucceeded,
          value: formatNumber(snapshot.payments.succeeded, culture),
        },
        { label: copy.paymentsFailed, value: formatNumber(snapshot.payments.failed, culture) },
        {
          label: copy.paymentsRefunded,
          value: formatNumber(snapshot.payments.refunded, culture),
        },
      ],
      inventory: [
        {
          label: copy.inventoryOnHand,
          value: formatNumber(snapshot.inventory.totalOnHand, culture),
        },
        {
          label: copy.inventoryReserved,
          value: formatNumber(snapshot.inventory.totalReserved, culture),
        },
        {
          label: copy.inventoryLowStock,
          value: formatNumber(snapshot.inventory.lowStockItems, culture),
        },
      ],
      users: [
        { label: copy.usersAdmins, value: formatNumber(snapshot.users.admins, culture) },
        {
          label: copy.usersSuperAdmins,
          value: formatNumber(snapshot.users.superAdmins, culture),
        },
        {
          label: copy.usersCustomers,
          value: formatNumber(snapshot.users.customers, culture),
        },
      ],
    };
  });

  /** Preformatted recent-order rows (backend values only, newest 5). */
  protected readonly recentOrders = computed(() => {
    const culture = this.cultures.culture();
    return (this.slot().data?.recentOrders ?? []).map((order) => ({
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      status: order.status,
      total: formatCurrency(order.grandTotal.amount, order.grandTotal.currency, culture),
      items: formatNumber(order.itemCount, culture),
      created: formatDate(order.createdAtUtc, culture),
    }));
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.slot().error, this.cultures.culture()),
  );

  ngOnInit(): void {
    this.overview.refresh();
  }

  /** Snapshot retry re-enters the state refresh (duplicate-safe by design). */
  protected retry(): void {
    this.overview.refresh();
  }
}
