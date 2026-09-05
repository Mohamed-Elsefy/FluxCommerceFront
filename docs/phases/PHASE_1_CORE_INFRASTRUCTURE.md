# Phase 1 — Core Infrastructure

## 1. Overview

Phase 1 establishes the shared frontend infrastructure required for reliable communication between the Angular applications and the ASP.NET Core backend.

The implementation must build on the API contracts already extracted into:

```text
docs/frontend-contract/
```

These contracts remain the source of truth for API consumption. Phase 1 must not introduce a separate API contract package or duplicate the backend contract definition.

The primary objective is to provide a stable foundation that later phases can use for authentication, catalog, cart, checkout, orders, administration, and other business features.

---

## 2. Goals

Phase 1 must provide:

- Centralized HTTP configuration.
- Typed API client infrastructure.
- A clear separation between feature data access and raw `HttpClient` usage.
- Functional HTTP interceptors.
- Consistent API error normalization.
- ProblemDetails handling.
- Correlation/request context handling.
- Request cancellation and lifecycle management.
- Typed query and pagination abstractions.
- Reusable asynchronous resource-state patterns.
- Common loading, empty, and error UI primitives.
- Real backend integration validation.
- Comprehensive unit, HTTP, integration, and architecture tests.
- Documentation and hardening of the resulting infrastructure.

The result should allow future features to consume APIs consistently without implementing their own HTTP, error, pagination, or request-lifecycle mechanisms.

---

## 3. Architectural Flow

The target API communication flow is:

```text
Component
    ↓
Feature Service / Store
    ↓
API Client
    ↓
HttpClient
    ↓
HTTP Interceptors
    ↓
ASP.NET Core API
```

Error handling should follow:

```text
HTTP Error
    ↓
HTTP Interceptor
    ↓
Normalized API Error
    ↓
Stable Error Code
    ↓
Feature State
    ↓
Localized User Message
    ↓
UI
```

Asynchronous resource state should follow:

```text
Idle
  ↓
Loading
  ↓
  ├── Success
  ├── Empty
  └── Error
```

---

# 4. Sub-Phases

## 1.1 — API Contract Integration Foundation

### Objective

Integrate the existing backend API contracts into the Angular development workflow.

### Scope

- Review the structure of `docs/frontend-contract/`.
- Identify:
  - endpoints
  - HTTP methods
  - request models
  - response models
  - query parameters
  - path parameters
  - status codes
  - error contracts
  - pagination contracts
  - required headers
  - authentication requirements
- Determine which contracts should be represented as TypeScript types.
- Determine whether types/client code can be generated from the existing contract format.
- Define rules for keeping generated/manual frontend representations synchronized with the backend contracts.
- Establish naming and mapping conventions.

### Constraints

- `docs/frontend-contract/` is the source of truth.
- Do not create a Phase 0.5 API Contract Package.
- Do not duplicate backend business rules in the frontend.
- Do not invent frontend contracts that contradict the backend contracts.

### Deliverable

A clearly defined Angular representation/consumption strategy for the existing backend API contracts.

---

## 1.2 — HttpClient & API Configuration

### Objective

Establish the centralized HTTP foundation for both Angular applications.

### Scope

- Configure Angular `HttpClient`.
- Use the Angular provider-based HTTP configuration.
- Integrate the existing `libs/api` configuration.
- Centralize API base URL resolution.
- Support:
  - development API configuration
  - production same-origin `/api` configuration
  - Storefront
  - Admin
- Prevent hard-coded API URLs inside features.
- Define shared request configuration/context conventions.

### Deliverable

All API communication can use one consistent HTTP configuration without features managing environment-specific URLs.

---

## 1.3 — Typed API Client Architecture

### Objective

Create a typed abstraction between feature data access and Angular `HttpClient`.

### Scope

