/**
 * Normalized API error model + mapping logic for Sub-Phase 1.5 — API Error Normalization.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §1.5.
 * Source of truth: `docs/frontend-contract/ERROR_CATALOG.md`
 * (shapes, status mapping, retry guidance) and `API_CONTRACT.md` §0.2.
 *
 * What this file does: convert every failure the `ApiClient` can surface —
 * HTTP errors, `ProblemDetail`/`ValidationProblemDetail` bodies, business /
 * conflict errors, network failures, unexpected throwables, and
 * cancellation-related errors — into one stable `ApiError`:
 *
 * ```text
 * ApiError
 * ├── status            HTTP status (0 = no response: network/cancel/unexpected)
 * ├── code              stable code: backend `Module.Code` when present,
 * │                     else a client-synthesized transport code below
 * ├── message           backend `detail` verbatim when present (already
 * │                     localized — display as-is); otherwise a technical
 * │                     English diagnostic, NEVER user-facing copy
 * ├── validationErrors  field map from the 400 validation shape, if any
 * ├── correlationId     sent context id else response echo, else null
 * └── traceId           backend trace id when present (for bug reports)
 * ```
 *
 * Code strategy (honest about the wire — ERROR_CATALOG §0): business-error
 * responses carry NO machine-readable code (`extensions` is `{}`; only the
 * localized `detail` travels). So `code` is best-effort: captured from
 * `extensions.code` when a backend ever sends it, `undefined` otherwise.
 * Features must therefore branch on `code` when present and on
 * `status` + endpoint context otherwise — and NEVER on `message` text.
 * Client-synthesized codes (`NetworkError`, `RequestCancelled`,
 * `UnknownError`) are stable PascalCase singles that can never collide with
 * dotted backend codes; the localization layer (Phase 4 / `libs/i18n`) will
 * map codes — never messages — to user-facing copy.
 *
 * Explicitly NOT here: correlation generation/ownership (1.6,
 * `./correlation-ids` — this file only forwards ids that already exist);
 * cancellation operators and lifecycle handling (1.7,
 * `./request-lifecycle` — cancellation is merely classified, never
 * managed); message translations (never hard-coded here).
 */

import { HttpErrorResponse } from '@angular/common/http';

/** Client-synthesized code for status-0 transport failures (no response received). */
export const NETWORK_ERROR_CODE = 'NetworkError';

/** Client-synthesized code for requests aborted before a response arrived. */
export const REQUEST_CANCELLED_CODE = 'RequestCancelled';

/** Client-synthesized code for non-HTTP throwables escaping the pipeline. */
export const UNKNOWN_ERROR_CODE = 'UnknownError';

/**
 * Stable frontend error representation. Thrown (via `throwError`) by the
 * error interceptor so feature data-access layers observe exactly one error
 * shape. Check with `isApiError`; branch on `code` (then `status`), never
 * on `message` text.
 */
export class ApiError extends Error {
  /** HTTP status; `0` when no response was received. */
  readonly status: number;
  /** Stable code (`Module.Code` when the backend sent one; else a transport code). */
  readonly code?: string;
  /** Field-level validation map from the 400 validation shape, if any. */
  readonly validationErrors?: Record<string, string[]>;
  /** Sent context id, else the response echo, else `null` (1.6 owns generation). */
  readonly correlationId?: string | null;
  /** Backend trace id for bug reports, when present. */
  readonly traceId?: string | null;

  constructor(init: {
    status: number;
    message: string;
    code?: string;
    validationErrors?: Record<string, string[]>;
    correlationId?: string | null;
    traceId?: string | null;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.validationErrors = init.validationErrors;
    this.correlationId = init.correlationId;
    this.traceId = init.traceId;
  }
}

/** Narrows an observed rejection to the normalized model (guards double mapping). */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

/** Defensively coerces the 400 `errors` map (contract: `Record<string, string[]>`). */
function toValidationErrors(value: unknown): Record<string, string[]> | undefined {
  const record = asRecord(value);
  if (record === null) {
    return undefined;
  }
  const result: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(record)) {
    result[field] = Array.isArray(messages)
      ? messages.filter((message): message is string => typeof message === 'string')
      : [];
  }
  return result;
}

/** Best-effort abort classification (name-based: robust across SSR/browser realms). */
function isAbortError(value: unknown): boolean {
  const record = asRecord(value);
  return record !== null && record['name'] === 'AbortError';
}

/**
 * Normalizes an `HttpErrorResponse` into an `ApiError`. `correlationId`
 * should be the sent context id with the response `X-Correlation-ID` echo as
 * fallback (resolved by the error interceptor); `null` when neither exists.
 */
export function normalizeHttpError(
  error: HttpErrorResponse,
  correlationId: string | null = null,
): ApiError {
  if (error.status === 0) {
    if (isAbortError(error.error)) {
      return new ApiError({
        status: 0,
        code: REQUEST_CANCELLED_CODE,
        message: 'Request was cancelled before a response was received.',
        correlationId,
      });
    }
    return new ApiError({
      status: 0,
      code: NETWORK_ERROR_CODE,
      message: error.message || 'Network request failed with status 0.',
      correlationId,
    });
  }

  const body = asRecord(error.error);
  if (body !== null && typeof body['status'] === 'number' && typeof body['detail'] === 'string') {
    const extensions = asRecord(body['extensions']);
    const code = extensions !== null ? stringField(extensions, 'code') : null;
    return new ApiError({
      status: error.status,
      code: code ?? undefined,
      message: body['detail'] as string,
      validationErrors:
        body['errors'] !== undefined ? toValidationErrors(body['errors']) : undefined,
      correlationId,
      traceId: stringField(body, 'traceId'),
    });
  }

  // Framework auto-400 (`[ApiController]` DataAnnotations violations) arrives
  // as a validation shape WITHOUT `detail` (only `title` + `errors`, as the
  // reported `customerId` case shows). Without this branch the whole field
  // map was dropped and the UI fell back to "unexpected error".
  if (
    body !== null &&
    typeof body['status'] === 'number' &&
    body['errors'] !== undefined &&
    asRecord(body['errors']) !== null
  ) {
    const extensions = asRecord(body['extensions']);
    const code = extensions !== null ? stringField(extensions, 'code') : null;
    return new ApiError({
      status: error.status,
      code: code ?? undefined,
      message: stringField(body, 'title') ?? `Validation failed with status ${error.status}.`,
      validationErrors: toValidationErrors(body['errors']),
      correlationId,
      traceId: stringField(body, 'traceId'),
    });
  }

  if (typeof error.error === 'string' && error.error.trim() !== '') {
    return new ApiError({
      status: error.status,
      message: error.error,
      correlationId,
    });
  }
  return new ApiError({
    status: error.status,
    message: `Request failed with status ${error.status} (${error.statusText || 'Unknown'}).`,
    correlationId,
  });
}

/**
 * Normalizes non-HTTP throwables (unexpected pipeline failures). Already
 * normalized `ApiError` instances pass through untouched (no double mapping).
 */
export function normalizeUnknownError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }
  if (error instanceof Error && error.message !== '') {
    return new ApiError({ status: 0, code: UNKNOWN_ERROR_CODE, message: error.message });
  }
  return new ApiError({
    status: 0,
    code: UNKNOWN_ERROR_CODE,
    message: 'An unexpected error occurred.',
  });
}
