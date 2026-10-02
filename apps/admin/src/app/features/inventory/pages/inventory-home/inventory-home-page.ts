/**
 * Admin Inventory landing page for Sub-Phases 13.8–13.10 — Inventory
 * Foundation plus its slices — plus Supplement S1, Step S1.7 (counts
 * overview).
 *
 * Page structure (same convention as the 12.4 dashboard foundation):
 * a localized page header, the backend-issued counts overview, plus
 * one card per inventory section. Cards link to their live routes —
 * never anywhere else, so no dead functionality ships. Every counts
 * bucket echoes verbatim for display (never an input to math).
 *
 * SSR/hydration safe: signals plus static metadata, no browser APIs.
 * RTL safe: grid auto-flow follows the document direction; logical
 * properties only.
 */

import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CultureService, formatNumber, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { Card, ErrorState, LoadingIndicator } from '@flux/ui';
import { InventoryCountsState } from '../../state/inventory-counts-state';
import {
  INVENTORY_TRANSLATION_KEYS,
  translateInventoryKey,
} from '../../i18n/inventory-translations';

interface InventorySection {
  readonly titleKey: string;
  readonly descriptionKey: string;
  /** Live section route (every section is routed — no placeholders remain). */
  readonly route: string;
}

/** Inventory sections in portal order. */
const INVENTORY_SECTIONS: readonly InventorySection[] = [
  {
    titleKey: INVENTORY_TRANSLATION_KEYS.stockTitle,
    descriptionKey: INVENTORY_TRANSLATION_KEYS.stockDescription,
    route: '/inventory/stock',
  },
  {
    titleKey: INVENTORY_TRANSLATION_KEYS.reservationsTitle,
    descriptionKey: INVENTORY_TRANSLATION_KEYS.reservationsDescription,
    route: '/inventory/reservations',
  },
  {
    titleKey: INVENTORY_TRANSLATION_KEYS.adjustmentsTitle,
    descriptionKey: INVENTORY_TRANSLATION_KEYS.adjustmentsDescription,
    route: '/inventory/adjustments',
  },
  {
    titleKey: INVENTORY_TRANSLATION_KEYS.newItemSectionTitle,
    descriptionKey: INVENTORY_TRANSLATION_KEYS.newItemSectionDescription,
    route: '/inventory/new',
  },
];

@Component({
  selector: 'app-inventory-home-page',
  imports: [RouterLink, Card, ErrorState, LoadingIndicator],
  templateUrl: './inventory-home-page.html',
  styleUrl: './inventory-home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryHomePage implements OnInit {
  private readonly cultures = inject(CultureService);
  private readonly counts = inject(InventoryCountsState);

  /** Current counts snapshot (idle → loading → success | error). */
  protected readonly slot = this.counts.counts;

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.title),
      subtitle: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.subtitle),
      countsHeading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.homeCountsHeading),
      countsLoading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.homeCountsLoading),
      countsErrorTitle: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.homeCountsErrorTitle,
      ),
      retry: translateKey(culture, 'common.actions.retry'),
      factTotalItems: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.homeCountTotalItems,
      ),
      factTotalOnHand: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.homeCountTotalOnHand,
      ),
      factTotalReserved: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.homeCountTotalReserved,
      ),
      factLowStock: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.homeCountLowStock),
      factPendingReservations: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.homeCountPendingReservations,
      ),
      factCommittedReservations: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.homeCountCommittedReservations,
      ),
      factReleasedReservations: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.homeCountReleasedReservations,
      ),
      factExpiredReservations: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.homeCountExpiredReservations,
      ),
      sections: INVENTORY_SECTIONS.map((section) => ({
        title: translateInventoryKey(culture, section.titleKey),
        description: translateInventoryKey(culture, section.descriptionKey),
        route: section.route,
      })),
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.slot().error, this.cultures.culture()),
  );

  /** Culture-formatted counts facts (display only — never inputs to math). */
  protected readonly facts = computed(() => {
    const culture = this.cultures.culture();
    const data = this.slot().data;
    if (data === null) {
      return [];
    }
    const copy = this.copy();
    return [
      { label: copy.factTotalItems, value: formatNumber(data.totalItems, culture) },
      { label: copy.factTotalOnHand, value: formatNumber(data.totalOnHand, culture) },
      { label: copy.factTotalReserved, value: formatNumber(data.totalReserved, culture) },
      { label: copy.factLowStock, value: formatNumber(data.lowStockItems, culture) },
      {
        label: copy.factPendingReservations,
        value: formatNumber(data.pendingReservations, culture),
      },
      {
        label: copy.factCommittedReservations,
        value: formatNumber(data.committedReservations, culture),
      },
      {
        label: copy.factReleasedReservations,
        value: formatNumber(data.releasedReservations, culture),
      },
      {
        label: copy.factExpiredReservations,
        value: formatNumber(data.expiredReservations, culture),
      },
    ];
  });

  ngOnInit(): void {
    this.counts.load();
  }

  /** Counts retry re-enters a fresh snapshot. */
  protected retry(): void {
    this.counts.reload();
  }
}
