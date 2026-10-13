# ADR 010 — Culture-to-Direction Coupling

Status: Accepted (2026-09-10, Phase 4 Sub-Phase 4.4).

## Context

Phase 3 (ADR 008) made every component direction-symmetric through
logical properties but deferred document `dir` switching to Phase 4.
Switching must be central (features never touch direction), instant (no
reload), and state-duplication-free.

## Decision

`CultureService` derives direction and owns its only DOM effect:

- `direction` is a `computed` over the `culture` signal through the 4.1
  mapping (`ar` → `rtl`, all others → `ltr`) — derived, never stored, so
  no duplicate direction state can exist.
- The service is the single writer of `<html dir>` (mirroring how
  `ThemeService` owns `data-theme`), applied atomically with state and
  persistence in `initialize()`/`setCulture()`, platform-guarded like all
  browser writes.
- No Phase 3 code changed: no CSS, no component, no shell, no
  direction branching — the logical-property foundation responds to the
  attribute automatically (direction-invariance suite keeps proving it).

## Consequences

- `en → ar` flips the app to RTL and `ar → en` back to LTR, synchronously,
  on both Storefront and Admin — asserted by unit tests (signal + DOM)
  and the E2E lifecycle (switch → reload → persistence).
- A second direction manager cannot be introduced without tripping the
  single-writer shape: any new `dir` write or direction state is a review
  and audit failure, not a silent fork.
