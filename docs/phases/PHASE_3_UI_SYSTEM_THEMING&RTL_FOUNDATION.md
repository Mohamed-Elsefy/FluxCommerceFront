# Phase 3 — UI System, Theming & RTL Foundation

## 1. Overview

Phase 3 establishes the shared UI foundation for the FluxCommerce Angular frontend.

The goal is to create a scalable, reusable, responsive, theme-aware, and RTL-safe UI foundation that can support the Storefront and Admin applications and future feature phases without prematurely building a large design system.

This phase focuses on presentation infrastructure and application shells. Business-specific UI and feature functionality remain outside this phase.

---

## 2. Goals

Phase 3 aims to establish:

- A clear UI architecture and library boundary.
- Design tokens and CSS variables.
- Light and dark theme support.
- Reusable core UI primitives.
- Reusable layout primitives.
- Storefront application shell.
- Admin application shell.
- Responsive behavior for mobile, tablet, and desktop.
- RTL-safe styling from the beginning.
- Accessible foundational components.
- Component and architectural testing.
- Documentation of UI architecture and conventions.

---

## 3. Scope

### Included

- UI architecture foundation.
- Design tokens.
- CSS custom properties.
- Theme infrastructure.
- Light/Dark themes.
- Core reusable UI components.
- Layout primitives.
- Storefront shell.
- Admin shell.
- Responsive foundation.
- RTL-safe UI foundation.
- Shared shell/navigation components where justified.
- Accessibility hardening.
- Testing and architectural verification.
- Documentation and completion report.

### Excluded

The following remain outside Phase 3:

- Catalog business features.
- Product details business UI.
- Cart functionality.
- Checkout functionality.
- Orders functionality.
- Inventory functionality.
- Feature-specific business state.
- Full localization and translation infrastructure.
- Culture synchronization.
- Localized date/number/currency formatting.
- A large enterprise-wide design system with unnecessary abstractions.

Localization and language/culture management belong to Phase 4.

---

# 4. Sub-Phases

## 3.1 — UI Architecture Foundation

### Objective

Establish the architectural boundaries and conventions for the shared UI and theming infrastructure before implementing components.

### Tasks

- Review the existing workspace structure.
- Define the responsibility of `libs/ui`.
- Define the responsibility of `libs/theming`.
- Define what belongs inside `apps/storefront`.
- Define what belongs inside `apps/admin`.
- Establish rules for shared components versus feature-owned components.
- Establish naming and export conventions.
- Verify dependency direction and library boundaries.
- Ensure shared UI remains business-agnostic.

### Target Structure

```text
libs/
├── ui/
└── theming/

apps/
├── storefront/
└── admin/
```

### Architectural Principle

```text
UI        → Presentation
Theming   → Visual infrastructure
Apps      → Composition
Features  → Business-specific UI
```

### Acceptance Criteria

- UI and theming responsibilities are clearly separated.
- Shared libraries do not depend on business features.
- Storefront and Admin remain application composition layers.
- Component ownership rules are documented.

---

## 3.2 — Design Tokens & CSS Variables

### Objective

Create a centralized visual foundation that prevents repeated hard-coded styling values.

### Token Categories

- Colors.
- Typography.
- Spacing.
- Borders.
- Border radius.
- Shadows/elevation.
- Sizing.
- Z-index.
- Motion.
- Layout.

### Tasks

- Define the minimum required token set.
- Organize tokens by category.
- Create CSS custom properties.
- Establish typography foundations.
- Establish spacing conventions.
- Establish container sizing.
- Establish radius and border conventions.
- Establish elevation/shadow conventions.
- Avoid unnecessary or unused tokens.

### Example

```css
:root {
  --color-primary: ...;
  --color-surface: ...;
  --color-text: ...;

  --spacing-sm: ...;
  --spacing-md: ...;
  --spacing-lg: ...;

  --radius-sm: ...;
  --radius-md: ...;
}
```

### Acceptance Criteria

- Reusable components consume design tokens instead of duplicating visual values.
- Tokens are centralized and consistently named.
- The token system is sufficient for the current UI without becoming over-engineered.

---

## 3.3 — Theme System

### Objective

