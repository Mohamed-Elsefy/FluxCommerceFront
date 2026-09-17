/**
 * Storefront Payment Result page shell for Sub-Phase 9.2 — Payment
 * Feature Foundation.
 *
 * Smart-page skeleton (route-level composition): reads the `:orderId`
 * route param through the pure §9.2 `readPaymentRouteParams` helper and
 * renders the payment status shell. Status reads, outcome handling, and
 * retry/return navigation arrive in Sub-Phases 9.8–9.10 and drive this
 * shell then. No API access, no HTTP, no state writes, no polling, no
 * navigation lives here.
 *
 * Copy is placeholder English (skeleton shell — feature localization
 * arrives with the §9.10 UI pass, never backend text).
 *
 * SSR-safe: route snapshot read plus static composition only, no browser
 * APIs. RTL safe: logical properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.3 — no API service, no `HttpClient`, no status query.
 * - 9.4 — no `@Injectable()` store, no signals/computeds, no lifecycle.
 * - 9.8 — no success/failure/pending/cancelled outcome handling.
 * - 9.10 — no retry/return navigation.
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PaymentStatusComponent } from '../../components/payment-status/payment-status';
import { readPaymentRouteParams } from '../../models/payment.models';

@Component({
  selector: 'payment-result-page',
  imports: [PaymentStatusComponent],
  templateUrl: './payment-result-page.html',
  styleUrl: './payment-result-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentResultPage {
  private readonly route = inject(ActivatedRoute);

  /**
   * Order whose payment result displays, from the `:orderId` route
   * param. `null` blocks entry (nothing to display — 9.8 renders the
   * recovery, never a fabricated id).
   */
  protected readonly params = readPaymentRouteParams(this.route.snapshot.paramMap);
}
