# Phase 10 --- Orders & Customer Account

## Objective

Build the customer-facing account and order experience that connects the
completed Checkout and Payment flows with the customer's post-purchase
experience.

The phase should remain focused on customer-facing functionality. Admin
order/payment management and backend order orchestration are outside
this phase.

Target flow:

``` text
Checkout
   ↓
Create Order
   ↓
Payment
   ↓
Payment Result
   ↓
Customer Account
   ↓
Orders
   ↓
Order Details
```

------------------------------------------------------------------------

## Scope

Phase 10 covers:

-   Customer Account
-   Customer Profile
-   Orders List
-   Order Details
-   Order Status
-   Payment Status
-   Order History when supported by the backend contract
-   Post-payment order synchronization
-   Polling when required by eventual consistency
-   Authentication and ownership UX
-   Loading, empty, error, and not-found states
-   Localization and RTL
-   Responsive design
-   Accessibility
-   Unit/component tests
-   End-to-end order journeys

The backend remains the source of truth for order data, payment status,
business rules, authorization, and state transitions.

------------------------------------------------------------------------

# 10.1 --- Orders Contract Audit & Feature Foundation

## Objective

Verify the existing Orders API contract before implementing the
customer-facing UI and establish the Orders feature boundaries.

## Tasks

### Backend Contract Audit

Review and document the actual customer-facing contract for:

-   Orders list endpoint
-   Order details endpoint
-   Current-user/profile endpoint, if available
-   Pagination contract
-   Order status values
-   Payment status values
-   Order history, if available
-   Authorization and ownership behavior
-   `401 Unauthorized` behavior
-   `403 Forbidden` behavior
-   `404 Not Found` behavior
-   Response envelopes
-   Error contracts

### Feature Foundation

Create or complete:

``` text
features/orders/
```

with the project's existing feature architecture.

Establish:

-   Feature models
-   API/data-access services
-   Feature state
-   Routes
-   Public feature boundaries
-   API-to-feature mapping
-   Typed contracts

### Architecture Rules

The dependency flow should remain:

``` text
Orders Page
    ↓
Orders State
    ↓
Orders Data Access
    ↓
ApiClient
    ↓
Orders API
```

Components should not call `HttpClient` directly.

Do not introduce a global state-management solution unless the existing
architecture and actual requirements justify it.

## Deliverables

-   Verified Orders API contract
-   Orders feature foundation
-   Typed feature models
-   Orders data-access boundary
-   Initial Orders routes

------------------------------------------------------------------------

# 10.2 --- Customer Account & Profile

## Objective

Build the authenticated customer account area and connect it to the
existing identity/session infrastructure.

## Tasks

-   Create the Account shell/page
-   Add Account navigation
-   Add Profile view
-   Display current customer information
-   Integrate existing authentication/session state
-   Integrate logout
-   Handle profile loading
-   Handle profile errors
-   Handle unauthenticated navigation
-   Add navigation to Orders

Suggested structure:

``` text
/account
    ├── Profile
    └── Orders
```

The exact route structure should follow the project's existing routing
conventions.

## Important Constraint

Do not create profile editing functionality unless the backend contract
already supports it and it belongs to the current project scope.

## Deliverables

-   Customer Account area
-   Profile experience
-   Account navigation
-   Authentication/session integration

------------------------------------------------------------------------

# 10.3 --- Orders List

## Objective

Allow authenticated customers to view their orders in a paginated list.

## Route

Suggested:

``` text
/account/orders
```

Use the project's established routing conventions if they differ.

## Tasks

Implement:

-   Orders list page
-   Orders data loading
-   Pagination
-   Order summary
-   Order date
-   Order status
-   Payment status
-   Order total
-   Navigation to order details

## UI States

The page must explicitly handle:

``` text
Idle
 ↓
Loading
 ↓
 ├── Success
 ├── Empty
 └── Error
```

Provide:

-   Loading state
-   Empty state
-   Error state
-   Retry behavior
-   Pagination state

## Business Rules

-   Do not calculate order totals in Angular.
-   Do not derive order status from payment status.
-   Do not derive payment status from order status.
-   Use backend-provided values.
-   Reuse the project's existing pagination abstraction.