Implement centralized Light/Dark theme support while remaining SSR- and hydration-safe.

### Themes

```text
Light
Dark
```

### Architecture

```text
ThemeService
     ↓
data-theme
     ↓
CSS Variables
     ↓
UI Components
```

### Tasks

- Create the theme abstraction.
- Implement the Light theme.
- Implement the Dark theme.
- Implement theme switching.
- Define the default theme.
- Implement persistence if required by the architecture.
- Support system preference if included in the approved scope.
- Ensure browser-only APIs are accessed safely.
- Ensure theme initialization is SSR-safe.
- Ensure theme changes do not introduce hydration inconsistencies.
- Keep theme implementation details out of individual UI components.

### Architectural Rule

Components should consume CSS variables/tokens rather than directly depending on the theme service.

```text
ThemeService
      ↓
CSS Variables
      ↓
Button / Card / Input / ...
```

### Acceptance Criteria

- Light and Dark themes work consistently.
- Theme switching is centralized.
- Storefront SSR remains safe.
- Hydration remains stable.
- UI components do not contain duplicated theme logic.

---

## 3.4 — Core UI Primitives

### Objective

Build a focused initial set of reusable presentation components.

### Initial Components

```text
Button
Icon
Input
Badge
Card
Spinner
Alert
Divider
```

Additional controls may be introduced only when justified by actual Phase 3 requirements:

```text
Checkbox
Radio
Select
Textarea
```

### Tasks

For each component:

- Define a stable public API.
- Implement required inputs and outputs.
- Implement supported states.
- Implement disabled state where applicable.
- Implement loading state where applicable.
- Implement keyboard behavior where applicable.
- Implement focus states.
- Ensure accessibility.
- Ensure theme compatibility.
- Ensure RTL-safe styling.
- Add component tests.

### Acceptance Criteria

- Components are reusable and business-agnostic.
- APIs are simple and predictable.
- Components support Light/Dark themes.
- Components are RTL-safe.
- Components meet foundational accessibility requirements.
- Components are covered by appropriate tests.

---

## 3.5 — Layout Primitives

### Objective

Provide reusable layout primitives for consistent page composition.

### Potential Components

```text
Container
Stack
Grid
Flex
Divider
```

Only abstractions with clear and repeated value should be introduced.

### Tasks

- Implement responsive container behavior.
- Implement spacing conventions.
- Implement common flex layouts.
- Implement common grid layouts.
- Establish content width constraints.
- Ensure layouts are RTL-safe.
- Avoid creating abstractions for every individual CSS property.

### Acceptance Criteria

- Common application layouts can be composed without duplicated CSS.
- Layout primitives remain generic and business-agnostic.
- Responsive and RTL behavior is supported.

---

## 3.6 — Storefront Application Shell

### Objective

Build the foundational Storefront application shell without implementing business features.

### Structure

```text
Storefront
│
├── Header
├── Navigation
├── Main Content
└── Footer
```

### Header

Implement:

- Brand/logo area.
- Main navigation entry.
- Authentication-related UI integration points.
- Cart entry placeholder/integration point where required.
- Responsive behavior.
- Theme integration.

Existing authentication behavior from Phase 2 must be reused rather than reimplemented.

### Navigation

Implement:

- Desktop navigation.
- Mobile navigation.
- Active navigation state.
- Keyboard accessibility.
- RTL-safe positioning.

### Footer

Implement:

- Basic footer structure.
- Navigation groups where required.
- Responsive layout.
- RTL-safe layout.

### Main Shell

```text
Header
   ↓
Navigation
   ↓
Router Outlet
   ↓
Footer
```

### Acceptance Criteria

- Storefront has a complete foundational shell.
- Existing application routing remains functional.
- Phase 2 authentication behavior remains intact.
- No Catalog/Cart/Checkout business implementation is introduced.

---

## 3.7 — Admin Application Shell

### Objective

Build the foundational Admin application shell.

### Structure

```text
Admin
│
├── Sidebar
├── Header
└── Main Content
```

### Sidebar

Implement:

- Navigation items.
- Active state.
- Expanded/collapsed behavior where required.
- Mobile behavior.
- RTL-safe positioning.

### Header

Implement:

