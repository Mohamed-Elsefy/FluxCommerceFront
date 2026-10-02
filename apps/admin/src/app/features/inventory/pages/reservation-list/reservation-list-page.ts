/**
 * Admin reservation list page for Supplement S1, Step S1.7 — Inventory
 * Lists & Counts (reservation slice).
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `ReservationListState` (route-provided `inventoryRoutes` entry —
 * never a global store), rendering the paged reservation table through
 * the shared admin primitives.
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * ReservationListPage (this file — orchestration only)
 *     ↓ ReservationListState (../state — paged slot + committed filters/page)
 *     ↓ InventoryAdminApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Inventory API
 * ```
 *
 * Contract fidelity (S1.1 audit — only backend-exposed options):
 * `GET /inventory/reservations` exposes paging plus `status` (exact
 * backend name), `sku` (exact, normalized), and `orderId` filters,
 * fixed newest-first ordering — no `sortBy`, no other filters. Filter
 * commits reset to page 1. Status renders as localized text through
 * the single `reservationStatusDisplay` site (forward-compatible
 * unknown fallback — see `ENUM_REFERENCE.md` §8); the lifecycle
 * itself stays entirely backend-owned (no transitions, no gates).
 * Reservation ids deep-link to the lookup page through the sanctioned
 * per-column row links — every listed route exists, so no dead links
 * ship.
 *
 * Resource states: idle → loading → success | empty | error through the
 * shared primitives with localized copy and retry (out-of-range pages
 * arrive as `200` with `items: []` — the empty state, never an error).
 * Failures resolve through `resolveApiErrorMessage` (never backend
 * text, `Inventory.ValidationFailed` included).
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 */

import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  CultureService,
  formatDate,
  formatNumber,
  resolveApiErrorMessage,
  translateKey,
} from '@flux/i18n';
import { ErrorState } from '@flux/ui';
import { AdminDataTable, type AdminDataColumn } from '../../../../shared/data-table/data-table';
import { AdminFilterBar } from '../../../../shared/filters/filter-bar/filter-bar';
import { AdminSelect, type AdminSelectOption } from '../../../../shared/forms/select/select';
import { AdminTextInput } from '../../../../shared/forms/text-input/text-input';
import {
  AdminPagination,
  type AdminPaginationCopy,
} from '../../../../shared/pagination/pagination';
import { ReservationListState } from '../../state/reservation-list-state';
import {
  reservationStatusDisplay,
  type AdminReservationRow,
} from '../../models/inventory-admin.models';
import {
  INVENTORY_TRANSLATION_KEYS,
  translateInventoryKey,
} from '../../i18n/inventory-translations';

const RESERVATION_STATUSES: readonly string[] = ['Pending', 'Committed', 'Released', 'Expired'];

/** Backend wire value behind a reservation status filter name. */
const RESERVATION_STATUS_NUMBERS: Readonly<Record<string, number>> = {
  Pending: 0,
  Committed: 1,
  Released: 2,
  Expired: 3,
};