## Deliverables

-   Customer Orders List
-   Pagination
-   Loading/empty/error handling
-   Navigation to Order Details

------------------------------------------------------------------------

# 10.4 --- Order Details

## Objective

Build the complete customer-facing order details experience.

## Route

Suggested:

``` text
/account/orders/:orderId
```

Use the project's existing route conventions if they differ.

## Tasks

Display information supported by the backend contract, such as:

-   Order identifier
-   Order date
-   Order status
-   Payment status
-   Customer information
-   Shipping information
-   Billing information
-   Order items
-   Product information
-   Quantities
-   Prices
-   Subtotals
-   Discounts
-   Shipping cost
-   Taxes
-   Final total

Only display fields that are actually provided by the backend contract.

## State Handling

Handle:

``` text
Loading
Success
Not Found
Forbidden
Unauthorized
Error
```

## Business Rules

The backend is authoritative.

The frontend should present the received order rather than
reconstructing business state or recalculating authoritative totals.

## Deliverables

-   Order Details page
-   Order information presentation
-   Order items presentation
-   Totals presentation
-   Proper error/not-found handling

------------------------------------------------------------------------

# 10.5 --- Order & Payment Status Experience

## Objective

Provide a clear and localized presentation of Order Status and Payment
Status.

## Tasks

Implement:

-   Order status presentation
-   Payment status presentation
-   Status badges/components
-   Localized status labels
-   Accessible status representation
-   Unknown/future status fallback

Keep the two concepts independent:

``` text
Order Status
Payment Status
```

For example:

``` text
Order Status: Processing
Payment Status: Succeeded
```

The frontend must not assume that a successful payment automatically
means the order is completed.

## Rules

-   Backend status values are authoritative.
-   Do not hard-code business transitions in Angular.
-   Do not infer one status from another.
-   Localize user-facing status labels.
-   Provide a safe fallback for unknown values.

## Deliverables

-   Order status UI
-   Payment status UI
-   Localized status mapping
-   Accessible status presentation

------------------------------------------------------------------------

# 10.6 --- Order History & Post-Payment Synchronization

## Objective

Connect the Payment Result experience with the eventual customer-visible
Order state.

This sub-phase addresses the possibility that payment completion and
order finalization are not immediately observable as a single
synchronous operation.

------------------------------------------------------------------------

## 10.6.1 --- Order History

If the backend exposes order status history, display it as part of Order
Details.

Possible information:

-   Status
-   Timestamp
-   Localized status label
-   Other backend-provided metadata

Do not invent an order history from frontend state changes.

If the backend does not provide historical status data, do not create a
fake timeline.

------------------------------------------------------------------------

## 10.6.2 --- Post-Payment Synchronization

Support the required synchronization flow:

``` text
Payment Result
      ↓
Load Order
      ↓
Order Stable?
   ├── Yes → Display Order
   └── No
        ↓
      Poll
        ↓
   Load Order
        ↓
     Repeat
```

Polling should only be implemented if the actual backend behavior
requires it.

## Polling Requirements

When polling is required:

-   Use bounded polling
-   Define a maximum duration or attempt count
-   Stop when the order reaches the required stable/terminal state
-   Cancel polling when the user leaves the flow
-   Stop polling on component destruction
-   Prevent duplicate polling loops
-   Avoid overlapping requests
-   Handle API errors
-   Handle authentication/session expiration
-   Preserve backend authority
-   Provide appropriate pending/processing UI

## Deliverables

-   Order history when supported
-   Post-payment order refresh/synchronization
-   Bounded polling when required
-   Proper cancellation and lifecycle handling

------------------------------------------------------------------------

# 10.7 --- Routing, Authorization & Account UX

## Objective

Integrate Account and Orders into the Storefront navigation and
authenticated customer experience.

## Tasks

Implement:

-   Account lazy route
-   Orders lazy route
-   Order Details lazy route
-   Authentication guard integration
-   Return URL behavior
-   Direct navigation/deep links
-   Payment Result → Order navigation
-   Account → Orders navigation
-   Orders → Order Details navigation
-   Proper unauthorized handling
-   Proper forbidden handling
-   Proper not-found handling

