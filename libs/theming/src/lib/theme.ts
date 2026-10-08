/**
 * `libs/theming` foundation.
 *
 * Owns theme identifiers and switching constants. Design tokens and CSS
 * variables live in `./tokens.css` (Sub-Phase 3.2); switching mechanics
 * and persistence arrive with Sub-Phase 3.3.
 */

/** Themes supported out of the box. */
export type Theme = 'light' | 'dark';

/** Narrows an unknown (e.g. persisted) value to a supported theme. */
export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** Theme applied before the user selects one — Kinetic dark-first (DESIGN §1). */
export const DEFAULT_THEME: Theme = 'dark';

/** Root attribute carrying the active theme (e.g. `<html data-theme="dark">`). */
export const THEME_ATTRIBUTE = 'data-theme';
