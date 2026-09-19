/**
 * Storefront Payment Result page for Sub-Phases 9.8 (result handling)
 * and 9.9 (unknown-outcome verification).
 *
 * Outcome hub (route-level composition): reads the `:orderId` route
 * param through the pure §9.2 `readPaymentRouteParams` helper and
 * renders one dedicated block per resolved outcome from the
 * route-provided `PaymentState` (shared with the payment page — same
 * route subtree, same instance):
 *
 * - `succeeded` — success presentation with the order reference. Never
 *   shown on provider claims alone: entry triggers a backend
 *   verification read first (`refreshStatus`), and only the
 *   backend-resolved stage renders.
 * - `failed` — failure message with retry (back to the payment route,
 *   whose entry re-initializes) and return-to-checkout navigation.
 * - `cancelled` — cancellation message with re-attempt and
 *   modify-checkout navigation.
 * - `pending` — pending presentation with the manual status-check
 *   affordance (single-shot verification — no polling, 9.9 owns loops).
 * - anything else (direct deep link, mid-flow arrival) — neutral
 *   fallback with a back-to-payment link, never fabricated outcomes.
 *
 * Backend-truth rule (the §9.8 enforcement): provider-reported stages
 * are claims, not proof. `succeeded`/`pending` entries verify through
 * `refreshStatus` before final presentation; `failed`/`cancelled`
 * present from resolved state (provider-reported or backend-resolved —
 * both terminal, both retryable through re-entry, never edited here).
 * This page performs no confirmation, no polling, and no order writes —
 * it reads state and routes.
 *
 * Copy is placeholder English (outcome shells — feature localization
 * arrives with the §9.10 UI pass, never backend text).
 *
 * SSR-safe: signals, router templating, and platform-guarded
 * verification only — no browser APIs. RTL safe: logical properties
 * only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.9 — no polling loops, no failure-category handling, no recovery
 *   algorithms (the check button fires one explicit read).
 * - 9.10 — no localized copy beyond placeholders.
 * - Phase 10 — no order polling, no order-history reads (the reference
 *   shown is the route `orderId` only — never a fabricated number).
 */

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { readPaymentRouteParams, paymentPath } from '../../models/payment.models';
import { PaymentState } from '../../state/payment-state';

@Component({
  selector: 'payment-result-page',
  imports: [RouterLink],
  templateUrl: './payment-result-page.html',
  styleUrl: './payment-result-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentResultPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly state = inject(PaymentState);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Order whose result displays, from the `:orderId` route param.
   * `null` renders the fallback (nothing to display — never a
   * fabricated id).
   */
  protected readonly params = readPaymentRouteParams(this.route.snapshot.paramMap);

  /** Resolved lifecycle stage driving the outcome blocks. */
  protected readonly lifecycle = this.state.lifecycle;
  /** Latest provider confirmation outcome, if any (distinguishes unknown holds). */
  protected readonly confirmationOutcome = this.state.confirmationOutcome;
  /** Backend-reported payment status facts, if verified. */
  protected readonly paymentStatus = this.state.paymentStatus;
  /** Displayable failure text, if any (state-normalized — never backend text). */
  protected readonly errorMessage = computed(() => this.state.statusError()?.message ?? null);

  /** Back-to-payment path for retry/re-attempt (`/payment/:orderId`). */
  protected readonly retryPath = computed(() => {
    const params = this.params;
    return params === null ? '/checkout' : paymentPath(params.orderId);
  });

  ngOnInit(): void {
    if (!this.isBrowser) {
      return;
    }
    if (this.params === null) {
      return;
    }
    // Backend authority before final presentation: provider-reported
    // `succeeded`/`pending` verify through one explicit status read, as
    // does an outstanding-unknown hold (`processing` with an `unknown`
    // outcome — sent-but-unread resolves through backend truth, never a
    // blind retry). `failed`/`cancelled` already resolve terminally;
    // anything earlier has no payment id to verify yet (the guard inside
    // `refreshStatus` drops those calls structurally).
    const stage = this.state.lifecycle();
    const unknown = stage === 'processing' && this.state.confirmationOutcome() === 'unknown';
    if (stage === 'succeeded' || stage === 'pending' || unknown) {
      this.state.refreshStatus();
    }
  }

  /**
   * Manual status verification for the pending and unknown blocks
   * (Sub-Phase 9.9 — one explicit single-shot read per press; no
   * polling, no automatic recovery).
   */
  protected onCheckStatus(): void {
    if (!this.isBrowser) {
      return;
    }
    this.state.refreshStatus();
  }
}
