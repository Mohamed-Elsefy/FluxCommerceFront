# ADR 006 — Design Tokens & CSS Custom Properties

Status: Accepted (2026-09-10, Phase 3 Sub-Phases 3.2/3.8).

## Context

Hard-coded colors, spacing, and type values scattered across components
drift apart and make theming impossible. The token system must serve two
applications, two themes, and both directions from one definition without
becoming an unused enterprise-wide catalog (PROJECT_CONTEXT.md §21 warns
against premature abstraction).

## Decision

Single source in `libs/theming/src/lib/tokens.css`: `:root` custom
properties under `--<category>-<name>`, covering colors, typography,
spacing, borders, radius, shadows, containers, z-index, motion, and
breakpoints. Rules:

- Dark theme reuses the same names under `:root[data-theme='dark']`
  (higher specificity, order-independent); components never branch on theme.
- Display type (`lg/xl/2xl`) and container padding are fluid `clamp()`
  ramps; micro-type and spacing stay fixed for stability.
- Breakpoints are canonical literals (`--breakpoint-sm/md/lg/xl`) because
  `var()` is invalid in `@media` conditions; queries repeat them exactly
  (audit-enforced, complements allowed).
- Values only: global resets live separately in `reset.css` (border-box,
  body margin), wired before tokens in both apps' `styles` arrays.
- Minimal by design: every token is consumed or is a required scale
  anchor; nothing speculative.

## Consequences

- Components and shells style exclusively through variables; Light/Dark
  and LTR/RTL fall out of the token layer with no per-component logic.
- Token renames are breaking changes by construction (same names are the
  theme contract) — additions are cheap, renames require migration.
- WCAG AA text contrast (4.5:1, both themes) is computed from these values
  in `scripts/verify-architecture.mjs`, so token edits cannot silently
  regress legibility.
