/**
 * Payment error shell for Sub-Phase 9.2 — Payment Feature Foundation.
 *
 * Presentational only: renders HOW a payment failure looks by composing
 * the shared `ErrorState` primitive, and emits WHEN retry is pressed.
 * The owning page decides WHEN (from the feature state error slot,
 * Sub-Phase 9.4), WHAT message to show (page-localized from the
 * normalized failure, never backend text), and WHAT retry does
 * (state-aware retry, Sub-Phase 9.9). No API access, no HTTP, no state
 * writes, no error classification lives here (`ARCHITECTURE.md` §8).
 *
 * SSR-safe: static markup from inputs only, no browser APIs. RTL safe:
 * logical properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.3 — no API service, no `HttpClient`, no error mapping.
 * - 9.4 — no signal store, no failure slot.
 * - 9.9 — no failure-category handling, no retry execution.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ErrorState } from '@flux/ui';

@Component({
  selector: 'payment-error',
  imports: [ErrorState],
  templateUrl: './payment-error.html',
  styleUrl: './payment-error.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentErrorComponent {
  /** Display message (page-localized, required content — `null` renders nothing). */
  @Input() message: string | null = null;
  /** Emitted on retry click — the page performs the state-aware retry (9.9). */
  @Output() readonly retry = new EventEmitter<void>();
}
