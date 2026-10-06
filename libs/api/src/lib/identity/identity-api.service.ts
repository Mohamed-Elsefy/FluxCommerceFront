/**
 * Identity API service for Sub-Phase 2.1 — Identity Contract Integration.
 *
 * Scope: `docs/phases/PHASE_2_IDENTITY_AUTHENTICATION_IMPLEMENTATION_PLAN.md`
 * §4.1. Covers exactly the ten Identity endpoints required by the phase:
 *
 * ```text
 * POST /auth/register            POST /auth/verify-email
 * POST /auth/login               POST /auth/resend-verification
 * POST /auth/refresh             POST /auth/forgot-password
 * POST /auth/logout              POST /auth/reset-password
 * GET  /auth/me                  POST /auth/change-password
 * ```
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §1,
 * `docs/frontend-contract/DTO_REFERENCE.md` §1,
 * `docs/frontend-contract/AUTH_FLOW.md`, and
 * `docs/frontend-contract/ERROR_CATALOG.md` §1.
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * Feature Data Access (Phase 2.4+, not this file)
 *         ↓ IdentityApiService (this file — thin typed façade)
 *     ApiClient (Phase 1, the ONLY HttpClient user)
 *         ↓ HttpClient → interceptors → ASP.NET Core API
 * ```
 *
 * Contract fidelity rules enforced here:
 * - Request/response types come from `@flux/models` (the Phase 1 §1.1
 *   mirrors of `FluxCommerce.Modules.Identity.Contracts`) — no local
 *   re-declarations, so no contract drift is possible.
 * - Route templates come from `IDENTITY_ENDPOINTS` (the Phase 1 §1.1 route
 *   table) — no scattered string literals.
 * - The service never unwraps `ApiResponse.data`, never catches or remaps
 *   errors, and never attaches tokens: envelopes stay intact for feature
 *   data-access to map, failures flow untouched to the Phase 1 error
 *   normalizer (`ApiError` with `status` + best-effort `code` +
 *   `validationErrors`), and `Authorization` headers stay owned by the
 *   interceptor pipeline (`ACCESS_TOKEN_PROVIDER` seam, Phase 2.5).
 * - Validation semantics are the backend's: every request string is
 *   non-nullable, Fluent validation failures arrive as `400
 *   ValidationProblemDetail` with `errors{field: [msg]}` keyed by C#/DTO
 *   property names, and callers must branch on `status` (+ endpoint context)
 *   rather than on human-readable `detail` text. Per-endpoint stable codes
 *   are listed on each method for server-log correlation only — the wire
 *   carries `extensions: {}` on the `MapError` path (ERROR_CATALOG §0).
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 2.2 — no `AuthService`, no session/state stores, no selectors.
 * - 2.3 — no token storage, no persistence, no SSR storage strategy.
 * - 2.4 — no forms, no components, no pages.
 *
 * Supplement S1, Step S1.2 — Identity growth: `PUT /auth/profile` plus the
 * SuperAdmin user/permission surface (`GET /admin/users`, `/counts`,
 * `/{id}`, roles, unlock, permission grant/revoke/list/catalog). Same
 * façade rules apply (typed 1:1 methods, envelopes intact, no mapping).
 */

import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AssignRoleRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  GrantPermissionRequest,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  RefreshRequest,
  RegisterAdminRequest,
  RegisterCustomerRequest,
  ResendVerificationRequest,
  ResendVerificationResponse,
  ResetPasswordRequest,
  UpdateProfileRequest,
  UserAdminCountsResponse,
  UserAdminResponse,
  UserListQuery,
  UserResponse,
  VerifyEmailRequest,
} from '@flux/models';
import { ApiClient, type ApiRequestOptions } from '../client/api-client';
import { IDENTITY_ENDPOINTS } from '../contracts/api-endpoints';
import type { ApiResponse, ApiResponseWithData, PagedApiResponse } from '../contracts/api-response';
import { toQueryParams } from '../runtime/query';

