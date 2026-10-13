# ADR 023 — SSR Production Posture: Explicit Prerender, Server Fallback, Safe Errors

Status: Accepted (2026-09-25, Phase 11 Sub-Phases 11.11/11.13).

## Context

The 11.1 baseline prerendered 15 static routes with a `** → Prerender`
catch-all. Sub-Phase 11.2 then proved that unknown URLs fall through the
Angular pipeline to a raw Express `Cannot GET` page on direct
navigation and SSR requests — the localized `NotFoundPage` never
rendered server-side. Switching the catch-all to `RenderMode.Server`
fixed the 404 path but silently dropped prerendering to **0 routes**
(verified by rebuild in 11.13): a `Server` wildcard disables the
crawler that auto-discovers static routes.

## Decision

1. **Explicit static routes + Server wildcard.** The 15 baseline static
   routes are declared explicitly as `RenderMode.Prerender` in
   `app.routes.server.ts` (data-driven `:id` routes stay `Server`);
   `**` stays `RenderMode.Server` so unknown URLs render `NotFoundPage`
   through the Angular pipeline. Prerender output is pinned at 15/15 by
   rebuild verification, not by crawl behavior.
2. **API namespace guard.** `server.ts` answers `/api/*` with a generic
   JSON 404. The storefront owns no API implementation (no same-origin
   proxy exists); without the guard the pipeline would render
   application HTML with a 200 status for a machine namespace.
3. **Generic failure surfaces.** A terminal fallthrough (404) and an
   error-handling middleware (500, server-side logging) serve one
   static, internals-free page. Plain fallthrough and error paths are
   separate middleware by Express design.
4. **Host validation is deployment configuration.** `angular.json`
   keeps `allowedHosts: []` (deny-by-default); deployments supply
   `NG_ALLOWED_HOSTS` at runtime. Verification runs used
   `NG_ALLOWED_HOSTS=localhost,127.0.0.1`. Never `"*"`.

## Consequences

- Unknown URLs render localized, non-indexable 404 content on every
  path (direct, SSR, in-app) with zero framework leakage.
- HTTP status for unknown URLs stays 200 with `noindex`: Angular SSR
  exposes no status-code seam for `**` routes. Proper 404 status
  belongs to platform evolution (Phase 15).
- Any new static route must be added to the explicit prerender list;
  the build's `prerendered-routes.json` is the check.
