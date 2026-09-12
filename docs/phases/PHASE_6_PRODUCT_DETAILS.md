# Phase 6 --- Product Details & Variants Implementation Plan

## Goal

Transform the product from something the customer can discover in Phase
5 into something they can inspect, configure, and add to the cart.

The target customer flow is:

``` text
Product Listing
      ↓
Product Details
      ↓
Images
      ↓
Specifications
      ↓
Variant Selection
      ↓
SKU / Price / Availability
      ↓
Quantity
      ↓
Add to Cart
```

> **Phase 6 makes a product selectable and addable; Phase 7 owns the
> cart experience.**

------------------------------------------------------------------------

## 6.1 --- Product Details Foundation

### Objective

Create the foundation for the Product Details page and connect it to the
real backend contract.

### Tasks

-   Create the Product Details feature/page.
-   Add the route:

``` text
/catalog/products/:id
```

-   Keep the route lazy-loaded.
-   Define Product Details models from the backend contract.
-   Add Product Details data-access.
-   Use the existing `ApiClient`.
-   Create feature-local state following the existing project patterns.
-   Read the Product ID from the route.
-   Handle invalid or missing Product IDs.
-   Keep Product Details state local to the feature.
-   Do not introduce global Catalog/Product state.

### Expected Flow

``` text
Route
  ↓
Product Details State
  ↓
Product Details Data Access
  ↓
ApiClient
  ↓
Backend Catalog API
```

### Acceptance Criteria

-   Product Details route works directly.
-   Product ID is correctly read from the route.
-   The API contract matches the backend contract.
-   No raw `HttpClient` is used inside the feature.
-   State remains feature-local.
-   The route is lazy-loaded.

------------------------------------------------------------------------

## 6.2 --- Product Details Page & Information

### Objective

Build the main Product Details experience.

### Tasks

Display the product information provided by the backend contract, such
as:

-   Product name
-   Description
-   Pricing
-   Availability
-   SKU
-   Specifications
-   Other supported product metadata

Implement the main resource states:

``` text
Loading
Success
Error
Not Found
```

### Rules

-   Do not invent fields that are not provided by the backend contract.
-   Keep business rules in the backend.
-   Reuse the existing loading and error infrastructure.

### Acceptance Criteria

-   Real product data is displayed.
-   Product Not Found has a clear UX.
-   Loading state is visible.
-   API errors use the existing error-handling infrastructure.
-   No backend business workflow is duplicated in the UI.

------------------------------------------------------------------------

## 6.3 --- Product Image Gallery

### Objective

Provide a responsive and accessible product image gallery.

### Tasks

Implement:

-   Main product image.
-   Thumbnail list.
-   Selected image state.
-   Image switching.
-   Missing-image fallback.
-   Responsive layout.
-   Keyboard accessibility.
-   RTL-safe behavior.

### Conceptual Structure

``` text
Product Images
      ↓
┌─────────────────────┐
│                     │
│    Main Image       │
│                     │
└─────────────────────┘
   ↓   ↓   ↓   ↓
 Thumb Thumb Thumb
```

### Requirements

-   The gallery must work on mobile, tablet, and desktop.
-   Do not create separate mobile and desktop implementations.
-   Use responsive CSS/layout.
-   Avoid browser-only APIs that can break SSR.
-   Follow existing shared UI and accessibility conventions.

### Acceptance Criteria

-   Selecting a thumbnail changes the main image.
-   Gallery works across supported screen sizes.
-   Keyboard interaction is supported.
-   RTL does not break ordering or interaction.
-   SSR and hydration remain stable.

------------------------------------------------------------------------

## 6.4 --- Variant Selection

### Objective

Implement the variant-selection experience and establish the selected
variant as the source of truth for variant-specific data.

### Tasks

-   Extract the variant structure from the backend contract.
-   Display available variants.
-   Track the selected variant in feature state.
-   Update variant-dependent information when the selection changes.
-   Prevent invalid variant selections.
-   Apply a default selection only when supported by the
    contract/business rules.

### Conceptual Model

``` text
Product
 ├── Variant A
 ├── Variant B
 └── Variant C

        ↓

Selected Variant
        ↓
 ┌───────────────┐
 │ SKU           │
 │ Price         │
 │ Availability  │
 └───────────────┘
```

### Important Rule

Do not assume that a Product is always the purchasable unit.

