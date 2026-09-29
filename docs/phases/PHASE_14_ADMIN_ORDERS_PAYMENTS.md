# Phase 14 — Admin Orders & Payments

## Objective

Implement the Admin Orders & Payments vertical slice using the existing Admin architecture, shared UI/data-access patterns, and the real backend contracts.

The phase must remain contract-driven. The frontend must not invent endpoints, DTOs, filters, payment capabilities, or business rules that are not supported by the backend.

---

## 14.1 — Foundation & Backend Contract Alignment

### Goals

Establish the exact backend contract boundary before implementing Orders and Payments UI.

### Tasks

- Review the existing Orders and Payments API contracts.
- Identify the available endpoints and DTOs for:
  - Orders list
  - Order details
  - Customer information
  - Order status
  - Payment status
  - Payment details
  - Payment history
  - Failed payments
- Identify supported query parameters, filters, pagination, sorting, and response shapes.
- Identify the exact backend enum values used for order and payment statuses.
- Define frontend models and mapping boundaries based on the real contracts.
- Record any missing backend capabilities as contract gaps.
- Do not create assumed endpoints or DTOs to fill contract gaps.

### Completion Criteria

- The Phase 14 implementation boundary is explicitly aligned with the backend.
- All planned API interactions are backed by real contracts.
- Any unsupported capability is documented instead of fabricated.

---

## 14.2 — Admin Orders Feature Foundation

### Goals

Create the structural foundation for the Admin Orders feature.

### Tasks

- Create the Orders feature structure under the existing Admin architecture.
- Add Orders routes.
- Create the Admin Orders API service.
- Establish feature-owned state.
- Reuse the existing:
  - API client
  - authentication infrastructure
  - authorization infrastructure
  - routing conventions
  - shared UI primitives
- Define feature models and contract mapping.
- Keep Orders implementation isolated from unrelated feature internals.

### Completion Criteria

- Orders feature is routable and structurally integrated.
- API access follows the established Admin data-access pattern.
- State ownership is feature-local unless a genuine cross-feature requirement exists.

---

## 14.3 — Orders List & Pagination

### Goals

Implement the Admin Orders list using the existing data-table infrastructure.

### Tasks

- Create the Orders List page.
- Reuse the sanctioned Admin data-table implementation.
- Display only backend-supported order fields.
- Implement server-side pagination when supported by the contract.
- Implement loading states.
- Implement empty states.
- Implement error states.
- Manage pagination state within the Orders feature.
- Preserve existing Admin table conventions.

### Completion Criteria

- Admin users can view the Orders list.
- Pagination works according to the backend contract.
- Loading, empty, and error states are handled consistently.
- No duplicate or forked table implementation is introduced.

---

## 14.4 — Orders Filtering & Status Presentation

### Goals

Add contract-supported filtering and consistent order-status presentation.

### Tasks

- Implement only filters supported by the backend.
- Add status filtering when supported.
- Add appropriate debounce behavior where needed.
- Reload orders when filters change.
- Create/reuse an `OrderStatusBadge`.
- Map backend status enum values to localized labels.
- Avoid scattered status string comparisons inside components.
- Preserve the existing Admin filtering patterns.

### Completion Criteria

- Supported filters work correctly.
- Order status is displayed consistently.
- Backend enum values remain the source of truth.
- Status labels are fully localized.

---

## 14.5 — Order Details & Customer Information

### Goals

Implement the Order Details workflow.

### Tasks

- Create the Order Details page.
- Handle the order route parameter.
- Load order details through the feature data-access layer.
- Display backend-provided:
  - Order information
  - Customer information
  - Order status
  - Order items
  - Quantities
  - Prices and totals
  - Available metadata
- Use backend-provided business values rather than recalculating them in Angular.
- Implement loading states.
- Implement error states.
- Handle not-found scenarios according to existing Admin conventions.
- Add navigation between Orders List and Order Details.

### Completion Criteria

- Admin users can open and inspect an order.
- Customer information is displayed when supported by the contract.
- Order totals and business values are represented from backend data.
- The details workflow follows existing Admin UX patterns.

---

## 14.6 — Payment Integration & Order-Payment Presentation

