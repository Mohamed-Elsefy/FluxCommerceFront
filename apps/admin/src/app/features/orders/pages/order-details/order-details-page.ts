/**
 * Admin order details page for Sub-Phases 14.5–14.7 — Order Details &
 * Customer Information + Payment Integration & Order-Payment
 * Presentation + Payment Details, Status & Failed Payments — plus
 * Supplement S1, Step S1.8 (force-cancel + refund actions).
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `OrderDetailsState` (route-provided `ordersRoutes` entry — never a
 * global store) for the single order slot, rendering header facts, the
 * line-items table, and the address-backed customer information through
 * the shared admin primitives. Cancel/refund submissions stay page-local
 * (the 13.10 adjustment pattern): success notifies and reloads the
 * order slot; failures notify with the resolved message.
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * OrderDetailsPage (this file — orchestration + page-local submissions)
 *     ↓ OrderDetailsState (../state — single order slot)
 *     ↓ OrdersAdminApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 *
 * Display contract (14.1 audit — only backend-exposed data): the single
 * `GET /admin/orders/{orderId}` payload carries everything below
 * verbatim — order number, string status (through the feature-owned
 * `OrderStatusBadge`), nested money objects on totals, split flat money
 * fields on line items, item counts, timestamps, and the
 * shipping/billing address echo. No totals math, no status derivation,
 * no customer-identity resolution: no `userId`/`customerId`/email/phone
 * exists on the payload, so the addresses are the complete customer
 * information (unknown ids mask as `404`, rendered through the shared
 * error state with retry, never probed). Money and counts render
 * culture-formatted for display only (never inputs to math). Failures
 * resolve through `resolveApiErrorMessage` (never backend text).
 *
 * Mutation contract (S1.1 audit — the backend stays authoritative):
 * Cancel shows for `Pending` orders only (force-cancel any `Pending`;
 * compensation flows via `order_cancelled`); Refund shows for
 * `Confirmed` orders only (paid orders — the refund completes
 * asynchronously via the saga, in-flight duplicates stay `200`
 * idempotent). Anything else surfaces as backend `409`
 * (`CancelConflict`/`RefundConflict`) — never predicted client-side
 * beyond the status gates. Both actions confirm through dialogs;
 * refund requires a 1..500-char reason. Duplicate submits lock while a
 * submission is in flight.
 *
 * Payment section (14.6–14.7 — the only order→payment linkage the
 * backend exposes): the by-order initialization read chained into the
 * single payment read, rendered as backend-issued facts (status through
 * the feature-owned `PaymentStatusBadge`, intent reference, provider,
 * amount). The live `clientSecret` never reaches the view (discarded at
 * the mapping boundary). Failed payments render the backend-supplied
 * `Failed` status with the `danger` tone — no failure reason exists on
 * the payload, so none is invented. `404` renders the empty notice;
 * `409` (`NotReady` saga lag and `NotPayable` terminal share the status
 * with no machine code on the wire) and other failures render the
 * retryable error state. Payment lifecycle and verification stay
 * backend-owned: this section presents, never confirms, polls, or
 * derives.
 *
 * Resource states: idle → loading → success | error through the shared
 * primitives with localized copy and retry. The line-items table reuses
 * the sanctioned `admin-data-table` (no fork); an order without line
 * items renders the table empty state.
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 14.8 — no payment history (no such endpoint).
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, type Observable } from 'rxjs';
import {
  CultureService,
  formatCurrency,
  formatDate,
  formatNumber,
  resolveApiErrorMessage,
  translateKey,
} from '@flux/i18n';
import { Card, EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { isApiError } from '@flux/api';
import type { OrderLineItemResponse } from '@flux/models';
import { AdminDataTable, type AdminDataColumn } from '../../../../shared/data-table/data-table';
import { AdminDialog } from '../../../../shared/dialog/dialog';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { AdminTextarea } from '../../../../shared/forms/textarea/textarea';
import { OrderStatusBadge } from '../../components/order-status-badge/order-status-badge';
import { PaymentStatusBadge } from '../../components/payment-status-badge/payment-status-badge';
import { OrdersAdminApiService } from '../../data-access/orders-admin-api.service';
import { OrderDetailsState } from '../../state/order-details-state';
import { OrderPaymentState } from '../../state/order-payment-state';
import { ORDERS_TRANSLATION_KEYS, translateOrdersKey } from '../../i18n/orders-translations';

/** Pending mutation behind the confirmation dialog (`null` = closed). */
type PendingOrderAction = 'cancel' | 'refund';

