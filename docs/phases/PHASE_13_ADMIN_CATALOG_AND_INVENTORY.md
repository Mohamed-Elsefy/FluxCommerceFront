# Phase 13 --- Admin Catalog & Inventory

## Phase Goal

Transform the Admin Portal from a stable management shell into a
functional Commerce Management Interface for Catalog and Inventory
operations.

This phase must build on the existing Phase 12 Admin foundation and
reuse its established shell, navigation, tables, pagination, filters,
forms, dialogs, notifications, localization, RTL/LTR, theming,
authorization, and testing infrastructure.

The frontend must consume the real backend contracts and must not
reproduce backend business rules or workflows.

------------------------------------------------------------------------

## Phase Scope

### Catalog

-   Products
-   Product Variants
-   Categories
-   Product Images
-   Product Specifications

### Inventory

-   Stock
-   Inventory Status
-   Reservations
-   Inventory Adjustments

------------------------------------------------------------------------

## Architectural Principles

1.  **Backend is the source of truth**
    -   Use actual backend contracts.
    -   Do not invent endpoints, commands, CRUD operations, upload
        mechanisms, or response models.
2.  **Vertical feature ownership**
    -   Catalog-specific business logic belongs to the Catalog feature.
    -   Inventory-specific business logic belongs to the Inventory
        feature.
    -   Shared infrastructure belongs in shared libraries only when it
        is genuinely reusable.
3.  **No frontend business orchestration**
    -   Do not reproduce inventory, reservation, payment, or other
        backend workflows in Angular.
    -   Angular submits commands and displays the resulting backend
        state.
4.  **Reuse Phase 12 primitives**
    -   Extend existing shared UI infrastructure instead of rebuilding
        it.
5.  **Feature-local state**
    -   Prefer Signals / feature stores for feature state.
    -   Avoid introducing global state unless a requirement genuinely
        crosses feature boundaries.
6.  **Explicit resource states**
    -   Loading
    -   Success
    -   Empty
    -   Error
7.  **Production-ready UX**
    -   Typed Reactive Forms
    -   Validation
    -   Field-level backend errors
    -   Duplicate-submit prevention
    -   Confirmation dialogs
    -   Notifications
    -   Responsive behavior
    -   Accessibility
    -   Localization
    -   RTL/LTR support

------------------------------------------------------------------------

# Sub-Phases

## 13.1 --- Foundation & Backend Contract Alignment

### Objective

Establish the exact integration boundary between the Admin frontend and
the backend before implementing Catalog and Inventory business
functionality.

### Tasks

-   Review the available Catalog APIs.
-   Review the available Inventory APIs.
-   Identify actual:
    -   Endpoints
    -   HTTP methods
    -   Request DTOs
    -   Response DTOs
    -   Pagination contracts
    -   Filtering contracts
    -   Sorting contracts
    -   Validation errors
    -   Authorization requirements
-   Review the backend models/contracts for:
    -   Product
    -   Product Variant
    -   Category
    -   Product Image
    -   Specification
    -   Stock
    -   Reservation
    -   Inventory Adjustment
-   Identify supported operations.
-   Identify contract limitations or missing backend capabilities that
    affect the frontend.
-   Confirm the actual image/upload mechanism before implementing image
    management.
-   Confirm naming and route conventions with the existing Admin
    application.

### Constraints

Do not implement assumed CRUD operations or API capabilities that are
not present in the backend contract.

### Completion Criteria

-   Catalog contract map is understood.
-   Inventory contract map is understood.
-   Required frontend models can be derived from real contracts.
-   No unresolved API assumptions remain for the planned work.

------------------------------------------------------------------------

## 13.2 --- Admin Catalog Feature Foundation

### Objective

Create the structural foundation for the Catalog feature while
integrating it with the existing Admin shell.

### Tasks

Create the feature structure:

``` text
features/catalog/
├── pages/
├── components/
├── data-access/
├── state/
├── models/
└── catalog.routes.ts
```

Implement:

-   Catalog routes.
-   Admin navigation integration.
-   Feature-level state.
-   Catalog API integration.
-   Feature models.
-   Resource state handling.
-   Authorization integration.
-   Loading, empty, and error states.

Reuse existing Phase 12 primitives:

-   Tables
-   Pagination
-   Filters
-   Forms
-   Inputs
-   Dialogs
-   Notifications
-   Buttons
-   Existing layout primitives

### Completion Criteria

The Catalog feature is routable, authorized, connected to the API layer,
and ready for business functionality.

------------------------------------------------------------------------

## 13.3 --- Product Management

### Objective

Implement end-to-end Product management using the real backend contract.

### Product List

Implement:

-   Product table.
-   Pagination.
-   Sorting.
-   Filtering.
-   Search when supported by the backend.
-   Product status.
-   Relevant product metadata.
-   Loading state.
-   Empty state.
-   Error state.

### Product Create

Implement:

-   Typed Reactive Form.
-   Client-side validation.
-   Backend validation.
-   Field-level validation errors.
-   Submit state.
-   Duplicate-submit prevention.
-   Success notification.
-   Navigation/update behavior after success.

