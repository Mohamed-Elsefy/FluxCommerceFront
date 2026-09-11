# Phase 5 --- Catalog & Product Discovery

## Phase Objective

Build the first complete customer-facing commerce capability in the
Storefront.

At the end of this phase, a customer should be able to:

``` text
Open Storefront
      ↓
Browse Home
      ↓
Discover Categories
      ↓
Open a Category
      ↓
Browse Products
      ↓
Search Products
      ↓
Filter Products
      ↓
Sort Products
      ↓
Navigate Pages
```

The phase must consume the existing backend Catalog API contracts and
must not reproduce backend business logic in Angular.

------------------------------------------------------------------------

## 5.1 --- Catalog Feature Foundation

### Goal

Establish the Catalog feature structure and its integration boundary
before implementing the UI.

### Tasks

-   Create the Storefront Catalog feature.
-   Define Catalog-specific models/types based on the existing backend
    contracts.
-   Define Catalog API/data-access services.
-   Integrate Catalog data access with the existing `ApiClient`.
-   Define Catalog routes.
-   Establish feature-level state management.
-   Reuse existing shared infrastructure from Phase 1.
-   Keep Catalog state local to the feature.
-   Avoid introducing global state management.

### Expected Structure

The exact structure should follow the existing project architecture, but
conceptually:

``` text
catalog/
├── pages/
├── components/
├── data-access/
├── state/
├── models/
└── routes/
```

### Architectural Flow

``` text
Component
    ↓
Catalog State
    ↓
Catalog Data Access
    ↓
ApiClient
    ↓
Backend Catalog API
```

### Acceptance Criteria

-   Catalog feature exists.
-   Routes can be lazy-loaded.
-   Backend communication uses the existing API infrastructure.
-   Catalog types match backend contracts.
-   No duplicated HTTP infrastructure is introduced.
-   No global Catalog state is introduced.

------------------------------------------------------------------------

## 5.2 --- Home & Category Discovery

### Goal

Create the Storefront entry point for product discovery.

### Tasks

Implement:

-   Home page.
-   Catalog entry point.
-   Category discovery.
-   Category list/navigation.
-   Navigation from category → product listing.
-   Appropriate empty/loading/error states.

### Conceptual Flow

``` text
Home
 ├── Categories
 │      └── Category
 │             ↓
 │        Product Listing
 │
 └── Product Discovery
        ↓
   Product Listing
```

### Acceptance Criteria

-   Customer can open the Home page.
-   Customer can discover available categories.
-   Selecting a category navigates to the appropriate Catalog route.
-   Category state is represented through route/query state where
    appropriate.
-   Loading, empty, and error states are handled.

------------------------------------------------------------------------

## 5.3 --- Product Listing

### Goal

Build the main product discovery page.

### Product Listing Should Include

``` text
Catalog Header
      ↓
Search
      ↓
Filters / Sort
      ↓
Result Count
      ↓
Product Grid
      ↓
Pagination
```

### Product Card

The Product Card should initially display information supported by the
Catalog contract, such as:

-   Product image.
-   Product name.
-   Price.
-   Availability/status where provided.
-   Link to Product Details.

Do not implement:

-   Variant selection.
-   Quantity selection.
-   Add to cart.

Those belong to Phase 6 --- Product Details & Variants.

### Acceptance Criteria

-   Products are loaded from the backend.
-   Products render correctly in a responsive grid.
-   Product cards are reusable within the Catalog feature.
-   Product cards navigate to the future Product Details route.
-   No Phase 6 behavior is introduced.

------------------------------------------------------------------------

## 5.4 --- Catalog Query State

### Goal

Create one coherent representation of the Catalog query instead of
managing search, filters, sorting, and pagination independently.

Conceptually:

``` text
CatalogQueryState

search
category
filters
sort
page
pageSize
```

### Tasks

-   Define typed query state.
-   Define default values.
-   Synchronize query state with backend requests.
-   Reset pagination when appropriate.
-   Prevent duplicated query-building logic.
-   Keep query state feature-owned.

### Query Behavior

Changing a query parameter should produce the correct Catalog request.

For example:

``` text
Search changed
      ↓
page = 1
      ↓
Load products
```

``` text
Filter changed
      ↓
page = 1
      ↓
Load products
```

``` text
Page changed
      ↓
keep search/filter/sort
      ↓
Load requested page
```

### Acceptance Criteria

-   All Catalog query parameters are represented consistently.
-   Query state is typed.
-   Search/filter/sort/page changes produce correct API requests.
-   Pagination does not lose active filters.
-   No duplicated query-string logic exists across components.

------------------------------------------------------------------------

## 5.5 --- Search

### Goal

Implement product search using the backend Catalog search capability.