If the backend models the Variant as the purchasable unit, the frontend
should follow:

``` text
Product
   ↓
Variant
   ↓
SKU / Price / Availability
```

### Acceptance Criteria

-   The user can select a valid variant.
-   The selected variant is clearly represented in the UI.
-   SKU, price, and availability reflect the selected variant when
    modeled that way by the contract.
-   Invalid or unavailable variants are handled clearly.
-   Variant state remains feature-local.

------------------------------------------------------------------------

## 6.5 --- SKU, Pricing & Availability

### Objective

Connect the selected variant to the commercial information exposed by
the backend.

### Tasks

Display, where provided by the contract:

-   SKU
-   Price
-   Availability
-   Variant-specific commercial information

### Required State Behavior

``` text
No Variant Selected
        ↓
Appropriate UI State

Variant Selected
        ↓
SKU / Price / Availability

Unavailable Variant
        ↓
Cannot Add to Cart
```

### Rules

-   Changing the selected variant must not leave stale variant-specific
    information visible.
-   SKU must correspond to the selected variant.
-   Pricing must come from the backend contract.
-   Availability must come from the backend contract.
-   Do not implement backend availability calculations in the frontend.

### Acceptance Criteria

-   Variant-specific information updates correctly.
-   SKU is correct.
-   Pricing is contract-driven.
-   Availability is contract-driven.
-   Invalid/unavailable selections cannot be added to the cart.

------------------------------------------------------------------------

## 6.6 --- Quantity Selection

### Objective

Allow the customer to select the quantity before adding the product to
the cart.

### Tasks

Implement:

-   Quantity control.
-   Increment.
-   Decrement.
-   Minimum quantity.
-   Maximum quantity when defined by the contract/business rules.
-   Invalid-input prevention.
-   Localized validation.
-   Accessibility labels.

### State Ownership

Quantity is Product Details UI state:

``` text
Product Details State
 ├── selectedVariant
 └── quantity
```

It is not Cart global state.

### Acceptance Criteria

-   Quantity starts with a valid value.
-   Invalid quantities cannot be submitted.
-   Increment/decrement work correctly.
-   Quantity boundaries follow available contract/business rules.
-   Validation messages are localized.

------------------------------------------------------------------------

## 6.7 --- Add to Cart Integration

### Objective

Connect Product Details to the Cart capability without implementing the
Cart experience.

### Tasks

-   Define the Product Details → Cart integration boundary.
-   Use the existing backend Cart API contract.
-   Send the selected purchasable item and quantity.
-   Add Add-to-Cart loading state.
-   Add success feedback.
-   Add error handling.
-   Prevent duplicate submissions while the request is in progress.
-   Handle invalid or unavailable items.

### Expected Flow

``` text
Select Variant
      ↓
Select Quantity
      ↓
Add to Cart
      ↓
Backend Cart API
      ↓
Success / Error Feedback
```

### Explicitly Out of Scope

Do not implement:

-   Cart page.
-   Cart item management.
-   Update cart.
-   Remove item.
-   Clear cart.
-   Cart totals page.
-   Guest cart persistence.
-   Cart merge.
-   Global Cart state.

These belong to Phase 7 --- Shopping Cart.

------------------------------------------------------------------------

## 6.8 --- Localization, RTL, Responsive & Accessibility

### Objective

Integrate Product Details with the localization, RTL, responsive, and
accessibility infrastructure completed in earlier phases.

### Localization

Support all project cultures for:

-   Product actions.
-   Variant labels.
-   Quantity labels.
-   Availability messages.
-   SKU labels.
-   Price-related UI.
-   Errors.
-   Loading states.
-   Empty states.
-   Accessibility labels.
-   Add-to-Cart feedback.

Feature-specific translations should remain owned by the feature.

### RTL

Verify:

-   Product information.
-   Image gallery.
-   Variant controls.
-   Quantity controls.
-   Buttons.
-   Icons.
-   Alignment.
-   Direction-sensitive interactions.

Use CSS logical properties where applicable.

### Responsive

Verify:

``` text
Mobile
Tablet
Desktop
```

Use responsive layout rather than duplicated markup/components.

### Accessibility

Verify:

-   Keyboard navigation.
-   Focus management.
-   Semantic controls.
-   Accessible labels.
-   Selected-state communication.
-   Disabled-state communication.
-   Add-to-Cart feedback.

