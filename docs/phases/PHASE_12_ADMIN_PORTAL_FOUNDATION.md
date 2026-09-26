# Phase 12 — Admin Portal Foundation

## Objective

Establish the foundational architecture and reusable UI infrastructure for the Admin Portal without implementing business-specific admin features.

By the end of this phase, the Admin application should provide:

- Authentication and authorization integration
- Admin routing
- Admin shell and layout
- Sidebar and header navigation
- Dashboard foundation
- Reusable table and pagination primitives
- Generic filtering and form primitives
- Accessible dialogs
- Global notifications
- Responsive behavior
- RTL/LTR support
- Localization integration
- Theme integration
- Unit, component, and E2E test coverage
- Architecture and documentation verification

This phase must prepare the Admin Portal for Phase 13 (Catalog & Inventory) and Phase 14 (Orders & Payments).

---

# 12.1 — Admin Route & Authorization Integration

## Goal

Integrate the Admin application with the existing authentication and authorization infrastructure.

## Tasks

- Review and reuse the existing `authGuard`.
- Review and reuse the existing `roleGuard`.
- Reuse the existing authentication/session infrastructure.
- Protect the Admin root route.
- Apply the existing `Admin` / `SuperAdmin` role model.
- Handle:
  - Unauthenticated users
  - Authenticated non-admin users
  - Authorized admin users
- Integrate the existing `/forbidden` page.
- Support direct navigation and page refresh.
- Ensure authorization remains backend-authoritative.
- Avoid creating a separate Admin authentication system.

## Routing Foundation

Establish an extensible route structure such as:

```text
/admin
    ├── dashboard
    ├── catalog       (future)
    ├── inventory     (future)
    ├── orders        (future)
    └── payments      (future)
```

Use lazy loading where appropriate.

## Tests

Verify:

- Anonymous user → Login
- Authenticated customer → Forbidden
- Admin → Dashboard
- SuperAdmin → Dashboard
- Unauthorized direct URL access
- Browser refresh
- Session/token expiration handling

## Out of Scope

- Rebuilding authentication
- Creating a new role system
- Business-specific authorization rules

---

# 12.2 — Admin Application Architecture & Shell

## Goal

Establish the structural foundation of the Admin Portal.

## Admin Shell

```text
AdminShell
 ├── AdminHeader
 ├── AdminSidebar
 ├── Main Content
 │    └── RouterOutlet
 └── Global Notifications
```

## Tasks

- Create `AdminShell`.
- Separate layout concerns from feature concerns.
- Define layout routes.
- Provide the main router outlet.
- Support nested routes.
- Handle active route state.
- Integrate existing:
  - Theme infrastructure
  - Localization infrastructure
  - Authentication
  - API infrastructure
  - Shared UI

## Suggested Structure

```text
apps/admin/src/app/
├── core/
├── layout/
│   ├── admin-shell/
│   ├── admin-header/
│   └── admin-sidebar/
├── features/
│   └── dashboard/
└── app.routes.ts
```

## Architectural Rule

The Admin Shell must not contain business-specific knowledge about:

- Products
- Orders
- Inventory
- Payments
- Other future domain features

The shell should host features rather than implement their business logic.

---

# 12.3 — Admin Navigation & Sidebar

## Goal

Create an extensible Admin navigation system.

## Tasks

- Implement the Admin Sidebar.
- Implement the Admin Header.
- Define navigation items.
- Support active route state.
- Support nested navigation where needed.
- Integrate icons.
- Localize navigation labels.
- Support role-aware visibility when required.
- Integrate logout.
- Display relevant current-user/session information.

## Navigation Concept

```text
Dashboard

Catalog
  ├── Products
  ├── Categories
  └── Variants

Inventory

Orders

Payments

Users
```

Only Dashboard needs to be an implemented business destination in this phase. Future navigation items should not introduce unfinished business functionality.

## Responsive Behavior

Desktop:

```text
Sidebar + Content
```

Mobile:

```text
Header
   ↓
Drawer Sidebar
   ↓
Content
```

## Tests

Verify:

- Active navigation state
- Navigation behavior
- Mobile sidebar/drawer
- Keyboard navigation
- Localized labels
- RTL navigation behavior

---

# 12.4 — Dashboard Foundation

## Goal

Create the Admin Dashboard foundation without turning Phase 12 into a full analytics implementation.

## Tasks

- Create the Dashboard route.
- Create the Dashboard page structure.
- Add page header.
- Establish reusable dashboard layout/grid patterns.
- Add reusable cards where appropriate.
- Provide placeholders only where necessary.
- Support loading, empty, and error states when data is introduced.
- Ensure responsive behavior.
- Ensure RTL/LTR compatibility.