- Application context.
- User/account area.
- Theme integration where applicable.
- Responsive behavior.

### Main Area

```text
Sidebar
     +
Header
     ↓
Router Outlet
```

### Acceptance Criteria

- Admin has a complete foundational shell.
- Sidebar and header work responsively.
- RTL behavior is supported.
- No Admin business modules are implemented in this phase.

---

## 3.8 — Responsive Foundation

### Objective

Establish consistent responsive behavior across the shared UI and application shells.

### Target Viewports

```text
Mobile
Tablet
Desktop
```

### Tasks

- Define responsive breakpoints.
- Implement responsive containers.
- Implement responsive spacing where required.
- Implement responsive typography where required.
- Implement responsive headers.
- Implement Storefront mobile navigation.
- Implement Admin mobile sidebar behavior.
- Handle content overflow correctly.
- Validate layouts across supported viewport sizes.

### Architectural Rule

Prefer one component with responsive styling/behavior:

```text
One Component
     ↓
Responsive CSS / Behavior
```

Avoid separate Desktop/Mobile/Tablet components unless a genuine architectural reason exists.

### Acceptance Criteria

- Core UI works across supported viewport sizes.
- Storefront and Admin shells adapt correctly.
- No unnecessary device-specific component duplication exists.

---

## 3.9 — RTL Foundation

### Objective

Make RTL a first-class UI concern from the beginning rather than retrofitting it later.

### Tasks

Prefer CSS logical properties:

```css
margin-inline
padding-inline
inset-inline
border-inline
```

Instead of unnecessary physical-direction properties:

```css
margin-left
margin-right
padding-left
padding-right
```

Prefer:

```css
text-align: start;
```

where appropriate.

### Verification Areas

Test:

- Header.
- Navigation.
- Sidebar.
- Footer.
- Forms.
- Cards.
- Dialogs.
- Icons and directional icons.
- Spacing.
- Positioning.
- Responsive layouts.

### Acceptance Criteria

- Foundational components behave correctly in LTR.
- Foundational components behave correctly in RTL.
- No systemic LTR-only assumptions are introduced.
- RTL is supported without duplicating components.

### Phase Boundary

Phase 3 establishes RTL-safe UI.

Phase 4 will implement:

- Translation infrastructure.
- Language switching.
- Culture management.
- Direction switching based on language/culture.
- Localized formatting.
- Localized validation and API errors.

---

## 3.10 — Navigation & Shared Shell Components

### Objective

Consolidate genuinely reusable shell components while preserving application and feature ownership.

### Potential Components

```text
Header
Navigation
Sidebar
Footer
Breadcrumb
PageHeader
MobileMenu
UserMenu
ThemeToggle
```

These should only be moved to shared libraries when they are:

1. Actually reusable.
2. Business-agnostic.
3. Stable enough to justify a shared abstraction.

### Ownership Rule

Generic component:

```text
libs/ui
└── Card
```

Feature-specific component:

```text
apps/storefront
└── features/
    └── catalog/
        └── ProductCard
```

Do not move business-specific components into `libs/ui` merely because they may eventually be reused.

### Acceptance Criteria

- Shared shell components have clear ownership.
- Business-specific components remain feature-owned.
- Shared libraries do not become coupled to application features.

---

## 3.11 — Accessibility & UX Hardening

### Objective

Establish accessibility and interaction-quality standards for the foundational UI.

### Tasks

- Use semantic HTML.
- Implement keyboard navigation.
- Provide visible focus states.
- Use accessible buttons and links.
- Implement accessible form controls.
- Add ARIA only where appropriate.
- Ensure dialogs are accessible.
- Ensure navigation is keyboard accessible.
- Verify color contrast.
- Implement disabled/loading interaction states.
- Verify interactive feedback.

### Example

Prefer:

```html
<button type="button">
```

over using a generic clickable element for button behavior.

### Acceptance Criteria

- Core components are keyboard accessible.
- Interactive elements use appropriate semantic HTML.
- Focus states are visible.
- Accessibility concerns are addressed without unnecessary ARIA complexity.

---

## 3.12 — Testing & Architectural Verification

### Objective

Verify that the Phase 3 foundation is behaviorally correct and architecturally sound.

### Unit Tests

