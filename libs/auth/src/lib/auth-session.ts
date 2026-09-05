/**
 * `libs/auth` foundation.
 *
 * Owns session-related abstractions (who the current user is, whether a
 * session exists). No authentication workflow is implemented here:
 * login, registration, token lifecycle and guards arrive with Phase 2.
 */

/** Session presence, without any workflow detail. */
export type AuthStatus = 'anonymous' | 'authenticated';

/** Minimal identity every authenticated session exposes. */
export interface CurrentUser {
  /** Backend user identifier (opaque to the frontend). */
  id: string;
  /** Role names granted by the backend. Backend authorization stays authoritative. */
  roles: readonly string[];
}