## Security Boundary

Angular route guards provide navigation/UX protection.

They are not the actual security boundary.

The backend remains responsible for:

-   Authentication
-   Authorization
-   Customer ownership
-   Access to order resources

## Deliverables

-   Complete Account/Orders routing
-   Authenticated customer navigation
-   Correct unauthorized/forbidden behavior
-   Correct deep-link behavior

------------------------------------------------------------------------

# 10.8 --- Localization, RTL, Responsive Design & Accessibility

## Objective

Bring the Account and Orders experience into compliance with the
project's existing UX infrastructure.

## Localization

Localize:

-   Account labels
-   Orders labels
-   Order details labels
-   Status labels
-   Payment status labels
-   Empty states
-   Error messages
-   Loading/pending messages
-   Retry messages
-   Dates
-   Numbers
-   Currency
-   Order history labels

Use the existing localization infrastructure and supported project
cultures.

## RTL

Verify:

-   Logical CSS properties
-   Direction-sensitive layouts
-   Order item layouts
-   Status components
-   Pagination
-   Order history/timeline
-   Cards and tables
-   Mobile layouts

Do not introduce physical-direction assumptions such as unnecessary
`left`/`right` positioning.

## Responsive Design

Verify the experience on:

``` text
Mobile
Tablet
Desktop
```

Pay particular attention to:

-   Orders list
-   Order items
-   Totals
-   Order history
-   Account navigation

## Accessibility

Verify:

-   Semantic headings
-   Keyboard navigation
-   Focus management
-   Accessible buttons/links
-   Accessible status indicators
-   Screen-reader-friendly loading/error states
-   Meaningful empty states
-   Proper labels and relationships

## Deliverables

-   Fully localized Account/Orders experience
-   RTL-safe layouts
-   Responsive layouts
-   Accessible UI

------------------------------------------------------------------------

# 10.9 --- Testing, E2E & Phase Completion

## Objective

Verify that the complete customer order journey works correctly and that
the implementation remains consistent with the project's architecture.

## Unit Tests

Cover:

-   Orders data-access services
-   Profile data-access
-   Feature state
-   Status mapping
-   Pagination behavior
-   Error mapping
-   Polling logic
-   Polling cancellation
-   Component behavior
-   Page states

## Integration Tests

Verify:

``` text
Orders API
    ↓
Data Access
    ↓
State
    ↓
Page
```

Verify correct handling of:

-   Success
-   Empty responses
-   API errors
-   Unauthorized
-   Forbidden
-   Not Found
-   Invalid/unknown statuses

## E2E Journeys

### Journey 1 --- Account

``` text
Login
 ↓
Account
 ↓
Profile
```

### Journey 2 --- Orders List

``` text
Login
 ↓
Account
 ↓
Orders
 ↓
Orders List
```

### Journey 3 --- Order Details

``` text
Orders
 ↓
Select Order
 ↓
Order Details
 ↓
Display Backend Order Data
```

### Journey 4 --- Payment → Order

``` text
Checkout
 ↓
Create Order
 ↓
Payment
 ↓
Payment Result
 ↓
Order Details
```

### Journey 5 --- Eventual Consistency

When required:

``` text
Payment Success
 ↓
Order Processing
 ↓
Polling
 ↓
Updated Order
 ↓
Terminal/Stable State
```

## Final Verification

Run the project's applicable verification commands, including:

``` text
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build:storefront
npm run build:admin
npm run verify:architecture
```

Use the actual project scripts if names differ.

## Deliverables

-   Unit/component test coverage
-   E2E coverage for critical customer journeys
-   Successful project verification
-   No architectural boundary violations
-   Phase completion report

------------------------------------------------------------------------

# Phase 10 Dependency Flow

``` text
10.1 — Contract Audit & Feature Foundation
                  ↓
        ┌─────────┴─────────┐
        ↓                   ↓
10.2 — Account/Profile   10.3 — Orders List
        │                   │
        └─────────┬─────────┘
                  ↓
        10.4 — Order Details
                  ↓
        10.5 — Order & Payment Status
                  ↓
        10.6 — History & Synchronization
                  ↓
        10.7 — Routing & Authorization
                  ↓
        10.8 — Localization/RTL/A11y
                  ↓
        10.9 — Testing & Verification
```

