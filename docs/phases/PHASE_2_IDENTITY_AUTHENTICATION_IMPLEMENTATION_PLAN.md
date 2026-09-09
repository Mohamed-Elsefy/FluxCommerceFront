# Phase 2 --- Identity & Authentication

## 1. Purpose

Phase 2 establishes Identity & Authentication as a first-class frontend
platform capability on top of the infrastructure completed in Phase 1.

The phase is responsible for authentication, session management, token
lifecycle, authorization-aware routing, and the minimum UI integration
required to support an authenticated storefront and a protected Admin
foundation.

Phase 2 must consume the existing API infrastructure and frontend
contracts. It must not recreate or duplicate responsibilities already
completed in Phase 1.

------------------------------------------------------------------------

## 2. Phase Goal

By the end of Phase 2, FluxCommerce Angular must support:

-   User registration
-   User login
-   User logout
-   Session restoration
-   Current-user state
-   Access-token management
-   Refresh-token lifecycle
-   Centralized `401 Unauthorized` recovery
-   Authentication guards
-   Role-based guards
-   Protected Admin route foundation
-   Email verification entry points
-   Password recovery entry points
-   SSR-safe authentication behavior
-   Automated authentication test coverage

The final result is:

``` text
Anonymous User
      |
      +---- Public Storefront
      |
      +---- Login / Register
                 |
                 v
        Authenticated Session
                 |
        +--------+--------+
        |                 |
        v                 v
   Storefront          Admin
   Customer            Role Protected
   Routes              Routes
        |
        v
   Access Token
        |
        v
   API Requests
        |
        v
   Access Token Expired
        |
        v
   Refresh Token
        |
        v
   Retry Original Request
```

------------------------------------------------------------------------

## 3. Architectural Principles

### 3.1 Reuse Phase 1 Infrastructure

Phase 2 must build on:

-   Existing API client
-   Existing HTTP infrastructure
-   Existing error normalization
-   Existing request context / correlation mechanisms
-   Existing cancellation mechanisms
-   Existing `ACCESS_TOKEN_PROVIDER` integration point
-   Existing frontend API contracts

No parallel HTTP or authentication transport layer should be introduced.

### 3.2 Authentication vs Authorization

Authentication answers:

``` text
"Who is the current user?"
```

Authorization answers:

``` text
"Is this user allowed to access this resource?"
```

The frontend may provide route guards and role-aware navigation, but the
backend remains the authoritative security boundary.

Angular guards are navigation protection and UX mechanisms, not a
replacement for backend authorization.

### 3.3 Authentication as a Platform Capability

Authentication is a cross-cutting platform capability.

It should not be implemented inside individual storefront features such
as Catalog, Cart, Wishlist, or Orders.

Feature code should consume stable authentication abstractions instead
of directly managing tokens or session state.

### 3.4 Minimal Global State

Authentication and current-user information are legitimate global
concerns.

Use a small, explicit Signal-based state model unless actual complexity
justifies introducing a larger state-management solution.

Do not turn authentication state into a general-purpose application
store.

### 3.5 SSR and Hydration Safety

Authentication must remain compatible with Angular SSR and hydration.

Browser-only APIs must not be accessed directly from code that can
execute during server rendering.

Session restoration must not cause hydration inconsistencies or
premature route redirects.

------------------------------------------------------------------------

# 4. Sub-Phase Plan

## 4.1 --- Identity Contract Integration

### Objective

Integrate the existing Identity API contracts into the Angular
application.

### Scope

Use the contracts already available under:

``` text
docs/frontend-contract/
```

Cover the Identity endpoints required by the phase:

``` text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me

POST /auth/verify-email
POST /auth/resend-verification

POST /auth/forgot-password
POST /auth/reset-password
POST /auth/change-password
```

### Tasks

-   Review Identity request and response contracts.
-   Define frontend API types where required.
-   Define Identity API service methods.
-   Map contract DTOs to frontend models where appropriate.
-   Preserve backend error codes and validation semantics.
-   Avoid introducing new API contracts outside the existing contract
    source.

### Deliverables

-   Identity API types
-   Identity API service
-   Contract-to-model mappings where required
-   Integration with the existing Phase 1 API client

### Acceptance Criteria

-   All Identity requests use the Phase 1 API infrastructure.
-   No duplicate HTTP client is introduced.
-   No contract drift is introduced.

------------------------------------------------------------------------

## 4.2 --- Authentication State & Session Foundation

### Objective

Create the central authentication state model.

### Scope

Establish stable abstractions for:

``` text
AuthService
AuthSession
AuthState
CurrentUser
```

