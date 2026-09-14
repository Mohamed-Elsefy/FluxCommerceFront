# Phase 7 — Shopping Cart Implementation Plan

## Phase Goal

Implement the complete Storefront Shopping Cart feature for both guest and authenticated users.

The phase must support:

- Guest cart
- Authenticated cart
- Add, update, remove, and clear operations
- Backend-authoritative totals
- Cart persistence through the existing backend contract
- Guest → Login → Cart Merge → Authenticated Cart
- Loading, empty, success, and error states
- Localization, RTL/LTR, responsive behavior, and accessibility
- Unit, component, API/data-access, and critical E2E coverage

The frontend must treat the Cart as an API capability and must not depend on backend storage details such as Redis.

---

## 7.1 — Cart Contracts & Feature Foundation

### Objective

Prepare the Cart feature structure and frontend contracts without rebuilding functionality already completed in Phase 6.

### Tasks

- Review the backend Cart API contract.
- Define the required frontend models/interfaces:
  - `Cart`
  - `CartItem`
  - `CartTotals`
  - Product/variant summary data used by cart items
- Establish the Cart feature boundaries.
- Define the Cart state structure.
- Define the required resource states:
  - Idle
  - Loading
  - Success
  - Empty
  - Error
- Define the distinction between:
  - Guest Cart
  - Authenticated Cart

### Deliverable

A clean Cart feature foundation ready for API integration and state management.

---

## 7.2 — Cart API & Data Access

### Objective

Implement the data-access layer for the backend Cart API.

### Operations

- Get Cart
- Add Item
- Update Item Quantity
- Remove Item
- Clear Cart
- Merge Guest Cart

### Tasks

- Create the Cart API client/service.
- Integrate it with the existing shared API infrastructure.
- Use the existing HTTP/interceptor infrastructure.
- Map API responses to frontend contracts.
- Handle validation and business errors returned by the backend.
- Keep business logic out of the API/data-access layer.

### Deliverable

A working Cart API/data-access layer following:

```text
Component
    ↓
Cart Feature Service/Store
    ↓
Cart API
    ↓
HttpClient
    ↓
Backend
```

---

## 7.3 — Cart Feature State

### Objective

Implement Cart feature state using the existing Signals/feature-store approach.

### State

The state should cover at least:

- Cart data
- Loading state
- Error state
- Empty state
- Item count
- Subtotal
- Total

### Operations

- `loadCart()`
- `addItem()`
- `updateQuantity()`
- `removeItem()`
- `clearCart()`
- `mergeCart()`

### Guidelines

- Cart state is feature state.
- Do not make Cart global state without a concrete requirement.
- Do not introduce NgRx merely because Cart contains multiple state transitions.
- Do not use `localStorage` as the authoritative Cart state.
- Keep server state and UI state clearly separated.

### Deliverable

A centralized Cart feature state that can be consumed by Cart components and other required Storefront flows.

---

## 7.4 — Cart Page & UI

### Objective

Build the Storefront Cart user interface.

### Suggested Structure

```text
CartPage
 ├── CartItems
 │    └── CartItem
 │         ├── Product/Variant Info
 │         ├── Quantity Control
 │         └── Remove Action
 │
 └── CartSummary
      ├── Item Count
      ├── Subtotal
      └── Total
```

### Tasks

- Create the Cart page.
- Render cart items.
- Display product/variant information.
- Implement quantity controls.
- Implement item removal.
- Implement clear cart.
- Display Cart summary.
- Add the required navigation boundary toward Checkout without implementing Checkout logic.

### Rules

- Do not implement complex pricing calculations in the frontend.
- Do not implement inventory business rules.
- Do not implement order creation.
- Do not implement payment logic.

Backend remains authoritative for pricing and totals.

### Deliverable

A complete and responsive Cart UI connected to the Cart feature state.

---

## 7.5 — Guest Cart

### Objective

Implement the complete guest-user Cart experience.

### Tasks

- Load the guest Cart.
- Add items as a guest.
- Update item quantities.
- Remove items.
- Clear the guest Cart.
- Preserve Cart identity according to the backend contract.
- Handle guest Cart expiration or invalidation according to the API response.
- Handle invalid or unavailable Cart states.

### Guidelines

- Do not create an independent frontend Cart persistence mechanism.
- Do not depend on Redis implementation details.
- Follow the backend Cart identity and lifecycle contract.

### Deliverable

A fully functional guest Cart.

---

## 7.6 — Authenticated Cart

### Objective

Implement the Cart experience for authenticated users.

### Tasks

- Load the authenticated user's Cart after authentication.
- Add items.
- Update quantities.
- Remove items.
- Clear the Cart.
- Preserve Cart state after page refresh according to backend persistence.
- React correctly to authentication state changes.
- Ensure the guest Cart is not incorrectly reused after authentication.

### Deliverable

A fully functional authenticated Cart integrated with the existing authentication flow.

---

## 7.7 — Guest → Login → Cart Merge

### Objective

Implement the most important integration scenario of Phase 7:

