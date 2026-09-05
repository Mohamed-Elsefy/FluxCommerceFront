/**
 * Query parameter & pagination abstractions for Sub-Phase 1.8 — Query Parameters
 * & Pagination Abstractions.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §1.8.
 * Source of truth: `docs/frontend-contract/PAGINATION_CONVENTION.md`
 * (`PagedResult<T>{items,totalCount,pageNumber,pageSize}` envelope,
 * defaults `1/20`, limits `pageNumber>=1`, `1<=pageSize<=100`) and
 * `DTO_REFERENCE.md` §2.6 (catalog search/filter/sort shapes).
 *
 * Layers (features never hand-build query strings or parse raw URL params):
 *
 * ```text
 * Feature state (typed query object: PaginationRequest + SortQuery + filters)
 *     ↓ normalizePagination / toPaginationParams (contract defaults + clamps)
 *     ↓ toQueryParams (typed object → QueryParams funnel, no hand-built strings)
 *     ↓ ApiClient `params` (or toHttpParams where HttpParams is required)
 * Query string → Backend
 * ```
 *
 * Serialization policy (shared by `buildQueryString` and `toHttpParams`, so
 * both stay wire-identical):
 * - `null`/`undefined` omit the key → backend defaults apply.
 * - Arrays repeat the key (`?sku=A&sku=B`); empty arrays contribute nothing.
 * - Scalars stringify (`2` → `pageNumber=2`, `true` → `exact=true`,
 *   numeric wire enums → their number).
 * - Nested objects have NO backend query convention (the contract surface is
 *   flat) and do not typecheck; runtime strays are skipped, never coerced
 *   into shapes the backend cannot bind.
 *
 * Models:
 * - `PaginationRequest` — canonical paging input (`pageNumber`, `pageSize`,
 *   both optional 1-based). `PagingQuery` (1.1) is kept as an alias.
 * - `PagedResult<T>` lives in `./api-response` (response side, unchanged).
 * - `SortQuery<TField>` — generic sort pair; `SortDirectionParam` uses the
 *   backend query names (`Ascending`/`Descending`, also accepted as numbers
 *   by model binding — send names).
 * - Filters are domain query objects (e.g. `CatalogSearchQuery` in
 *   `@flux/models`); this module treats any `QueryParams`-shaped object as
 *   filter criteria — no parallel filter framework.
 *
 * Explicitly NOT here (later work): resource-state signals/stores (1.9),
 * loading/empty/error UI primitives (1.10).
 */

import { HttpParams } from '@angular/common/http';

/** Backend paging defaults/limits (`PAGINATION_CONVENTION.md` §§3-4). */
export const DEFAULT_PAGE_NUMBER = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MIN_PAGE_NUMBER = 1;
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 100;

/**
 * Canonical pagination request input. Both fields optional and 1-based;
 * omitted values resolve to backend defaults via `normalizePagination`.
 */
export interface PaginationRequest {
  readonly pageNumber?: number;
  readonly pageSize?: number;
}

/** Fully resolved paging pair (no optionals, always within contract limits). */
export interface ResolvedPagination {
  readonly pageNumber: number;
  readonly pageSize: number;
}

/**
 * Applies contract defaults and clamps (`pageNumber>=1`, `1<=pageSize<=100`).
 * Non-finite values (NaN, infinities) and out-of-range inputs fall back to
 * defaults instead of producing backend `400`s; fractional values floor.
 */
