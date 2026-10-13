import { Injectable, Signal, computed, inject } from '@angular/core';
import { AuthService } from '@flux/auth';
import { ADMIN_NAV_ITEMS, visibleDestinations, type AdminDestination } from './admin-navigation';

/**
 * Shell-scoped navigation state for Supplement S1, Step S1.3 — Permission
 * Authorization Infrastructure.
 *
 * Derives the visible sidebar destinations from the live `AuthService`
 * session (`roles` + `permissions` from the last `GET /auth/me`) through
 * the app-owned `visibleDestinations` table. Signals are reused by
 * reference — this service owns no session state of its own and never
 * replicates it.
 *
 * Scoping (deliberate, do not widen without review):
 * - Provided in the `AppLayout` component `providers` (shell subtree
 *   only), never `root` — Phase 12.8 forbids new global admin state
 *   without allowlist justification, and nothing outside the shell needs
 *   this derivation.
 * - Consumed only by `AppLayout`, so `apps/admin/.../layout/` stays free
 *   of auth symbols (rule 3.7: auth state is reused, never replicated).
 *   `SuperAdmin` bypasses every permission gate and always sees the full
 *   menu; everyone else sees only what the backend granted.
 */
@Injectable()
export class AdminNavState {
  private readonly auth = inject(AuthService);

  /** Visible destinations for the current session (unlocalized). */
  readonly destinations: Signal<readonly AdminDestination[]> = computed(() =>
    visibleDestinations(ADMIN_NAV_ITEMS, this.auth.roles(), this.auth.permissions()),
  );
}
