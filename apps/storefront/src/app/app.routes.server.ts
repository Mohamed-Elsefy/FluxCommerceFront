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
    // Sub-Phase 10.4 — order-detail URLs are data-driven (one per
    // order, no build-time backend) and authenticated, so they render
    // on demand instead of prerendering. The server renders the loading
    // shell at request time; the live order loads client-side after
    // hydration (same seam as the §10.2 profile page).
    path: 'account/orders/:orderId',
    renderMode: RenderMode.Server,
  },
  {
    // Sub-Phase 11.13 — explicit static routes (mirrors the 11.1
    // baseline of 15 prerendered routes). A `** → Server` fallback
    // disables the crawler that auto-discovers these, so they are
    // declared explicitly instead of depending on crawl behavior.
    // Partial paths (`catalog/products`, `payment`, `account/orders`)
    // prerender their idle shells by design (no backend at build time);
    // data-driven `:id` variants stay `Server` above.
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'account',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'account/orders',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'account/profile',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'cart',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'catalog',
    renderMode: RenderMode.Prerender,
  },
  {
    // Catalog aliases (same idle shells as their primaries — no backend
    // at build time, data loads in the browser after hydration).
    path: 'catalog/categories',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'catalog/products',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'catalog/products',
    renderMode: RenderMode.Prerender,
  },
  {
    // Products shelf — static listing shell prerenders idle (same SSR
    // posture as the catalog discovery page: no backend at build time).
    path: 'products',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'checkout',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'forgot-password',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'login',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'payment',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'register',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'resend-verification',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'reset-password',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'verify-email',
    renderMode: RenderMode.Prerender,
  },
  {
    // Sub-Phase 11.11 — unknown URLs (no prerenderable enumeration
    // exists for them) render on demand instead of prerendering, so
    // direct navigation and SSR requests serve the localized
    // `NotFoundPage` through the Angular pipeline instead of falling
    // through to the raw Express fallback.
    path: '**',
    renderMode: RenderMode.Server,
  },
];
