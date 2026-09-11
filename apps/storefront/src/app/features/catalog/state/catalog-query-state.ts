/**
 * Coherent catalog query state for Sub-Phase 5.4 — Catalog Query State.
 *
 * Scope: `docs/phases/PHASE_5_CATALOG.md` §5.4 (state only — no UI).
 *
 * One typed representation of the catalog query instead of managing
 * search, category, filters, sorting, and pagination independently:
 *
 * ```text
 * CatalogQueryState
 * ├── search    (free text, '' = none)
 * ├── category  (category id, null = all)
 * ├── filters   (backend-supported filters: status, visibility)
 * ├── sort      (backend-supported sort: field + direction)
 * ├── page      (1-based)
 * └── pageSize  (1..100)
 * ```
 *
 * Layering (single query-building path — never duplicated):
 *
 * ```text
 * UI (5.5+ inputs; route in 5.2 shape)
 *     ↓ pure updaters (this file — new immutable snapshot per change)
 *     ↓ toBackendQuery (UI shape → backend CatalogSearchQuery)
 *     ↓ toCatalogQueryParams (models — normalization + funnel)
 *     ↓ ApiClient params → GET /catalog
 * ```
 *
 * Rules enforced here:
 * - Immutability: every updater returns a NEW snapshot (nested spreads —
 *   structural sharing, never mutation), so OnPush components and signals
 *   observe reference changes.
 * - Page reset: `search`/`category`/`filters`/`sort`/`pageSize` changes
 *   reset `page` to 1 (a new result set starts on the first page; sort
 *   follows the 5.6 "same principle" rule). `page` changes preserve
 *   everything else, so pagination never loses active search/filter/sort.
 * - Paging normalization delegates to the Phase 1 `normalizePagination`
 *   primitive — no duplicated clamping logic.
 * - Route sync shares the backend field names (`searchTerm`, `categoryId`,
 *   `status`, `visibility`, `sortBy`, `sortDirection`, `pageNumber`,
 *   `pageSize`), so one schema serves wire and URL. Garbage route values
 *   fall back to field defaults (the backend stays the validator for
 *   real ids).
 * - Contract fidelity: only backend-supported fields exist. Price-like or
 *   availability filters are NOT invented here (same rule as the 5.3 card).
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 5.5 — no search input component (state accepts search text already).
 * - 5.6 — no filter/sort selector components (state accepts them already).
 * - 5.7 — no pagination controls (state carries page/pageSize already).
 *
 * Pure functions + types only: no Angular, DOM, HTTP, or storage access —
 * SSR-safe. Feature-owned (`catalog/state`); never global state.
 */

import { normalizePagination, toQueryParams, type QueryParams } from '@flux/api';
import {
  CatalogProductSortBy,
  CatalogProductSortDirection,
  ProductStatus,
  ProductVisibility,
} from '@flux/models';
import { DEFAULT_CATALOG_PAGE_NUMBER, DEFAULT_CATALOG_PAGE_SIZE } from '../models/catalog.models';
import type { CatalogQuery } from '../models/catalog.models';

/** Backend-supported listing filters (subset of `CatalogProductFilter`). */
export interface CatalogFilters {
  /** Product lifecycle filter (`null` = no filter). */
  readonly status: ProductStatus | null;
  /** Product exposure filter (`null` = no filter). */
  readonly visibility: ProductVisibility | null;
}

/** Backend-supported listing sort (`GET /catalog?sortBy=&sortDirection=`). */
export interface CatalogSort {
  /**
   * Sort field (`null` = backend default order; `direction` is then
   * meaningless and omitted on the wire).
   */
  readonly by: CatalogProductSortBy | null;
  /** Sort direction (only sent alongside `by`). */
  readonly direction: CatalogProductSortDirection;
}

/**
 * Single coherent catalog query: search, category, filters, sort, and
 * pagination in one immutable snapshot. UI-facing names; `toBackendQuery`
 * translates to wire names exactly once.
 */
export interface CatalogQueryState {
  /** Free search text (`''` = no search). Kept verbatim; `''` omits it. */
  readonly search: string;
  /** Selected category id (`null` = all categories). */
  readonly category: string | null;
  /** Listing filters. */
  readonly filters: CatalogFilters;
  /** Listing sort. */
  readonly sort: CatalogSort;
  /** Current page, 1-based. */
  readonly page: number;
  /** Current page size (1..100). */
  readonly pageSize: number;
}

/** Fresh default query: no search/filter/sort, first page, backend size. */
export function defaultCatalogQueryState(): CatalogQueryState {
  return {
    search: '',
    category: null,
    filters: { status: null, visibility: null },
    sort: { by: null, direction: CatalogProductSortDirection.Ascending },
    page: DEFAULT_CATALOG_PAGE_NUMBER,
    pageSize: DEFAULT_CATALOG_PAGE_SIZE,
  };
}

