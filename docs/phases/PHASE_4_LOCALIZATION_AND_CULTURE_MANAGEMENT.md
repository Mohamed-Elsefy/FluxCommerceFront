# Phase 4 — Localization & Culture Management

## Objective

Build a centralized, reusable localization and culture-management infrastructure for the Angular 22 application.

Phase 4 is an infrastructure phase. It must provide the foundation required by future features without introducing feature-specific business localization or rebuilding infrastructure already established in previous phases.

The implementation must align with the existing FluxCommerce architecture, the Phase 1 HTTP/request infrastructure, and the Phase 3 theming and centralized RTL/direction foundation.

---

## Scope

### In Scope

- Supported culture model
- Translation resource system
- Translation loading and lookup
- Interpolation
- Missing-key and fallback behavior
- Current culture state
- Language switching
- Culture persistence
- Culture initialization
- Culture-to-direction integration
- Backend culture synchronization
- Date, number, and currency formatting
- Localized validation messages
- API error localization
- SSR and hydration safety
- Unit, integration, SSR, and E2E validation

### Out of Scope

- Catalog-specific translations
- Product localization
- Cart localization
- Checkout localization
- Orders localization
- Admin business localization
- Business-specific forms
- Reimplementation of the Phase 3 RTL/direction system
- Reimplementation of the Phase 3 theme system
- Introduction of a new state-management library solely for localization

---

# Sub-Phases

## 4.1 — Culture Model & Supported Cultures

### Objective

Establish the foundational culture model and a single source of truth for supported application cultures.

### Supported Cultures

- `en`
- `fr`
- `de`
- `es`
- `ar`

### Tasks

- Define the culture model.
- Define the supported culture registry.
- Define the default culture.
- Define culture metadata:
  - culture code
  - display name
  - direction
- Provide centralized culture validation.
- Avoid duplicated culture lists across the application.
- Avoid raw culture strings where a centralized abstraction is appropriate.

### Direction Rules

- `ar` → `rtl`
- `en` → `ltr`
- `fr` → `ltr`
- `de` → `ltr`
- `es` → `ltr`

### Deliverables

- Culture model.
- Supported culture registry.
- Default culture configuration.
- Culture validation utilities.
- Unit tests.

### Acceptance Criteria

- All supported cultures are defined centrally.
- Unsupported cultures are handled deterministically.
- Culture metadata is reusable by other localization infrastructure.
- Arabic resolves to RTL and all other supported cultures resolve to LTR.

---

## 4.2 — Translation Resource System

### Objective

Implement the translation runtime inside `libs/i18n`.

### Tasks

- Define the translation resource structure.
- Define the translation key convention.
- Add base translation resources for:
  - `en`
  - `fr`
  - `de`
  - `es`
  - `ar`
- Implement translation resource loading.
- Implement translation lookup.
- Support nested translation keys where required.
- Support interpolation.
- Define missing-key behavior.
- Define deterministic fallback behavior.

### Example Key Structure

```text
common.actions.save
common.actions.cancel
common.validation.required
errors.unauthorized
errors.network
```

### Deliverables

- Translation resource model.
- Translation loader.
- Translation service/API.
- Base translation resources.
- Missing-key handling.
- Fallback mechanism.
- Unit tests.

### Acceptance Criteria

- Translation values can be resolved by key.
- Interpolation works correctly.
- Missing translations do not cause runtime failures.
- Fallback behavior is deterministic.
- The localization infrastructure remains independent from business feature implementations.

---

## 4.3 — Culture State & Language Switching

### Objective

Provide application-level current-culture state and runtime language switching.

### Tasks

- Create the culture management abstraction.
- Maintain the current culture using the established Angular state approach.
- Expose the current culture through a reactive/signal-based API.
- Implement runtime language switching.
- Implement culture initialization.
- Implement persistence.
- Define culture initialization precedence.

### Suggested Precedence

```text
Persisted Culture
       ↓
Runtime / Browser Preference
       ↓
Application Default
```

The implementation must remain SSR-safe and must not directly depend on browser-only APIs during server initialization.

### Deliverables

- Culture management service/abstraction.
- Current culture signal/state.
- Language switching API.
- Persistence mechanism.
- Initialization logic.
- Unit tests.