export function normalizePagination(request: PaginationRequest = {}): ResolvedPagination {
  const rawPageNumber = request.pageNumber ?? DEFAULT_PAGE_NUMBER;
  const rawPageSize = request.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageNumber = Math.floor(rawPageNumber);
  const pageSize = Math.floor(rawPageSize);
  return {
    pageNumber:
      Number.isFinite(pageNumber) && pageNumber >= MIN_PAGE_NUMBER
        ? pageNumber
        : DEFAULT_PAGE_NUMBER,
    pageSize:
      Number.isFinite(pageSize) && pageSize >= MIN_PAGE_SIZE
        ? Math.min(pageSize, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE,
  };
}

/** Normalized paging pair as query input (spread alongside filters/sort). */
export function toPaginationParams(request: PaginationRequest = {}): QueryParams {
  const { pageNumber, pageSize } = normalizePagination(request);
  return { pageNumber, pageSize };
}

/** Backend sort-direction query names (`GET /catalog?sortDirection=`). */
export type SortDirectionParam = 'Ascending' | 'Descending';

/**
 * Generic sort pair. `TField` is the endpoint's sortable field set
 * (e.g. `'Name' | 'CreatedAtUtc'` for `GET /catalog`); defaults to open
 * strings for endpoints without a fixed set.
 */
export interface SortQuery<TField extends string = string> {
  readonly sortBy?: TField;
  readonly sortDirection?: SortDirectionParam;
}

/** Single scalar query value: strings, JSON numbers (incl. numeric wire enums), booleans. */
export type QueryParamScalar = string | number | boolean;

/**
 * One query parameter value. `null`/`undefined` omit the key; arrays repeat
 * it (`?sku=A&sku=B`); empty arrays contribute nothing.
 */
export type QueryParamValue = QueryParamScalar | readonly QueryParamScalar[] | null | undefined;

/** Query parameter map using wire (camelCase) names, e.g. `{ pageNumber: 2 }`. */
export interface QueryParams {
  [param: string]: QueryParamValue;
}

function isScalar(value: unknown): value is QueryParamScalar {
  const kind = typeof value;
  return kind === 'string' || kind === 'number' || kind === 'boolean';
}

/**
 * Shared serialization core: emits each surviving `(key, stringValue)` pair
 * in insertion order, applying the omission policy. Both public serializers
 * build on it, so string and `HttpParams` outputs can never diverge.
 */
function eachQueryValue(
  params: QueryParams,
  emit: (key: string, stringValue: string) => void,
): void {
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      continue;
    }
    const values: readonly unknown[] = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (isScalar(item)) {
        emit(key, String(item));
      }
    }
  }
}

/**
 * Converts a typed feature query object (e.g. `CatalogSearchQuery`) into
 * `QueryParams`. Needed because TypeScript interfaces never carry an implicit
 * index signature, so they are not directly assignable to `QueryParams` —
 * this funnel is the single sanctioned conversion (never hand-built strings):
 *
 * ```ts
 * client.get(path, { params: toQueryParams(query) });
 * ```
 *
 * Same policy as the serializers: `null`/`undefined` dropped, scalar arrays
 * kept, nested objects skipped (no backend convention).
 */
export function toQueryParams<T extends object>(query: T): QueryParams {
  const params: Record<string, QueryParamValue> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      params[key] = value.filter(isScalar);
    } else if (isScalar(value)) {
      params[key] = value;
    }
  }
  return params;
}

/**
 * Deterministic query serializer shared by all `ApiClient` verbs (and
 * reusable by future pagination abstractions). Omission-first:
 * `null`/`undefined`/empty arrays never reach the wire.
 */
export function buildQueryString(params: QueryParams = {}): string {
  const parts: string[] = [];
  eachQueryValue(params, (key, stringValue) => {
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(stringValue)}`);
  });
  return parts.join('&');
}

/**
 * Type-safe `QueryParams` → `HttpParams` conversion with identical semantics
 * to `buildQueryString` (same omission/repetition/stringify policy; Angular
 * encodes on `toString()`). For call sites that require `HttpParams`
 * instead of a prebuilt query string.
 */
export function toHttpParams(params: QueryParams = {}): HttpParams {
  let httpParams = new HttpParams();
  eachQueryValue(params, (key, stringValue) => {
    httpParams = httpParams.append(key, stringValue);
  });
  return httpParams;
}