/**
 * Whether a query selects a listing at all: a category, a search text, an
 * active filter, or an explicit sort. The page renders the listing section
 * (and loads it) only then; pure discovery otherwise. Pure.
 */
export function hasListingQuery(state: CatalogQueryState): boolean {
  return (
    state.category !== null ||
    state.search !== '' ||
    state.filters.status !== null ||
    state.filters.visibility !== null ||
    state.sort.by !== null
  );
}

/**
 * Sets search text and resets to the first page (a new result set starts
 * at page 1). Pure — returns a new snapshot, never mutates the input.
 */
export function setQuerySearch(state: CatalogQueryState, search: string): CatalogQueryState {
  return { ...state, search, page: DEFAULT_CATALOG_PAGE_NUMBER };
}

/**
 * Selects a category (`null`, empty, or blank clears it) and resets to the
 * first page. Pure — returns a new snapshot, never mutates the input.
 */
export function setQueryCategory(
  state: CatalogQueryState,
  category: string | null,
): CatalogQueryState {
  const normalized = category === null || category.trim() === '' ? null : category.trim();
  return { ...state, category: normalized, page: DEFAULT_CATALOG_PAGE_NUMBER };
}

/** Filter patch: set fields change, `null` clears, omitted fields keep. */
export interface CatalogFilterPatch {
  readonly status?: ProductStatus | null;
  readonly visibility?: ProductVisibility | null;
}

/**
 * Merges a filter patch and resets to the first page. Pure — returns a
 * new snapshot (new `filters` object), never mutates the input.
 */
export function setQueryFilters(
  state: CatalogQueryState,
  patch: CatalogFilterPatch,
): CatalogQueryState {
  return {
    ...state,
    filters: {
      status: patch.status !== undefined ? patch.status : state.filters.status,
      visibility: patch.visibility !== undefined ? patch.visibility : state.filters.visibility,
    },
    page: DEFAULT_CATALOG_PAGE_NUMBER,
  };
}

/** Sort patch: `by: null` clears sorting; omitted `direction` keeps it. */
export interface CatalogSortPatch {
  readonly by: CatalogProductSortBy | null;
  readonly direction?: CatalogProductSortDirection;
}

/**
 * Replaces sorting and resets to the first page (same principle as
 * filters — a reordered result set starts at page 1). Pure — returns a
 * new snapshot (new `sort` object), never mutates the input.
 */
export function setQuerySort(state: CatalogQueryState, patch: CatalogSortPatch): CatalogQueryState {
  return {
    ...state,
    sort: {
      by: patch.by,
      direction: patch.direction !== undefined ? patch.direction : state.sort.direction,
    },
    page: DEFAULT_CATALOG_PAGE_NUMBER,
  };
}

/**
 * Encodes a sort combination as an opaque select token (`''` = default
 * order). Single encode site for the 5.6 sort selector — the page never
 * builds sort tokens itself.
 */
export function encodeSortSelection(sort: CatalogSort): string {
  return sort.by === null ? '' : `${sort.by}:${sort.direction}`;
}

/**
 * Decodes a sort select token back into a patch for `setQuerySort`.
 * Unknown or partial tokens clear sorting (never a backend 400); an
 * unparseable direction falls back to ascending. Pure.
 */
export function decodeSortSelection(value: string): CatalogSortPatch {
  const separator = value.indexOf(':');
  const by = parseCatalogSortBy(separator === -1 ? null : value.slice(0, separator));
  if (by === null) {
    return { by: null };
  }
  return {
    by,
    direction:
      parseCatalogSortDirection(separator === -1 ? null : value.slice(separator + 1)) ??
      CatalogProductSortDirection.Ascending,
  };
}

/**
 * Moves to `page`, preserving search/category/filters/sort — pagination
 * never loses the active query. Out-of-range and non-finite values fall
 * back through the Phase 1 paging primitive. Pure — new snapshot.
 */
export function setQueryPage(state: CatalogQueryState, page: number): CatalogQueryState {
  return {
    ...state,
    page: normalizePagination({ pageNumber: page, pageSize: state.pageSize }).pageNumber,
  };
}

/**
 * Changes the page size (clamped 1..100 via the Phase 1 paging primitive)
 * and resets to the first page (the current page may not exist under the
 * new size). Pure — returns a new snapshot, never mutates the input.
 */
export function setQueryPageSize(state: CatalogQueryState, pageSize: number): CatalogQueryState {
  return {
    ...state,
    pageSize: normalizePagination({ pageNumber: state.page, pageSize }).pageSize,
    page: DEFAULT_CATALOG_PAGE_NUMBER,
  };
}

