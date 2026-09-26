/**
 * Admin form actions for Sub-Phase 12.6 — Filtering & Form Primitives.
 *
 * Presentation only: the submit/cancel row every admin form needs.
 * Emits `submitted`/`cancelled` (both plain buttons — the owning
 * feature runs validation and submission); the submit action locks
 * while `submitting` or `disabled`, showing progress copy instead of
 * the submit label. Cancel is optional and always enabled.
 *
 * SSR/hydration safe: static markup from inputs only. RTL safe:
 * logical properties only, direction-aware flow.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { LoadingIndicator } from '@flux/ui';

@Component({
  selector: 'admin-form-actions',
  imports: [LoadingIndicator],
  templateUrl: './form-actions.html',
  styleUrl: './form-actions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFormActions {
  /** Submit action text (owner-localized, required). */
  @Input({ required: true }) submitLabel = '';
  /** Cancel action text (owner-localized; null hides the action). */
  @Input() cancelLabel: string | null = null;
  /** Progress text shown while submitting (owner-localized). */
  @Input() submittingLabel: string | null = null;
  /** Submission in flight: submit locks with progress copy. */
  @Input() submitting = false;
  /** Submit locked for form-level reasons (e.g. pristine). */
  @Input() disabled = false;
  /** Emitted when the submit action activates. */
  @Output() readonly submitted = new EventEmitter<void>();
  /** Emitted when the cancel action activates. */
  @Output() readonly cancelled = new EventEmitter<void>();

  /** Whether the submit action is currently locked. */
  protected locked(): boolean {
    return this.submitting || this.disabled;
  }
}