------------------------------------------------------------------------

## 6.9 --- SSR & SEO Integration

### Objective

Ensure Product Details works correctly as a public, SEO-sensitive
Storefront page.

### Tasks

-   Verify SSR rendering.
-   Verify hydration.
-   Handle route parameters correctly during SSR.
-   Avoid browser-only APIs.
-   Avoid unnecessary duplicate API requests.
-   Set product-specific page title.
-   Set product description metadata when supported.
-   Add Open Graph metadata when supported by the existing architecture.
-   Handle Product Not Found correctly during SSR.

### Expected Flow

``` text
Direct Product URL
        ↓
SSR
        ↓
Product HTML
        ↓
Hydration
        ↓
Interactive Product Details
```

### Acceptance Criteria

-   Direct Product URLs render correctly through SSR.
-   No hydration errors occur.
-   No unnecessary duplicate requests are introduced.
-   SEO metadata is appropriate for the product.
-   Not Found behavior is correct during SSR.

------------------------------------------------------------------------

## 6.10 --- Testing

### Objective

Verify the complete Product Details vertical slice.

Testing should be implemented throughout the phase, not postponed until
the end.

### Unit Tests

Cover:

-   Product Details state.
-   Product loading state transitions.
-   Variant selection.
-   Selected variant transitions.
-   Quantity validation.
-   Quantity transitions.
-   Data-access behavior.
-   Error handling.
-   Add-to-Cart state transitions.

### Component Tests

Cover:

-   Product Details page.
-   Image Gallery.
-   Variant Selector.
-   Quantity Selector.
-   Add-to-Cart interaction.
-   Loading state.
-   Error state.
-   Not Found state.
-   Unavailable state.

### Integration Tests

Verify:

``` text
Product Details State
       ↓
Data Access
       ↓
ApiClient
       ↓
Backend Contract
```

And:

``` text
Selected Variant
       +
Quantity
       ↓
Cart API
```

### E2E

Critical journey:

``` text
Home
 ↓
Category
 ↓
Product Listing
 ↓
Product Details
 ↓
Select Variant
 ↓
Select Quantity
 ↓
Add to Cart
```

Also verify relevant:

-   Mobile viewport.
-   Desktop viewport.
-   Localization/RTL.
-   Product Not Found.
-   Unavailable Variant.

------------------------------------------------------------------------

## 6.11 --- Hardening & Phase Completion

### Objective

Ensure Phase 6 is a complete vertical slice rather than a collection of
isolated components.

### Final Review Checklist

-   [ ] Backend contract fidelity.
-   [ ] Product Details route.
-   [ ] Lazy loading.
-   [ ] Feature-local state.
-   [ ] Data-access boundaries.
-   [ ] No raw `HttpClient` inside the feature.
-   [ ] No unnecessary global state.
-   [ ] No premature Cart architecture.
-   [ ] Product information.
-   [ ] Image gallery.
-   [ ] Variant selection.
-   [ ] SKU handling.
-   [ ] Pricing.
-   [ ] Availability.
-   [ ] Quantity validation.
-   [ ] Add-to-Cart integration.
-   [ ] Loading states.
-   [ ] Error states.
-   [ ] Not Found state.
-   [ ] Localization.
-   [ ] RTL.
-   [ ] Responsive behavior.
-   [ ] Accessibility.
-   [ ] SSR.
-   [ ] SEO metadata.
-   [ ] Unit tests.
-   [ ] Component tests.
-   [ ] Integration tests.
-   [ ] Critical E2E journey.
-   [ ] Documentation synchronization.

------------------------------------------------------------------------

# Phase 6 Completion Criteria

Phase 6 is complete when the following customer journey works
end-to-end:

``` text
Storefront Home
      ↓
Categories
      ↓
Product Listing
      ↓
Product Card
      ↓
Product Details
      ↓
Product Images
      ↓
Product Information
      ↓
Specifications
      ↓
Select Variant
      ↓
SKU / Price / Availability
      ↓
Select Quantity
      ↓
Add to Cart
      ↓
Success / Error Feedback
```

The implementation must preserve the project's architectural boundaries
and must not pull Phase 7 Cart responsibilities forward.

## Final Boundary

``` text
Phase 5
Product Discovery
      ↓
Phase 6
Product Selection + Add to Cart
      ↓
Phase 7
Shopping Cart
```