### Goals

Integrate payment information into the Order workflow only where the backend contract supports it.

### Tasks

- Validate the payment relationship exposed by the backend.
- Integrate payment data with Order Details when available.
- Define payment models and mapping.
- Display supported payment information such as:
  - Payment status
  - Payment reference/identifier
  - Payment method
  - Payment provider
  - Other backend-supported payment metadata
- Reuse existing Admin presentation patterns.
- Keep payment lifecycle/business rules owned by the backend.
- Keep payment presentation inside the Orders feature unless the contract and UI complexity justify a separate feature.
- If payment linkage is not exposed by the backend, document the contract gap instead of creating an assumed endpoint.

### Completion Criteria

- Order-payment presentation matches the actual backend contract.
- No payment business logic is reimplemented in Angular.
- Unsupported payment capabilities are not fabricated.

---

## 14.7 — Payment Details, Status & Failed Payments

### Goals

Provide clear payment-state presentation for Admin users.

### Tasks

- Implement Payment Details presentation according to the available contract.
- Create/reuse a `PaymentStatusBadge`.
- Support all backend-defined payment states required by the contract.
- Display failure information only when supplied by the backend.
- Localize payment statuses and failure messages.
- Avoid frontend-specific interpretation of payment failures.
- Ensure payment state remains presentation of backend truth.

### Completion Criteria

- Supported payment states are rendered consistently.
- Failed payments are represented using backend-provided information.
- Payment lifecycle behavior remains server-owned.

---

## 14.8 — Payment History

### Goals

Implement payment history only if the backend exposes the required capability.

### Tasks

- Verify the existence and shape of payment-history contracts.
- If supported:
  - Add the API integration.
  - Define payment-history models.
  - Display payment-history records.
  - Display timestamps.
  - Display status transitions where available.
  - Display references and metadata supported by the contract.
- If unsupported:
  - Record the contract gap.
  - Do not invent an endpoint such as `GET /orders/{id}/payments`.
  - Do not simulate payment history from unrelated frontend state.

### Completion Criteria

- Payment history is implemented only when contract-supported.
- Unsupported history functionality is explicitly documented.
- No fabricated API capability exists.

---

## 14.9 — Localization, RTL, Responsive & Accessibility Hardening

### Goals

Bring the Orders & Payments experience to the project's existing production UI standards.

### Tasks

- Add all required localization keys.
- Maintain locale support for:
  - `en`
  - `fr`
  - `de`
  - `es`
  - `ar`
- Preserve localization key parity.
- Verify RTL/LTR behavior.
- Verify responsive behavior for:
  - Orders List
  - Filters
  - Order Details
  - Customer information
  - Payment sections
- Verify keyboard navigation.
- Add appropriate semantic labels.
- Verify accessible loading, error, empty, and status states.
- Follow existing theming and UI conventions.

### Completion Criteria

- All supported locales contain the required keys.
- RTL and LTR layouts behave correctly.
- Orders and Payments remain usable across supported screen sizes.
- Accessibility follows the established Admin standards.

---

## 14.10 — Orders & Payments E2E + Integration Verification

### Goals

Verify the complete Admin Orders & Payments workflow.

### Critical Flow

```text
Admin Login
    ↓
Orders
    ↓
Orders List
    ↓
Apply Filters
    ↓
Open Order
    ↓
Order Details
    ↓
Customer Information
    ↓
Payment Information
    ↓
Payment Status
    ↓
Failed Payment (when contract/test data supports it)
```

### Tasks

- Add or update Orders List tests.
- Verify pagination.
- Verify supported filters.
- Verify empty states.
- Verify error states.
- Verify Order Details.
- Verify customer information.
- Verify order-status rendering.
- Verify payment rendering.
- Verify payment-status rendering.
- Verify failed-payment rendering when testable.
- Verify localization.
- Verify RTL behavior.
- Verify Admin authorization.
- Use backend-faithful mocks or test data where live backend behavior is unsuitable for deterministic tests.

### Completion Criteria

- The critical Admin Orders workflow is covered by E2E tests.
- Contract-supported payment flows are covered.
- Existing test suites remain green.

---

