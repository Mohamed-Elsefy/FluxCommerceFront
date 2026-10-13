/**
 * Shared normalized-failure model for Refactoring Phase A (step A1).
 *
 * Source of truth: `docs/frontend-contract/ERROR_CATALOG.md` §0
 * (business-error responses carry no machine code — `extensions` is
 * `{}`) and `API_CONTRACT.md` §0.2.
 *
 * Canonical status-first classifiers behind the per-feature mirrors
 * (`CheckoutFailure`/`OrdersFailure` + `is*Failure` predicates in
 * storefront features, `PaymentFailureKind` in payments). Features keep
 * their domain-specific classifiers (idempotency, cancel-conflict,
 * retry budgets) — only the generic HTTP-status predicates live here.
 *
 * Compatible with the Phase 1 `ApiError` without importing it (keeps
 * this module free of class-valued imports — types only, same
 * convention as the feature mirrors). Pure — throws nothing, no
 * Angular, no HTTP, SSR-safe.
 */

/**
 * Minimal normalized-failure view: an HTTP `status` plus the
 * best-effort `code` and the 400 field map. Branch on `status` first,
 * treat `code` as a hint, never on message text.
 */
export interface NormalizedFailure {
  readonly status: number;
  readonly code?: string;
  readonly validationErrors?: Record<string, string[]>;
}

/**
 * Whether the failure is a `400` validation rejection. Pure — throws
 * nothing.
 */
export function isValidationFailure(failure: NormalizedFailure | null | undefined): boolean {
  return failure?.status === 400;
}

/**
 * Whether the failure carries field-level validation messages (the 400
 * validation shape). Pure — throws nothing.
 */
export function hasFieldErrors(failure: NormalizedFailure | null | undefined): boolean {
  return (
    failure?.status === 400 &&
    failure?.validationErrors !== undefined &&
    Object.keys(failure.validationErrors).length > 0
  );
}

/**
 * Whether the failure is an authentication failure (`401` — anonymous
 * call or expired session). Recovery is login/refresh, never retry.
 * Pure — throws nothing.
 */
export function isAuthFailure(failure: NormalizedFailure | null | undefined): boolean {
  return failure?.status === 401;
}

/**
 * Whether the failure is an authorization rejection (`403` — missing
 * role/permission or foreign ownership). Never retry blindly, never
 * force logout — the session is valid but unauthorized. Pure.
 */
export function isAccessDeniedFailure(failure: NormalizedFailure | null | undefined): boolean {
  return failure?.status === 403;
}

/**
 * Whether the failure is a missing resource (`404` — unknown id, or a
 * masked foreign id to prevent IDOR probing). Pure — throws nothing.
 */
export function isNotFoundFailure(failure: NormalizedFailure | null | undefined): boolean {
  return failure?.status === 404;
}

/**
 * Whether the failure is a `409` conflict (idempotency reuse, stale
 * state, illegal transition). Never retried with the same input.
 * Pure — throws nothing.
 */
export function isConflictFailure(failure: NormalizedFailure | null | undefined): boolean {
  return failure?.status === 409;
}

/**
 * Whether the failure is a transport failure (`status 0` — no response
 * received: network or cancellation). Outcome unknown — explicit
 * recovery, never silent. Pure — throws nothing.
 */
export function isTransportFailure(failure: NormalizedFailure | null | undefined): boolean {
  return failure?.status === 0;
}

/**
 * Whether the failure leaves entered form data safe to preserve (any
 * `4xx` rejection — the backend changed nothing). Transport failures
 * (`status 0`) and `5xx` are unknown-outcome. Pure — throws nothing.
 */
export function isFormPreservingFailure(failure: NormalizedFailure | null | undefined): boolean {
  return failure !== null && failure !== undefined && failure.status >= 400 && failure.status < 500;
}