Cover relevant:

- Theme logic.
- UI component behavior.
- State transitions.
- Responsive behavior where logic exists.

### Component Tests

Prioritize:

```text
Button
Input
Card
Dialog
Navigation
Header
Sidebar
Footer
```

### Verification Matrix

| Dimension | Cases |
|---|---|
| Theme | Light / Dark |
| Direction | LTR / RTL |
| Viewport | Mobile / Tablet / Desktop |
| Component State | Default / Hover / Focus / Disabled / Loading |

### Architectural Verification

Verify that:

```text
libs/ui
   ↓
does not depend on business features
```

and:

```text
libs/theming
   ↓
contains visual infrastructure only
```

Avoid dependencies such as:

```text
UI → Catalog
UI → Cart
UI → Orders
UI → Authentication business logic
```

### Acceptance Criteria

- Relevant unit/component tests pass.
- Type checking passes.
- Build verification passes.
- Architectural boundaries remain valid.
- Critical Light/Dark and LTR/RTL combinations are verified.
- Storefront SSR/hydration remains valid.

---

## 3.13 — Documentation & Phase Completion

### Objective

Document the UI foundation and formally close Phase 3.

### Documentation Updates

Update:

```text
ARCHITECTURE.md
PROJECT_CONTEXT.md
```

Document:

- UI architecture.
- Library responsibilities.
- Design token conventions.
- Theme architecture.
- RTL rules.
- Responsive rules.
- Component ownership rules.
- Shared component guidelines.

### Completion Report

Create:

```text
docs/phases/PHASE_3_COMPLETION_REPORT.md
```

The report should include:

- Completed sub-phases.
- Implemented components.
- Architecture decisions.
- Design token implementation.
- Theme implementation.
- Responsive implementation.
- RTL implementation.
- Accessibility improvements.
- Testing results.
- Architectural verification results.
- Known limitations.
- Deferred work.
- Final completion status.

---

# 5. Recommended Execution Order

```text
3.1  UI Architecture Foundation
 ↓
3.2  Design Tokens & CSS Variables
 ↓
3.3  Theme System
 ↓
3.4  Core UI Primitives
 ↓
3.5  Layout Primitives
 ↓
3.6  Storefront Application Shell
 ↓
3.7  Admin Application Shell
 ↓
3.8  Responsive Foundation
 ↓
3.9  RTL Foundation
 ↓
3.10 Navigation & Shared Shell Components
 ↓
3.11 Accessibility & UX Hardening
 ↓
3.12 Testing & Architectural Verification
 ↓
3.13 Documentation & Phase Completion
```

---

# 6. Phase 3 Definition of Done

Phase 3 is complete when:

- The shared UI architecture is established.
- `libs/ui` has a focused set of reusable presentation primitives.
- `libs/theming` provides the visual/theme foundation.
- Design tokens and CSS variables are established.
- Light and Dark themes work correctly.
- Storefront has a complete foundational application shell.
- Admin has a complete foundational application shell.
- Responsive behavior works across Mobile, Tablet, and Desktop.
- Foundational UI is RTL-safe.
- Accessibility requirements are addressed.
- Phase 2 authentication behavior remains integrated without duplication.
- Unit/component tests pass.
- Type checking passes.
- Build and SSR/hydration verification pass.
- Architectural boundaries are verified.
- Project documentation is synchronized.
- `PHASE_3_COMPLETION_REPORT.md` is created.

---

# 7. Final Architectural Outcome

The expected foundation after Phase 3 is:

```text
                    FluxCommerce Angular
                           │
          ┌────────────────┴────────────────┐
          │                                 │
      Storefront                          Admin
          │                                 │
      App Shell                         App Shell
          │                                 │
      Shared UI ──────────────── Theming System
          │                         │
          └───────────┬─────────────┘
                      │
               Design Tokens
                      │
          ┌───────────┴───────────┐
          │           │           │
        Light       Dark       RTL/LTR
          │           │           │
          └───────────┬───────────┘
                      │
                Responsive UI
                      │
                 Tested UI
```

The result should be a stable UI foundation that future FluxCommerce feature phases can consume without rebuilding the application's visual architecture or introducing inconsistent styling patterns.