### Product Edit

Implement:

-   Product loading.
-   Form population.
-   Editing.
-   Validation.
-   Backend conflict/error handling.
-   Submit state.
-   Success handling.

### Product Details

Display available product information, including where supported:

-   Product metadata.
-   Variants.
-   Images.
-   Specifications.
-   Availability information.

### Product Delete / Disable

Implement only if supported by the backend contract:

-   Confirmation dialog.
-   Backend operation.
-   Success/error notification.
-   State refresh/update.

### Completion Criteria

Admin users can view and manage Products through the real backend API
with complete loading, validation, error, and success handling.

------------------------------------------------------------------------

## 13.4 --- Product Variants Management

### Objective

Implement Product Variant management within the Product context.

### Tasks

-   Variant list.
-   Variant details where supported.
-   Create Variant.
-   Edit Variant.
-   Delete/disable when supported.
-   SKU handling.
-   Pricing.
-   Availability-related information.
-   Variant-specific validation.
-   Backend conflict handling.
-   Loading/empty/error states.

### Business Rule Boundary

The frontend must not implement backend business rules such as:

-   SKU uniqueness
-   Price rules
-   Stock rules
-   Variant validity

Angular should display validation and conflict information returned by
the backend.

### Completion Criteria

Product variants can be viewed and managed according to the backend
contract without duplicating domain rules in Angular.

------------------------------------------------------------------------

## 13.5 --- Category Management

### Objective

Implement Category management as a dedicated Catalog capability.

### Tasks

-   Category list.
-   Pagination/filtering when supported.
-   Search when supported.
-   Create Category.
-   Edit Category.
-   Delete/disable when supported.
-   Parent/child relationships when supported.
-   Category status.
-   Validation.
-   Confirmation dialogs.
-   Notifications.
-   Error handling.

### Constraint

Do not assume that categories are flat or hierarchical. The UI must
follow the actual backend model and contract.

### Completion Criteria

Admin users can manage Categories according to the supported backend
operations.

------------------------------------------------------------------------

## 13.6 --- Product Images & Specifications

### Objective

Complete Product management with image and specification capabilities
supported by the backend.

### Product Images

Implement supported operations such as:

-   View images.
-   Add images.
-   Remove images.
-   Update images.
-   Set primary image.
-   Reorder images.

Only implement operations exposed by the backend.

### Upload Architecture

Before implementation, confirm whether the backend uses:

-   Direct file upload.
-   URL-based images.
-   External storage references.
-   Another upload mechanism.

Do not invent an upload architecture.

### Product Specifications

Implement supported operations:

-   View specifications.
-   Add specification.
-   Edit specification.
-   Remove specification.
-   Validate specification data.

### Completion Criteria

Products can manage their supported images and specifications with
correct API integration and complete UI states.

------------------------------------------------------------------------

## 13.7 --- Catalog Integration & Hardening

### Objective

Perform a complete integration and quality pass across the Catalog
feature before starting Inventory implementation.

### Tasks

Review:

-   Navigation.
-   Routing.
-   Route guards.
-   Authorization.
-   State synchronization.
-   API error handling.
-   Refresh behavior.
-   Pagination state.
-   Filter state.
-   Sorting state.
-   Duplicate requests.
-   Duplicate submissions.
-   Loading states.
-   Empty states.
-   Error states.
-   Dialog behavior.
-   Notifications.
-   Localization.
-   RTL/LTR.
-   Responsive behavior.
-   Accessibility.

### Testing

Add or complete tests for:

-   Data access.
-   State management.
-   Mapping.
-   Forms.
-   Validation.
-   Filters.
-   Pagination.
-   Dialogs.
-   Error handling.
-   Important component interactions.

### Completion Criteria

Catalog is functionally integrated, tested, localized, responsive,
accessible, and stable enough to serve as the foundation for later Admin
phases.

------------------------------------------------------------------------

## 13.8 --- Inventory Feature Foundation

### Objective

Create the Inventory feature using the same architectural principles
established for Catalog.

### Feature Structure

``` text
features/inventory/
├── pages/
├── components/
├── data-access/
├── state/
├── models/
└── inventory.routes.ts
```

### Tasks

-   Inventory routes.
-   Admin navigation integration.
-   Inventory models.
-   API integration.
-   Feature state.
-   Resource states.
-   Authorization.
-   Loading/empty/error states.
-   Reuse existing Admin shared primitives.

### Completion Criteria

Inventory is structurally integrated and ready for stock, reservation,
and adjustment functionality.

------------------------------------------------------------------------

## 13.9 --- Stock & Inventory Status

### Objective

Provide Admin users with visibility into current inventory state.

### Tasks

Implement supported capabilities:

-   Stock list.
-   Product/Variant identification.
-   Current stock.
-   Available quantity.
-   Reserved quantity when exposed by the backend.
-   Inventory status.
-   Pagination.
-   Filtering.
-   Sorting.
-   Search when supported.
-   Loading state.
-   Empty state.
-   Error state.

### Business Rule Boundary

The frontend must not independently reproduce inventory business rules.

