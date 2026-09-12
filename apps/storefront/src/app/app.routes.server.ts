import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // Sub-Phase 6.1 — product URLs are data-driven (one per product, no
    // build-time backend), so they render on demand instead of prerendering.
    // The server emits the idle shell; data loads in the browser after
    // hydration (SSR transfer arrives in Sub-Phase 6.9).
    path: 'catalog/products/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
