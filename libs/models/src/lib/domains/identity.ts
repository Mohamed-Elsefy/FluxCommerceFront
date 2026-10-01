/**
 * Identity contract mirrors for Sub-Phase 1.1.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §1 and
 * `docs/frontend-contract/DTO_REFERENCE.md` §1
 * (`FluxCommerce.Modules.Identity.Contracts` records).
 *
 * Notes:
 * - Identity requests carry zero `DataAnnotations`; every request string is
 *   non-nullable. Validation is Fluent → `400 ValidationProblemDetail`.
 * - C# `PascalCase` maps to wire `camelCase` by framework default; the
 *   interfaces below already use wire casing.
 * - Timestamps are `DateTime` (not `DateTimeOffset`), ISO-8601 strings.
 * - `UserStatus` is a NUMBER on the wire (see `./enums`); roles are strings.
 */

import type { Guid, IsoDateString, PageQuery } from '../common/shared-types';
import { isValidPageQuery } from '../common/shared-types';
import type { Permission, UserRole, UserStatus } from '../common/enums';
import { isPermission } from '../common/enums';

/** `POST /auth/register` body (same 4 strings as `RegisterAdminRequest`). */
export interface RegisterCustomerRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** `POST /auth/register-admin` body (SuperAdmin only). */
export interface RegisterAdminRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** `POST /auth/login` body. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** `POST /auth/refresh` body — opaque refresh token, never a JWT. */
export interface RefreshRequest {
  refreshToken: string;
}

/** `POST /auth/logout` body — idempotent revoke. */
export interface LogoutRequest {
  refreshToken: string;
}

/** `POST /auth/verify-email` body — token from the email link. */
export interface VerifyEmailRequest {
  token: string;
}

/** `POST /auth/resend-verification` body — unverified accounts only. */
export interface ResendVerificationRequest {
  email: string;
}

/** `POST /auth/forgot-password` body — always `200` (no enumeration). */
export interface ForgotPasswordRequest {
  email: string;
}

/** `POST /auth/reset-password` body — reset token valid for 1h. */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/** `POST /auth/change-password` body — authenticated JWT required. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * `POST /admin/users/{id}/roles` body (SuperAdmin only).
 * The user id travels in the route, never in the body.
 */
export interface AssignRoleRequest {
  role: UserRole;
}

/**
 * `PUT /auth/profile` body (any authenticated JWT). All fields nullable:
 * `null` keeps the current value, empty clears optional fields
 * (`phoneNumber`, `avatarUrl`).
 */
export interface UpdateProfileRequest {
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  preferredLanguage?: string | null;
  timeZone?: string | null;
}

/**
 * `POST /admin/users/{id}/permissions` body (SuperAdmin only).
 * The user id travels in the route, never in the body — one catalog
 * value per call (`Permission`, see `../common/enums`).
 */
export interface GrantPermissionRequest {
  permission: Permission;
}

/**
 * `POST /auth/login` + `POST /auth/refresh` payload.
 * `accessToken`: JWT, 15m, claims `NameIdentifier=userId`, `Email`, `Role[]`.
 * `refreshToken`: opaque, 7d rotating (reuse → `401 Identity.InvalidToken`).
 */
export interface LoginResponse {
  userId: Guid;
  email: string;
  roles: string[];
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: IsoDateString;
}

/** `POST /auth/register*`, `verify-email`, `GET /auth/me`, role/unlock payload. */
export interface UserResponse {
  id: Guid;
  email: string;
  roles: string[];
  isEmailVerified: boolean;
  registeredAtUtc: IsoDateString;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  phoneNumber?: string | null;
  isPhoneVerified: boolean;
  avatarUrl?: string | null;
  preferredLanguage: string;
  timeZone: string;
  status: UserStatus;
  /**
   * Authoritative permission list (JWT `permission[]` claims mirror).
   * Used for menu rendering; `SuperAdmin` holds none and bypasses gates.
   */
  permissions: string[];
}

/**
 * `GET /admin/users/{id}` (+ `GET /admin/users` item) payload
 * (SuperAdmin only): `UserResponse` plus lockout telemetry.
 */
export interface UserAdminResponse extends UserResponse {
  failedAccessAttemptCount: number;
  lockoutEndUtc?: IsoDateString | null;
  isLocked: boolean;
}

/** `GET /admin/users/counts` payload (SuperAdmin only, all `int`). */
export interface UserAdminCountsResponse {
  total: number;
  pending: number;
  active: number;
  suspended: number;
  locked: number;
  deleted: number;
  customers: number;
  admins: number;
  superAdmins: number;
  unverified: number;
  lockedOut: number;
}

/**
 * `GET /admin/users` query (SuperAdmin only): paging +
 * `status?/role?/search?` (email/first/last substring, newest-first).
 * Unknown `status`/`role` → `400`.
 */
export interface UserListQuery extends PageQuery {
  status?: string;
  role?: string;
  search?: string;
}

/** User statuses accepted as the `status` filter (names, case-insensitive). */
export const USER_STATUS_FILTER_VALUES: readonly string[] = [
  'Pending',
  'Active',
  'Suspended',
  'Locked',
  'Deleted',
];

/** Roles accepted as the `role` filter (names, case-insensitive). */
export const USER_ROLE_FILTER_VALUES: readonly UserRole[] = ['Customer', 'Admin', 'SuperAdmin'];

/**
 * Structural pre-check for a user-list query. Never a substitute for
 * backend validation. Pure — throws nothing.
 */
export function isValidUserListQuery(query: UserListQuery | null | undefined): boolean {
  if (!isValidPageQuery(query)) {
    return false;
  }
  if (query === null || query === undefined) {
    return true;
  }
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    const known = USER_STATUS_FILTER_VALUES.some(
      (s) => s.toLowerCase() === String(query.status).toLowerCase(),
    );
    if (!known) {
      return false;
    }
  }
  if (query.role !== undefined && query.role !== null && query.role !== '') {
    const known = USER_ROLE_FILTER_VALUES.some(
      (r) => r.toLowerCase() === String(query.role).toLowerCase(),
    );
    if (!known) {
      return false;
    }
  }
  if (query.search !== undefined && query.search !== null && query.search.trim() === '') {
    return false;
  }
  return true;
}

/**
 * `POST /admin/users/{id}/permissions` submission (SuperAdmin only):
 * the user id (route) plus one catalog permission (body). Unknown
 * permission → `400 Identity.InvalidPermission`; already-granted →
 * `409 Identity.PermissionAlreadyGranted`.
 */
export interface PermissionGrantSubmission {
  readonly userId: Guid;
  readonly permission: string;
}

/**
 * Structural pre-check for a permission grant. Pure — throws nothing.
 */
export function isValidPermissionGrantSubmission(
  grant: PermissionGrantSubmission | null | undefined,
): boolean {
  if (grant === null || grant === undefined) {
    return false;
  }
  if (typeof grant.userId !== 'string' || grant.userId.trim() === '') {
    return false;
  }
  return isPermission(grant.permission);
}

/** `POST /auth/resend-verification` payload. */
export interface ResendVerificationResponse {
  emailSent: boolean;
  expiresAtUtc?: IsoDateString | null;
}
