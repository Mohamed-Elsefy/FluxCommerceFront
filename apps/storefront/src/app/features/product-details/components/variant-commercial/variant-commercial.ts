/**
 * Selected-variant commercial component for Sub-Phase 6.5 — SKU Binding
 * (price row added with the priced-variant contract change, ADR 018).
 *
 * Presentation only: renders HOW the selected variant's commercial
 * information looks (SKU + backend-issued unit-price rows, no-selection
 * prompt, unavailable notice). The owning page decides WHEN and WHAT —
 * the selected variant arrives as an input from feature state and the
 * price arrives preformatted for the active culture (display only).
 * No API access, no HTTP — presentational components never call the
 * Catalog API (`ARCHITECTURE.md` §8).
 *
 * Contract fidelity (strictly backend-driven, never calculated, never
 * fabricated):
 * - SKU renders from `VariantResponse.sku` and unit price renders from
 *   the page-formatted backend snapshot (`unitPriceAmount` + `currency`
 *   via `formatCurrency` at the page — display only, never an input to
 *   math), both read live off the inputs on every change-detection pass
 *   — switching variants cannot leave stale variant-specific information
 *   visible by construction. A `null` price hides its row (tolerant
 *   rendering; the contract always carries one).
 * - Availability counts render nowhere: inventory reads are `Admin`-only
 *   (`API_CONTRACT.md` §5) and this storefront must not depend on them.
 *   "Unavailable" here means exactly what the customer-visible contract
 *   provides — a selected variant that is no longer selectable (inactive
 *   or deleted on refetch) — announced via `role="alert"` because it
 *   appears asynchronously from a settled refetch.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { isSelectableVariant, type ProductVariant } from '../../models/product-details.models';

@Component({
  selector: 'product-details-variant-commercial',
  templateUrl: './variant-commercial.html',
  styleUrl: './variant-commercial.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariantCommercial {
  /** Selected variant (`null` = nothing selected yet). */
  @Input() variant: ProductVariant | null = null;

  /** Visible section heading (page-localized, required). */
  @Input({ required: true }) title!: string;

  /** SKU row label (page-localized, required). */
  @Input({ required: true }) skuLabel!: string;

  /** Unit-price row label (page-localized, required). */
  @Input({ required: true }) priceLabel!: string;

  /**
   * Page-formatted backend unit-price snapshot for the active culture, or
   * `null` when absent (row hides — tolerant rendering, never broken money).
   */
  @Input({ required: true }) priceText!: string | null;

  /** No-selection prompt (page-localized, required). */
  @Input({ required: true }) selectPrompt!: string;

  /** Unavailable notice (page-localized, required). */
  @Input({ required: true }) unavailableMessage!: string;

  /** Whether `variant` is still orderable (selectable per the contract). */
  protected isSelectable(variant: ProductVariant): boolean {
    return isSelectableVariant(variant);
  }
}