### Recommended State Model

``` text
Initializing
    |
    +---- Anonymous
    |
    +---- Authenticated
```

The state should provide access to:

-   Authentication status
-   Current user
-   Access token state
-   Roles
-   Initialization status

### Tasks

-   Create authentication state.
-   Create session abstraction.
-   Create current-user state.
-   Create derived authentication selectors.
-   Create derived role selectors.
-   Define state transition rules.
-   Keep authentication state separate from feature state.

### Deliverables

-   Central authentication state
-   Session abstraction
-   Current-user state
-   Authentication status selectors
-   Role selectors

### Acceptance Criteria

-   Components do not manage authentication state independently.
-   Token lifecycle logic is centralized.
-   Authentication state has explicit initialization semantics.

------------------------------------------------------------------------

## 4.3 --- Token Storage & Session Model

### Objective

Define and implement the frontend token/session persistence strategy.

### Scope

Determine how the frontend manages:

-   Access token
-   Refresh token
-   Session restoration
-   Session clearing
-   SSR behavior

### Tasks

-   Define token storage abstraction.
-   Implement an SSR-safe storage mechanism.
-   Define session creation behavior.
-   Define session replacement behavior after token refresh.
-   Define session cleanup behavior.
-   Prevent sensitive token values from being logged.
-   Document the selected storage strategy and its security
    implications.

### Security Considerations

Evaluate:

``` text
Access Token Exposure
Refresh Token Exposure
XSS Risk
Browser Storage
SSR
Token Lifetime
Refresh Rotation
```

The frontend must not store passwords or unnecessary sensitive
information.

### Deliverables

-   Token storage abstraction
-   SSR-safe implementation
-   Session persistence strategy
-   Session clearing mechanism
-   Documented storage decision

------------------------------------------------------------------------

## 4.4 --- Login & Registration

### Objective

Implement the first complete authentication vertical slice.

### Login Flow

``` text
Login Form
    |
    v
Validation
    |
    v
Login API
    |
    v
Store Session
    |
    v
Load Current User
    |
    v
Authenticated
    |
    v
Redirect
```

### Registration Flow

``` text
Register Form
    |
    v
Validation
    |
    v
Register API
    |
    v
Registration Result
    |
    v
Pending / Verification State
```

Registration behavior must follow the backend contract exactly.

Registration must not assume that successful account creation
automatically means the user is authenticated if email verification or
another backend condition is required.

### UI Scope

Implement only the authentication UI required for the phase:

-   Login page
-   Registration page
-   Authentication forms
-   Form validation
-   Loading states
-   API error presentation
-   Authentication success/failure states
-   Navigation behavior

Do not build the complete application Design System in this phase.

### Deliverables

-   Working login
-   Working registration
-   Authentication forms
-   Validation
-   API error handling
-   Authentication navigation

------------------------------------------------------------------------

## 4.5 --- Access Token Integration

### Objective

Activate the authentication integration point prepared in Phase 1.

### Flow

``` text
Authenticated Session
       |
       v
API Request
       |
       v
Authentication Interceptor
       |
       v
Authorization: Bearer <access-token>
       |
       v
Backend
```

### Tasks

-   Connect authentication state to `ACCESS_TOKEN_PROVIDER`.
-   Attach access tokens centrally.
-   Keep token handling out of feature services.
-   Prevent token values from appearing in logs.
-   Ensure anonymous requests remain valid.

### Deliverable

A centralized access-token injection mechanism.

### Acceptance Criteria

Any authenticated API request receives the correct access token without
feature-specific authentication code.

------------------------------------------------------------------------

## 4.6 --- Refresh Token Lifecycle

### Objective

Implement access-token expiration recovery using the backend
refresh-token contract.

### Successful Refresh

``` text
401
 |
 v
Refresh
 |
 v
Success
 |
 v
Update Session
 |
 v
Retry Original Request
```

### Failed Refresh

``` text
401
 |
 v
Refresh
 |
 v
Failure
 |
 v
Clear Session
 |
 v
Anonymous
 |
 v
Login
```

### Single-Flight Refresh

Concurrent expired requests must not trigger multiple refresh
operations.

Incorrect:

``` text
Request A -> 401 ----+
Request B -> 401 ----+--> Multiple Refresh Requests
Request C -> 401 ----+
```

Required behavior:

``` text
Request A -> 401 ----+
Request B -> 401 ----+--> ONE Refresh Operation
Request C -> 401 ----+          |
                              v
                       New Access Token
                              |
                 +------------+------------+
                 |            |            |
                 v            v            v
              Retry A      Retry B      Retry C
```

### Loop Prevention

