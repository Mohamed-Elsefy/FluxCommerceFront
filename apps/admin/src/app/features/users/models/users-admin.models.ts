/**
 * Admin Users feature models for Supplement S1, Step S1.5 — Admin Users
 * & Permissions.
 *
 * Scope: canonical wire aliases plus the user-status display map only
 * (list/details/permission views arrive with the slices that own their
 * pages, which own their mappers). The single declaration site stays
 * `@flux/models` (S1.1 audit mirrors + S1.2 canonical declarations) —
 * aliases here, never re-declarations, so no contract drift is possible.
 *
 * Backend-authoritative data rule (binds every later slice):
 * `totalCount` and every `UserAdminCountsResponse` bucket echo verbatim
 * for display (never inputs to math), permission values render verbatim
 * (stable identifiers, never localized), and user `status` (a NUMBER on
 * the wire) maps through the single `userStatusDisplay` site below —
 * unknown future values fall back verbatim with the `neutral` tone (see
 * `ENUM_REFERENCE.md` §8). Pure types + pure functions: no Angular, no
 * HTTP, no browser APIs — SSR-safe.
 */

import type { PagedResult } from '@flux/api';
import type {
  RegisterAdminRequest,
  UserAdminCountsResponse,
  UserAdminResponse,
} from '@flux/models';
import { UserStatus } from '@flux/models';
import type { BadgeVariant } from '@flux/ui';

/** One admin user row (canonical wire shape, never re-declared). */
export type UserAdminRow = UserAdminResponse;

/** Paged admin user result (`GET /admin/users`, newest-first). */
export type UserAdminPage = PagedResult<UserAdminRow>;

/**
 * Users overview: the backend-issued buckets behind the admin landing
 * page (`GET /admin/users/counts`). Every bucket echoes verbatim for
 * display — never an input to math.
 */
export type UsersOverview = UserAdminCountsResponse;

/**
 * Projects raw admin-creation form values into the
 * `POST /auth/register-admin` body. Trims surrounding whitespace
 * (the backend trims and lowercases email server-side); empty
 * first/last names travel as-is so backend validation (`400` with
 * `errors{}`) stays authoritative. Pure — throws nothing, performs no
 * HTTP.
 */
export function toRegisterAdminRequest(
  email: string | null | undefined,
  password: string | null | undefined,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): RegisterAdminRequest {
  return {
    email: (email ?? '').trim(),
    password: password ?? '',
    firstName: (firstName ?? '').trim(),
    lastName: (lastName ?? '').trim(),
  };
}

/** Zero overview (no user data yet). */
export function emptyUsersOverview(): UsersOverview {
  return {
    total: 0,
    pending: 0,
    active: 0,
    suspended: 0,
    locked: 0,
    deleted: 0,
    customers: 0,
    admins: 0,
    superAdmins: 0,
    unverified: 0,
    lockedOut: 0,
  };
}

// ---------------------------------------------------------------------------
// User status display (S1.5)
// ---------------------------------------------------------------------------

/** Translation key + badge variant behind one user status value. */
export interface UserBadgeDisplay {
  /** Key into the users bundle (`users.status.*`). */
  readonly labelKey: string;
  /** Badge emphasis (maps 1:1 onto the shared `flux-badge` variants). */
  readonly variant: BadgeVariant;
}

/**
 * Display behind a user status wire value (`UserStatus` NUMBER on the
 * wire: `Pending = 0, Active = 1, Suspended = 2, Locked = 3, Deleted = 4`
 * — see `ENUM_REFERENCE.md` §1). Unknown future values fall back to the
 * `unknown` entry (render the raw value verbatim with the `neutral`
 * tone — see `ENUM_REFERENCE.md` §8). The single mapping site for admin
 * user status — no scattered numeric comparisons elsewhere. Pure —
 * throws nothing.
 */
export function userStatusDisplay(status: UserStatus | number): UserBadgeDisplay {
  switch (status) {
    case UserStatus.Pending:
      return { labelKey: 'users.status.pending', variant: 'warning' };
    case UserStatus.Active:
      return { labelKey: 'users.status.active', variant: 'success' };
    case UserStatus.Suspended:
      return { labelKey: 'users.status.suspended', variant: 'warning' };
    case UserStatus.Locked:
      return { labelKey: 'users.status.locked', variant: 'danger' };
    case UserStatus.Deleted:
      return { labelKey: 'users.status.deleted', variant: 'neutral' };
    default:
      return { labelKey: 'users.status.unknown', variant: 'neutral' };
  }
}
