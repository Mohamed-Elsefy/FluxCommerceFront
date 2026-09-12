/**
 * Variant selector component for Sub-Phase 6.4 — Variant Selection.
 *
 * Presentation only: renders HOW variant options look (a labelled group of
 * option buttons). The owning page decides WHEN and WHAT — the variant list
 * and the selected id arrive as inputs, and choices leave through
 * `selectionChange`. No API access, no HTTP — presentational components
 * never call the Catalog API (`ARCHITECTURE.md` §8).
 *
 * Contract fidelity (`DTO_REFERENCE.md` §2 — `VariantResponse`): variants
 * are a flat backend list (`name`/`sku`/`status`, no option dimensions, no
 * price/currency), so options show backend names only — no Color/Size/Style
 * grouping and no SKU/price/availability text (Sub-Phase 6.5 owns that
 * presentation). Selectability mirrors the feature helper
 * (`isSelectableVariant`: backend `Active` + non-deleted); anything else
 * renders disabled with the unavailable note and can never emit.
 *
 * Selection state itself lives in `ProductDetailsState` (feature-local);
 * this component is stateless beyond its inputs.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { isSelectableVariant, type ProductVariant } from '../../models/product-details.models';

@Component({
  selector: 'product-details-variant-selector',
  templateUrl: './variant-selector.html',
  styleUrl: './variant-selector.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariantSelector {
  /** Variants to offer (feature-loaded, flat backend list). */
  @Input({ required: true }) variants: readonly ProductVariant[] = [];

  /** Currently selected variant id (`null` = no explicit selection). */
  @Input() selectedVariantId: string | null = null;

  /** Visible group heading (page-localized, required). */
  @Input({ required: true }) label!: string;

  /** Unavailable note for disabled options (page-localized, required). */
  @Input({ required: true }) unavailableLabel!: string;

  /** Emitted with the variant id on valid selection (never for disabled options). */
  @Output() readonly selectionChange = new EventEmitter<string>();

  /** Whether `variant` can be selected (backend `Active`, non-deleted). */
  protected isSelectable(variant: ProductVariant): boolean {
    return isSelectableVariant(variant);
  }

  /** Whether `variant` carries the current selection. */
  protected isSelected(variant: ProductVariant): boolean {
    return this.selectedVariantId === variant.id;
  }

  /**
   * Emits a selection for selectable variants; silently ignores anything
   * else (defense in depth behind the native `disabled` attribute, which
   * already blocks pointer and keyboard activation). Public so the guard
   * stays directly unit-testable (same convention as `SearchInput.onInput`).
   */
  selectVariant(variant: ProductVariant): void {
    if (this.isSelectable(variant)) {
      this.selectionChange.emit(variant.id);
    }
  }
}
