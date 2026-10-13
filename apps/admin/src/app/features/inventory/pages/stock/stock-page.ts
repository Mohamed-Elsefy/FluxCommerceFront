/**
 * Admin stock lookup page for Sub-Phase 13.9 — Stock & Inventory Status
 * — plus Supplement S1, Step S1.7 (deep-link target).
 *
 * Smart page (route-level composition) within the inventory context:
 * reads the feature-scoped `StockState` (route-provided
 * `inventoryRoutes` entry — never a global store) and renders one SKU
 * lookup at a time through the shared async UI. Mounted at both
 * `/inventory/stock` (manual lookup form) and `/inventory/stock/:sku`
 * (deep link from the stock list — the route param auto-loads on entry
 * and on param changes).
 *
 * Display contract (13.1 audit — only backend-exposed capabilities):
 * `GET /inventory/{sku}` is the single-resource stock read. The record
 * renders the backend-issued quantities verbatim (`onHandQuantity`,
 * `reservedQuantity`, `availableQuantity`) plus the update timestamp:
 * `availableQuantity` is never derived client-side, no status or
 * threshold is invented (a "low stock" badge would be an undelegated
 * business rule), and no product/variant name resolves (the payload
 * carries the SKU alone and no lookup-by-SKU endpoint exists).
 *
 * Resource states: idle (entry prompt) → loading → success | error
 * with retry. There is no separate empty state: a single-resource read
 * either returns its record or fails (unknown SKUs surface as `404`
 * through the error state, never as an empty list). Failures resolve
 * through `resolveApiErrorMessage` (never backend text).
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - Stock lists, filtering, or pagination (owned by the stock list
 *   page in S1.7 — no shared logic, separate state).
 * - 13.10 — no reservation lookups, no adjustment forms.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { CultureService, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { Card, EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { AdminSearchInput } from '../../../../shared/filters/search-input/search-input';
import { StockState } from '../../state/stock-state';
import {
  INVENTORY_TRANSLATION_KEYS,
  translateInventoryKey,
} from '../../i18n/inventory-translations';

@Component({
  selector: 'app-stock-page',
  imports: [ReactiveFormsModule, AdminSearchInput, Card, EmptyState, ErrorState, LoadingIndicator],
  templateUrl: './stock-page.html',
  styleUrl: './stock-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockPage {
  private readonly stock = inject(StockState);
  private readonly cultures = inject(CultureService);

  /** Route SKU (`null` on the manual-lookup entry — deep links carry it). */
  private readonly routeSku = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('sku'))),
    { initialValue: null as string | null },
  );

  /** SKU editor control (presence validated; normalization lives in the state). */
  protected readonly skuControl = new FormControl<string | null>(null, {
    validators: [Validators.required],
  });

  /** Lookup form group (owns the `ngSubmit` output the template binds). */
  protected readonly form = new FormGroup({ sku: this.skuControl });

  constructor() {
    // Deep-link drive: a present `:sku` param auto-loads (initial value
    // included, param changes followed). Runs `untracked` so settled
    // responses never reschedule the effect — the param is the only
    // dependency. Manual lookups keep working alongside.
    effect(() => {
      const sku = this.routeSku();
      untracked(() => {
        if (sku !== null) {
          this.stock.lookup(sku);
        }
      });
    });
  }

  /** Current stock record (idle → loading → success | error). */
  protected readonly slot = this.stock.stock;

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockHeading),
      subheading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockSubheading),
      skuLabel: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockSkuLabel),
      skuPlaceholder: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.stockSkuPlaceholder,
      ),
      skuClear: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockSkuClear),
      lookup: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockLookup),
      idleTitle: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockIdleTitle),
      idleMessage: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockIdleMessage),
      loading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockLoading),
      errorTitle: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      factSku: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockFactSku),
      factOnHand: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockFactOnHand),
      factReserved: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockFactReserved),
      factAvailable: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockFactAvailable),
      factUpdated: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockFactUpdated),
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.slot().error, this.cultures.culture()),
  );

  /**
   * Submits the editor value. Invalid submits only mark the field;
   * duplicate in-flight submits no-op at the state level.
   */
  protected submit(): void {
    this.skuControl.markAsTouched();
    if (this.skuControl.invalid) {
      return;
    }
    this.stock.lookup(this.skuControl.value);
  }

  /** Lookup retry re-enters the current editor value. */
  protected retry(): void {
    this.stock.lookup(this.skuControl.value);
  }
}
