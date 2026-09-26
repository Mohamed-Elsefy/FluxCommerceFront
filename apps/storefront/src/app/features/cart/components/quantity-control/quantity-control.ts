/**
 * Cart line quantity control for Sub-Phase 7.4 — Cart Page & UI.
 *
 * Presentation only: renders HOW a cart line quantity looks (decrement /
 * increment buttons around a numeric textbox). The owning page decides
 * WHEN and WHAT — the committed quantity arrives as an input and every
 * valid change leaves through `quantityChange` (controlled, same
 * convention as the Phase 6 `QuantitySelector`: no timers, no debounce
 * here). No API access, no HTTP — presentational components never call
 * backend APIs (`ARCHITECTURE.md` §8).
 *
 * Bounds (contract-driven, same rule as §6.6): the decrement control
 * disables at `MIN_CART_QUANTITY` (the contract's cart quantity floor);
 * there is no maximum clamp because the contract defines none. Textbox
 * keystrokes parse through `parseCartQuantityInput` — invalid text
 * (empty, signed, decimal, non-numeric, below-minimum) raises the
 * localized inline error and never emits, so invalid quantities can
 * never reach feature state; blur reverts the draft to the committed
 * value. The `disabled` input freezes the whole control while a cart
 * mutation is in flight (the §7.3 one-at-a-time lock would otherwise
 * drop the change silently).
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
 * Explicitly out of scope (later work, must not appear here):
 * - 7.5/7.7 — no identity handling, no merge wiring.
 * - Phase 8 — no checkout, pricing, or totals logic.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { MIN_CART_QUANTITY, parseCartQuantityInput } from '../../models/cart.models';

@Component({
  selector: 'cart-quantity-control',
  templateUrl: './quantity-control.html',
  styleUrl: './quantity-control.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuantityControl {
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

  /**
   * Unique error element id (page-projected, required): every cart line
   * renders its own control, so a shared static id would duplicate
   * `id`s across lines and misdirect `aria-describedby`. The owning
   * line passes a variant-scoped id (SSR-safe: derived from backend
   * data, identical on server and client).
   */
  @Input({ required: true }) errorId!: string;

  /** Freezes the control while a cart mutation is in flight. */
  @Input() disabled = false;

  /** Emitted with the new quantity on every valid change (never invalid). */
  @Output() readonly quantityChange = new EventEmitter<number>();

  /** Contract quantity floor, exposed for the decrement disabled state. */
  protected readonly minQuantity = MIN_CART_QUANTITY;

  /** Whether the current textbox draft failed parsing (inline error). */
  private readonly draftInvalid = signal(false);

  /** Whether the inline validation error shows. */
  protected showInvalid(): boolean {
    return this.draftInvalid();
  }

  /** Emits `quantity - 1` unless at the minimum or disabled (button also disables). */
  decrease(): void {
    if (!this.disabled && this.quantity > MIN_CART_QUANTITY) {
      this.quantityChange.emit(this.quantity - 1);
    }
  }

  /** Emits `quantity + 1` unless disabled (no contract maximum exists to clamp). */
  increase(): void {
    if (!this.disabled) {
      this.quantityChange.emit(this.quantity + 1);
    }
  }

  /**
   * Validates raw keystrokes: valid text emits immediately and clears the
   * error; invalid text raises the error and emits nothing. Disabled
   * controls ignore input. Public so the prevention stays directly
   * unit-testable (same convention as `SearchInput.onInput`).
   */
  onInput(event: Event): void {
    if (this.disabled) {
      return;
    }
    const parsed = parseCartQuantityInput((event.target as HTMLInputElement).value);
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