## Important Constraint

Do not invent Dashboard APIs.

Phase 12 should not introduce a complete analytics system for:

- Sales analytics
- Revenue analytics
- Order analytics
- Inventory analytics
- Customer analytics

Real dashboard data should only be implemented when supported by an established backend contract.

## Tests

Verify:

- Dashboard rendering
- Route access
- Responsive layout
- Localization
- RTL/LTR behavior

---

# 12.5 — Admin Table & Pagination Primitives

## Goal

Build reusable UI foundations that later phases can use for:

- Products
- Inventory
- Orders
- Payments

## Table

Create a generic table capability rather than business-specific tables.

Conceptually:

```text
DataTable<T>
```

## Potential Capabilities

- Typed columns
- Column headers
- Cell rendering
- Empty state
- Loading state
- Optional row selection when justified
- Responsive behavior
- Accessibility

Do not create business-specific components such as:

```text
ProductTable
OrderTable
InventoryTable
```

during this phase unless a concrete requirement proves they belong here.

## Pagination

Integrate the UI with the existing API pagination contract.

Support:

- Current page
- Page size
- Total count
- Next/previous navigation
- Page changes

## Data Flow

```text
API Pagination Contract
        ↓
Feature State
        ↓
Pagination UI
        ↓
Table
```

## Tests

Verify:

- Table rendering
- Loading state
- Empty state
- Pagination changes
- Accessibility
- Responsive behavior

---

# 12.6 — Filtering & Form Primitives

## Goal

Establish reusable UI primitives required by future Admin features.

## Filtering

Create generic primitives where justified, such as:

```text
SearchInput
Select
DateRange
FilterBar
```

These components must remain business-agnostic.

Do not create feature-specific filters such as:

```text
ProductFilter
OrderFilter
InventoryFilter
```

during Phase 12.

## Forms

Establish reusable presentation primitives for:

- Form layout
- Inputs
- Selects
- Checkboxes
- Textareas
- Validation messages
- Form actions
- Disabled states
- Loading states

## Architectural Rule

```text
Shared UI
    ↓
Generic primitives

Feature
    ↓
Business-specific form
```

For example:

```text
ProductForm
```

belongs to Phase 13, not Phase 12.

## Tests

Verify:

- Validation message rendering
- Disabled states
- Loading states
- Keyboard interaction
- Accessibility

---

# 12.7 — Dialogs & Notifications

## Goal

Provide reusable infrastructure for general Admin interactions.

## Dialog

Implement a generic accessible dialog supporting:

- Open/close
- Title
- Content
- Actions
- Escape-key handling
- Focus management
- Backdrop interaction
- Accessibility semantics

The dialog must remain independent of business domains.

## Notifications

Establish a generic notification mechanism:

```text
Notification Service
        ↓
Notification State
        ↓
Notification Host
        ↓
Toast / Alert
```

Support notification types such as:

```text
Success
Info
Warning
Error
```

Do not couple the notification system directly to:

- Orders
- Products
- Payments
- Inventory

## Tests

Verify:

- Dialog opening and closing
- Focus management
- Keyboard behavior
- Notification creation
- Notification dismissal
- Multiple notifications
- Accessibility

---

# 12.8 — Admin State & Data Lifecycle

## Goal

Keep Admin state management simple and aligned with the existing project architecture.

## State Strategy

Prefer:

```text
Signals
Local component state
Feature-local state
```

Use broader/global state only when there is a real cross-feature requirement.

Do not introduce:

```text
NgRx
SignalStore
Global Admin Store
```

without concrete complexity that justifies them.

## Resource Lifecycle

Admin data flows should follow:

```text
Idle
 ↓
Loading
 ↓
Success / Empty
 ↓
Error
```

The state model should make loading, empty, and error states explicit instead of relying on implicit UI behavior.

---

# 12.9 — Responsive, RTL, Localization & Theme Hardening

## Goal

Ensure the Admin Portal integrates correctly with the platform-wide UI infrastructure from the beginning.

## Localization

Reuse the existing:

- Culture identifiers
- Translation infrastructure
- Language selection
- Persistence mechanisms

Do not create a separate Admin localization system.

## RTL/LTR

Verify:

- Sidebar
- Header
- Tables
- Forms
- Dialogs
- Pagination
- Icons
- Spacing
- Alignment

Prefer logical CSS properties where appropriate.

## Theme

Integrate the Admin Portal with the existing theming system.

Do not create an independent Admin theme architecture.

## Responsive Verification

Test:

```text
Desktop
Tablet
Mobile
Narrow viewport
```

Verify there is no unnecessary:

- Horizontal overflow
- Broken table layout
- Inaccessible control
- Sidebar/layout failure