------------------------------------------------------------------------

# Architectural Constraints

Throughout Phase 10:

1.  **Backend is the source of truth.**

    -   Do not duplicate business rules in Angular.
    -   Do not calculate authoritative order totals on the client.
    -   Do not derive backend state transitions in the client.

2.  **Keep Order Status and Payment Status independent.**

3.  **Reuse existing shared infrastructure.**

    -   API client
    -   Authentication
    -   Pagination
    -   Localization
    -   Theming
    -   UI primitives
    -   Error handling
    -   Existing state patterns

4.  **Do not introduce unnecessary global state management.**

5.  **Keep business-specific components inside the Orders feature.**

6.  **Keep reusable primitives in shared libraries only when they are
    genuinely reusable.**

7.  **Backend authorization remains the security boundary.**

8.  **Do not implement Admin functionality in this phase.**

9.  **Do not implement backend orchestration in the Angular
    application.**

10. **Do not invent API capabilities.** If a required feature is not
    supported by the verified backend contract, document it rather than
    creating a frontend-only approximation.

------------------------------------------------------------------------

# Out of Scope

The following are explicitly outside Phase 10:

-   Admin Orders
-   Admin Payments
-   Admin Users
-   Admin order management
-   Payment administration
-   Refund administration
-   Backend order orchestration
-   Backend Saga implementation
-   Inventory workflows
-   New payment provider integration
-   Order state-transition implementation
-   Backend business-rule changes

These capabilities belong to later phases or the backend and should not
be pulled into the customer-facing Orders phase.

------------------------------------------------------------------------

# Definition of Done

Phase 10 is complete when:

-   [ ] Customer Account is available
-   [ ] Customer Profile is displayed
-   [ ] Customer Orders List is available
-   [ ] Orders are paginated according to the backend contract
-   [ ] Order Details are available
-   [ ] Order Status is displayed correctly
-   [ ] Payment Status is displayed correctly
-   [ ] Order History is displayed when supported by the backend
-   [ ] Post-payment synchronization works correctly
-   [ ] Polling is implemented only when required
-   [ ] Polling is bounded and cancellable
-   [ ] Authentication and ownership behavior is correct
-   [ ] Loading states are implemented
-   [ ] Empty states are implemented
-   [ ] Error states are implemented
-   [ ] Not-found behavior is implemented
-   [ ] Localization is complete
-   [ ] RTL behavior is verified
-   [ ] Responsive behavior is verified
-   [ ] Accessibility is verified
-   [ ] Unit/component tests pass
-   [ ] Critical E2E journeys pass
-   [ ] Architecture verification passes
-   [ ] Storefront build passes
-   [ ] Admin build remains unaffected
-   [ ] No Admin Orders/Payments functionality has been introduced
-   [ ] No unnecessary architecture or state-management complexity has
    been introduced

------------------------------------------------------------------------

# Expected Customer Experience

At the end of Phase 10, the customer journey should be:

``` text
                    ┌──────────────┐
                    │   Checkout   │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │ Create Order │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │   Payment    │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │Payment Result │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │    Order     │
                    └──────┬───────┘
                           ↓
                 ┌─────────────────────┐
                 │  Customer Account   │
                 └─────────┬───────────┘
                           ↓
                 ┌─────────────────────┐
                 │       Orders        │
                 └─────────┬───────────┘
                           ↓
                 ┌─────────────────────┐
                 │   Order Details     │
                 ├─────────────────────┤
                 │ Order Status        │
                 │ Payment Status      │
                 │ Items               │
                 │ Totals              │
                 │ History*            │
                 └─────────────────────┘

* When supported by the backend contract.
```

# Phase 10 Outcome

Phase 10 establishes the complete customer-facing post-purchase
experience:

``` text
Checkout
   +
Payments
   +
Orders
   +
Customer Account
   ↓
Complete Customer Commerce Journey
```

After this phase, the project can move to the next roadmap stage focused
on Storefront Production Readiness rather than expanding customer order
functionality further.