### Tasks

-   Add Catalog search input.
-   Connect search input to Catalog query state.
-   Integrate search with product listing.
-   Handle empty search.
-   Handle no results.
-   Handle loading state.
-   Cancel obsolete requests where the existing cancellation
    infrastructure supports it.

### Architectural Flow

``` text
Search Input
     ↓
Catalog Query State
     ↓
Catalog API
     ↓
Backend Search
```

The frontend does not implement its own search engine.

### Performance Consideration

Avoid sending unnecessary requests for every raw keystroke when the
existing architecture requires debouncing.

The implementation should ensure that:

``` text
Older request
     ↓
does not overwrite
     ↓
newer search result
```

### Acceptance Criteria

-   Search returns backend results.
-   Clearing search restores the normal listing.
-   Empty results are handled.
-   Search integrates correctly with category/filter/sort state.
-   Stale search requests cannot corrupt the current UI state.

------------------------------------------------------------------------

## 5.6 --- Filtering & Sorting

### Goal

Provide customer-facing product filtering and sorting based strictly on
supported Catalog API capabilities.

### Filtering

Implement only filters exposed by the backend contract.

Possible examples include:

-   Category.
-   Price-related filters.
-   Availability.
-   Other Catalog-supported filters.

Do not invent filters that the backend does not support.

### Sorting

Implement supported backend sort options.

Conceptually:

``` text
Sort
├── Default
├── Price ascending
├── Price descending
└── Other backend-supported options
```

The exact options must come from the API contract.

### Behavior

``` text
Filter changed
      ↓
Update Query State
      ↓
Reset Page
      ↓
Request Products
```

The same principle applies to sorting.

### Acceptance Criteria

-   Filters use typed state.
-   Sorting uses typed state.
-   Active filters remain visible.
-   Removing a filter updates results.
-   Changing filters/sort resets pagination appropriately.
-   Unsupported filtering/sorting is not fabricated on the frontend.

------------------------------------------------------------------------

## 5.7 --- Pagination Integration

### Goal

Integrate Catalog results with the reusable pagination infrastructure
created in Phase 1.

### Tasks

-   Consume the backend paged-result response according to the actual
    contract.
-   Connect pagination UI to Catalog query state.
-   Preserve search/filter/sort/category state during page navigation.
-   Handle first/last/next/previous navigation.
-   Handle invalid or unavailable pages safely.

### Expected Flow

``` text
Query State
    ↓
Catalog API
    ↓
Paged Result
    ↓
Product Grid
    ↓
Pagination
```

### Acceptance Criteria

-   Pagination uses the existing shared abstraction.
-   Page changes request the correct page.
-   Active search/filter/sort state is preserved.
-   Total count/pages are displayed correctly where applicable.
-   No duplicate pagination implementation is created.

------------------------------------------------------------------------

## 5.8 --- Resource States & UX

### Goal

Provide consistent feedback throughout the Catalog experience.

Reuse the existing resource-state pattern:

``` text
Idle
 ↓
Loading
 ↓
 ├── Success
 ├── Empty
 └── Error
```

### Loading

Handle:

-   Initial Catalog loading.
-   Search loading.
-   Filter changes.
-   Sorting.
-   Pagination.

### Empty

Differentiate between:

``` text
No products exist
```

and:

``` text
Current search/filter has no results
```

### Error

Provide:

-   Clear localized error message.
-   Retry action.
-   Stable UI rather than an unhandled exception.

### Acceptance Criteria

Every Catalog data request has appropriate:

``` text
Loading
Success
Empty
Error
```

behavior.

------------------------------------------------------------------------

## 5.9 --- Localization, RTL & Responsive Integration

### Goal

Integrate the Catalog feature with the infrastructure completed in
Phases 3 and 4.

### Localization

All customer-facing Catalog UI must support the existing cultures:

``` text
en
fr
de
es
ar
```

This includes:

-   Headings.
-   Search labels.
-   Filter labels.
-   Sort labels.
-   Pagination labels.
-   Empty states.
-   Error messages.
-   Actions.
-   Accessibility labels.

### RTL

Verify Arabic rendering for:

-   Product grid.
-   Filters.
-   Search.
-   Pagination.
-   Navigation.
-   Icons.
-   Alignment.

Use logical CSS properties rather than LTR-specific positioning.

### Responsive

Verify:

``` text
Mobile
Tablet
Desktop
```

Do not create duplicated components for different screen sizes.

### Acceptance Criteria

-   Catalog works in all supported cultures.
-   Arabic RTL layout is correct.
-   No hard-coded LTR assumptions exist.
-   Catalog is usable on mobile, tablet, and desktop.

------------------------------------------------------------------------