---

# 12.10 — Admin Testing & End-to-End Verification

## Goal

Verify that the Admin foundation works as an integrated application before business features are introduced.

## Unit / Component Tests

Cover:

- Route guards
- Role authorization
- AdminShell
- Header
- Sidebar
- Navigation
- Dashboard
- Table
- Pagination
- Filter primitives
- Form primitives
- Dialog
- Notifications

## E2E Scenarios

### Authentication

```text
Anonymous
   ↓
/admin
   ↓
Login
   ↓
Admin Dashboard
```

### Authorization

```text
Customer
   ↓
/admin
   ↓
Forbidden
```

### Admin

```text
Admin
 ↓
Dashboard
 ↓
Navigation
 ↓
Logout
```

### Additional Scenarios

- Direct navigation
- Browser refresh
- Deep links
- Responsive behavior
- RTL
- Localization
- Theme behavior

---

# 12.11 — Architecture Verification & Cleanup

## Goal

Ensure that Phase 12 does not introduce architectural duplication or unnecessary complexity.

## Review

Verify:

- Feature boundaries
- Shared library boundaries
- Dependency direction
- API usage
- Authentication integration
- UI reuse
- State ownership
- Routing
- Lazy loading
- Localization
- RTL/LTR
- Accessibility

## Duplication Check

Avoid unnecessary parallel implementations such as:

```text
AdminApiClient
AdminAuthService
AdminPagination
AdminNotificationService
```

when existing shared capabilities already provide the required behavior.

The principle is:

> Extend existing infrastructure where appropriate; do not rebuild it inside the Admin application.

---

# 12.12 — Documentation & Phase Completion

## Goal

Synchronize project documentation with the completed Admin foundation.

## Update

- `PROJECT_CONTEXT.md`
- `ARCHITECTURE.md`
- Phase documentation
- Completion report
- ADRs when a significant architectural decision is introduced

## Document

- Admin routing structure
- Admin shell architecture
- Authorization integration
- Shared UI additions
- State management decisions
- Responsive/RTL decisions
- Testing strategy
- Deferred work
- Known limitations

---

# Phase 12 Definition of Done

Phase 12 is complete when:

- [ ] Admin routes are protected by the existing authentication/authorization infrastructure.
- [ ] Admin and SuperAdmin access works according to the existing role model.
- [ ] Unauthorized users are redirected/blocked correctly.
- [ ] Admin Shell is implemented.
- [ ] Header and Sidebar are implemented.
- [ ] Dashboard foundation is implemented.
- [ ] Admin navigation is extensible.
- [ ] Generic table capability is available.
- [ ] Pagination is integrated with the existing API contract.
- [ ] Generic filtering primitives are available where justified.
- [ ] Generic form primitives are available where justified.
- [ ] Accessible dialog infrastructure is available.
- [ ] Global notification infrastructure is available.
- [ ] Admin state follows the existing Signals/local-state approach.
- [ ] Loading, empty, success, and error states are handled consistently.
- [ ] Localization works correctly.
- [ ] RTL/LTR works correctly.
- [ ] Existing theme infrastructure is integrated.
- [ ] Responsive behavior works across desktop, tablet, and mobile.
- [ ] Unit/component tests are passing.
- [ ] Critical Admin E2E scenarios are passing.
- [ ] No unnecessary business logic has moved into shared UI.
- [ ] No unnecessary Admin-specific duplicates of shared infrastructure exist.
- [ ] Architecture boundaries remain valid.
- [ ] Documentation is synchronized.
- [ ] Phase completion report is created.

---

# Explicit Non-Goals

The following must remain outside Phase 12:

- Product CRUD
- Category CRUD
- Variant management
- Product image management
- Product specifications
- Inventory management
- Stock adjustments
- Inventory reservations
- Order management
- Payment management
- User management
- Full dashboard analytics/reporting
- Business-specific workflows
- Business-specific forms
- Business-specific filters
- New backend business features
- Introduction of a new global state management library without demonstrated need

These belong to later phases or explicitly deferred work.

---

# Phase 12 → Phase 13 Handoff

The output of Phase 12 should provide a stable foundation for:

```text
Phase 13 — Admin Catalog & Inventory
```

Phase 13 should be able to build on:

```text
Admin Authentication
        ↓
Admin Authorization
        ↓
Admin Shell
        ↓
Navigation
        ↓
Shared UI
 ├── Table
 ├── Pagination
 ├── Filters
 ├── Forms
 ├── Dialogs
 └── Notifications
        ↓
Catalog & Inventory Features
```

Phase 12 should therefore finish with the Admin Portal acting as a stable application shell rather than as a collection of unfinished business features.
