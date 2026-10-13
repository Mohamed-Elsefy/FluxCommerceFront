/**
 * `libs/utils` foundation.
 *
 * Contains only generic utilities with no business ownership.
 * Anything feature-specific belongs in its owning feature, never here.
 */

/** Narrows `null`/`undefined` away (e.g. inside `filter` or after lookups). */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