## 5.10 --- SSR & SEO Integration

### Goal

Ensure public Catalog pages work correctly with Storefront SSR.

SEO-sensitive Storefront pages include:

``` text
Home
Category Pages
Product Listing Pages
Product Detail Pages
```

### Tasks

-   Verify Catalog routes under SSR.
-   Ensure product data can render correctly during server rendering.
-   Avoid browser-only APIs in SSR execution paths.
-   Verify hydration behavior.
-   Avoid duplicate API requests caused by SSR → hydration.
-   Add appropriate page metadata where supported by the current
    architecture.
-   Ensure route parameters/query parameters work correctly under SSR.

### Acceptance Criteria

-   Home renders through SSR.
-   Category pages render through SSR.
-   Product listing pages render through SSR.
-   Hydration completes without errors.
-   No browser-only API breaks server rendering.
-   Catalog does not unnecessarily request the same data twice.

------------------------------------------------------------------------

## 5.11 --- Testing

Testing must be implemented alongside the feature, not only after
completion.

### Unit Tests

Cover:

-   Catalog query state.
-   Query transformations.
-   Filter state.
-   Sorting state.
-   Pagination state.
-   Search behavior.
-   API/data-access services.
-   State transitions.

### Component Tests

Cover:

-   Product Card.
-   Product Grid.
-   Search.
-   Filters.
-   Sort.
-   Pagination.
-   Loading state.
-   Empty state.
-   Error state.

### Integration/API Tests

Verify:

``` text
Catalog State
      ↓
Data Access
      ↓
ApiClient
      ↓
Backend Contract
```

using the existing project testing conventions.

### E2E

At minimum:

``` text
Home
 ↓
Category
 ↓
Product Listing
 ↓
Search
 ↓
Filter
 ↓
Sort
 ↓
Pagination
```

### Acceptance Criteria

-   Unit tests pass.
-   Component tests pass.
-   Integration/API tests pass.
-   Critical Catalog E2E journey passes.

------------------------------------------------------------------------

## 5.12 --- Hardening & Phase Completion

### Goal

Verify that Phase 5 is a complete vertical slice rather than a
collection of individually working components.

### Review

Verify:

-   Architecture boundaries.
-   API contract usage.
-   Lazy-loaded routes.
-   Feature state ownership.
-   No unnecessary global state.
-   No direct `HttpClient` usage from components.
-   No duplicated shared infrastructure.
-   No premature shared Catalog libraries.
-   Localization.
-   RTL.
-   Responsive behavior.
-   SSR/hydration.
-   Accessibility.
-   Loading/empty/error UX.
-   Tests.
-   Documentation.

------------------------------------------------------------------------

# Phase 5 Final Acceptance Criteria

Phase 5 is complete when the following journey works end-to-end:

``` text
Storefront Home
      ↓
Categories
      ↓
Category
      ↓
Product Listing
      ↓
Search
      ↓
Filtering
      ↓
Sorting
      ↓
Pagination
      ↓
Product Card
      ↓
Product Details Route
```

And the implementation satisfies:

-   Real backend Catalog contracts are consumed.
-   Catalog feature is properly isolated.
-   Search works.
-   Filtering works.
-   Sorting works.
-   Pagination works.
-   Query state is coherent.
-   Product cards work.
-   Loading state works.
-   Empty state works.
-   Error state works.
-   Localization works.
-   RTL works.
-   Responsive behavior works.
-   SSR works for public Catalog pages.
-   Unit/component tests pass.
-   Catalog E2E journey passes.
-   No Phase 6 functionality is introduced.

------------------------------------------------------------------------

# Phase 5 Scope Boundary

## Included

``` text
Home
Categories
Product Listing
Product Cards
Search
Filtering
Sorting
Pagination
Catalog State
Loading / Empty / Error
Localization
RTL
Responsive UI
SSR
Testing
```

## Explicitly Deferred to Phase 6

``` text
Product Details implementation
Image Gallery
Variants
SKU selection
Variant selection
Quantity selection
Add to Cart
```

## Architectural Items Explicitly Avoided

Do not introduce:

``` text
NgRx
SignalStore
Elasticsearch
Client-side search engine
Global Catalog state
Premature shared Catalog libraries
Cart logic
Checkout logic
Payment logic
```

unless a demonstrated project requirement makes one necessary.

------------------------------------------------------------------------

# Final Phase Deliverable

``` text
Production-oriented Catalog & Product Discovery experience
+
Real backend integration
+
SSR-compatible public pages
+
Localized + RTL-aware UI
+
Responsive UX
+
Automated tests
```

The final boundary of Phase 5 is:

> **The customer can discover and browse products, but cannot yet fully
> select/configure or purchase one.**
