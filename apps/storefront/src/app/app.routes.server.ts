import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    // Sub-Phases 6.1–6.9 — product URLs are data-driven (one per product,
    // no build-time backend), so they render on demand instead of
    // prerendering. The server fetches live at request time, applies
    // product metadata into the SSR `<head>`, and transfers settled
    // payloads to the browser once per id (no hydration refetch).
    path: 'catalog/products/:id',
    renderMode: RenderMode.Server,
  },
  {
    // Sub-Phase 9.2 — payment URLs are data-driven (one per order, no
    // build-time backend) and authenticated, so they render on demand
    // instead of prerendering. The server renders the shell at request
    // time; provider/browser initialization happens client-side after
    // hydration (Sub-Phase 9.5/9.11 seam).
    path: 'payment/:orderId',
    renderMode: RenderMode.Server,
  },
  {
    path: 'payment/:orderId/result',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
