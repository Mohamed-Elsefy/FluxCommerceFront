/**
 * Admin textarea for Sub-Phase 12.6 — Filtering & Form Primitives.
 *
 * Thin reactive-form wrapper: a labeled native textarea with hint and
 * validation messages (`admin-form-field`). Dumb by design — value,
 * validators, and disabled state stay in the owning feature's typed
 * form control. SSR/hydration safe; RTL safe (logical properties only).
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
import { AdminFormField } from '../form-field/form-field';

@Component({
  selector: 'admin-textarea',
  imports: [ReactiveFormsModule, AdminFormField],
  templateUrl: './textarea.html',
  styleUrl: './textarea.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTextarea implements OnChanges, OnDestroy {
  /** Bound control (feature-owned). */
  @Input({ required: true }) control!: FormControl<string | null>;
  /** Visible label (owner-localized, required). */
  @Input({ required: true }) label = '';
  /** Control id for label association (owner-provided). */
  @Input() fieldId: string | null = null;
  /** Visible row count. */
  @Input() rows = 4;
  /** Placeholder text (owner-localized). */
  @Input() placeholder: string | null = null;
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