## 14.11 — Architecture, Security, Performance & Documentation

### Goals

Complete the phase without violating the established project architecture or quality standards.

### Tasks

#### Architecture

Verify that the implementation follows:

```text
Admin Feature
      ↓
Admin Data Access
      ↓
Shared API Client
```

Ensure there is no:

- Component → direct `HttpClient`
- Component → raw API URL
- Duplicate API client
- Cross-feature internal dependency
- Orders → Catalog internals dependency
- Orders → Inventory internals dependency
- Unauthorized state sharing

#### Security

- Reuse the existing authentication and authorization infrastructure.
- Preserve backend authorization as the source of authority.
- Do not treat hidden UI elements as authorization.
- Verify protected Admin routes and API access.

#### Performance

- Avoid unnecessary API requests.
- Verify pagination behavior.
- Verify filter request behavior.
- Avoid unnecessary subscriptions or state recomputation.
- Preserve the existing Angular performance strategy.

#### Documentation

Update the relevant project documentation:

- `PROJECT_CONTEXT.md`
- `ARCHITECTURE.md`
- Phase 14 documentation
- Completed-phase report
- Contract-gap documentation, when applicable

Document any backend capabilities that remain unavailable to the frontend.

### Completion Criteria

- Architecture checks pass.
- Tests pass.
- No unauthorized architectural dependencies are introduced.
- Documentation reflects the actual implementation.
- Known contract gaps are explicitly recorded.

---

# Phase 14 Completion Checklist

## Contract

- [x] Orders contracts reviewed
- [x] Payment contracts reviewed
- [x] Supported filters identified
- [x] Pagination contract verified
- [x] Order status enums verified
- [x] Payment status enums verified
- [x] Payment linkage verified
- [x] Payment history availability verified
- [x] Contract gaps documented

## Orders

- [x] Orders feature created
- [x] Orders routes added
- [x] Orders API integration completed
- [x] Orders List implemented
- [x] Pagination implemented
- [x] Supported filters implemented
- [x] Order status presentation implemented
- [x] Order Details implemented
- [x] Customer information implemented

## Payments

- [x] Payment integration completed where supported
- [x] Payment status presentation implemented
- [x] Payment details implemented where supported
- [x] Failed payment presentation implemented where supported
- [x] Payment history implemented where supported
- [x] Unsupported payment capabilities documented

## UX

- [x] Localization complete
- [x] Locale key parity verified
- [x] RTL/LTR verified
- [x] Responsive behavior verified
- [x] Accessibility verified
- [x] Loading states verified
- [x] Empty states verified
- [x] Error states verified

## Testing

- [x] Unit tests added
- [x] Component tests added
- [x] API mapping tested
- [x] Pagination tested
- [x] Filtering tested
- [x] Order Details tested
- [x] Payment states tested
- [x] E2E critical flow tested
- [x] Existing test suite remains green

## Architecture & Documentation

- [x] Architecture checks pass
- [x] Authorization verified
- [x] No direct component API access
- [x] No duplicated data-table implementation
- [x] No cross-feature boundary violations
- [x] Performance reviewed
- [x] `PROJECT_CONTEXT.md` updated
- [x] `ARCHITECTURE.md` updated
- [x] Phase 14 completion documented

---

# Phase 14 Dependency Flow

```text
14.1 Contract Alignment
        │
        ▼
14.2 Orders Foundation
        │
        ├──────────────► 14.3 Orders List
        │                       │
        │                       ▼
        │                 14.4 Filtering
        │
        ▼
14.5 Order Details
        │
        ▼
14.6 Payment Integration
        │
        ├──────────────► 14.7 Payment Details / Failed Payments
        │
        └──────────────► 14.8 Payment History
                                │
                                ▼
                    14.9 Localization / UX
                                │
                                ▼
                    14.10 E2E Verification
                                │
                                ▼
                    14.11 Architecture & Documentation
```

## Implementation Rule

**14.1 is the contract gate for the entire phase.**

The implementation of 14.6–14.8 must be determined by the actual backend capabilities discovered during 14.1. The frontend must never fabricate missing payment endpoints, DTOs, history records, filters, or business operations.
