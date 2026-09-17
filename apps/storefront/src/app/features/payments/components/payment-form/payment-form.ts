/**
 * Payment form shell for Sub-Phase 9.2 — Payment Feature Foundation.
 *
 * Presentational only: renders WHERE the payment form lives (section
 * shell with a submit affordance) and emits WHEN the customer submits.
 * The owning page decides WHEN submission is allowed and WHAT it does.
 * No API access, no HTTP, no state writes, no Stripe/Elements surface —
 * the provider mount point arrives in Sub-Phase 9.5 and confirmation
 * wiring in Sub-Phase 9.7 (`ARCHITECTURE.md` §8: presentational
 * components never call backend APIs).
 *
 * Copy is placeholder English (skeleton shell — feature localization
 * arrives with the §9.10 UI pass, never backend text).
 *
 * SSR-safe: static markup from inputs only, no browser APIs. RTL safe:
 * logical properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.3 — no API service, no `HttpClient`, no envelope mapping.
 * - 9.4 — no signal store, no lifecycle, no status reads.
 * - 9.5 — no Stripe SDK import, no Elements mounting.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'payment-form',
  templateUrl: './payment-form.html',
  styleUrl: './payment-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentFormComponent {
  /** Whether submission is disabled (the page disables while processing). */
  @Input() disabled = false;
  /** Submit button text (page-supplied; localized in the §9.10 pass). */
  @Input() submitLabel = 'Pay';
  /** Emitted on submit click — the page performs the confirmation (9.7). */
  @Output() readonly formSubmit = new EventEmitter<void>();
}
