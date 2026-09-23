/**
 * Storefront Account feature state for Sub-Phase 10.2 — Customer Account
 * & Profile.
 *
 * Scope: `docs/phases/PHASE_10_ORDERS_CUSTOMER_ACCOUNT.md` §10.2 (profile
 * resource only — no orders-list state, no order-details state, no
 * polling, no navigation state).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §1.11
 * (`GET /auth/me` → `ApiResponse<UserResponse>`; authenticated, user
 * resolved from the JWT — no id parameter, no IDOR surface).
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * ProfilePage (pages/ — orchestration only)
 *     ↓ AccountState (this file — route-provided local Signals)
 *     ↓ IdentityApiService (@flux/api — GET /auth/me transport)
 *     ↓ AuthService (@flux/auth — session re-sync, read-only otherwise)
 *     ↓ ApiClient → HttpClient → ASP.NET Core API
 * ```
 *
 * State rules (the Catalog/Cart/Checkout/Payment pattern — route-provided
 * via `accountRoutes`, never `providedIn`, never a global store):
 * - One profile resource slot (`idle → loading → success | error`,
 *   shared Phase 1 `createResourceState`/`loadResourceState` — the page
 *   renders loading/error/loaded from it, never from ad-hoc flags).
 * - `loadProfile()` reads the live backend profile and re-syncs the
 *   central session (`AuthService.updateCurrentUser`, the §2.5 hydration
 *   seam — a no-op unless authenticated, so expiry can never corrupt
 *   session state). Missing `data` on a `200` is treated as failure
 *   (contract breach, never rendered as a profile).
 * - Loads dedupe: a second call while loading, or after success without
 *   `force`, is a safe no-op (page `ngOnInit` + browser-only
 *   `afterNextRender` both trigger it — exactly one request results).
 *   `retry()` forces a fresh load after errors.
 * - Cancellation travels through `options.signal` (Phase 1
 *   `cancelOnAbort` completes pre-aborted/in-flight aborts silently —
 *   never as errors; state stays untouched).
 * - No logout here (`AuthService.logout` owns it — the shell calls it
 *   directly); no profile editing (no backend contract supports it).
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.3 — no orders-list slots or pagination behavior.
 * - 10.4 — no order-details slots or cancel orchestration.
 * - 10.5/10.6 — no status mapping, no history, no polling.
 */

import { Injectable, inject } from '@angular/core';
import { map, tap, type Observable } from 'rxjs';
import {
  IdentityApiService,
  createResourceState,
  loadResourceState,
  type ApiRequestOptions,
} from '@flux/api';
import { AuthService, mapUserResponseToCurrentUser } from '@flux/auth';
import type { CustomerProfile } from '../models/account.models';

/** Options for `AccountState.loadProfile`. */
export interface LoadProfileOptions extends ApiRequestOptions {
  /**
   * Reload even after a settled success (error retries always reload).
   * Defaults to `false` — repeated page triggers dedupe to one request.
   */
  readonly force?: boolean;
}

/**
 * Feature-scoped account state: the live customer profile resource.
 * Provided on the `accountRoutes` parent (one instance per account
 * entry — never a global store, no `providedIn`).
 */
@Injectable()
export class AccountState {
  private readonly identity = inject(IdentityApiService);
  private readonly auth = inject(AuthService);
  private readonly profileStore = createResourceState<CustomerProfile>();

  /** Profile resource lifecycle (`idle | loading | success | error`). */
  readonly status = this.profileStore.status;

  /** Settled backend profile, or `null` until the first success. */
  readonly profile = this.profileStore.data;

  /** Normalized profile failure (`ApiError | null`). */
  readonly error = this.profileStore.error;

  /** True while the profile request is in flight (or untouched idle). */
  readonly isLoading = this.profileStore.isLoading;

  /** True once a backend profile has settled successfully. */
  readonly isSuccess = this.profileStore.isSuccess;

  /** True when the last profile load failed. */
  readonly isError = this.profileStore.isError;

  /**
   * Loads the live profile (`GET /auth/me`) into the resource slot and
   * re-syncs the central session user. Dedupes concurrent and repeated
   * calls (see above); `force: true` reloads after success. Failures —
   * including a `200` without `data` — land in the error slot untouched
   * for the page to render via `resolveApiErrorMessage`.
   */
  loadProfile(options: LoadProfileOptions = {}): void {
    if (this.profileStore.isLoading()) {
      return;
    }
    if (!options.force && this.profileStore.isSuccess()) {
      return;
    }
    loadResourceState(this.profileStore, this.profileSource({ signal: options.signal }), {
      signal: options.signal,
    });
  }

  /** Forces a fresh profile load (error-state retry path). */
  retry(): void {
    this.loadProfile({ force: true });
  }

  /**
   * Live profile source: unwraps `ApiResponse.data` (missing data is a
   * contract breach → normalized failure, never a rendered profile)
   * and re-syncs the session user through the shared mapper.
   */
  private profileSource(options: ApiRequestOptions = {}): Observable<CustomerProfile> {
    return this.identity.getCurrentUser(options).pipe(
      map((envelope) => {
        const profile = envelope.data ?? null;
        if (profile === null) {
          throw new Error('Profile response carried no data.');
        }
        return profile;
      }),
      tap((profile) => this.auth.updateCurrentUser(mapUserResponseToCurrentUser(profile))),
    );
  }
}
