/**
 * Payment loading shell for Sub-Phase 9.2 — Payment Feature Foundation.
 *
 * Presentational only: renders HOW payment loading looks by composing
 * the shared `LoadingIndicator` primitive. The owning page decides WHEN
 * (from the feature state loading slot, Sub-Phase 9.4) and passes an
 * already-decided label. No API access, no HTTP, no state writes, no
 * loading logic lives here (`ARCHITECTURE.md` §8).
 *
 * SSR-safe: static markup from inputs only, no browser APIs. RTL safe:
 * logical properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.3 — no API service, no `HttpClient`.
 * - 9.4 — no signal store, no loading slot.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { LoadingIndicator } from '@flux/ui';

@Component({
  selector: 'payment-loading',
  imports: [LoadingIndicator],
  templateUrl: './payment-loading.html',
  styleUrl: './payment-loading.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentLoadingComponent {
  /** Accessible loading text (page-supplied; localized in the §9.10 pass). */
  @Input() label = 'Loading payment…';
}
