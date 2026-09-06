/**
 * Central authentication state models for Sub-Phase 2.2 — Authentication
 * State & Session Foundation.
 *
 * Scope: `docs/phases/PHASE_2_IDENTITY_AUTHENTICATION_IMPLEMENTATION_PLAN.md`
 * §4.2. Source of truth for shapes: `docs/frontend-contract/API_CONTRACT.md`
 * §1, `docs/frontend-contract/DTO_REFERENCE.md` §1 (`UserResponse`,
 * `LoginResponse`), `docs/frontend-contract/AUTH_FLOW.md`.
 *
 * These are pure data contracts — no behavior, no storage, no HTTP. State
 * transitions live exclusively in `AuthService` (`./auth.service`), which is
 * the only writer. Feature code must consume the service's readonly signals
 * and must never replicate this state.
 *
 * Contract mapping (applied by later data-access, never here):
 * - `CurrentUser` mirrors the `UserResponse` fields the shell needs: `id`,
 *   `email`, display name (`displayName ?? "<firstName> <lastName>"`),
 *   `roles`, `isEmailVerified`.
 * - `AuthSession` carries token METADATA and lifecycle flags only — never
 *   token values. Values stay in `AuthService` memory (never persisted,
 *   never logged); persistence arrives in Sub-Phase 2.3.
 */

/**
 * Lifecycle of the central authentication state.
 *
 * - `initializing`: startup, before session restoration (2.8) has decided.
 *   Guards must treat this as "unknown" — never as anonymous (no premature
 *   redirects).
 * - `anonymous`: settled, no session (startup without session, or after
 *   logout/clear).
 * - `authenticated`: settled, a live session exists.
 */
export type AuthState = 'initializing' | 'anonymous' | 'authenticated';

/** Settled session presence, without any workflow detail. */
export type AuthStatus = 'anonymous' | 'authenticated';

/**
 * Minimal identity every authenticated session exposes. Backend
 * authorization stays authoritative; roles here drive navigation/UX only.
 */
export interface CurrentUser {
  /** Backend user identifier (opaque to the frontend). */
  readonly id: string;
  /** Lower-cased account email from `UserResponse.email`. */
  readonly email: string;
  /**
   * Display name (`UserResponse.displayName`, falling back to
   * `"<firstName> <lastName>"` when null). Null only when the backend
   * supplied neither.
   */
  readonly displayName: string | null;
  /** Role names granted by the backend (`Customer` / `Admin` / `SuperAdmin`). */
  readonly roles: readonly string[];
  /** Email-verification flag from `UserResponse.isEmailVerified`. */
  readonly isEmailVerified: boolean;
}

/**
 * Session abstraction: token metadata and lifecycle flags. Holds no secret
 * material — the access-token value itself lives only in `AuthService`
 * memory and is never part of this snapshot.
 */
export interface AuthSession {
  /** Backend user id the session belongs to (mirrors `CurrentUser.id`). */
  readonly userId: string;
  /** Whether an access token is currently held in service memory. */
  readonly hasAccessToken: boolean;
  /** ISO-8601 timestamp of when the session became authenticated. */
  readonly authenticatedAtUtc: string;
}
