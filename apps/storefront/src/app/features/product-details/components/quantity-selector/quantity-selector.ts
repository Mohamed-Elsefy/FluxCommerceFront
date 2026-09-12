/**
 * Quantity selector component for Sub-Phase 6.6 — Quantity Selection.
 *
 * Presentation only: renders HOW the purchase quantity looks (decrement /
 * increment buttons around a numeric textbox). The owning page decides WHEN
 * and WHAT — the committed quantity arrives as an input and every valid
 * change leaves through `quantityChange` (controlled, same convention as
 * `SearchInput`: no timers, no debounce here). No API access, no HTTP —
 * presentational components never call the Catalog API (`ARCHITECTURE.md`
 * §8).
 *
 * Bounds (§6.6 — contract-driven): the decrement control disables at
 * `MIN_QUANTITY` (the contract's cart quantity floor); there is no maximum
 * clamp because the contract defines none. Textbox keystrokes parse
 * through `parseQuantityInput` — invalid text (empty, signed, decimal,
 * non-numeric, below-minimum) raises the localized inline error and never
 * emits, so invalid quantities can never reach feature state; blur reverts
 * the draft to the committed value.
 *
 * Accessibility: native buttons (`type="button"`, localized `aria-label`s)
 * give Tab/Enter/Space free; the textbox carries `inputmode="numeric"`,
 * `aria-invalid`, and an `aria-describedby` error reference announced via
 * `role="alert"`. Visible `:focus-visible` indicators on every control.
 *
 * SSR/hydration safe: markup derives from inputs and signals only — no
 * `window`/`document`/`localStorage`. RTL safe: logical properties only,
 * no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here): add-to-cart
 * actions (Sub-Phase 6.7).
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { MIN_QUANTITY, parseQuantityInput } from '../../models/product-details.models';

@Component({
  selector: 'product-details-quantity-selector',
  templateUrl: './quantity-selector.html',
  styleUrl: './quantity-selector.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuantitySelector {
  /** Committed quantity to display (page-owned, echoed back). */
  @Input({ required: true }) quantity!: number;

  /** Visible group heading (page-localized, required). */
  @Input({ required: true }) label!: string;

  /** Decrement button label (page-localized, required). */
  @Input({ required: true }) decreaseLabel!: string;

  /** Increment button label (page-localized, required). */
  @Input({ required: true }) increaseLabel!: string;

  /** Invalid-input note (page-localized, required). */
  @Input({ required: true }) invalidMessage!: string;

  /** Emitted with the new quantity on every valid change (never invalid). */
  @Output() readonly quantityChange = new EventEmitter<number>();

  /** Contract quantity floor, exposed for the decrement disabled state. */
  protected readonly minQuantity = MIN_QUANTITY;

  /** Whether the current textbox draft failed parsing (inline error). */
  private readonly draftInvalid = signal(false);

  /** Whether the inline validation error shows. */
  protected showInvalid(): boolean {
    return this.draftInvalid();
  }

  /** Emits `quantity - 1` unless already at the minimum (button also disables). */
  decrease(): void {
    if (this.quantity > MIN_QUANTITY) {
      this.quantityChange.emit(this.quantity - 1);
    }
  }

  /** Emits `quantity + 1` (no contract maximum exists to clamp). */
  increase(): void {
    this.quantityChange.emit(this.quantity + 1);
  }

  /**
   * Validates raw keystrokes: valid text emits immediately and clears the
   * error; invalid text raises the error and emits nothing. Public so the
   * prevention stays directly unit-testable (same convention as
   * `SearchInput.onInput`).
   */
  onInput(event: Event): void {
    const parsed = parseQuantityInput((event.target as HTMLInputElement).value);
    if (parsed === null) {
      this.draftInvalid.set(true);
    } else {
      this.draftInvalid.set(false);
      this.quantityChange.emit(parsed);
    }
  }

  /**
   * Reverts an invalid draft to the committed quantity on blur, so the
   * control never displays a value the state does not hold. Public for the
   * same testability reason as `onInput`.
   */
  onBlur(event: Event): void {
    if (this.draftInvalid()) {
      (event.target as HTMLInputElement).value = String(this.quantity);
      this.draftInvalid.set(false);
    }
  }
}