@Component({
  selector: 'app-order-details-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AdminDataTable,
    AdminDialog,
    AdminTextarea,
    Card,
    EmptyState,
    ErrorState,
    LoadingIndicator,
    OrderStatusBadge,
    PaymentStatusBadge,
  ],
  templateUrl: './order-details-page.html',
  styleUrl: './order-details-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailsPage {
  private readonly details = inject(OrderDetailsState);
  private readonly payment = inject(OrderPaymentState);
  private readonly ordersApi = inject(OrdersAdminApiService);
  private readonly cultures = inject(CultureService);
  private readonly notifications = inject(AdminNotificationService);
  private readonly formBuilder = inject(FormBuilder);

  /** Route order id (`null` until the first param emission). */
  private readonly orderId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: null as string | null },
  );

  /** Current order details (idle → loading → success | error). */
  protected readonly order = this.details.order;

  /** Current order payment (idle → loading → success | error). */
  protected readonly paymentSlot = this.payment.payment;

  constructor() {
    // Drives both slots from the route id (initial value included,
    // changes followed). Runs `untracked` on purpose: loads read and
    // write the slots, so without `untracked` every settled response
    // would reschedule the effect into an infinite fetch loop. The
    // effect depends on the route id alone. The payment slot stays
    // independent — its failures never hide settled order facts.
    effect(() => {
      const id = this.orderId();
      untracked(() => {
        this.details.load(id);
        this.payment.load(id);
      });
    });
  }

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const order = this.order().data;
    const payment = this.paymentSlot().data;
    return {
      back: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsBack),
      loading: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsLoading),
      errorTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      factNumber: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFactNumber),
      factItems: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFactItems),
      factCreated: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFactCreated),
      factSubtotal: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFactSubtotal),
      factShipping: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFactShipping),
      factDiscount: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFactDiscount),
      factTotal: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFactTotal),
      orderNumber: order?.orderNumber ?? '',
      items: order === null ? '' : formatNumber(order.itemCount, culture),
      created: order === null ? '' : formatDate(order.createdAtUtc, culture),
      subtotal:
        order === null
          ? ''
          : formatCurrency(order.subtotal.amount, order.subtotal.currency, culture),
      shipping:
        order === null
          ? ''
          : formatCurrency(order.shippingCost.amount, order.shippingCost.currency, culture),
      discount:
        order === null
          ? ''
          : formatCurrency(order.discount.amount, order.discount.currency, culture),
      total:
        order === null
          ? ''
          : formatCurrency(order.grandTotal.amount, order.grandTotal.currency, culture),
      itemsTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsItemsTitle),
      itemsEmpty: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsItemsEmpty),
      colProduct: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsColProduct),
      colSku: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsColSku),
      colQuantity: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsColQuantity),
      colUnitPrice: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsColUnitPrice),
      colLineTotal: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsColLineTotal),
      customerTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsCustomerTitle),
      shippingTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsShippingTitle),
      billingTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsBillingTitle),
      addrRecipient: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsAddrRecipient),
      addrStreet: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsAddrStreet),
      addrCity: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsAddrCity),
      addrRegion: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsAddrRegion),
      addrPostal: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsAddrPostal),
      addrCountry: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsAddrCountry),
      paymentTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.paymentTitle),
      paymentLoading: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.paymentLoading),
      paymentEmptyTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.paymentEmptyTitle),
      paymentEmptyMessage: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.paymentEmptyMessage),
      paymentErrorTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.paymentErrorTitle),
      paymentFactStatus: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.paymentFactStatus),
      paymentFactReference: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.paymentFactReference,
      ),
      paymentFactProvider: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.paymentFactProvider),
      paymentFactAmount: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.paymentFactAmount),
      paymentReference: payment?.reference ?? null,
      paymentProvider: payment?.provider ?? null,
      paymentAmount:
        payment === null ? '' : formatCurrency(payment.amount, payment.currency, culture),
    };
  });

  /** Payment status for the badge (`''` until settled — the badge is gated on data). */
  protected readonly paymentStatus = computed(() => this.paymentSlot().data?.status ?? '');

  /** Line-item table columns for the active culture. */
  protected readonly itemColumns = computed(
    (): readonly AdminDataColumn<OrderLineItemResponse>[] => {
      const culture = this.cultures.culture();
      const copy = this.copy();
      return [
        { key: 'product', header: copy.colProduct, value: (row) => row.productName },
        { key: 'sku', header: copy.colSku, value: (row) => row.sku },
        {
          key: 'quantity',
          header: copy.colQuantity,
          value: (row) => formatNumber(row.quantity, culture),
        },
        {
          key: 'unitPrice',
          header: copy.colUnitPrice,
          value: (row) => formatCurrency(row.unitPrice, row.unitPriceCurrency, culture),
        },
        {
          key: 'lineTotal',
          header: copy.colLineTotal,
          value: (row) => formatCurrency(row.lineTotal, row.lineTotalCurrency, culture),
        },
      ];
    },
  );

  /** Shipping address street lines joined for display (verbatim parts). */
  protected readonly shippingStreet = computed(() => streetOf(this.order().data?.shippingAddress));
  /** Billing address street lines joined for display (verbatim parts). */
  protected readonly billingStreet = computed(() => streetOf(this.order().data?.billingAddress));

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.order().error, this.cultures.culture()),
  );

  /** Localized payment failure message (never backend text). */
  protected readonly paymentErrorMessage = computed(() =>
    resolveApiErrorMessage(this.paymentSlot().error, this.cultures.culture()),
  );

  /** Whether the payment slot settled with no payment (missing or masked). */
  protected readonly paymentEmpty = computed(() => this.paymentSlot().error?.status === 404);

  /** Details retry reloads the slot for the current route id. */
  protected retry(): void {
    this.details.load(this.orderId());
  }

  /** Payment retry reloads the payment slot for the current route id. */
  protected retryPayment(): void {
    this.payment.load(this.orderId());
  }

  /** Refund reason editor (required, 1..500 chars — backend-owned bounds). */
  protected readonly reasonControl = this.formBuilder.nonNullable.control('');

  /** Submission in flight (actions lock, duplicate submits no-op). */
  protected readonly submitting = signal(false);

  /** Pending mutation behind the confirmation dialog (`null` = closed). */
  protected readonly pendingAction = signal<PendingOrderAction | null>(null);

  /** Whether the force-cancel action shows (order still `Pending`). */
  protected readonly canCancel = computed(() => this.order().data?.status === 'Pending');

  /** Whether the refund action shows (order `Confirmed`, i.e. paid). */
  protected readonly canRefund = computed(() => this.order().data?.status === 'Confirmed');

  /** Localized mutation copy for the active culture. */
  protected readonly actionCopy = computed(() => {
    const culture = this.cultures.culture();
    const order = this.order().data;
    return {
      actionsTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsActionsTitle),
      cancelAction: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsCancelAction),
      refundAction: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsRefundAction),
      cancelDialogTitle: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.detailsCancelDialogTitle,
      ),
      cancelDialogMessage: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.detailsCancelDialogMessage,
        { orderNumber: order?.orderNumber ?? '' },
      ),
      dialogConfirm: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsDialogConfirm),
      dialogCancel: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsDialogCancel),
      refundDialogTitle: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.detailsRefundDialogTitle,
      ),
      refundDialogMessage: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.detailsRefundDialogMessage,
        { orderNumber: order?.orderNumber ?? '' },
      ),
      refundReasonLabel: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.detailsRefundReasonLabel,
      ),
      notifyCancelTitle: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.detailsNotifyCancelTitle,
      ),
      notifyCancelMessage: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.detailsNotifyCancelMessage,
        { orderNumber: order?.orderNumber ?? '' },
      ),
      notifyRefundTitle: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.detailsNotifyRefundTitle,
      ),
      notifyRefundMessage: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.detailsNotifyRefundMessage,
        { orderNumber: order?.orderNumber ?? '' },
      ),
      notifyErrorTitle: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.detailsNotifyErrorTitle,
      ),
    };
  });

  /** Opens the force-cancel confirmation dialog. */
  protected askCancel(): void {
    this.pendingAction.set('cancel');
  }

  /** Opens the refund dialog with a cleared reason. */
  protected askRefund(): void {
    this.reasonControl.setValue('');
    this.pendingAction.set('refund');
  }

  /** Closes the mutation dialog without acting. */
  protected cancelMutation(): void {
    this.pendingAction.set(null);
  }

  /**
   * Confirms the pending mutation: closes the dialog first (duplicate
   * clicks cannot re-enter), then runs the call under the submit lock.
   * Success notifies and reloads details + payment; failures notify
   * with the resolved message (409 conflicts included — never retried
   * blindly).
   */
  protected confirmMutation(): void {
    const id = this.orderId();
    const action = this.pendingAction();
    this.pendingAction.set(null);
    if (id === null || action === null || this.submitting()) {
      return;
    }
    if (action === 'refund') {
      const reason = this.reasonControl.value.trim();
      if (reason === '' || reason.length > 500) {
        return;
      }
      this.runMutation(this.ordersApi.refundOrder(id, { reason }), action);
      return;
    }
    this.runMutation(this.ordersApi.cancelOrder(id), action);
  }

  /** Runs one mutation with notifications and post-success reload. */
  private runMutation(source: Observable<unknown>, action: PendingOrderAction): void {
    this.submitting.set(true);
    const id = this.orderId();
    source.subscribe({
      next: () => {
        this.submitting.set(false);
        this.details.load(id);
        this.payment.load(id);
        const culture = this.cultures.culture();
        const copy = this.actionCopy();
        this.notifications.success(
          action === 'cancel' ? copy.notifyCancelTitle : copy.notifyRefundTitle,
          action === 'cancel' ? copy.notifyCancelMessage : copy.notifyRefundMessage,
        );
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const culture = this.cultures.culture();
        this.notifications.error(
          this.actionCopy().notifyErrorTitle,
          isApiError(error)
            ? resolveApiErrorMessage(error, culture)
            : this.actionCopy().notifyErrorTitle,
        );
      },
    });
  }
}

/** Joins address street lines for display (line2 omitted when absent). */
function streetOf(address: { line1: string; line2?: string | null } | null | undefined): string {
  if (address === null || address === undefined) {
    return '';
  }
  return address.line2 === null || address.line2 === undefined || address.line2 === ''
    ? address.line1
    : `${address.line1}, ${address.line2}`;
}
