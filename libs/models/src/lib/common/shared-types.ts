/**
 * `libs/models` foundation.
 *
 * Contains only genuinely shared, cross-application primitive types.
 * Feature-specific models stay inside their owning feature.
 */

/** Opaque identifier of any backend entity. Wire type: UUID string. */
export type EntityId = string;

/** Backend `Guid` scalar as transported over JSON. Always a UUID string. */
export type Guid = string;

/**
 * ISO-8601 date-time string as transported by the backend API.
 *
 * Covers both backend timestamp kinds (they are indistinguishable on the
 * wire): `DateTime` (Identity + Catalog timestamps) and `DateTimeOffset`
 * (Cart + Orders + Inventory timestamps). See `docs/frontend-contract/DTO_REFERENCE.md` §0.
 */
export type IsoDateString = string;

/**
 * Shared paging input for every paged list query
 * (`PAGINATION_CONVENTION.md`: `pageNumber >= 1`, `1 <= pageSize <= 100`,
 * defaults `1`/`20`). Omitted values resolve to backend defaults.
 */
export interface PageQuery {
  readonly pageNumber?: number;
  readonly pageSize?: number;
}

/**
 * Structural pre-check for paging bounds. Null/undefined means "server
 * defaults" and passes. Never a substitute for backend validation
 * (`400 ValidationFailed` on violation). Pure — throws nothing.
 */
export function isValidPageQuery(query: PageQuery | null | undefined): boolean {
  if (query === null || query === undefined) {
    return true;
  }
  const { pageNumber, pageSize } = query;
  if (pageNumber !== undefined && pageNumber !== null) {
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      return false;
    }
  }
  if (pageSize !== undefined && pageSize !== null) {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return false;
    }
  }
  return true;
}
