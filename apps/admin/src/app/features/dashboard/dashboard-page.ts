/**
 * Admin dashboard page for Supplement S2, Step S2.3 — Adaptive
 * Dashboard Landing.
 *
 * Smart page (route-level composition): reads the shared `AuthService`
 * for the live session card (no API call, no invented data) and the
 * feature-scoped `DashboardState` (route-provided on the `dashboard`
 * entry in `app.routes.ts` — never a global store) for the live
 * snapshot: per-entitlement overview cards (orders, payments,
 * inventory, catalog, users — backend-issued counts, display only;
 * `null` sections render nothing), the honest empty state (no
 * entitled sections), plus the recent-orders drill-down widget
 * (newest 5, deep links to the existing admin order details — no
 * parallel detail view ships).
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
 * Display contract (S2.1 audit — only backend-exposed data): every
 * section echoes verbatim for display (culture-formatted, never inputs
 * to math). Card links drill into the owning feature lists
 * (`/orders/list`, `/payments/list`, `/inventory/stock`,
 * `/catalog/products`, `/users/list` whenever the `users` section is
 * present — section presence is the entitlement proof); recent rows link to the
 * existing admin order details (`/orders/:id`). Failures (including
 * the first failing entitled section) resolve through
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
import { netRevenueByCurrency } from '@flux/models';
import { hasEntitledSections } from './models/dashboard-admin.models';
import { DashboardState } from './state/dashboard-state';
import { SeriesChart } from './components/series-chart/series-chart';
import { DASHBOARD_TRANSLATION_KEYS, translateDashboardKey } from './i18n/dashboard-translations';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, Card, EmptyState, ErrorState, LoadingIndicator, SeriesChart],
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

  /**
   * Whether the users-list drill-down shows: whenever the `users`
   * section is present (section presence is itself the entitlement
   * proof — `users.read` or `SuperAdmin`), plus a `SuperAdmin`
   * allowance for the (backend-impossible) absent-section case.
   */
  protected readonly canBrowseUsers = computed(
    () =>
      this.auth.isSuperAdmin() ||
      (this.slot().data?.users !== null && this.slot().data?.users !== undefined),
  );

  /**
   * Whether the recent-payments widget shows: `payments.read` holders
   * (or `SuperAdmin`) only — stats-only viewers get the stats card
   * but no list.
   */
  protected readonly canViewPaymentsList = computed(
    () => this.auth.isSuperAdmin() || this.auth.hasPermission('payments.read')(),
  );

  /**
   * Whether the recent-users widget shows: `users.read` holders (or
   * `SuperAdmin`) only.
   */
  protected readonly canViewUsersList = computed(
    () => this.auth.isSuperAdmin() || this.auth.hasPermission('users.read')(),
  );

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
        count: formatNumber(snapshot?.orders?.total ?? 0, culture),
      }),
      ordersPending: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.ordersPending),
      ordersConfirmed: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.ordersConfirmed),
      ordersCancelled: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.ordersCancelled),
      paymentsTitle: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.paymentsTitle),
      paymentsLink: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.paymentsLink),
      paymentsTotal: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.paymentsTotal, {
        count: formatNumber(snapshot?.payments?.total ?? 0, culture),
      }),
      paymentsSucceeded: translateDashboardKey(
        culture,
        DASHBOARD_TRANSLATION_KEYS.paymentsSucceeded,
      ),
      paymentsFailed: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.paymentsFailed),
      paymentsRefunded: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.paymentsRefunded),
      paymentsNet: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.paymentsNet),
      inventoryTitle: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.inventoryTitle),
      inventoryLink: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.inventoryLink),
      inventoryTotal: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.inventoryTotal, {
        count: formatNumber(snapshot?.inventory?.totalItems ?? 0, culture),
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
        count: formatNumber(snapshot?.users?.total ?? 0, culture),
      }),
      usersAdmins: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.usersAdmins),
      usersSuperAdmins: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.usersSuperAdmins),
      usersCustomers: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.usersCustomers),
      catalogTitle: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.catalogTitle),
      catalogLink: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.catalogLink),
      catalogTotal: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.catalogTotal, {
        count: formatNumber(snapshot?.catalog?.totalProducts ?? 0, culture),
      }),
      catalogProducts: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.catalogProducts),
      catalogActiveProducts: translateDashboardKey(
        culture,
        DASHBOARD_TRANSLATION_KEYS.catalogActiveProducts,
      ),
      catalogCategories: translateDashboardKey(
        culture,
        DASHBOARD_TRANSLATION_KEYS.catalogCategories,
      ),
      catalogVariants: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.catalogVariants),
      emptyTitle: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.emptyTitle),
      emptyMessage: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.emptyMessage),
      recentTitle: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.recentTitle),
      recentEmpty: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.recentEmpty),
      recentLink: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.recentLink),
      recentPaymentsTitle: translateDashboardKey(
        culture,
        DASHBOARD_TRANSLATION_KEYS.recentPaymentsTitle,
      ),
      recentPaymentsEmpty: translateDashboardKey(
        culture,
        DASHBOARD_TRANSLATION_KEYS.recentPaymentsEmpty,
      ),
      recentPaymentsLink: translateDashboardKey(
        culture,
        DASHBOARD_TRANSLATION_KEYS.recentPaymentsLink,
      ),
      recentUsersTitle: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.recentUsersTitle),
      recentUsersEmpty: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.recentUsersEmpty),
      recentUsersLink: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.recentUsersLink),
      seriesTitle: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.seriesTitle),
      seriesEmpty: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.seriesEmpty),
    };
  });

  /**
   * Culture-formatted section facts (display only — never inputs to
   * math). A `null` entry means the caller is not entitled to that
   * section and its card renders nothing.
   */
  protected readonly facts = computed(() => {
    const culture = this.cultures.culture();
    const snapshot = this.slot().data;
    if (snapshot === null) {
      return null;
    }
    const copy = this.copy();
    const orders = snapshot.orders;
    const payments = snapshot.payments;
    const inventory = snapshot.inventory;
    const catalog = snapshot.catalog;
    const users = snapshot.users;
    return {
      orders:
        orders === null || orders === undefined
          ? null
          : [
              { label: copy.ordersPending, value: formatNumber(orders.pending, culture) },
              { label: copy.ordersConfirmed, value: formatNumber(orders.confirmed, culture) },
              { label: copy.ordersCancelled, value: formatNumber(orders.cancelled, culture) },
            ],
      payments:
        payments === null || payments === undefined
          ? null
          : [
              {
                label: copy.paymentsSucceeded,
                value: formatNumber(payments.succeeded, culture),
              },
              { label: copy.paymentsFailed, value: formatNumber(payments.failed, culture) },
              {
                label: copy.paymentsRefunded,
                value: formatNumber(payments.refunded, culture),
              },
              ...netRevenueByCurrency(
                payments.totalsByCurrency,
                payments.refundedTotalsByCurrency,
              ).map((entry) => ({
                label: `${entry.currency} · ${copy.paymentsNet}`,
                value: formatCurrency(entry.netAmount, entry.currency, culture),
              })),
            ],
      inventory:
        inventory === null || inventory === undefined
          ? null
          : [
              {
                label: copy.inventoryOnHand,
                value: formatNumber(inventory.totalOnHand, culture),
              },
              {
                label: copy.inventoryReserved,
                value: formatNumber(inventory.totalReserved, culture),
              },
              {
                label: copy.inventoryLowStock,
                value: formatNumber(inventory.lowStockItems, culture),
              },
            ],
      catalog:
        catalog === null || catalog === undefined
          ? null
          : [
              {
                label: copy.catalogProducts,
                value: formatNumber(catalog.totalProducts, culture),
              },
              {
                label: copy.catalogActiveProducts,
                value: formatNumber(catalog.activeProducts, culture),
              },
              {
                label: copy.catalogCategories,
                value: formatNumber(catalog.totalCategories, culture),
              },
              {
                label: copy.catalogVariants,
                value: formatNumber(catalog.totalVariants, culture),
              },
            ],
      users:
        users === null || users === undefined
          ? null
          : [
              { label: copy.usersAdmins, value: formatNumber(users.admins, culture) },
              {
                label: copy.usersSuperAdmins,
                value: formatNumber(users.superAdmins, culture),
              },
              {
                label: copy.usersCustomers,
                value: formatNumber(users.customers, culture),
              },
            ],
    };
  });

  /** Whether any section is entitled (the honest-empty-dashboard gate). */
  protected readonly hasSections = computed(() => hasEntitledSections(this.slot().data));

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

  /** Preformatted recent-payment rows (backend values only, newest 5). */
  protected readonly recentPayments = computed(() => {
    const culture = this.cultures.culture();
    return (this.slot().data?.recentPayments ?? []).map((payment) => ({
      paymentId: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      total: formatCurrency(payment.amount, payment.currency, culture),
      created: formatDate(payment.createdAtUtc, culture),
    }));
  });

  /** Preformatted recent-user rows (backend values only, newest 5). */
  protected readonly recentUsers = computed(() => {
    const culture = this.cultures.culture();
    return (this.slot().data?.recentUsers ?? []).map((user) => ({
      userId: user.id,
      email: user.email,
      displayName: user.displayName ?? `${user.firstName} ${user.lastName}`.trim(),
      roles: user.roles.join(', '),
    }));
  });

  /** Trailing-days series points (backend values only, oldest-first). */
  protected readonly seriesPoints = computed(() => this.slot().data?.dailySeries ?? []);

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
