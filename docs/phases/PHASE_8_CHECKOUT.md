# Phase 8 — Checkout

## Goal

Build the complete storefront checkout flow on top of the Phase 7 cart, allowing the customer to review checkout information, provide the required customer and shipping data, validate the input, and create an order through the backend.

The frontend must **not implement order orchestration, inventory reservation, payment processing, Saga logic, or other backend business workflows**.

### Main Flow

```text
Cart
 ↓
Checkout
 ↓
Customer Information
 ↓
Shipping Address
 ↓
Shipping Information
 ↓
Order Summary
 ↓
Validation
 ↓
Create Order
 ↓
Backend Order Workflow
 ↓
Checkout Result
```

---

## 8.1 — Checkout Architecture & Contract

Establish the checkout boundaries before implementing UI.

### Tasks

- Review the backend order/checkout API contract.
- Identify:
  - Create Order request
  - Create Order response
  - Required customer information
  - Required shipping/address information
  - Required shipping information
  - Order summary data
  - Validation errors
  - Business errors
- Define frontend models/interfaces based on the actual backend contract.
- Define the boundary between:
  - Cart state
  - Checkout form state
  - Checkout state
  - Order creation request
  - Backend response
- Determine which data comes from the cart and which must be entered by the customer.
- Confirm authenticated-user requirements.
- Confirm behavior when the cart is empty.
- Confirm behavior when the cart changes while checkout is open.

### Acceptance Criteria

- Checkout responsibilities are clearly separated from Cart and Payment.
- Frontend models match the backend contract.
- No backend business logic is duplicated in the frontend.

---

# 8.2 — Checkout Feature & Data Access

Create the Checkout feature using the existing frontend architecture.

### Tasks

- Create the Checkout feature/slice.
- Add the required route.
- Add lazy loading where appropriate.
- Create checkout data-access services.
- Add the Create Order API operation.
- Reuse existing API infrastructure.
- Reuse authentication/current-user infrastructure.
- Reuse shared error/resource-state patterns.
- Add cancellation handling for HTTP operations where applicable.

### Acceptance Criteria

- Checkout has its own feature boundary.
- API communication is isolated from presentation components.
- Existing architecture and shared infrastructure are reused.

---

# 8.3 — Checkout State Management

Introduce state for the checkout workflow without duplicating Cart state.

### Tasks

- Define checkout state.
- Represent:
  - Initial state
  - Loading
  - Ready
  - Submitting
  - Success
  - Failure
- Keep form state separate from submission state.
- Read the current cart from the existing Cart feature/state.
- Handle checkout initialization.
- Handle empty-cart access.
- Handle checkout state reset when necessary.
- Prevent duplicate order-submission attempts.

### Acceptance Criteria

- Checkout does not become a second Cart store.
- Form state and API/submission state are clearly separated.
- UI can reliably represent each checkout state.

---

# 8.4 — Customer & Shipping Information

Build the checkout form.

### Customer Information

Implement the fields required by the backend contract.

### Shipping Address

Implement the required address information.

### Shipping Information

Implement the required shipping-related selections/data supported by the backend.

### Tasks

- Use Angular Reactive Forms.
- Create strongly structured form groups.
- Define validation rules from the actual contract.
- Separate customer, address, and shipping sections.
- Support editing before submission.
- Prepare form data for the Create Order request.
- Avoid putting business rules into UI components.

### Acceptance Criteria

- All required checkout information can be entered.
- Invalid data is clearly identified.
- Form structure maps cleanly to the backend request.
- No unnecessary backend assumptions are introduced.

---

# 8.5 — Order Summary

Build the checkout order summary using the existing Cart data.

### Tasks

Display relevant information such as:

- Cart items
- Quantities
- Product/variant information
- Item prices
- Subtotal
- Shipping cost if provided/required
- Total
- Relevant checkout selections

### Important Boundary

The frontend should **display** calculated values supplied by the appropriate backend/cart contract.

It must not recreate authoritative pricing, inventory, discount, tax, or order calculations.

### Acceptance Criteria

- Summary accurately reflects the current cart.
- Checkout does not duplicate cart business logic.
- Summary updates correctly when the underlying cart changes.

---

# 8.6 — Client Validation & Create Order

Connect the validated checkout form to order creation.

### Tasks

- Validate the complete checkout form.
- Prevent submission when invalid.
- Transform form state into the backend Create Order request.
- Submit the order through the checkout data-access layer.
- Handle successful order creation.
- Store/use the returned order information only as required by the next frontend step.
- Prepare the flow for the future Payment phase.

### Flow

```text
User submits checkout
        ↓
Client validation
        ↓
Create Order Request
        ↓
Backend
        ↓
Order created / rejected
        ↓
Checkout Result
```

