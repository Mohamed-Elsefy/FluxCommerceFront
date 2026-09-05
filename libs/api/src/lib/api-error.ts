/**
 * Error-payload contracts for Sub-Phase 1.1 — API Contract Integration Foundation.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §0.2 and
 * `docs/frontend-contract/ERROR_CATALOG.md`
 * (`BuildingBlocks.Web.ProblemDetails`, `ApiControllerBase.MapError`,
 * `ExceptionHandler`, `ErrorCodeLocalizer`).
 *
 * Shapes:
 * - `ProblemDetail` (`application/problem+json`) for 401/403/404/409/500 and
 *   `Failure→400` business errors.
 * - `ValidationProblemDetail` (7 properties incl. `errors{field: [msg]}`) for
 *   `400` validation — from `ApiControllerBase.Invalid(errors)`, `MapError`
 *   `Validation`, or `[ApiController]` auto-400 on `DataAnnotations`
 *   violations (Cart/Orders/Inventory).
 *
 * Wire reality (ERROR_CATALOG §0): `MapError` builds business-error responses
 * WITHOUT `extensions`/`instance`/`traceId`, so `extensions.code` is `{}` and
 * the machine-readable `Error.Code` is NOT on the wire — only the localized
 * `detail`. Branch on `status` first, display `detail` (never the raw code),
 * read `errors{}` on `400`. Field keys are C#/DTO property names
 * (`Password`, `Quantity`, `pageNumber`, ...). Stable per-endpoint code tables
 * live in ERROR_CATALOG §§1-6; normalization into a stable frontend error
 * model is Sub-Phase 1.5 — this file only mirrors the wire shapes.
 *
 * Status mapping: `NotFound→404`, `Validation→400` (validation shape),
 * `Conflict→409`, `Unauthorized→401`, `Forbidden→403`, `Failure→400`
 * (default branch, not 500). Only unhandled exceptions → `500` generic
 * localized (message hidden).
 */

/** Business/transport error envelope (`application/problem+json`). */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string | null;
  traceId?: string | null;
  extensions?: Record<string, unknown>;
}

/** `400` validation envelope — same 7 properties plus the field-error map. */
export interface ValidationProblemDetail extends ProblemDetail {
  errors: Record<string, string[]>;
}

/** Narrows a `400` body to the validation shape (`errors{}` present). */
export function isValidationProblemDetail(
  body: ProblemDetail | ValidationProblemDetail | unknown,
): body is ValidationProblemDetail {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  return (
    (body as ValidationProblemDetail).status === 400 &&
    typeof (body as ValidationProblemDetail).errors === 'object' &&
    (body as ValidationProblemDetail).errors !== null
  );
}

/** Best-effort machine code lookup — `undefined` for business errors (§0). */
export function problemCodeOf(body: ProblemDetail | unknown): string | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }
  const extensions = (body as ProblemDetail).extensions;
  if (typeof extensions !== 'object' || extensions === null) {
    return undefined;
  }
  const code = (extensions as Record<string, unknown>)['code'];
  return typeof code === 'string' ? code : undefined;
}
