/**
 * `libs/theming` foundation.
 *
 * Owns theme identifiers and switching constants. Design tokens, CSS
 * variables and persistence arrive with Phase 3.
 */

/** Themes supported out of the box. */
export type Theme = 'light' | 'dark';

/** Theme applied before the user selects one. */
export const DEFAULT_THEME: Theme = 'light';

/** Root attribute carrying the active theme (e.g. `<html data-theme="dark">`). */
export const THEME_ATTRIBUTE = 'data-theme';
