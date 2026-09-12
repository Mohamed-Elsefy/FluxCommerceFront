/**
 * Selected-variant commercial component for Sub-Phase 6.5 — SKU Binding.
 *
 * Presentation only: renders HOW the selected variant's commercial
 * information looks (SKU definition row, no-selection prompt, unavailable
 * notice). The owning page decides WHEN and WHAT — the selected variant
 * arrives as an input from feature state. No API access, no HTTP —
 * presentational components never call the Catalog API (`ARCHITECTURE.md`
 * §8).
 *
 * Contract fidelity (§6.5 rules — strictly backend-driven, never
 * calculated, never fabricated):
 * - SKU renders from `VariantResponse.sku` only, read live off the input
 *   on every change-detection pass — switching variants cannot leave stale
 *   variant-specific information visible by construction.
 * - Price renders nowhere: no anonymous/customer read contract exposes one
 *   (`VariantResponse` carries no price/currency fields; checkout reprices
 *   authoritatively server-side per `API_CONTRACT.md` §4).
 * - Availability counts render nowhere: inventory reads are `Admin`-only
 *   (`API_CONTRACT.md` §5) and this storefront must not depend on them.
 *   "Unavailable" here means exactly what the customer-visible contract
 *   provides — a selected variant that is no longer selectable (inactive
 *   or deleted on refetch) — announced via `role="alert"` because it
 *   appears asynchronously from a settled refetch.
 *   (See also `ARCHITECTURE.md` §21: price/availability are not fabricated.)
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

  /** No-selection prompt (page-localized, required). */
  @Input({ required: true }) selectPrompt!: string;

  /** Unavailable notice (page-localized, required). */
  @Input({ required: true }) unavailableMessage!: string;

  /** Whether `variant` is still orderable (selectable per the contract). */
  protected isSelectable(variant: ProductVariant): boolean {
    return isSelectableVariant(variant);
  }
}
