/**
 * Storefront Payment page shell for Sub-Phase 9.2 — Payment Feature
 * Foundation.
 *
 * Smart-page skeleton (route-level composition): reads the `:orderId`
 * route param through the pure §9.2 `readPaymentRouteParams` helper and
 * composes the four foundation shells (form, status, error, loading).
 * Shell inputs stay at their neutral placeholders — feature state,
 * initialization, and confirmation wiring arrive in Sub-Phases 9.4/9.6+
 * and drive these shells then. No API access, no HTTP, no state writes,
 * no Stripe surface, no navigation lives here.
 *
 * Data flow (target — `ARCHITECTURE.md` §10; data-access and state land
 * in 9.3/9.4, the provider boundary in 9.5):
 *
 * ```text
 * PaymentPage (this file — orchestration skeleton only)
 *     ↓ PaymentState (9.4 — feature-owned local Signals, route-provided)
 *     ↓ PaymentApiService (9.3 — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Payments API
 * ```
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
 * - 9.5 — no Stripe SDK, no Elements, no provider abstraction.
 * - 9.6+ — no initialization, confirmation, polling, or retry.
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PaymentErrorComponent } from '../../components/payment-error/payment-error';
import { PaymentFormComponent } from '../../components/payment-form/payment-form';
import { PaymentLoadingComponent } from '../../components/payment-loading/payment-loading';
import { PaymentStatusComponent } from '../../components/payment-status/payment-status';
import { readPaymentRouteParams } from '../../models/payment.models';

@Component({
  selector: 'payment-page',
  imports: [
    PaymentErrorComponent,
    PaymentFormComponent,
    PaymentLoadingComponent,
    PaymentStatusComponent,
  ],
  templateUrl: './payment-page.html',
  styleUrl: './payment-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentPage {
  private readonly route = inject(ActivatedRoute);

  /**
   * Order being paid, from the `:orderId` route param. `null` blocks
   * entry (nothing to initialize — 9.6 renders the recovery, never a
   * fabricated id).
   */
  protected readonly params = readPaymentRouteParams(this.route.snapshot.paramMap);

  /**
   * Skeleton submit handler — Sub-Phase 9.7 wires provider confirmation
   * here. Intentionally a no-op: submission without initialization and
   * state would be an unverified payment attempt.
   */
  protected onFormSubmit(): void {
    // 9.7 — provider confirmation through the payment state.
  }

  /**
   * Skeleton retry handler — Sub-Phase 9.9 wires state-aware retry here.
   * Intentionally a no-op (see above).
   */
  protected onRetry(): void {
    // 9.9 — state-aware retry through the payment state.
  }
}