The implementation must prevent:

``` text
401
 |
Refresh
 |
401
 |
Refresh
 |
401
 |
...
```

### Deliverables

-   Refresh mechanism
-   Single-flight refresh coordination
-   Session replacement
-   Original-request retry
-   Refresh failure handling
-   Refresh loop prevention

------------------------------------------------------------------------

## 4.7 --- Centralized 401 Recovery

### Objective

Complete the centralized HTTP authentication pipeline.

### Required Flow

``` text
HTTP Request
      |
      v
Attach Access Token
      |
      v
Backend
      |
 +----+----+
 |         |
200       401
 |         |
 v         v
Response  Refresh Eligibility
              |
              v
            Refresh
              |
        +-----+-----+
        |           |
      Success      Failure
        |           |
        v           v
      Retry      Clear Session
```

### Tasks

-   Define refresh-eligible requests.
-   Exclude the refresh endpoint from refresh recursion.
-   Retry an eligible original request at most once.
-   Preserve cancellation semantics.
-   Handle concurrent `401` responses.
-   Clear authentication state after unrecoverable authentication
    failure.
-   Preserve non-authentication errors.

### Deliverable

A centralized `401 Unauthorized` recovery mechanism integrated with
Phase 1 HTTP infrastructure.

------------------------------------------------------------------------

## 4.8 --- Session Restoration & Current User

### Objective

Restore authentication state safely during application startup.

### Flow

``` text
Application Startup
       |
       v
Initialize Auth
       |
       v
Read Session
       |
   +---+---+
   |       |
   v       v
 No      Exists
   |       |
   v       v
Anonymous Restore / Validate
             |
             v
        Current User
             |
             v
        Authenticated
```

### Tasks

-   Initialize authentication state at application startup.
-   Restore persisted session information.
-   Restore or load current user.
-   Define behavior for invalid/expired sessions.
-   Expose initialization state.
-   Ensure guards wait for authentication initialization.
-   Ensure anonymous startup remains fast and stable.
-   Keep restoration SSR-safe.

### Critical Rule

A guard must not treat:

``` text
Initializing
```

as:

``` text
Anonymous
```

Premature redirects must be prevented.

### Deliverables

-   Authentication initialization
-   Session restoration
-   Current-user loading
-   Initialization state
-   SSR-safe restoration

------------------------------------------------------------------------

## 4.9 --- Logout & Session Cleanup

### Objective

Implement complete logout behavior.

### Flow

``` text
Logout
  |
  v
Backend Logout
  |
  v
Refresh Token Revocation
  |
  v
Clear Client Session
  |
  v
Clear Current User
  |
  v
Anonymous
  |
  v
Redirect
```

### Tasks

-   Integrate logout API.
-   Clear access-token state.
-   Clear refresh-token state.
-   Clear current-user state.
-   Clear derived authentication state.
-   Define behavior when backend logout fails.
-   Redirect after logout.
-   Prevent stale authenticated state from remaining in the application.

### Deliverables

-   Backend logout integration
-   Complete client session cleanup
-   Current-user cleanup
-   Post-logout navigation

------------------------------------------------------------------------

## 4.10 --- Email Verification & Password Recovery

### Objective

Implement the minimum Identity lifecycle required to make authentication
complete without turning Phase 2 into the full Customer Account feature.

### Scope

Implement entry points for:

``` text
Email Verification
Resend Verification

Forgot Password
Reset Password
```

Password change functionality may be integrated where required by the
Identity flow, but full customer account management remains outside this
phase.

### Explicitly Out of Scope

``` text
Customer Profile
Addresses
Order History
Customer Dashboard
Account Preferences
```

These belong to later Customer Account work.

### Deliverables

-   Email verification flow
-   Resend verification flow
-   Forgot-password flow
-   Reset-password flow
-   Appropriate authentication state transitions

------------------------------------------------------------------------

## 4.11 --- Authentication Guards

### Objective

Protect authenticated routes.

### Auth Guard

``` text
Route
 |
 v
Auth Guard
 |
 v
Authenticated?
 |
 +---- Yes ---> Allow
 |
 +---- No ----> Login
```

### Tasks

-   Implement authentication guard.
-   Handle `Initializing` state correctly.
-   Preserve intended return URL where appropriate.
-   Redirect unauthenticated users to login.
-   Avoid duplicating authentication logic in route components.

### Deliverable

Reusable authentication route guard.

------------------------------------------------------------------------

## 4.12 --- Role Guards & Admin Foundation

### Objective

Provide role-based route protection for the future Admin application.

### Flow

