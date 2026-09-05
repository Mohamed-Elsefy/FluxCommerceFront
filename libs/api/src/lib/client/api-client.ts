/**
 * Typed API client foundation for Sub-Phase 1.3 — Typed API Client Architecture.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §1.3.
 *
 * Required layering (`ARCHITECTURE.md` §10):
 *
 * ```text
 * Feature Data Access
 *         ↓ ApiClient (this file — the ONLY sanctioned HttpClient user)
 *     HttpClient
 *         ↓
 * ASP.NET Core API
 * ```
 *
 * Naming conventions:
 * - Method names mirror HTTP verbs in lowercase: `get`/`post`/`put`/`patch`/`delete`.
 * - `T` is always the FULL response body — typically `ApiResponse`,
 *   `ApiResponseWithData<M>`, or `PagedApiResponse<M>` from `./api-response`
 *   with `M` from `@flux/models`. The client never unwraps `data`.
 * - `pathParams` keys must match the `{placeholder}` names of the route
 *   template (see `EndpointDefinition.path` in `./api-endpoints`).
 * - `params` keys use wire (camelCase) query names per `docs/frontend-contract/`.
 *
 * Parameter & payload handling:
 * - Path interpolation via `buildEndpointPath` (`{id}` → encoded value).
 * - Query serialization via `buildQueryString`: `null`/`undefined` are
 *   omitted, arrays repeat the key (`?id=1&id=2`), scalars (incl. numeric
 *   wire enums, paging ints, booleans) stringify. Manual serialization keeps
 *   omission semantics explicit — `HttpClient`'s `params` handling is not
 *   relied upon.
 * - Bodies accept the 1.1 DTO types as `unknown` (any DTO assignable, no
 *   `any` leakage); `delete` sends no body (no contract `DELETE` takes one).
 * - Base URL comes from `API_BASE_URL` (Sub-Phase 1.2) — never hard-coded.
 * - `context` flows into `HttpContext` via `toHttpContext` for the 1.4
 *   interceptor pipeline to consume.
 *
 * Codegen decision (§1.3 "Determine where generated API code belongs"): the
 * backend contract ships as docs + C# records with no OpenAPI codegen step,
 * so the 1.1 hand mirrors + this client are the integration surface. If
 * OpenAPI generation is adopted later, generated output belongs in
 * `libs/api/src/lib/generated/` and this client stays as the hand-written
 * transport it builds upon — generated DTOs would replace `@flux/models`
 * mirrors, never this layer.
 *
 * Manual mapping boundaries (what this client deliberately does NOT do):
 * - No `ApiResponse.data` unwrapping — feature data-access maps DTOs to view
 *   models and decides empty/success states (Sub-Phases 1.8/1.9).
 * - No error normalization or `ProblemDetail` handling — Sub-Phase 1.5 owns
 *   that; errors pass through untouched.
 * - No auth header injection — interceptors (1.4) and Phase 2 own tokens.
 * - No DTO→view-model mapping — feature-owned, never shared prematurely.
 */

import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import { buildApiUrl } from './api-config';
import { buildEndpointPath } from '../contracts/api-endpoints';
import { ApiRequestContext, toHttpContext } from '../runtime/request-context';
import { cancelOnAbort } from '../runtime/request-lifecycle';
import { buildQueryString } from '../runtime/query';
import type { QueryParams } from '../runtime/query';

/** Route-template values, keyed by `{placeholder}` name, e.g. `{ id: orderId }`. */
export type PathParams = Record<string, string | number>;

/**
 * Per-call options for every `ApiClient` verb. All fields optional; an
 * omitted field leaves that request aspect at its default.
 */
export interface ApiRequestOptions {
  /** Values for the route template's `{placeholders}`. */
  readonly pathParams?: PathParams;
  /** Query string parameters (convert typed query objects via `toQueryParams`). */
  readonly params?: QueryParams;
  /** Extra headers merged onto the request. */
  readonly headers?: Record<string, string>;
  /** Request-scoped metadata (correlation/culture/idempotency). */
  readonly context?: ApiRequestContext;
  /**
   * Lifecycle signal (e.g. `destroySignal(destroyRef)`). Aborting completes
   * the call silently without sending (pre-aborted) or aborts it in flight;
   * cancellations never surface as errors (Sub-Phase 1.7).
   */
  readonly signal?: AbortSignal;
}

/**
 * The single typed gateway between feature data-access services and Angular
 * `HttpClient`. Inject this — never `HttpClient` — in features
 * (enforced by lint + `scripts/verify-architecture.mjs`).
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Typed `GET`. `T` is the full body (e.g. `ApiResponseWithData<CartResponse>`). */
  get<T>(path: string, options: ApiRequestOptions = {}): Observable<T> {
    const { url, headers, context } = this.prepare(path, options);
    return this.http.get<T>(url, { headers, context }).pipe(cancelOnAbort(options.signal));
  }

  /**
   * Typed `POST` with body (1.1 DTO as `body`). Use `T = ApiResponse` for
   * dataless `200`s and `T = void` for `204 No Content` lifecycle calls.
   */
  post<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    const { url, headers, context } = this.prepare(path, options);
    return this.http.post<T>(url, body, { headers, context }).pipe(cancelOnAbort(options.signal));
  }

  /** Typed `PUT` with body. `T = void` for `204 No Content` updates. */
  put<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    const { url, headers, context } = this.prepare(path, options);
    return this.http.put<T>(url, body, { headers, context }).pipe(cancelOnAbort(options.signal));
  }

  /** Typed `PATCH` with body. */
  patch<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    const { url, headers, context } = this.prepare(path, options);
    return this.http.patch<T>(url, body, { headers, context }).pipe(cancelOnAbort(options.signal));
  }

  /** Typed bodyless `DELETE` (no contract `DELETE` takes a body). */
  delete<T>(path: string, options: ApiRequestOptions = {}): Observable<T> {
    const { url, headers, context } = this.prepare(path, options);
    return this.http.delete<T>(url, { headers, context }).pipe(cancelOnAbort(options.signal));
  }

  private prepare(
    path: string,
    options: ApiRequestOptions,
  ): {
    url: string;
    headers: HttpHeaders;
    context: ReturnType<typeof toHttpContext>;
  } {
    const interpolated = buildEndpointPath(path, options.pathParams ?? {});
    const query = buildQueryString(options.params ?? {});
    const url = buildApiUrl({ baseUrl: this.baseUrl }, interpolated) + (query ? `?${query}` : '');
    return {
      url,
      headers: new HttpHeaders(options.headers ?? {}),
      context: toHttpContext(options.context ?? {}),
    };
  }
}