### Acceptance Criteria

- The current culture is available through a centralized abstraction.
- The application can switch languages at runtime.
- Switching language does not require a full page reload.
- The selected culture is persisted and restored.
- Initialization is safe for SSR.

---

## 4.4 — Localization & Direction Integration

### Objective

Connect culture changes to the centralized direction mechanism established in Phase 3.

This sub-phase must integrate with the existing RTL foundation rather than create another direction-management system.

### Flow

```text
Current Culture
      ↓
Direction Resolution
      ↓
Phase 3 Direction Mechanism
      ↓
LTR / RTL
```

### Tasks

- Map culture to direction.
- Integrate culture changes with the centralized direction mechanism.
- Support runtime direction changes.
- Ensure the existing RTL-safe UI primitives continue to work.
- Add direction-related tests.

### Acceptance Criteria

- `en → ar` changes the application direction to RTL.
- `ar → en` changes the application direction to LTR.
- `fr`, `de`, and `es` resolve to LTR.
- There is no duplicate direction state.
- `libs/i18n` does not reimplement Phase 3 RTL infrastructure.

---

## 4.5 — Backend Culture Synchronization

### Objective

Propagate the current frontend culture consistently to the FluxCommerce backend through the existing HTTP/request infrastructure.

### Tasks

- Integrate current culture with the existing request-context mechanism.
- Send the current culture with API requests using the established approach.
- Ensure all applicable API requests use the same culture context.
- Ensure a runtime culture change affects subsequent requests.
- Avoid feature-specific culture headers or request handling.

### Flow

```text
Current Culture
      ↓
HTTP / Request Context
      ↓
API Request
      ↓
Backend Culture
```

### Deliverables

- HTTP/request integration.
- Culture propagation.
- Request-context integration.
- Integration tests.

### Acceptance Criteria

- API requests contain the correct culture context.
- New requests use the newly selected culture after a language switch.
- No duplicate culture propagation mechanism is introduced.
- Feature libraries do not need to know how culture is transmitted to the backend.

---

## 4.6 — Formatting & Localized Validation

### Objective

Provide culture-aware formatting infrastructure and localized validation support.

### Formatting Areas

#### Date

```text
Date + Current Culture
        ↓
Localized Date
```

#### Number

```text
Number + Current Culture
          ↓
Localized Number
```

#### Currency

```text
Amount + Currency + Current Culture
              ↓
       Localized Currency
```

### Validation

- Localize common validation messages.
- Support localized required/invalid/general validation messages.
- Integrate with the existing form infrastructure where appropriate.
- Keep business-specific validation messages outside this phase.

### Deliverables

- Date formatting abstraction.
- Number formatting abstraction.
- Currency formatting abstraction.
- Validation localization support.
- Translation resources for common validation messages.
- Unit tests.

### Acceptance Criteria

- Date formatting responds to the active culture.
- Number formatting responds to the active culture.
- Currency formatting responds to the active culture.
- Arabic formatting behaves correctly for the supported locale.
- Validation messages are not hardcoded to English.
- Formatting infrastructure remains business-agnostic.

---

## 4.7 — API Error Localization

### Objective

Connect the normalized API error model from Phase 1 to the localization system.

### Error Flow

```text
API Response
    ↓
Normalized API Error
    ↓
Stable Error Code
    ↓
Localization Mapping
    ↓
Localized Message
    ↓
UI
```

### Tasks

- Define error-code-to-translation-key mapping.
- Localize common API errors.
- Support validation errors.
- Support unauthorized/forbidden errors.
- Support network/general errors.
- Define unknown-error fallback behavior.
- Ensure UI code does not depend on server-generated human-readable messages.

### Example

```text
USER_NOT_FOUND
ORDER_NOT_FOUND
UNAUTHORIZED
VALIDATION_ERROR
```

Mapped to:

```text
errors.userNotFound
errors.orderNotFound
errors.unauthorized
errors.validation
```

### Deliverables

- Error localization mapper.
- Localized error resolver.
- Error translation resources.
- Unit and integration tests.

### Acceptance Criteria