@Component({
  selector: 'app-reservation-list-page',
  imports: [
    ReactiveFormsModule,
    AdminDataTable,
    AdminFilterBar,
    AdminSelect,
    AdminTextInput,
    AdminPagination,
    ErrorState,
  ],
  templateUrl: './reservation-list-page.html',
  styleUrl: './reservation-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationListPage implements OnInit {
  private readonly reservations = inject(ReservationListState);
  private readonly cultures = inject(CultureService);
  private readonly formBuilder = inject(FormBuilder);

  /** Current reservation page (idle → loading → success | empty | error). */
  protected readonly slot = this.reservations.page;

  /** Filter form (status select plus exact sku/orderId text). */
  protected readonly filters = this.formBuilder.nonNullable.group({
    status: [''],
    sku: [''],
    orderId: [''],
  });

  /** Whether the table body shows the loading state. */
  protected readonly tableLoading = computed(() => {
    const status = this.slot().status;
    return status === 'idle' || status === 'loading';
  });

  /** Localized table columns for the active culture. */
  protected readonly columns = computed((): readonly AdminDataColumn<AdminReservationRow>[] => {
    const culture = this.cultures.culture();
    return [
      {
        key: 'reservation',
        header: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsListColId),
        value: (row) => row.reservationId,
        link: (row) => `/inventory/reservations/${row.reservationId}`,
      },
      {
        key: 'order',
        header: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsListColOrder),
        value: (row) => row.orderId,
      },
      {
        key: 'sku',
        header: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsListColSku),
        value: (row) => row.sku,
      },
      {
        key: 'quantity',
        header: translateInventoryKey(
          culture,
          INVENTORY_TRANSLATION_KEYS.reservationsListColQuantity,
        ),
        value: (row) => formatNumber(row.quantity, culture),
      },
      {
        key: 'status',
        header: translateInventoryKey(
          culture,
          INVENTORY_TRANSLATION_KEYS.reservationsListColStatus,
        ),
        value: (row) => this.statusText(row.status),
      },
      {
        key: 'expires',
        header: translateInventoryKey(
          culture,
          INVENTORY_TRANSLATION_KEYS.reservationsListColExpires,
        ),
        value: (row) => formatDate(row.expiresAt, culture),
      },
    ];
  });

  /** Localized status select options (All + backend status names). */
  protected readonly statusOptions = computed((): readonly AdminSelectOption[] => {
    const culture = this.cultures.culture();
    return [
      { value: '', label: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.filterAll) },
      ...RESERVATION_STATUSES.map((status) => ({
        value: status,
        label: this.statusText(RESERVATION_STATUS_NUMBERS[status] ?? -1),
      })),
    ];
  });

  /** Current page rows (`[]` until settled). */
  protected readonly rows = computed(() => this.slot().data?.items ?? []);

  /** Whether the pager renders (a settled page exists). */
  protected readonly showPager = computed(() => this.slot().data !== null);

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsListHeading),
      subheading: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsListSubheading,
      ),
      caption: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsListCaption),
      loading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.reservationsListLoading),
      emptyTitle: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsListEmptyTitle,
      ),
      emptyMessage: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsListEmptyMessage,
      ),
      errorTitle: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsListErrorTitle,
      ),
      retry: translateKey(culture, 'common.actions.retry'),
      filterTitle: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsListFilterTitle,
      ),
      filterStatus: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsListFilterStatus,
      ),
      filterSku: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsListFilterSku,
      ),
      filterOrderId: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsListFilterOrderId,
      ),
      filterClear: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsListFilterClear,
      ),
      filterApply: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.reservationsListFilterApply,
      ),
    };
  });

  /** Localized pager copy for the active culture. */
  protected readonly pagerCopy = computed((): AdminPaginationCopy => {
    const culture = this.cultures.culture();
    return {
      label: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.paginationLabel),
      first: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.paginationFirst),
      previous: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.paginationPrevious),
      next: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.paginationNext),
      last: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.paginationLast),
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.slot().error, this.cultures.culture()),
  );

  ngOnInit(): void {
    this.reservations.load();
  }

  /** Commits the filter form (resets to page 1). */
  protected applyFilters(): void {
    const raw = this.filters.getRawValue();
    this.reservations.setFilters({ status: raw.status, sku: raw.sku, orderId: raw.orderId });
  }

  /** Clears the filter form and reloads unfiltered. */
  protected clearFilters(): void {
    this.filters.reset({ status: '', sku: '', orderId: '' });
    this.reservations.setFilters({});
  }

  /** Commits a pager move (response-effective values re-render the pager). */
  protected onPageChange(pageNumber: number): void {
    this.reservations.setPage(pageNumber);
  }

  /** List retry re-enters the current effective page. */
  protected retry(): void {
    this.reservations.reload();
  }

  /** Localized status text (single mapping site, unknown-safe). */
  private statusText(status: number): string {
    const culture = this.cultures.culture();
    const display = reservationStatusDisplay(status);
    return translateInventoryKey(culture, display.labelKey, { value: String(status) });
  }
}
