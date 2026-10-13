/**
 * Admin select for Sub-Phase 12.6 — Filtering & Form Primitives.
 *
 * Thin reactive-form wrapper: a labeled native select with hint and
 * validation messages (`admin-form-field`). Options arrive as
 * `{value, label}` pairs (labels owner-localized before passing).
 * Dumb by design — value, validators, and disabled state stay in the
 * owning feature's typed form control. Native select gives keyboard,
 * screen-reader, and mobile behavior free. SSR/hydration safe; RTL
 * safe (logical properties only).
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

/** Selectable option: submitted value plus visible label. */
export interface AdminSelectOption {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'admin-select',
  imports: [ReactiveFormsModule, AdminFormField],
  templateUrl: './select.html',
  styleUrl: './select.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSelect implements OnChanges, OnDestroy {
  /** Bound control (feature-owned). */
  @Input({ required: true }) control!: FormControl<string | null>;
  /** Options to offer. */
  @Input({ required: true }) options: readonly AdminSelectOption[] = [];
  /** Visible label (owner-localized, required). */
  @Input({ required: true }) label = '';
  /** Control id for label association (owner-provided). */
  @Input() fieldId: string | null = null;
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
