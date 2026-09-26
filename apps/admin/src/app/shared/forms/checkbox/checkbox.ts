/**
 * Admin checkbox for Sub-Phase 12.6 — Filtering & Form Primitives.
 *
 * Thin reactive-form wrapper: a native checkbox with an implicitly
 * associated label (native wrapping gives keyboard and screen-reader
 * behavior free), plus hint and validation messages. Dumb by design —
 * value, validators, and disabled state stay in the owning feature's
 * typed boolean form control. SSR/hydration safe; RTL safe (logical
 * properties only).
 */

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  inject,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { Subscription } from 'rxjs';
import { AdminFieldErrors } from '../field-errors/field-errors';

@Component({
  selector: 'admin-checkbox',
  imports: [ReactiveFormsModule, AdminFieldErrors],
  templateUrl: './checkbox.html',
  styleUrl: './checkbox.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCheckbox implements OnChanges, OnDestroy {
  /** Bound control (feature-owned). */
  @Input({ required: true }) control!: FormControl<boolean | null>;
  /** Visible label (owner-localized, required). */
  @Input({ required: true }) label = '';
  /** Supporting hint text (owner-localized). */
  @Input() hint: string | null = null;

  private readonly changeDetector = inject(ChangeDetectorRef);
  private controlEvents: Subscription | null = null;

  /**
   * Refreshes on every control event: `FormControl` mutations do not
   * touch @Inputs, so an `OnPush` view reading control state (validity
   * styling) would otherwise stay stale.
   */
  ngOnChanges(): void {
    this.controlEvents?.unsubscribe();
    this.controlEvents =
      this.control?.events.subscribe(() => this.changeDetector.markForCheck()) ?? null;
  }

  ngOnDestroy(): void {
    this.controlEvents?.unsubscribe();
  }
}