/**
 * Thin typed façade over the Identity backend contract. Each method maps
 * 1:1 to one endpoint (same name, same body, same envelope); there is no
 * DTO→view-model mapping here because the contract DTOs already are the
 * frontend models for this sub-phase. Feature data-access (2.4+) unwraps
 * `data` and maps to view models as needed.
 */
@Injectable({ providedIn: 'root' })
export class IdentityApiService {
  private readonly api = inject(ApiClient);

  /**
   * `POST /auth/register` — anonymous. Creates a `Pending` customer and
   * triggers the 24h verification email.
   * Success: `200 ApiResponse<UserResponse>`.
   * Failures: `400` validation (`errors{}`), `409 Identity.DuplicateEmail`.
   */
  register(
    body: RegisterCustomerRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<UserResponse>> {
    return this.api.post<ApiResponseWithData<UserResponse>>(
      IDENTITY_ENDPOINTS.register.path,
      body,
      options,
    );
  }

  /**
   * `POST /auth/register-admin` — `SuperAdmin` only (verified 1:1
   * against `API_CONTRACT.md` §1.2: same 4-string body, `201
   * ApiResponse<UserResponse>` via `Created()`). Creates an `Admin`
   * with NO permissions — grants happen afterwards via
   * `grantPermission`.
   * Success: `201 ApiResponse<UserResponse>` (via `Created()`).
   * Failures: `400` validation (`errors{}`), `401` no/invalid JWT,
   * `403` non-SuperAdmin, `409 Identity.DuplicateEmail`.
   */
  registerAdmin(
    body: RegisterAdminRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<UserResponse>> {
    return this.api.post<ApiResponseWithData<UserResponse>>(
      IDENTITY_ENDPOINTS.registerAdmin.path,
      body,
      options,
    );
  }

  /**
   * `POST /auth/login` — anonymous. Returns the token pair
   * (`accessToken`: JWT 15m; `refreshToken`: opaque 7d, rotating).
   * Success: `200 ApiResponse<LoginResponse>`.
   * Failures: `400` validation, `401 Identity.InvalidCredentials |
   * EmailNotVerified | AccountLocked` (locked after 5 bad passwords, 15m).
   */
  login(
    body: LoginRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<LoginResponse>> {
    return this.api.post<ApiResponseWithData<LoginResponse>>(
      IDENTITY_ENDPOINTS.login.path,
      body,
      options,
    );
  }

  /**
   * `POST /auth/refresh` — anonymous, presents the opaque refresh token
   * (never a JWT). Rotates the pair; reuse of a revoked token yields
   * `401 Identity.InvalidToken`.
   * Success: `200 ApiResponse<LoginResponse>` (new pair).
   * Failures: `400` validation, `401 Identity.InvalidToken`.
   */
  refresh(
    body: RefreshRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<LoginResponse>> {
    return this.api.post<ApiResponseWithData<LoginResponse>>(
      IDENTITY_ENDPOINTS.refresh.path,
      body,
      options,
    );
  }

  /**
   * `POST /auth/logout` — anonymous, idempotent revoke of the presented
   * refresh token.
   * Success: `200 ApiResponse` (no data).
   * Failures: `400` validation.
   */
  logout(body: LogoutRequest, options: ApiRequestOptions = {}): Observable<ApiResponse> {
    return this.api.post<ApiResponse>(IDENTITY_ENDPOINTS.logout.path, body, options);
  }

  /**
   * `GET /auth/me` — any authenticated JWT (token attached centrally by the
   * interceptor pipeline, never by callers). Resolves the user from the
   * JWT `NameIdentifier` claim; no id parameter, so no IDOR surface.
   * Success: `200 ApiResponse<UserResponse>`.
   * Failures: `401` (no/invalid JWT), `404` (user deleted).
   */
  getCurrentUser(options: ApiRequestOptions = {}): Observable<ApiResponseWithData<UserResponse>> {
    return this.api.get<ApiResponseWithData<UserResponse>>(IDENTITY_ENDPOINTS.me.path, options);
  }

  /**
   * `POST /auth/verify-email` — anonymous. Consumes the single-use email
   * link token (24h).
   * Success: `200 ApiResponse<UserResponse>`.
   * Failures: `400` validation, `401 Identity.InvalidToken`, `404`
   * (user/token not found).
   */
  verifyEmail(
    body: VerifyEmailRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<UserResponse>> {
    return this.api.post<ApiResponseWithData<UserResponse>>(
      IDENTITY_ENDPOINTS.verifyEmail.path,
      body,
      options,
    );
  }

  /**
   * `POST /auth/resend-verification` — anonymous, unverified accounts only.
   * Success: `200 ApiResponse<ResendVerificationResponse>`
   * (`{ emailSent, expiresAtUtc? }`).
   * Failures: `400` validation.
   */
  resendVerification(
    body: ResendVerificationRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<ResendVerificationResponse>> {
    return this.api.post<ApiResponseWithData<ResendVerificationResponse>>(
      IDENTITY_ENDPOINTS.resendVerification.path,
      body,
      options,
    );
  }

  /**
   * `POST /auth/forgot-password` — anonymous. Always `200` (no account
   * enumeration); the 1h reset token is delivered by email when the account
   * exists.
   * Success: `200 ApiResponse` (no data).
   * Failures: `400` validation.
   */
  forgotPassword(
    body: ForgotPasswordRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponse> {
    return this.api.post<ApiResponse>(IDENTITY_ENDPOINTS.forgotPassword.path, body, options);
  }

  /**
   * `POST /auth/reset-password` — anonymous. Consumes the 1h reset token;
   * `newPassword` must satisfy the backend password policy.
   * Success: `200 ApiResponse` (no data).
   * Failures: `400` validation, `401 Identity.InvalidToken`.
   */
  resetPassword(
    body: ResetPasswordRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponse> {
    return this.api.post<ApiResponse>(IDENTITY_ENDPOINTS.resetPassword.path, body, options);
  }

  /**
   * `POST /auth/change-password` — any authenticated JWT (token attached
   * centrally). `confirmPassword` must equal `newPassword`; both must
   * satisfy the password policy.
   * Success: `200 ApiResponse` (no data).
   * Failures: `400` validation, `401` (no/invalid JWT).
   */
  changePassword(
    body: ChangePasswordRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponse> {
    return this.api.post<ApiResponse>(IDENTITY_ENDPOINTS.changePassword.path, body, options);
  }

  /**
   * `PUT /auth/profile` — any authenticated JWT. All fields nullable:
   * `null` keeps the current value, empty clears optional fields.
   * Success: `200 ApiResponse<UserResponse>` (with updated `permissions`).
   * Failures: `400` validation, `401`, `404` (deleted between login and call).
   */
  updateProfile(
    body: UpdateProfileRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<UserResponse>> {
    return this.api.put<ApiResponseWithData<UserResponse>>(
      IDENTITY_ENDPOINTS.updateProfile.path,
      body,
      options,
    );
  }

  /**
   * `POST /admin/users/{id}/roles` — `SuperAdmin` only. The id travels
   * in the route, never in the body. Assigning `Admin` grants nothing
   * by itself (effective on next login/refresh; permissions are
   * granted explicitly afterwards).
   * Success: `200 ApiResponse<UserResponse>`.
   * Failures: `400 Identity.InvalidRole`, `403`, `404 UserNotFound`,
   * `409 RoleAlreadyAssigned`.
   */
  assignRole(
    userId: string,
    body: AssignRoleRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<UserResponse>> {
    return this.api.post<ApiResponseWithData<UserResponse>>(
      IDENTITY_ENDPOINTS.assignRole.path,
      body,
      { ...options, pathParams: { id: userId, ...(options.pathParams ?? {}) } },
    );
  }

  /**
   * `POST /admin/users/{id}/unlock` — `SuperAdmin` only, no body.
   * Success: `200 ApiResponse<UserResponse>`.
   * Failures: `403`, `404 UserNotFound`.
   */
  unlockUser(
    userId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<UserResponse>> {
    return this.api.post<ApiResponseWithData<UserResponse>>(
      IDENTITY_ENDPOINTS.unlockUser.path,
      {},
      { ...options, pathParams: { id: userId, ...(options.pathParams ?? {}) } },
    );
  }

  /**
   * `GET /admin/users` — `users.read`. Paged (`1/20 max 100`)
   * newest-first with `status?/role?/search?` filters (unknown values
   * → `400`).
   * Success: `200 ApiResponse<PagedResult<UserAdminResponse>>`.
   * Failures: `400 ValidationFailed/InvalidRole`, `401`, `403`.
   */
  listUsers(
    query: UserListQuery = {},
    options: ApiRequestOptions = {},
  ): Observable<PagedApiResponse<UserAdminResponse>> {
    return this.api.get<PagedApiResponse<UserAdminResponse>>(IDENTITY_ENDPOINTS.listUsers.path, {
      ...options,
      params: toQueryParams(query),
    });
  }

  /**
   * `GET /admin/users/counts` — `users.read`.
   * Success: `200 ApiResponse<UserAdminCountsResponse>`.
   * Failures: `401`, `403`.
   */
  userCounts(
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<UserAdminCountsResponse>> {
    return this.api.get<ApiResponseWithData<UserAdminCountsResponse>>(
      IDENTITY_ENDPOINTS.userCounts.path,
      options,
    );
  }

  /**
   * `GET /admin/users/{id}` — `users.read`.
   * Success: `200 ApiResponse<UserAdminResponse>`.
   * Failures: `404 UserNotFound`.
   */
  getUser(
    userId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<UserAdminResponse>> {
    return this.api.get<ApiResponseWithData<UserAdminResponse>>(IDENTITY_ENDPOINTS.getUser.path, {
      ...options,
      pathParams: { id: userId, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `POST /admin/users/{id}/permissions` — `SuperAdmin` only, one
   * catalog value per call.
   * Success: `200 ApiResponse<UserResponse>` (with updated `permissions`).
   * Failures: `400 Identity.InvalidPermission`, `403`,
   * `404 UserNotFound`, `409 PermissionAlreadyGranted`.
   */
  grantPermission(
    userId: string,
    body: GrantPermissionRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<UserResponse>> {
    return this.api.post<ApiResponseWithData<UserResponse>>(
      IDENTITY_ENDPOINTS.grantPermission.path,
      body,
      { ...options, pathParams: { id: userId, ...(options.pathParams ?? {}) } },
    );
  }

  /**
   * `DELETE /admin/users/{id}/permissions/{permission}` —
   * `SuperAdmin` only, idempotent (absent permission still succeeds).
   * Success: `200 ApiResponse<UserResponse>`.
   * Failures: `400 Identity.InvalidPermission`, `403`,
   * `404 UserNotFound`.
   */
  revokePermission(
    userId: string,
    permission: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<UserResponse>> {
    return this.api.delete<ApiResponseWithData<UserResponse>>(
      IDENTITY_ENDPOINTS.revokePermission.path,
      { ...options, pathParams: { id: userId, permission, ...(options.pathParams ?? {}) } },
    );
  }

  /**
   * `GET /admin/users/{id}/permissions` — `users.read` (readable for
   * display).
   * Success: `200 ApiResponse<string[]>` (granted values).
   * Failures: `404 UserNotFound`.
   */
  listUserPermissions(
    userId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<string[]>> {
    return this.api.get<ApiResponseWithData<string[]>>(
      IDENTITY_ENDPOINTS.listUserPermissions.path,
      { ...options, pathParams: { id: userId, ...(options.pathParams ?? {}) } },
    );
  }

  /**
   * `GET /admin/users/permissions` — `SuperAdmin` only.
   * Success: `200 ApiResponse<string[]>` (full catalog).
   * Failures: `401`, `403`.
   */
  permissionCatalog(options: ApiRequestOptions = {}): Observable<ApiResponseWithData<string[]>> {
    return this.api.get<ApiResponseWithData<string[]>>(
      IDENTITY_ENDPOINTS.permissionCatalog.path,
      options,
    );
  }
}