``` text
Route
 |
 v
Auth Guard
 |
 v
Role Guard
 |
 v
Required Role?
 |
 +---- Yes ---> Allow
 |
 +---- No ----> Forbidden / Access Denied
```

### Scope

Support the backend-defined role model, including roles such as:

``` text
Customer
Admin
SuperAdmin
```

The exact role values must come from the existing Identity contracts and
backend implementation.

### Admin Scope

Phase 2 creates only the foundation:

-   Authenticated Admin route
-   Role protection
-   Protected Admin shell/entry point
-   Unauthorized/forbidden navigation behavior

It does not implement the Admin Portal itself.

### Deliverables

-   Role guard
-   Required-role route configuration
-   Protected Admin route foundation
-   Forbidden handling

------------------------------------------------------------------------

## 4.13 --- Authentication UI Integration

### Objective

Integrate authentication state into the application shell using minimal
UI.

### Storefront

Provide basic integration for:

``` text
Header
 |
 +-- Login
 +-- Register
 +-- Current User
 +-- Logout
```

The complete Header, Layout, Design System, Theme, and RTL work belongs
to Phase 3.

### Authentication States

UI must support:

``` text
Initializing
Anonymous
Authenticated
Loading
Error
Unauthorized
Forbidden
```

### Admin

Provide only the protected entry foundation required to validate
authentication and role-based access.

------------------------------------------------------------------------

## 4.14 --- Testing & Security Verification

### Objective

Validate authentication behavior at unit, integration, and E2E levels.

Testing must cover the critical authentication lifecycle rather than
only isolated methods.

### Unit Tests

#### Authentication State

-   Initializing state
-   Anonymous state
-   Authenticated state
-   Login transition
-   Logout transition
-   Session restoration
-   Session clearing

#### Token Management

-   Token exists
-   Token missing
-   Token replacement
-   Token clearing

#### Guards

-   Authenticated user allowed
-   Anonymous user redirected
-   Correct role allowed
-   Incorrect role denied
-   Initialization handled correctly

#### Refresh

-   `401` triggers refresh
-   Successful refresh
-   Failed refresh
-   Original request retry
-   Retry limit
-   Refresh loop prevention
-   Concurrent `401` handling

### HTTP Tests

Verify:

``` text
Authorization header
401 handling
Refresh request
Refresh success
Original request retry
Refresh failure
Concurrent 401 responses
Single refresh operation
Refresh endpoint exclusion
Infinite-loop prevention
Cancellation behavior
```

### Integration Tests

At minimum:

``` text
Register
   |
Verify
   |
Login
   |
Authenticated API Request
   |
Access Token Expiration
   |
Refresh
   |
Continue Request
   |
Logout
```

### E2E Tests

Critical flows:

-   Register
-   Login
-   Access protected route
-   Logout
-   Session restoration
-   Expired access token
-   Successful token refresh
-   Refresh failure
-   Customer access
-   Admin access
-   Non-admin access denied

------------------------------------------------------------------------

## 4.15 --- SSR, Security & Production Verification

### SSR Verification

Test:

``` text
Anonymous SSR
Authenticated Session Restoration
Hydration
Browser-only APIs
Protected Route Initialization
```

### Security Verification

Confirm:

-   Access tokens are not logged.
-   Refresh tokens are not logged.
-   Passwords are never persisted.
-   Authentication logic is centralized.
-   Feature services do not manipulate tokens directly.
-   UI visibility is not treated as authorization.
-   Backend authorization remains authoritative.
-   Logout clears local authentication state.
-   Refresh failures cannot leave stale authenticated state.

### Production Verification

Verify:

-   Error handling
-   Cancellation
-   Race conditions
-   Refresh concurrency
-   Navigation behavior
-   SSR behavior
-   Session persistence
-   Session invalidation
-   Role-based access

------------------------------------------------------------------------

## 4.16 --- Documentation & Phase Completion

### Objective

Synchronize project documentation after implementation.

### Update

``` text
docs/PROJECT_CONTEXT.md
docs/ARCHITECTURE.md
docs/phases/
docs/adr/
```

### Document

-   Authentication architecture
-   Session lifecycle
-   Token storage strategy
-   Refresh strategy
-   Single-flight refresh behavior
-   Guard architecture
-   Role authorization model
-   SSR considerations
-   Security decisions
-   Important ADRs

### Completion Report

Create a Phase 2 completion report containing:

-   Implemented capabilities
-   Architecture decisions
-   Test results
-   Security verification
-   SSR verification
-   Known limitations
-   Deferred work
-   Documentation changes

------------------------------------------------------------------------

# 5. Implementation Dependency Order

The recommended execution order is:

``` text
2.1 Identity Contract Integration
        |
        v
2.2 Authentication State & Session Foundation
        |
        v
2.3 Token Storage & Session Model
        |
        v
2.4 Login & Registration
        |
        v
2.5 Access Token Integration
        |
        v
2.6 Refresh Token Lifecycle
        |
        v
2.7 Centralized 401 Recovery
        |
        v
2.8 Session Restoration & Current User
        |
        v
2.9 Logout & Session Cleanup
        |
        v
2.10 Email Verification & Password Recovery
        |
        v
2.11 Authentication Guards
        |
        v
2.12 Role Guards & Admin Foundation
        |
        v
2.13 Authentication UI Integration
        |
        v
2.14 Testing & Security Verification
        |
        v
2.15 SSR / Production Verification
        |
        v
2.16 Documentation & Completion
```

------------------------------------------------------------------------

# 6. Phase 2 Definition of Done

Phase 2 is complete only when all of the following are true:

### Authentication

-   [ ] Login works against the real Identity API.
-   [ ] Registration works against the real Identity API.
-   [ ] Logout works against the real Identity API.
-   [ ] Current user is available through a centralized abstraction.
-   [ ] Session restoration works.
-   [ ] Authentication initialization is explicit.

### Token Lifecycle

-   [ ] Access tokens are centrally attached to authenticated requests.
-   [ ] Refresh tokens are handled through the backend contract.
-   [ ] Access-token expiration triggers refresh.
-   [ ] Successful refresh retries the original request.
-   [ ] Refresh failures clear the session.
-   [ ] Concurrent `401` responses result in one refresh operation.
-   [ ] Infinite refresh loops are prevented.

### Authorization

-   [ ] Authentication guard works.
-   [ ] Role guard works.
-   [ ] Protected Admin route foundation works.
-   [ ] Forbidden behavior is handled.
-   [ ] Backend remains the authoritative authorization boundary.

### Identity Lifecycle

-   [ ] Email verification entry point works.
-   [ ] Resend verification works.
-   [ ] Forgot-password flow works.
-   [ ] Reset-password flow works.

### SSR & Security

-   [ ] Authentication is SSR-safe.
-   [ ] Hydration remains stable.
-   [ ] Browser-only APIs are isolated appropriately.
-   [ ] Tokens are not logged.
-   [ ] Passwords are never persisted.
-   [ ] Authentication logic is centralized.

### Testing

-   [ ] Authentication state unit tests pass.
-   [ ] Guard unit tests pass.
-   [ ] HTTP authentication tests pass.
-   [ ] Refresh concurrency tests pass.
-   [ ] Integration authentication flows pass.
-   [ ] Critical E2E authentication flows pass.

### Documentation

-   [ ] Architecture documentation is synchronized.
-   [ ] Project context is synchronized.
-   [ ] Relevant ADRs are documented.
-   [ ] Phase 2 completion report is created.

------------------------------------------------------------------------

# 7. Explicit Non-Goals

The following are intentionally outside Phase 2:

-   Complete UI Design System
-   Dark/Light Theme System
-   Complete RTL implementation
-   Full localization/i18n
-   Catalog UI
-   Product Details UI
-   Cart
-   Wishlist
-   Checkout
-   Payments
-   Orders
-   Complete Customer Account
-   Customer Dashboard
-   Admin Dashboard
-   Admin Catalog Management
-   Admin Inventory Management
-   OAuth / Social Login
-   MFA
-   Passkeys

These capabilities belong to later phases of the roadmap.

------------------------------------------------------------------------

# 8. Phase 2 Architectural Outcome

The target architecture after Phase 2 is:

``` text
                         FluxCommerce Angular
                                  |
                 +----------------+----------------+
                 |                                 |
                 v                                 v
        Storefront Application             Admin Foundation
                 |                                 |
                 +----------------+----------------+
                                  |
                                  v
                         Identity Capability
                                  |
              +-------------------+-------------------+
              |                   |                   |
              v                   v                   v
        Authentication      Authorization       Current User
              |                   |                   |
       +------+------+       +----+----+              |
       |      |      |       |         |              |
     Login  Session Token   Auth     Role             |
     Register Restore       Guard    Guard            |
     Logout                 |         |               |
       |                    +----+----+               |
       +-------------------------+--------------------+
                                 |
                                 v
                         Phase 1 API Infrastructure
                                 |
                                 v
                              Backend
```

Phase 2 therefore establishes the authentication and authorization
foundation required by the remaining FluxCommerce Angular roadmap.

The next phases should consume this capability rather than reimplement
authentication logic inside individual features.