- Define the API client architecture.
- Define naming conventions.
- Define typed request/response methods.
- Define path parameter handling.
- Define query parameter serialization.
- Define request body typing.
- Define response typing.
- Determine where generated API code belongs, if generation is applicable.
- Define manual mapping boundaries where generation is not appropriate.

### Required Boundary

Features should follow:

```text
Feature Data Access
        ↓
API Client
        ↓
HttpClient
```

Features must not directly construct scattered raw HTTP requests.

### Deliverable

A reusable typed API client foundation suitable for all future feature modules.

---

## 1.4 — HTTP Interceptor Pipeline

### Objective

Establish the centralized HTTP interceptor pipeline.

### Scope

Implement functional interceptors for responsibilities that belong at the infrastructure level, including:

- Request configuration/context.
- Correlation/request context.
- Authentication integration hooks.
- Error interception.
- Request lifecycle concerns.

The interceptor pipeline must have clearly defined responsibilities and ordering.

### Important Boundary

Phase 1 does **not** implement authentication workflows.

Phase 2 owns:

- login
- registration
- access-token lifecycle
- refresh-token lifecycle
- authentication state
- authentication guards
- authorization behavior

Phase 1 should only provide infrastructure that allows Phase 2 to integrate authentication cleanly.

### Deliverable

A predictable, composable HTTP interceptor pipeline.

---

## 1.5 — API Error Normalization

### Objective

Convert backend and transport errors into a stable frontend error representation.

### Scope

Handle:

- HTTP errors.
- ProblemDetails.
- Validation errors.
- Business/application errors.
- Network failures.
- Unexpected/unrecognized errors.
- Cancellation-related errors.
- Stable backend error codes.
- Correlation identifiers where available.

### Error Model

The exact model must follow the existing backend contracts. Conceptually it may contain:

```text
ApiError
├── status
├── code
├── details/message
├── validationErrors
├── correlationId
└── ...
```

### Rules

Frontend business logic must not depend on human-readable backend error text.

Prefer:

```text
error.code
```

over:

```text
error.message === "Some backend text"
```

Stable error codes will later be connected to the localization infrastructure.

### Deliverable

A normalized error model that features can consume consistently.

---

## 1.6 — Correlation & Request Context

### Objective

Provide consistent correlation/request context between frontend and backend.

### Scope

- Define correlation ID ownership.
- Determine whether IDs are generated by the client, backend, or both.
- Define request header behavior.
- Read correlation information from responses/errors where applicable.
- Attach correlation information to normalized API errors.
- Ensure errors can be traced back to backend requests.

### Target Flow

```text
Angular Request
      ↓
Correlation Context
      ↓
ASP.NET Core API
      ↓
Response / Error
      ↓
Correlation ID
      ↓
Normalized Frontend Error
```

### Deliverable

Traceable API requests and errors across the frontend/backend boundary.

---

## 1.7 — Request Cancellation & Lifecycle

### Objective

Ensure API requests are cancelled when their owning lifecycle or operation no longer requires them.

### Scope

- Use Angular request cancellation mechanisms.
- Use `AbortSignal` where appropriate.
- Integrate `DestroyRef`/lifecycle-aware cancellation where appropriate.
- Use RxJS cancellation operators where they provide clearer semantics.
- Prevent stale requests from overwriting newer state.
- Distinguish cancelled requests from actual failures.

### Important Scenarios

```text
Component destroyed
    ↓
Request cancelled
```

and:

```text
Search A
   ↓
Search B
   ↓
A cancelled/replaced
   ↓
B remains active
```

### Deliverable

Lifecycle-safe API requests without unnecessary work or misleading error states.

---

## 1.8 — Query Parameters & Pagination Abstractions

### Objective

Create reusable typed infrastructure for query-based API endpoints.

### Scope

Support, where defined by the backend contracts:

- Pagination.
- Filtering.
- Sorting.
- Query parameters.
- Search parameters.
- Path/query parameter serialization.

Conceptual abstractions may include:

```text
PaginationRequest
PagedResult<T>
Sort
Filter
QueryParameters
```

