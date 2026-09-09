# ADR 001 — Signals-Based Authentication State

Status: Accepted (2026-09-09, Phase 2 Sub-Phases 2.2/2.8/2.11).

## Context

Authentication and current-user state are the only genuinely global
frontend concerns in the auth domain (ARCHITECTURE.md §9). The state must
support: an explicit startup phase (session restoration runs
asynchronously), derived selectors for components/guards, and strict
isolation from feature state. Candidates were component services with
`BehaviorSubject`s, SignalStore/NgRx, and plain Angular Signals.

## Decision

Central `AuthService` (`libs/auth`) owns the sole writable state as
private Signals (`AuthState`, `CurrentUser`, `AuthSession`, access token),
exposing readonly signals and `computed` selectors (`status`,
`isInitializing`, `initialized`, `isAuthenticated`, `isAnonymous`,
`currentUser`, `session`, `roles`, `hasRole()`, `isAdmin`,
`hasAccessToken`). Transitions are explicit methods with deterministic
rules (`initializing → anonymous|authenticated`, replacement/clearing
only while settled); illegal calls are safe no-ops. No store library:
the model is a tri-state lifecycle plus snapshots, far below the
complexity that justifies SignalStore/NgRx.

## Consequences

- Guards and components await `initialized` instead of branching on
  absence of data — premature login redirects are structurally impossible
  when the contract is followed.
- Feature code cannot replicate auth state (single writer, readonly
  surface; enforced by convention + review, lint boundary keeps HTTP out
  of features).
- Future complex flows (checkout sagas, cart merge) may still adopt
  SignalStore locally without affecting this foundation.
