/**
 * Raw-text module declarations for Vite `?raw` imports in unit specs
 * (Sub-Phase 8.8 stylesheet audit).
 *
 * Type-only: lets `tsc` resolve `*.css?raw` / `*.html?raw` spec imports
 * whose contents Vite inlines as strings at test runtime. Production
 * code never imports raw text — component templates and stylesheets
 * stay wired through `templateUrl`/`styleUrl`.
 */

declare module '*.css?raw' {
  const content: string;
  export default content;
}

declare module '*.html?raw' {
  const content: string;
  export default content;
}