The exact names and fields must follow the existing API contracts.

### Target Flow

```text
Feature State
      ↓
Typed Query
      ↓
API Client
      ↓
Query String
      ↓
Backend
```

Features should not manually construct query strings throughout components.

### Deliverable

Reusable typed query/pagination infrastructure.

---

## 1.9 — Resource State Architecture

### Objective

Establish a reusable pattern for asynchronous feature data.

### Scope

Represent the lifecycle of asynchronous resources using Angular Signals and/or feature-level state mechanisms.

The state model should support:

```text
Idle
Loading
Success
Empty
Error
```

Conceptually:

```text
ResourceState<T>
├── status
├── data
├── error
└── ...
```

### Rules

- Resource state is not global state.
- State should remain in the smallest appropriate scope.
- Do not create a global store for all server data.
- Use Signals as the default primitive where appropriate.
- Introduce a feature store only when the feature's complexity justifies it.

### Deliverable

A reusable resource-state pattern that future features can adopt consistently.

---

## 1.10 — Common Async UI States

### Objective

Provide shared UI primitives for common asynchronous states.

### Potential Components

```text
LoadingIndicator
Skeleton
EmptyState
ErrorState
RetryButton
```

The final component set should be based on actual reuse requirements rather than creating unnecessary generic components.

### Responsibility Boundary

Shared UI owns:

> How a state is presented.

Features own:

> When a state occurs and what action should happen.

### Deliverable

Reusable loading, empty, error, and retry presentation primitives.

---

## 1.11 — Real Backend Integration Slice

### Objective

Validate the complete Phase 1 infrastructure against a real backend endpoint.

### Scope

Select a simple endpoint from `docs/frontend-contract/` and implement a minimal end-to-end vertical slice:

```text
Backend Contract
      ↓
Typed API Client
      ↓
HttpClient
      ↓
Interceptors
      ↓
ASP.NET Core API
      ↓
Response
      ↓
Resource State
      ↓
UI
```

Validate, where supported by the selected endpoint:

- Successful response.
- Loading state.
- Empty state.
- API error.
- Validation/business error.
- ProblemDetails.
- Correlation ID.
- Request cancellation.
- Retry behavior where appropriate.

### Deliverable

Proof that the infrastructure works as an integrated system against the real backend.

---

## 1.12 — Testing & Architectural Verification

### Objective

Verify that Phase 1 infrastructure is reliable and respects the project architecture.

### Unit Tests

Test:

- API URL construction.
- Query parameter serialization.
- API client behavior.
- Error normalization.
- ProblemDetails mapping.
- Error code extraction.
- Correlation handling.
- Pagination mapping.
- Resource state transitions.
- Cancellation behavior.

### HTTP Tests

Cover representative cases such as:

```text
Successful request
400 validation error
401 unauthorized
404 not found
409 business/conflict error
500 server error
Network failure
Cancelled request
```

The exact cases should follow the actual backend contracts.

### Integration Tests

Where appropriate, validate infrastructure against the real backend.

### Architecture Verification

Ensure that:

```text
Component
    ↓
Feature Data Access
    ↓
API
    ↓
HttpClient
```

is respected.

Prevent:

```text
Component
    ↓
HttpClient
```

and direct feature-to-feature internal dependencies that violate the architecture.

### Deliverable

A tested and architecturally verified Phase 1 foundation.

---

## 1.13 — Phase Hardening & Documentation

### Objective

Finalize the infrastructure before starting Phase 2.

### Scope

Review:

- Dependency direction.
- Public library APIs.
- Naming conventions.
- Exports.
- Duplicate abstractions.
- Premature abstractions.
- SSR compatibility.
- Storefront/Admin compatibility.
- Error handling boundaries.
- Security boundaries.
- API contract alignment.
- Test coverage.
- Architecture verification.

Update documentation where actual architectural decisions were introduced:

```text
ARCHITECTURE.md
PROJECT_CONTEXT.md
```

