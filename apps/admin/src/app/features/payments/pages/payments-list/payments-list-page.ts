/**
 * Admin payments list page for Supplement S1, Step S1.9 — Payments:
 * Mine + Admin + Stats (platform-wide filters).
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `PaymentsListState` (route-provided `paymentsRoutes` entry — never a
 * global store), rendering the paged payments table through the shared
 * admin primitives.
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * PaymentsListPage (this file — orchestration only)
 *     ↓ PaymentsListState (../state — paged slot + committed filters/page)
 *     ↓ PaymentsAdminApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Payments API
 * ```
 *
 * Contract fidelity (S1.1 audit — only backend-exposed options):
 * `GET /admin/payments` exposes paging plus `status`/`orderId`/
 * `customerId`/`from`/`to`, fixed newest-first — no `sortBy`, no other
 * filters. Filter commits reset to page 1; unknown `status` or
 * `from > to` surfaces as backend `400` (never validated client-side
 * beyond presence). The table shows every backend-issued summary field
 * the contract carries (intent reference, provider, amount, status,
 * creation time). Pager values always come from the RESPONSE envelope
 * (effective `pageNumber`/`pageSize`/`totalCount`) with page counts
 * from the shared `totalPagesOf` helper. Status renders through the
 * feature-owned `AdminPaymentStatusBadge` (localized label + tone,
 * verbatim fallback for unknown values — the single status mapping
 * site, no scattered string comparisons). Money renders
 * culture-formatted for display only (never inputs to math).
 *
 * Resource states: idle → loading → success | empty | error through the
 * shared primitives with localized copy and retry (out-of-range pages
 * arrive as `200` with `items: []` — the empty state, never an error).
 * Failures resolve through `resolveApiErrorMessage` (never backend
 * text). References deep-link to the details route through the
 * sanctioned per-column row links — every listed route exists, so no
 * dead links ship.
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  CultureService,
  formatCurrency,
  formatDate,
  resolveApiErrorMessage,
  translateKey,
} from '@flux/i18n';
import { ErrorState } from '@flux/ui';
import {
  AdminDataTable,
  type AdminDataColumn,
  type AdminDataRowContext,
} from '../../../../shared/data-table/data-table';
import { AdminDateRange } from '../../../../shared/filters/date-range/date-range';
import { AdminFilterBar } from '../../../../shared/filters/filter-bar/filter-bar';
import { AdminSelect, type AdminSelectOption } from '../../../../shared/forms/select/select';
import { AdminTextInput } from '../../../../shared/forms/text-input/text-input';
import {
  AdminPagination,
  type AdminPaginationCopy,
} from '../../../../shared/pagination/pagination';
import { AdminPaymentStatusBadge } from '../../components/payment-status-badge/payment-status-badge';
import { PaymentsListState } from '../../state/payments-list-state';
import type { AdminPaymentRow } from '../../models/payments-admin.models';
import { PAYMENTS_TRANSLATION_KEYS, translatePaymentsKey } from '../../i18n/payments-translations';

@Component({
  selector: 'app-payments-list-page',
  imports: [
    ReactiveFormsModule,
    AdminDataTable,
    AdminDateRange,
    AdminFilterBar,
    AdminSelect,
    AdminTextInput,
    AdminPagination,
    ErrorState,
    AdminPaymentStatusBadge,
  ],
  templateUrl: './payments-list-page.html',
  styleUrl: './payments-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsListPage implements OnInit {
  private readonly payments = inject(PaymentsListState);
  private readonly cultures = inject(CultureService);
  private readonly formBuilder = inject(FormBuilder);

  /** Status cell template (badge per row — resolved after view init). */
  private readonly statusCell =
    viewChild<TemplateRef<AdminDataRowContext<AdminPaymentRow>>>('statusCell');

  /** Current payment page (idle → loading → success | empty | error). */
  protected readonly slot = this.payments.page;

  /**
   * Filter form (status select plus order/customer/date text — all
   * optional; blanks travel as omissions). Dates ride as ISO strings;
   * `from > to` surfaces as backend `400` (never validated here).
   */
  protected readonly filters = this.formBuilder.nonNullable.group({
    status: [''],
    orderId: [''],
    customerId: [''],
    from: [''],
    to: [''],
  });

  /** Whether the table body shows the loading state. */
  protected readonly tableLoading = computed(() => {
    const status = this.slot().status;
    return status === 'idle' || status === 'loading';
  });

  /** Localized table columns for the active culture. */
  protected readonly columns = computed((): readonly AdminDataColumn<AdminPaymentRow>[] => {
    const culture = this.cultures.culture();
    return [
      {
        key: 'reference',
        header: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.listColReference),
        value: (row) => row.providerPaymentIntentId ?? row.id,
        link: (row) => `/payments/${row.id}`,
      },
      {
        key: 'provider',
        header: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.listColProvider),
        value: (row) => row.provider ?? '—',
      },
      {
        key: 'amount',
        header: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.listColAmount),
        value: (row) => formatCurrency(row.amount, row.currency, culture),
      },
      {
        key: 'status',
        header: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.listColStatus),
        value: (row) => row.status,
        template: this.statusCell() ?? null,
      },
      {
        key: 'created',
        header: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.listColCreated),
        value: (row) => formatDate(row.createdAtUtc, culture),
      },
    ];
  });

  /** Current page rows (`[]` until settled). */
  protected readonly rows = computed(() => this.slot().data?.items ?? []);

  /** Whether the pager renders (a settled page exists). */
  protected readonly showPager = computed(() => this.slot().data !== null);

  /** Localized status select options (All + backend status names). */
  protected readonly statusOptions = computed((): readonly AdminSelectOption[] => {
    const culture = this.cultures.culture();
    return [
      { value: '', label: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.filterAll) },
      {
        value: 'Pending',
        label: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.statusPending),
      },
      {
        value: 'Processing',
        label: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.statusProcessing),
      },
      {
        value: 'Succeeded',
        label: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.statusSucceeded),
      },
      {
        value: 'Failed',
        label: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.statusFailed),
      },
      {
        value: 'Cancelled',
        label: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.statusCancelled),
      },
      {
        value: 'Refunded',
        label: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.statusRefunded),
      },
    ];
  });

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.listHeading),
      subheading: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.listSubheading),
      caption: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.listCaption),
      loading: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.listLoading),
      emptyTitle: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.listEmptyTitle),
      emptyMessage: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.listEmptyMessage),
      errorTitle: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.listErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      filterTitle: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.filterTitle),
      filterStatus: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.filterStatus),
      filterOrder: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.filterOrder),
      filterCustomer: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.filterCustomer),
      filterFrom: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.filterFrom),
      filterTo: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.filterTo),
      filterClear: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.filterClear),
      filterApply: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.filterApply),
    };
  });

  /** Localized pager copy for the active culture. */
  protected readonly pagerCopy = computed((): AdminPaginationCopy => {
    const culture = this.cultures.culture();
    return {
      label: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.paginationLabel),
      first: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.paginationFirst),
      previous: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.paginationPrevious),
      next: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.paginationNext),
      last: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.paginationLast),
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.slot().error, this.cultures.culture()),
  );

  ngOnInit(): void {
    this.payments.load();
  }

  /** Commits the filter form (resets to page 1). */
  protected applyFilters(): void {
    const raw = this.filters.getRawValue();
    this.payments.setFilters({
      status: raw.status,
      orderId: raw.orderId,
      customerId: raw.customerId,
      from: raw.from,
      to: raw.to,
    });
  }

  /** Clears the filter form and reloads unfiltered. */
  protected clearFilters(): void {
    this.filters.reset({ status: '', orderId: '', customerId: '', from: '', to: '' });
    this.payments.setFilters({});
  }

  /** Commits a pager move (response-effective values re-render the pager). */
  protected onPageChange(pageNumber: number): void {
    this.payments.setPage(pageNumber);
  }

  /** List retry re-enters the current effective page. */
  protected retry(): void {
    this.payments.reload();
  }
}
