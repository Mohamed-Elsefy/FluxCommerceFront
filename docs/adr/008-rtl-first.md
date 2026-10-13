# ADR 008 — RTL-First Strategy

Status: Accepted (2026-09-10, Phase 3 Sub-Phase 3.9).

## Context

Retrofitting RTL onto an LTR-designed system duplicates components and
breaks layouts. The requirement (ARCHITECTURE.md §15) is RTL-safety from
the first component, with direction switching and translations arriving
later in Phase 4 (`libs/i18n`).

## Decision

Direction response flows exclusively through CSS logical properties.
Enforcement, not convention:

- Zero physical-direction properties workspace-wide (margins, paddings,
  borders, radii, floats, alignment, standalone `left`/`right`,
  `translateX`, per-direction selectors) — asserted by
  `scripts/verify-architecture.mjs` across every stylesheet.
- No direction branching in code (no `dir` reads, no RTL flags) and no
  forced `direction` values — asserted the same way.
- No per-direction component variants (asserted by basename scan);
  horizontal stacks, drawers (`inset-inline-start`), and grid areas mirror
  with the document direction automatically.
- Behavioral proof: every shared primitive renders byte-identical markup
  under `dir="ltr"` and `dir="rtl"` (`direction-invariance` suite), and
  E2E renders the storefront RTL smoke without overflow.
- Decorative marks stay the feature's choice (`Icon` documents that
  mirroring-sensitive glyphs are feature-owned, never library-assumed).

## Consequences

- Phase 4 can switch document direction centrally with no component
  changes; LTR and RTL are the same code path, so they cannot diverge.
- Contributors get immediate audit failures instead of review-time RTL
  comments.
- Anything genuinely asymmetric in the future (e.g. directional
  iconography) must be an explicit, tested feature decision — the default
  stays symmetric.