### Acceptance Criteria

- Invalid forms cannot submit.
- Valid checkout data produces the correct API request.
- Successful order creation is handled correctly.
- The frontend does not implement backend order orchestration.

---

# 8.7 — Failure Handling & Recovery

Handle realistic checkout failures.

### Scenarios

- Empty cart
- Authentication/session issue
- Validation failure
- Invalid checkout data
- Cart changed before submission
- Product/variant unavailable
- Price-related backend rejection
- Order creation failure
- Network/server failure
- Duplicate submission
- Expired authentication

### Tasks

- Map backend errors into user-understandable UI states.
- Preserve entered form data when appropriate.
- Allow retry where safe.
- Prevent accidental duplicate submissions.
- Refresh/reload cart data when the backend indicates that the cart is no longer valid.
- Provide a clear recovery path back to Cart when required.

### Acceptance Criteria

- Failure does not leave the checkout UI in an inconsistent state.
- Recoverable errors can be retried.
- Backend errors are not exposed as raw technical messages.

---

# 8.8 — Localization, RTL, Responsive & Accessibility

Integrate Checkout with the existing UI infrastructure.

### Tasks

- Add all checkout text to the localization system.
- Support all existing supported languages.
- Verify RTL/LTR behavior.
- Ensure forms work correctly in RTL.
- Ensure order summary works correctly in both directions.
- Implement responsive layouts.
- Verify keyboard navigation.
- Add appropriate labels and validation messages.
- Verify focus behavior for validation errors.
- Ensure loading/submission states are accessible.

### Acceptance Criteria

- Checkout works correctly in LTR and RTL.
- No hardcoded user-facing strings remain.
- Form and validation UX are accessible.
- Layout works across supported screen sizes.

---

# 8.9 — Unit & Component Testing

Cover checkout logic before E2E testing.

### Tests

#### Forms

- Required-field validation
- Invalid values
- Valid form
- Form state changes

#### State

- Initial state
- Loading/submitting
- Success
- Failure
- Reset/recovery

#### Data Access

- Create Order request
- Successful response
- Validation errors
- Business errors
- Network/server errors
- Duplicate-submission protection

#### Components

- Checkout form rendering
- Validation messages
- Order summary
- Loading state
- Error state
- Empty-cart state
- Submission state

### Acceptance Criteria

- Core checkout logic is covered by automated tests.
- Tests verify behavior rather than implementation details.
- Existing test conventions are followed.

---

# 8.10 — Checkout E2E & Integration Verification

Verify the complete customer journey against the real application/backend.

### Primary Journey

```text
Authenticated Customer
        ↓
Cart
        ↓
Checkout
        ↓
Enter Customer Information
        ↓
Enter Shipping Address
        ↓
Select/Enter Shipping Information
        ↓
Review Order
        ↓
Submit
        ↓
Create Order
        ↓
Successful Checkout Result
```

### Additional Scenarios

- Empty cart → Checkout
- Invalid checkout form
- Backend validation failure
- Backend order-creation failure
- Cart changed before submission
- Unauthenticated access
- Session/token expiration
- Retry after failure
- Duplicate submission attempt
- Refresh during checkout

### Acceptance Criteria

- The main checkout journey works against the real backend.
- Critical failure scenarios are covered.
- No payment implementation is introduced.
- Checkout ends at successful/failed order creation and is ready for Phase 9.

---

# Phase 8 Definition of Done

Phase 8 is complete when:

- [ ] Checkout feature is implemented using the existing architecture.
- [ ] Backend checkout/order contracts are respected.
- [ ] Customer information is implemented.
- [ ] Shipping address is implemented.
- [ ] Shipping information is implemented.
- [ ] Order summary is implemented.
- [ ] Checkout validation works.
- [ ] Create Order integration works.
- [ ] Loading, empty, success, and failure states are handled.
- [ ] Duplicate submission is prevented.
- [ ] Cart and Checkout state remain properly separated.
- [ ] Localization is complete.
- [ ] RTL/LTR is verified.
- [ ] Responsive behavior is verified.
- [ ] Accessibility requirements are addressed.
- [ ] Unit/component tests pass.
- [ ] Critical E2E checkout journey passes.
- [ ] Backend Saga/order orchestration remains entirely backend-owned.
- [ ] Payment processing/UI remains deferred to **Phase 9**.

### Final Phase 8 Boundary

```text
Phase 7
Cart
  ↓
Phase 8
Checkout
  ↓
Create Order
  ↓
Order Created
  ↓
Phase 9
Payment
```

This keeps **Checkout, Order Creation, and Payment** as separate frontend concerns while preserving the backend as the owner of commerce orchestration.
