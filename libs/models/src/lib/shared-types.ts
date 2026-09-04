/**
 * `libs/models` foundation.
 *
 * Contains only genuinely shared, cross-application primitive types.
 * Feature-specific models stay inside their owning feature.
 */

/** Opaque identifier of any backend entity. */
export type EntityId = string;

/** ISO-8601 date-time string as transported by the backend API. */
export type IsoDateString = string;
