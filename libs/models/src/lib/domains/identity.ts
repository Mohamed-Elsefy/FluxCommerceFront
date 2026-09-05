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

import type { Guid, IsoDateString } from '../common/shared-types';
import type { UserRole, UserStatus } from '../common/enums';

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
}

/** `POST /auth/resend-verification` payload. */
export interface ResendVerificationResponse {
  emailSent: boolean;
  expiresAtUtc?: IsoDateString | null;
}
