# ADR 033 — Admin Shell Navigation & Logout Hardening

Status: Accepted.

## Context

Three shell defects surfaced during manual verification of the Admin
portal:

1. Logging out from any admin page did not land on `/login`. The
   shared `AuthNav` called `AuthService.logout()` with no options, so
   the post-logout destination defaulted to `/` — the guarded portal
   root. From `/` itself the navigation was a same-URL no-op, guards
   never re-ran, and the anonymous shell stayed on screen.
2. The portal root served a static `HomePage` while every real landing
   need is covered by the live dashboard (`GET /admin/dashboard`,
   Supplement S1.10). Login already defaulted to `/dashboard`, so home
   was a redundant hop.
3. The sidebar missed reachable destinations: the inventory item
   creation page (`/inventory/new`, `inventory.manage`) and the users
   list (`/users/list`) had no nav entries, so they were reachable
   only by URL or in-page links.

## Decision

### 1. Post-logout destination is app-owned

`AuthNav` gains a `logoutRedirectTo` input (default `null` → legacy
`/` behavior, so the Storefront is unaffected) forwarded to
`AuthService.logout({ redirectTo })`. The admin header passes
`"/login"`, so logout from any page is always a real navigation to
the anonymous entry point — guards cannot be skipped by a same-URL
no-op. Covered by `auth-nav` unit specs (default + custom
destination) and a strengthened `admin-auth` logout journey (asserts
`/login` URL, sign-in heading, and cleared storage).

### 2. The portal root redirects to the dashboard; home is removed

The shell `''` child is now `redirectTo: 'dashboard'` (`pathMatch:
full`); `features/home/` (page + i18n + specs) is deleted. Login's
`returnUrl` fallback (`/dashboard`) is unchanged, so post-login
landing is the dashboard with no hop. Denial/not-found back links
point at `/dashboard` directly. `layout.nav.home` is retired from the
layout bundle; specs and E2E referencing the home entry were
rewritten (root redirect, sidebar/dashboard navigation, French/RTL
chrome).

### 3. The sidebar lists every list-level destination

Added under existing permission gates (no new guards, no new routes):

- Inventory `New item` (`/inventory/new`, `inventory.manage` —
  hidden without it, like adjustments).
- Users list (`/users/list`, inherits the `SuperAdmin` group gate).

Creation pages for products/categories stay list-local (their list
pages already link `new` relatively). Details pages (`:id`) stay
deep-link-only. Covered by navigation unit specs (routes, gating, OR
semantics, per-culture labels) and shell/E2E suites.

## Consequences

- Logout from any admin page lands on `/login` deterministically.
- `/` always resolves to `/dashboard` (authenticated) or `/login`
  (anonymous) — no static home ships.
- Every list-level admin route is sidebar-reachable under its own
  permission; no dead links (all entries resolve to existing routes,
  asserted by the navigation spec).
- Verification: `tsc` (admin + spec), `eslint`, `prettier`,
  `verify-architecture.mjs` 106/106, admin unit 114 files / 735
  passed, `libs/auth` 11 files / 95 passed, `build:admin` green,
  Playwright admin scope green (auth, smoke, users, catalog,
  orders, payments, dashboard).
