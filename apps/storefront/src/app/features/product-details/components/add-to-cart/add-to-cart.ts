/**
 * Add-to-Cart button component for Sub-Phase 6.7 — Add to Cart Integration.
 *
 * Presentation only: renders HOW submission looks across its lifecycle
 * (idle action → adding with progress → added confirmation → error with
 * retry). The owning page decides WHEN and WHAT — lifecycle status,
 * disabled state, and all copy arrive as inputs; every activation leaves
 * through `add`. No API access, no HTTP — presentational components never
 * call the Cart API (`ARCHITECTURE.md` §8).
 *
 * Duplicate-submission prevention is doubled: the button disables while
 * `adding` AND the handler ignores activations in that state or when
 * `disabled`, so duplicate requests are impossible even past the native
 * control state. Invalid/unavailable items never enable the control — the
 * page binds `disabled` to the feature guard
 * (`selectedVariantSelectable`, valid quantity).
 *
 * Accessibility: a single native button per state (Tab/Enter/Space free);
 * progress exposes `role="status"` through the shared spinner label, the
 * confirmation uses `role="status"`, and failures use `role="alert"`.
 * Visible `:focus-visible` indicators on every control.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 *
 * Mount note: the 6.7 page does not mount this component yet — submission
 * requires a contract price source that does not exist (see the
 * integration note in `../../models`), and mounting a control that can
 * never succeed would mislead customers. It mounts in Phase 7 beside the
 * price source as:
 *
 * ```html
 * <product-details-add-to-cart
 *   [status]="addToCartStatus()"
 *   [disabled]="!canSubmit()"
 *   [addLabel]="…"
 *   [addingLabel]="…"
 *   [addedLabel]="…"
 *   [errorMessage]="addToCartErrorMessage()"
 *   [retryLabel]="…"
 *   (add)="onAddToCart()"
 * ></product-details-add-to-cart>
 * ```
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Spinner } from '@flux/ui';
import type { AddToCartStatus } from '../../models/product-details.models';

@Component({
  selector: 'product-details-add-to-cart',
  imports: [Spinner],
  templateUrl: './add-to-cart.html',
  styleUrl: './add-to-cart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddToCart {
  /** Submission lifecycle from feature state. */
  @Input({ required: true }) status: AddToCartStatus = 'idle';

  /** Whether activation is allowed (feature guard: selectable + quantity). */
  @Input() disabled = false;

  /** Idle action text (page-localized, required). */
  @Input({ required: true }) addLabel!: string;

  /** In-flight text (page-localized, required). */
  @Input({ required: true }) addingLabel!: string;

  /** Confirmation text (page-localized, required). */
  @Input({ required: true }) addedLabel!: string;

  /** Failure text (page-localized, `null` hides the error block). */
  @Input() errorMessage: string | null = null;

  /** Retry text (page-localized, required). */
  @Input({ required: true }) retryLabel!: string;

  /** Emitted on valid activation (initial add and error retry alike). */
  @Output() readonly add = new EventEmitter<void>();

  /**
   * Requests submission for actionable states; silently ignores anything
   * else (defense in depth behind the native `disabled` attribute, which
   * already blocks pointer and keyboard activation while adding or when
   * the feature guard denies it). Public so the guard stays directly
   * unit-testable (same convention as `SearchInput.onInput`).
   */
  requestAdd(): void {
    if (this.status !== 'adding' && !this.disabled) {
      this.add.emit();
    }
  }
}
