# ADR 035 — Supplement S3 Contract Delta (Users Write Re-centralization, Step S3.1)

Status: Accepted (S3.1; integration record appended in S3.7).

## Context

After Supplement S2, the backend removed the `users.manage` and
`admins.create` action-level permissions: creating admins and
granting/revoking permissions is not delegable work, so only
`SuperAdmin` performs it. The documented contract in
`docs/frontend-contract/` already reflects the new reality
(`API_CONTRACT.md` §0.5/§1/§8, `AUTH_FLOW.md` matrix,
`DTO_REFERENCE.md`, `ENUM_REFERENCE.md`, `ERROR_CATALOG.md` with
`Identity.Forbidden` retired). Step S3.1 must fix the exact
frontend/backend boundary before any UI in S3.3–S3.4 is built.

## Decision

### 1. Audited delta (the complete changed surface)

- Catalog v3 (9 values): `orders.read | orders.cancel |
orders.refund | payments.read | payments.stats | inventory.read |
inventory.manage | catalog.manage | users.read`. `users.manage`
  and `admins.create` are retired (migration-hygiene pin in the S3
  audit). The `Admin` role still grants nothing; grants apply on the
  next login/refresh; `SuperAdmin` bypasses every gate.
- Re-centralized to `SuperAdmin`: `POST /auth/register-admin`
  (still permission-less creation), role assign, unlock,
  grant/revoke, and the permission catalog document.
- Stayed delegated (`users.read`): list/counts/get/per-user
  permissions (the last readable for display).
- Dashboard: adaptive shape unchanged; only the `users` section gate
  moved (SuperAdmin role → `users.read`); the drill-down renders
  with the section present.
- `Identity.Forbidden` retired from the wire: denials are plain
  framework `403`s; classification stays status-first and the
  single-refresh-then-locked discipline is unchanged.
- No DTO shape, pagination, filter, or sort changes (paths and
  bodies byte-identical — only gates moved).

### 2. Frontend deltas (never re-declared)

- S3.2 migrates `PERMISSION_CATALOG` (9 values), the endpoint
  markers (writes/catalog → `super-admin`), and the service/domain
  comments against the S3 delta audit.
- S1/S2 audit modules, reports, and ADRs stay frozen as historical
  records — deltas live in S3 artifacts only.

### 3. Resolved S2.1 gap

- `permission-catalog-superadmin-note`: the S2 Objective text and
  the amended contract now agree the catalog document is
  `SuperAdmin`-only. Closed by this backend change.

## Consequences

- S3.3 gates the `users` mount by `permissionGuard(['users.read'])`
  and the `new` child by `roleGuard(SuperAdmin)`; navigation
  filters on `users.read`.
- S3.4 shows grant UI and the creation link to `SuperAdmin` only;
  the dashboard users link follows section presence.
- S3.5 verifies 403 discipline with no code changes expected.
- Verification: `libs/models` unit specs for every
  mapping/classifier/pre-check; `tsc` (libs + spec); architecture
  audit unchanged (pure types + pure functions, no Angular, no
  `HttpClient`, SSR-safe).

## Integration record (steps S3.2–S3.6, added S3.7)

Single-ADR supplement (delta alignment + integration as one
decision, same convention as ADR-034).

- S3.2 landed the v3 shapes canonically and froze nothing new
  (S1/S2 already frozen).
- S3.3–S3.4 applied the gates and page visibility exactly as
  audited; envelope handling and submission patterns unchanged.
- S3.5 verified 403 discipline with no code changes.
- S3.6 proved the slices with mocked-transport E2E (updated
  journeys + full re-verify green).