/**
 * Translates UI state to the backend `GET /catalog` query — the single
 * sanctioned conversion (never hand-built query strings downstream:
 * `toCatalogQueryParams(toBackendQuery(state))`). Empty search, cleared
 * filters, and fieldless sort omit their keys so backend defaults apply;
 * paging passes through for the funnel to normalize.
 */
export function toBackendQuery(state: CatalogQueryState): CatalogQuery {
  return {
    searchTerm: state.search === '' ? undefined : state.search,
    categoryId: state.category ?? undefined,
    status: state.filters.status ?? undefined,
    visibility: state.filters.visibility ?? undefined,
    sortBy: state.sort.by ?? undefined,
    sortDirection: state.sort.by === null ? undefined : state.sort.direction,
    pageNumber: state.page,
    pageSize: state.pageSize,
  };
}

/**
 * Serializes state to route query parameters through the SAME funnel as
 * the wire mapping — one schema for URL and backend, no parallel
 * query-building logic. `null`/empty fields omit their keys; paging
 * always travels explicitly so shared links reproduce the exact page.
 */
export function toRouteQueryParams(state: CatalogQueryState): QueryParams {
  return toQueryParams(toBackendQuery(state));
}

/** Minimal structural reader for route parameters (satisfied by `ParamMap`). */
export interface RouteParamReader {
  get(name: string): string | null;
}

/**
 * Parses route parameters back into query state. Unknown, blank, or
 * malformed values fall back to field defaults (deep links never crash
 * the listing; the backend validates real ids). Pure and total.
 */
export function queryStateFromRouteParams(params: RouteParamReader): CatalogQueryState {
  const search = params.get('searchTerm');
  const category = params.get('categoryId');
  const sortBy = parseCatalogSortBy(params.get('sortBy'));
  const paging = normalizePagination({
    pageNumber: params.get('pageNumber') === null ? undefined : Number(params.get('pageNumber')),
    pageSize: params.get('pageSize') === null ? undefined : Number(params.get('pageSize')),
  });
  return {
    search: search ?? '',
    category: category === null || category.trim() === '' ? null : category.trim(),
    filters: {
      status: parseProductStatus(params.get('status')),
      visibility: parseProductVisibility(params.get('visibility')),
    },
    sort: {
      by: sortBy,
      direction:
        sortBy === null
          ? CatalogProductSortDirection.Ascending
          : (parseCatalogSortDirection(params.get('sortDirection')) ??
            CatalogProductSortDirection.Ascending),
    },
    page: paging.pageNumber,
    pageSize: paging.pageSize,
  };
}

/** Parses a numeric-or-name enum route value; unknown values yield `null`. */
function parseRouteEnum<T extends number>(
  raw: string | null,
  names: Readonly<Record<string, T>>,
  known: (value: number) => boolean,
): T | null {
  if (raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }
  if (/^-?\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    return known(numeric) ? (numeric as T) : null;
  }
  const hit = names[trimmed.toLowerCase()];
  return hit === undefined ? null : hit;
}

/** `?status=` — numeric wire values with reverse lookup, or names. */
export function parseProductStatus(raw: string | null): ProductStatus | null {
  return parseRouteEnum<ProductStatus>(
    raw,
    {
      draft: ProductStatus.Draft,
      active: ProductStatus.Active,
      inactive: ProductStatus.Inactive,
      archived: ProductStatus.Archived,
    },
    (value) => ProductStatus[value] !== undefined,
  );
}

/** `?visibility=` — numeric wire values with reverse lookup, or names. */
export function parseProductVisibility(raw: string | null): ProductVisibility | null {
  return parseRouteEnum<ProductVisibility>(
    raw,
    { visible: ProductVisibility.Visible, hidden: ProductVisibility.Hidden },
    (value) => ProductVisibility[value] !== undefined,
  );
}

/** `?sortBy=` — numeric wire values with reverse lookup, or names. */
function parseCatalogSortBy(raw: string | null): CatalogProductSortBy | null {
  return parseRouteEnum<CatalogProductSortBy>(
    raw,
    { name: CatalogProductSortBy.Name, createdatutc: CatalogProductSortBy.CreatedAtUtc },
    (value) => CatalogProductSortBy[value] !== undefined,
  );
}

/** `?sortDirection=` — numeric wire values with reverse lookup, or names. */
function parseCatalogSortDirection(raw: string | null): CatalogProductSortDirection | null {
  return parseRouteEnum<CatalogProductSortDirection>(
    raw,
    {
      ascending: CatalogProductSortDirection.Ascending,
      descending: CatalogProductSortDirection.Descending,
    },
    (value) => CatalogProductSortDirection[value] !== undefined,
  );
}