- The same error code produces the correct localized message for each culture.
- Unknown error codes have a deterministic fallback.
- UI does not use backend human-readable error text as business logic.
- Error localization remains independent from individual business features.

---

## 4.8 — SSR, Hydration & End-to-End Validation

### Objective

Validate that localization, culture, direction, and formatting remain consistent across SSR, hydration, runtime switching, and browser reloads.

### SSR Requirements

The following must remain consistent:

```text
Initial Culture
      ↓
SSR
      ↓
Rendered HTML
      ↓
Hydration
      ↓
Same Culture
```

The implementation must prevent cases such as:

```text
Server → Arabic
Client → English
```

or:

```text
Server → RTL
Client → LTR
```

### Unit Testing

Cover:

- Culture validation.
- Culture switching.
- Culture persistence.
- Culture initialization.
- Translation lookup.
- Interpolation.
- Missing translations.
- Fallback behavior.
- Date formatting.
- Number formatting.
- Currency formatting.
- Direction resolution.
- Error-code localization.

### Integration Testing

Cover:

```text
Culture
  ↓
Localization
  ↓
HTTP
  ↓
Backend Culture
```

And:

```text
API Error Code
      ↓
Localized Message
```

### E2E Testing

At minimum, validate:

```text
English
  ↓
Arabic
  ↓
RTL
  ↓
Reload
  ↓
Arabic + RTL
  ↓
English
  ↓
LTR
```

### Acceptance Criteria

- SSR renders using the correct initial culture.
- Hydration does not produce localization-related mismatches.
- Initial direction matches the initial culture.
- Runtime language switching works.
- Culture persistence works after reload.
- Arabic consistently produces RTL behavior.
- Translation resources are available when required by SSR.
- Unit, integration, SSR, E2E, typecheck, lint, build, and architecture checks pass.

---

# Dependency Flow

The recommended implementation order is:

```text
4.1 Culture Model
       ↓
4.2 Translation Resource System
       ↓
4.3 Culture State & Language Switching
       ↓
4.4 Direction Integration
       ↓
4.5 Backend Culture Synchronization
       ↓
4.6 Formatting & Localized Validation
       ↓
4.7 API Error Localization
       ↓
4.8 SSR, Hydration & E2E Validation
```

Testing should be introduced continuously within each sub-phase rather than postponed entirely until 4.8.

---

# Architecture Boundaries

Phase 4 must preserve the following boundaries:

```text
libs/i18n
  → Localization infrastructure

libs/theming
  → Visual/theme infrastructure

libs/ui
  → Business-agnostic presentation

Feature Libraries
  → Feature-owned localized content
```

`libs/i18n` owns localization infrastructure, while individual feature libraries will own feature-specific translation content when those features are implemented.

Localization must not introduce coupling between `libs/ui` and feature/business libraries.

---

# Phase 4 Final Definition of Done

Phase 4 is complete when:

- The five supported cultures are centrally defined.
- Current culture is managed through a centralized abstraction.
- Language switching works at runtime.
- Culture persistence and initialization are implemented.
- Translation resources can be loaded and resolved.
- Interpolation works.
- Missing-key and fallback behavior are deterministic.
- Culture changes integrate with the Phase 3 direction system.
- Arabic produces RTL and the other supported cultures produce LTR.
- Current culture is propagated to the backend through the existing HTTP/request infrastructure.
- Date, number, and currency formatting are culture-aware.
- Common validation messages are localized.
- Normalized API errors can be resolved to localized frontend messages.
- SSR and hydration remain culture-consistent.
- No business feature becomes coupled to localization implementation details.
- No existing Phase 3 RTL or theming infrastructure is duplicated.
- Unit, integration, SSR, E2E, typecheck, lint, build, and architecture checks pass.
- The resulting infrastructure is ready for consumption by Catalog, Cart, Orders, Payments, and future Admin features.

---

# Phase 4 Scope Boundary

The purpose of Phase 4 is to establish the **localization and culture platform**, not to localize the entire application.

Future feature phases should consume this infrastructure rather than introduce their own:

- culture management
- translation loading
- language switching
- RTL/LTR handling
- backend culture propagation
- formatting
- API error localization

Feature-specific translations should be introduced alongside the feature that owns them.