```text
Guest
  ↓
Add Product
  ↓
Guest Cart
  ↓
Login
  ↓
Cart Merge
  ↓
Authenticated Cart
```

### Tasks

- Define when Cart merge is triggered during authentication transition.
- Connect the merge operation to the existing authentication flow.
- Send the guest Cart identity according to the backend contract.
- Receive the merged Cart from the backend.
- Replace/update the feature state with the merged result.
- Handle the guest Cart after successful merge.
- Prevent duplicate merge effects.
- Handle failed merge operations.
- Handle expired or invalid guest Carts.
- Handle the case where the authenticated user already has a Cart.

### Merge Rules

The frontend must not implement its own merge algorithm.

The backend remains responsible for merge behavior, including duplicate variant quantity handling and merge consistency.

### Deliverable

A reliable Guest → Login → Cart Merge → Authenticated Cart flow.

---

## 7.8 — UX States, Localization & Responsive Behavior

### Objective

Make the Cart feature production-ready from a UX perspective.

### Resource States

Implement clear UI for:

- Loading
- Empty Cart
- Successful operations
- Operation errors
- Cart loading errors
- Merge errors

### Localization

Support the existing application locales:

- English
- French
- German
- Spanish
- Arabic

All user-facing Cart text must use the existing i18n architecture.

### RTL/LTR

Verify the Cart in:

- LTR
- RTL

Pay particular attention to:

- Cart layout
- Quantity controls
- Summary layout
- Icons
- Spacing
- Directional elements

Use logical CSS properties where applicable.

### Responsive Design

Verify:

- Desktop
- Tablet
- Mobile

### Accessibility

Ensure:

- Keyboard navigation
- Accessible buttons and labels
- Accessible quantity controls
- Accessible remove actions
- Semantic structure
- Appropriate focus behavior

### Deliverable

A localized, accessible, responsive Cart experience supporting both LTR and RTL.

---

## 7.9 — Testing & Phase Verification

### Objective

Verify the Cart feature at unit, component, API/data-access, and E2E levels.

### Unit Tests

Cover:

- Cart state
- Add item state transitions
- Quantity updates
- Item removal
- Clear Cart
- Loading state
- Empty state
- Error state
- Merge state handling

### Component Tests

Cover:

- Cart rendering
- Cart item rendering
- Quantity controls
- Remove action
- Empty state
- Error state
- Cart summary

### API/Data-Access Tests

Cover:

- Correct API calls
- Request payloads
- Response mapping
- Error handling

### Mandatory E2E Scenario

Automate:

```text
Open Storefront
     ↓
Browse Catalog
     ↓
Open Product
     ↓
Select Variant
     ↓
Add to Cart
     ↓
Open Cart
     ↓
Login
     ↓
Cart Merge
     ↓
Authenticated Cart
```

### Additional E2E Coverage

Where appropriate, cover:

- Guest add/update/remove
- Authenticated add/update/remove
- Empty Cart
- Clear Cart
- Cart persistence after refresh
- Merge with an existing authenticated Cart
- Merge failure handling

### Deliverable

A tested Cart feature with automated coverage for the critical merge scenario.

---

# Phase 7 Acceptance Criteria

Phase 7 is complete when:

- [ ] Guest Cart works.
- [ ] Authenticated Cart works.
- [ ] Add Item works.
- [ ] Update Quantity works.
- [ ] Remove Item works.
- [ ] Clear Cart works.
- [ ] Cart totals are taken from the backend contract.
- [ ] Cart is managed as feature state.
- [ ] Cart persistence follows the backend contract.
- [ ] Guest → Login → Cart Merge works correctly.
- [ ] Duplicate variants are handled according to backend merge behavior.
- [ ] Repeated merge does not create duplicate state.
- [ ] Loading, empty, success, and error states are implemented.
- [ ] Localization is complete.
- [ ] RTL/LTR behavior is verified.
- [ ] Responsive behavior is verified.
- [ ] Accessibility requirements are covered.
- [ ] Unit tests are implemented.
- [ ] Component tests are implemented.
- [ ] API/data-access tests are implemented.
- [ ] Mandatory Guest → Login → Cart Merge E2E test is implemented.
- [ ] No Checkout, Payment, or Order business logic is implemented in this phase.

---

# Phase Boundary

Phase 7 ends at the Cart boundary.

### Included

```text
Product Details
      ↓
Add to Cart
      ↓
Cart
      ↓
Guest/Auth Cart
      ↓
Login
      ↓
Cart Merge
      ↓
Authenticated Cart
```

### Not Included

```text
Checkout
Address
Shipping
Create Order
Payment
Stripe
Order Status
Inventory Reservation
Saga Orchestration
```

These concerns belong to later phases.

---

# Final Outcome

At the end of Phase 7, the Storefront will have a complete Shopping Cart feature that supports both guest and authenticated users, persists through the backend Cart capability, handles authentication-based Cart merging, and is ready to hand off to:

**Phase 8 — Checkout**
