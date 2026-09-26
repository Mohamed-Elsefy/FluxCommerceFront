/**
 * Admin date range for Sub-Phase 12.6 — Filtering & Form Primitives.
 *
 * Two labeled native date inputs bound to feature-owned controls
 * (`from`/`to` as ISO date strings). Dumb by design — range
 * interpretation and validation stay in the owning feature. Native
 * date inputs give keyboard, picker, and mobile behavior free.
 * SSR/hydration safe; RTL safe (logical properties only).
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'admin-date-range',
  imports: [ReactiveFormsModule],
  templateUrl: './date-range.html',
  styleUrl: './date-range.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDateRange {
  /** Lower bound control (feature-owned, ISO date string). */
  @Input({ required: true }) from!: FormControl<string | null>;
  /** Upper bound control (feature-owned, ISO date string). */
  @Input({ required: true }) to!: FormControl<string | null>;
  /** Lower bound label (owner-localized, required). */
  @Input({ required: true }) fromLabel = '';
  /** Upper bound label (owner-localized, required). */
  @Input({ required: true }) toLabel = '';
  /** Lower bound control id (owner-provided). */
  @Input() fromId: string | null = null;
  /** Upper bound control id (owner-provided). */
  @Input() toId: string | null = null;
}
