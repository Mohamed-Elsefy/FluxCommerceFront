/**
 * Payment status shell for Sub-Phase 9.2 — Payment Feature Foundation.
 *
 * Presentational only: renders WHAT the current payment status looks
 * (the backend `PaymentStatus` string verbatim, or the waiting
 * placeholder before any status is known). The owning page decides WHEN
 * and WHAT status to show (status reads arrive in Sub-Phase 9.8). No API
 * access, no HTTP, no state writes, no status derivation — the component
 * never maps, verifies, or polls (`ARCHITECTURE.md` §8).
 *
 * Copy is placeholder English (skeleton shell — feature localization
 * arrives with the §9.10 UI pass, never backend text).
 *
 * SSR-safe: static markup from inputs only, no browser APIs. RTL safe:
 * logical properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.3 — no API service, no `HttpClient`, no status query.
 * - 9.4 — no signal store, no lifecycle.
 * - 9.8 — no success/failure/pending/cancelled result handling.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { PaymentStatus } from '@flux/models';

@Component({
  selector: 'payment-status',
  templateUrl: './payment-status.html',
  styleUrl: './payment-status.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentStatusComponent {
  /** Backend payment status to display; `null` renders the waiting shell. */
  @Input() status: PaymentStatus | null = null;
}
