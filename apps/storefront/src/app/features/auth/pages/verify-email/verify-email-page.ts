/**
 * Email verification page for Sub-Phase 2.10.
 *
 * Consumes the single-use 24h token from `?token=` (email link target) and
 * verifies immediately — there is nothing to fill in. Success presents the
 * verified identity and prompts a login (verification issues no tokens, so
 * nothing is stored or authenticated here). Failures route to the resend
 * entry point; a missing token explains that directly.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ErrorState, LoadingIndicator } from '@flux/ui';
import { AuthDataAccess, type RegistrationResult } from '../../data-access/auth-data-access';
import { isApiError } from '@flux/api';
import { CultureService, resolveApiErrorMessage } from '@flux/i18n';

type VerifyEmailState =
  | { readonly kind: 'verifying' }
  | { readonly kind: 'missing-token' }
  | { readonly kind: 'verified'; readonly result: RegistrationResult }
  | { readonly kind: 'failed'; readonly message: string };

@Component({
  selector: 'app-verify-email-page',
  imports: [RouterLink, LoadingIndicator, ErrorState],
  templateUrl: './verify-email-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailPage {
  private readonly authDataAccess = inject(AuthDataAccess);
  private readonly cultures = inject(CultureService);
  private readonly route = inject(ActivatedRoute);

  readonly state = signal<VerifyEmailState>({ kind: 'verifying' });

  /** Verified identity for display; null unless the link succeeded. */
  readonly verifiedResult = computed(() => {
    const state = this.state();
    return state.kind === 'verified' ? state.result : null;
  });

  /** Failure detail for display; null unless verification failed. */
  readonly failureMessage = computed(() => {
    const state = this.state();
    return state.kind === 'failed' ? state.message : null;
  });

  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token === null || token.length === 0) {
      this.state.set({ kind: 'missing-token' });
      return;
    }
    this.authDataAccess.verifyEmail(token).subscribe({
      next: (result) => this.state.set({ kind: 'verified', result }),
      error: (error: unknown) => {
        this.state.set({
          kind: 'failed',
          // Localized through stable codes/statuses, never backend text (11.10).
          message: resolveApiErrorMessage(
            isApiError(error) ? error : null,
            this.cultures.culture(),
          ),
        });
      },
    });
  }
}
