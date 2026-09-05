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
