# ADR 024 — App-Relative Canonical & Social URLs with Shared SEO Helpers

Status: Accepted (2026-09-23, Phase 11 Sub-Phases 11.3/11.4).

## Context

Phase 11 needed page-aware SEO (`title`/`description`/canonical) and
social metadata (`og:*`, `twitter:card`) for the public pages (home,
catalog listing, product details) that renders identically during SSR
and on the client. Absolute origins are not knowable SSR-safely: the
server document carries no deployment host, and emitting a wrong
absolute origin (e.g. `localhost`) is worse than a relative reference.
Backend image payloads carry a single URL per image with no width
variants, so honest `srcset` output is impossible.

## Decision

1. **App-relative canonical and `og:url`.** Canonicals and social URLs
   are paths resolved against the document base (`/`, `/catalog?…`
   through the existing route-schema funnel, `/catalog/products/:id`
   with a `/catalog` fallback for invalid ids). Absolute origins belong
   to deployment configuration (Phase 11 §11.12/§11.13), never to page
   code. Crawlers resolve relative references against the page URL.
2. **Shared, tested helpers in `libs/utils`.** `setCanonicalUrl`
   (single-tag, idempotent) and `selectSocialImage` (backend-primary →
   first usable → bundled fallback; blank URLs never reach `og:image`)
   keep the three public pages consistent instead of reimplementing the
   rules per feature.
3. **Error states stay honest.** Failed/unknown resources render
   localized error copy with the listing canonical, the fallback image,
   and (for route-level 404s) `robots: noindex` — never product imagery
   or home/index metadata.
4. **Fallback social image.** `public/og-fallback.png` (1200×630,
   brand-composed, 7.7 KB) ships with the app shell for pages without a
   representative image.

## Consequences

- Private pages (cart, checkout, payment, account, auth) expose no
  description, canonical, or social tags by design.
- True responsive images (`srcset`) require backend image variants;
  nothing is fabricated client-side (recorded for backend evolution).