### Final Verification

Run the project-level verification suite:

```text
lint
typecheck
unit tests
component tests
build storefront
build admin
SSR verification
E2E smoke tests
architecture verification
```

### Deliverable

A clean, documented, production-oriented Phase 1 foundation ready for Phase 2.

---

# 5. Implementation Dependency Order

The sub-phases should be implemented in the following dependency order:

```text
1.1 API Contract Integration Foundation
        ↓
1.2 HttpClient & API Configuration
        ↓
1.3 Typed API Client Architecture
        ↓
1.4 HTTP Interceptor Pipeline
        ↓
1.5 API Error Normalization
        ↓
1.6 Correlation & Request Context
        ↓
1.7 Request Cancellation & Lifecycle
        ↓
1.8 Query Parameters & Pagination
        ↓
1.9 Resource State Architecture
        ↓
1.10 Common Async UI States
        ↓
1.11 Real Backend Integration Slice
        ↓
1.12 Testing & Architectural Verification
        ↓
1.13 Phase Hardening & Documentation
```

The order may be adjusted when implementation details reveal a technical dependency, but the architectural boundaries must remain unchanged.

---

# 6. Explicitly Out of Scope

Phase 1 must not implement:

- Login.
- Registration.
- Logout workflow.
- Access-token lifecycle.
- Refresh-token lifecycle.
- Authentication state management.
- Authentication guards.
- Authorization/role guards.
- Catalog business features.
- Product pages.
- Cart.
- Checkout.
- Orders.
- Payments.
- Admin business features.
- Global server-data store without architectural justification.
- Backend business logic duplication.
- A new API contract package.

These responsibilities belong to later phases.

---

# 7. Phase 1 Completion Criteria

Phase 1 is complete when:

- [ ] Existing `docs/frontend-contract/` contracts are integrated into the frontend development workflow.
- [ ] Angular `HttpClient` is centrally configured.
- [ ] Storefront and Admin can use the same API infrastructure.
- [ ] API base URLs are centrally managed.
- [ ] Features do not directly depend on raw API URLs.
- [ ] A typed API client architecture is established.
- [ ] Functional HTTP interceptors are implemented.
- [ ] Authentication integration hooks exist without implementing authentication workflows.
- [ ] API errors are normalized consistently.
- [ ] ProblemDetails are handled according to the backend contract.
- [ ] Stable error codes are preserved.
- [ ] Correlation/request context is supported.
- [ ] Request cancellation is lifecycle-safe.
- [ ] Query and pagination abstractions follow backend contracts.
- [ ] Resource state is represented consistently.
- [ ] Common loading/empty/error UI primitives are available where justified.
- [ ] At least one real backend integration slice is working.
- [ ] Infrastructure unit and HTTP tests pass.
- [ ] Architecture verification passes.
- [ ] Storefront build passes.
- [ ] Admin build passes.
- [ ] SSR/hydration remains healthy.
- [ ] Existing E2E smoke tests remain healthy.
- [ ] Lint and typecheck pass.
- [ ] Relevant architecture/project documentation is updated.

---

# 8. Phase 1 Deliverable

The final deliverable is a stable frontend infrastructure layer:

```text
                    FluxCommerce Angular
                           │
          ┌────────────────┴────────────────┐
          │                                 │
      Storefront                           Admin
          │                                 │
          └────────────────┬────────────────┘
                           ↓
                  Feature Data Access
                           ↓
                     API Client
                           ↓
                      HttpClient
                           ↓
                    Interceptors
                           ↓
                    Backend API
                           │
          ┌────────────────┴────────────────┐
          ↓                                 ↓
     API Response                       API Error
          ↓                                 ↓
   Resource State                    Error Normalizer
          ↓                                 ↓
        UI State                    Stable Error Code
                                            ↓
                                            UI
```

Phase 2 and all subsequent business features must build on this foundation rather than introducing independent HTTP, error-handling, pagination, or request-lifecycle mechanisms.
