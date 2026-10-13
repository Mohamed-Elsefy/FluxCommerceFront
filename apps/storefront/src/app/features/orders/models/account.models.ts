/**
 * Storefront Orders account models for Sub-Phase 10.2 — Customer Account
 * & Profile.
 *
 * Scope: `docs/phases/PHASE_10_ORDERS_CUSTOMER_ACCOUNT.md` §10.2
 * (contracts and boundaries only — no API execution, no state
 * implementation, no pages, no components).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §1.11
 * (`GET /auth/me` → `ApiResponse<UserResponse>`) and
 * `docs/frontend-contract/DTO_REFERENCE.md` §1 (`UserResponse` shape).
 * The canonical wire mirror stays in `@flux/models` — `CustomerProfile`
 * is the §10.1 alias (re-exported from `./orders.models`), never
 * re-declared, so no contract drift is possible.
 *
 * Editing (Supplement S1, Step S1.4): the display projection below stays
 * read-only; the editable draft, the typed-form factory, the draft →
 * `UpdateProfileRequest` projection, and the server field-error helpers
 * live in `./profile-edit.models` (backed by `PUT /auth/profile`).
 *
 * Ownership (`ARCHITECTURE.md` §5): this module owns the feature-local
 * account route paths, the display-name resolution, and the pure
 * `UserResponse` → `ProfileView` projector. Pure types + pure functions:
 * no Angular, no HTTP, no storage — SSR-safe.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.3 — no orders-list shapes (see `./orders.models` pagination).
 * - 10.4 — no order-details presentation.
 */

import type { CustomerProfile } from './orders.models';

export type { CustomerProfile };

/** Account area base path (mounted in `app.routes.ts`, see `../account.routes`). */
export const ACCOUNT_PATH = '/account' as const;

/** Customer profile path (`/account/profile`). */
export const ACCOUNT_PROFILE_PATH = '/account/profile' as const;

/**
 * Read-only profile view projected from the backend `CustomerProfile`.
 * Every row renders verbatim backend data for display only — the editable
 * draft lives in `./profile-edit.models` (backed by `PUT /auth/profile`).
 */
export interface ProfileView {
  /** Resolved display name (never blank — falls back to the email). */
  readonly displayName: string;
  /** Account email (`UserResponse.email`, already lower-cased server-side). */
  readonly email: string;
  /** Email-verification flag from `UserResponse.isEmailVerified`. */
  readonly emailVerified: boolean;
  /** Phone number, or `null` when the backend sent none. */
  readonly phone: string | null;
  /** Role names granted by the backend (navigation/UX only). */
  readonly roles: readonly string[];
  /** Profile language hint (`preferredLanguage` — display only). */
  readonly preferredLanguage: string;
  /** Profile time-zone hint (`timeZone` — display only). */
  readonly timeZone: string;
  /** Registration timestamp (`registeredAtUtc`, ISO-8601). */
  readonly registeredAtUtc: string;
  /** Avatar image URL (`avatarUrl`), or `null` when the backend sent none. */
  readonly avatarUrl: string | null;
}

/**
 * Resolves the profile display name: `displayName`, falling back to
 * `"<firstName> <lastName>"`, falling back to the email (always
 * present, so the result is never blank). Mirrors the shared
 * `mapUserResponseToCurrentUser` fallback for the full profile shape.
 * Pure — throws nothing.
 */
export function resolveProfileDisplayName(profile: CustomerProfile): string {
  if (typeof profile.displayName === 'string' && profile.displayName.trim() !== '') {
    return profile.displayName;
  }
  const fallbackName = `${profile.firstName} ${profile.lastName}`.trim();
  if (fallbackName !== '') {
    return fallbackName;
  }
  return profile.email;
}

/**
 * Projects the read-only profile view out of a backend profile.
 * Verbatim data only — no computation, no edits. Pure — throws nothing,
 * performs no HTTP.
 */
export function toProfileView(profile: CustomerProfile): ProfileView {
  return {
    displayName: resolveProfileDisplayName(profile),
    email: profile.email,
    emailVerified: profile.isEmailVerified,
    phone: profile.phoneNumber ?? null,
    roles: [...profile.roles],
    preferredLanguage: profile.preferredLanguage,
    timeZone: profile.timeZone,
    registeredAtUtc: profile.registeredAtUtc,
    avatarUrl: profile.avatarUrl ?? null,
  };
}