For example, do not independently redefine inventory calculations such
as:

``` text
Available = OnHand - Reserved
```

unless such a calculation is explicitly part of the frontend
presentation contract.

The backend remains the source of truth.

### Completion Criteria

Admin users can reliably inspect stock and inventory status using
backend-provided state.

------------------------------------------------------------------------

## 13.10 --- Reservations & Inventory Adjustments

### Objective

Implement inventory reservation visibility and supported inventory
adjustment operations.

### Reservations

Implement supported capabilities:

-   Reservation list.
-   Reservation details when available.
-   Filtering.
-   Pagination.
-   Status.
-   Product/Variant reference.
-   Quantity.
-   Relevant timestamps.
-   Loading/empty/error states.

The reservation lifecycle remains entirely backend-owned.

### Inventory Adjustments

Implement:

-   Adjustment UI.
-   Typed Reactive Form.
-   Product/Variant selection.
-   Quantity.
-   Adjustment reason when supported.
-   Client-side validation.
-   Backend validation.
-   Confirmation dialog.
-   Submit state.
-   Duplicate-submit prevention.
-   Backend conflict/error handling.
-   Stock refresh/update after successful adjustment.

### Expected Flow

``` text
Admin
  ↓
Adjustment Form
  ↓
Angular API
  ↓
Backend Validation
  ↓
Inventory Business Logic
  ↓
Updated Inventory State
  ↓
Angular Refresh / State Update
```

### Constraint

Angular must not calculate or mutate inventory domain state
independently.

### Completion Criteria

Admin users can inspect reservations and execute supported inventory
adjustments through the backend contract.

------------------------------------------------------------------------

## 13.11 --- Phase Verification, E2E & Documentation

### Objective

Verify the complete Phase 13 implementation and document the resulting
state.

### Functional Verification

Verify the complete Admin flow:

``` text
Admin Login
    ↓
Catalog
    ├── Products
    │   ├── List
    │   ├── Create
    │   ├── Edit
    │   └── Details
    │
    ├── Variants
    ├── Categories
    ├── Images
    └── Specifications
    ↓
Inventory
    ├── Stock
    ├── Reservations
    └── Adjustments
```

### E2E Scenarios

Cover critical journeys such as:

1.  Admin login → Products → Product list.
2.  Product creation.
3.  Product editing.
4.  Product → Variant management.
5.  Category management.
6.  Product image/specification management.
7.  Inventory stock browsing.
8.  Reservation filtering.
9.  Inventory adjustment.
10. Verification of updated inventory state.

### Quality Verification

Verify:

-   Unit tests.
-   Component tests.
-   Critical Playwright E2E tests.
-   Authorization.
-   API validation.
-   API error handling.
-   Loading states.
-   Empty states.
-   Localization.
-   RTL/LTR.
-   Responsive UI.
-   Accessibility.
-   Shared library boundaries.
-   Feature boundaries.
-   No unnecessary cross-feature coupling.
-   No duplicated backend business logic.

### Documentation

Update where necessary:

-   `PROJECT_CONTEXT.md`
-   `ARCHITECTURE.md`
-   Phase completion documentation.
-   Relevant API/contract notes.
-   Any new architectural decisions.

### Completion Criteria

Phase 13 is complete only when Catalog and Inventory are integrated
end-to-end, tested, localized, accessible, and aligned with the
established project architecture.

------------------------------------------------------------------------

# Phase 13 Definition of Done

Phase 13 is considered complete when the Admin Portal provides
functional, backend-integrated management for:

### Catalog

-   [x] Products
-   [x] Product Variants
-   [x] Categories
-   [x] Product Images
-   [x] Product Specifications

### Inventory

-   [x] Stock
-   [x] Inventory Status
-   [x] Reservations
-   [x] Inventory Adjustments

### Engineering Quality

-   [x] Real backend contracts are used.
-   [x] Authorization is enforced.
-   [x] Loading/empty/error states are implemented.
-   [x] Typed Reactive Forms are used where applicable.
-   [x] Backend validation errors are displayed correctly.
-   [x] Duplicate submissions are prevented.
-   [x] Existing Phase 12 shared primitives are reused.
-   [x] Feature boundaries remain clean.
-   [x] Backend business rules are not duplicated.
-   [x] Localization is supported.
-   [x] RTL/LTR is supported.
-   [x] Responsive behavior is verified.
-   [x] Accessibility is verified.
-   [x] Unit/component tests are complete.
-   [x] Critical Playwright E2E scenarios are complete.
-   [x] Architecture verification passes.
-   [x] Documentation is updated.

------------------------------------------------------------------------

# Expected Phase Outcome

At the end of Phase 13, the Admin Portal should have the following
functional structure:

``` text
Admin Portal
├── Dashboard
├── Catalog
│   ├── Products
│   ├── Variants
│   ├── Categories
│   ├── Images
│   └── Specifications
└── Inventory
    ├── Stock
    ├── Reservations
    └── Adjustments
```

The result should be a functional Admin Commerce Management layer built
on the stable Phase 12 foundation and ready for:

**Phase 14 --- Admin Orders & Payments**
