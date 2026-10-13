# ADR 025 — Shell Navigation Model & Layout Localization

Status: Accepted (2026-09-25, Phase 11 follow-ups: header controls, layout translation).

## Context

The Phase 3 shell shipped English-only with a single Home destination;
the cart link and language picker were deferred until their routes and
contracts existed. Two constraints collided when adding them: (a) the
`verify-architecture.mjs` shell boundary forbids business words in
shell sources, and route paths (`/catalog`, `/cart`) name business
areas; (b) `libs/auth` must stay free of a localization dependency
(`ARCHITECTURE.md` §6), yet `AuthNav` renders user-facing session copy.

## Decision

1. **App-composed destinations.** Route paths plus translation *keys*
   live in `apps/storefront/src/app/storefront-navigation.ts`
   (`NavDestination{labelKey, route}`); shells map keys through the
   layout bundle at render time. Shells import no business modules and
   contain no business literals.
2. **Layout-owned `layout.*` bundle.** Shell chrome (destinations,
   brand/menu/skip labels, picker label, footer, legal with `{year}`)
   resolves per culture with the standard engine and fallback; short
   nouns reuse established feature wording. The 3.6 business-words
   audit now excludes `*-translations.ts` (prose, zero imports —
   documented in the script); import-shape coupling stays covered by
   the barrel/direction checks.
3. **Dumb components, wired shells.** `StorefrontCultureSwitch`
   (native select, validated emits, `attr.selected` so SSR shows the
   active option) and `AuthNav` (new label inputs with English
   defaults) stay decoupled; the header wires them to `CultureService`
   and the layout bundle.
4. **Auth pages fully localized.** The feature-owned `auth.*` bundle
   (72 keys, 5 cultures) covers all six auth pages; validation and
   form-level failures resolve through the Phase 4 platform resolvers
   (`common.validation.*`, `errors.*`), and the auth `FieldErrors`
   subscribes to control events so `markAllAsTouched()` repaints under
   `OnPush` (same convention as checkout).
5. **Narrow-viewport yielding.** Below 48rem the bar's cart link and
   picker hide in favor of the hamburger panel (same instances
   pattern); verified zero overflow at 375px LTR/RTL.

## Consequences

- Admin shell chrome stays English (Phase 12+ territory).
- Auth page specs pin culture hermeticity (`localStorage.clear()` in
  `beforeEach`); cross-file culture leakage under the shared builder
  environment is a known test-isolation fragility (Phase 15).
