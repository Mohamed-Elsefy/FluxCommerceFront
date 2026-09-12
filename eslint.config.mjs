// Enforced direction: Applications -> Features -> Shared Libraries.
//
// - apps/storefront and apps/admin must not import each other.
// - Shared libraries (libs/*) are consumed ONLY through their @flux/*
//   barrel entry points (libs/<lib>/src/public-api.ts). Relative
//   traversal into libs/ and deep @flux/<lib>/... imports are forbidden.
// - Libraries must never import from applications (never the reverse).
// - Feature code (apps/*/src/app/features/**) must never import raw
//   HttpClient from '@angular/common/http'. Features consume HTTP exclusively
//   through the typed ApiClient from @flux/api (libs/api is the single
//   sanctioned HttpClient user). Sub-Phase 1.3 boundary:
//   Feature Data Access -> API Client -> HttpClient.
//   ('@angular/common/http/testing' stays allowed for specs.)
// - No features exist yet (they arrive in Sub-Phase 0.5). The convention
//   is fixed now: Feature A must not import Feature B internals; cross-
//   feature needs go through a stable contract, a shared abstraction, or
//   the backend API. The same per-scope pattern below extends to features
//   in 0.5.
// - Sub-Phase 3.1 (UI Architecture Foundation): libs/ui is business-
//   agnostic presentation only and libs/theming is visual infrastructure
//   only. Neither may import any @flux/* barrel (they stay decoupled from
//   each other and from api/auth/i18n/models/utils), business-feature or
//   domain specifiers (catalog, cart, checkout, orders, inventory,
//   payments, auth business logic), application code, or HttpClient.
//   Components consume CSS variables/tokens, never the theme service;
//   apps compose libs/ui + libs/theming, never the reverse.
import tsParser from '@typescript-eslint/parser';

const noLibTraversal = {
  group: ['**libs**'],
  message:
    'Import shared libraries through their @flux/* path alias (barrel entry point). Relative traversal into libs/ is forbidden.',
};

const barrelOnly = {
  group: ['@flux/*/**'],
  message:
    'Import the @flux/<lib> barrel entry point only (libs/<lib>/src/public-api.ts). Deep imports into library internals are forbidden.',
};

const noCrossAppStorefront = {
  group: ['**apps/**', '**admin**'],
  message: 'apps/storefront must not import from apps/admin. Applications are independent.',
};

const noCrossAppAdmin = {
  group: ['**apps/**', '**storefront**'],
  message: 'apps/admin must not import from apps/storefront. Applications are independent.',
};

const noAppFromLibs = {
  group: ['**apps/**', '**storefront**', '**admin**'],
  message:
    'Shared libraries must not import from applications. Dependency direction is apps -> libs, never the reverse.',
};

const noRawHttpClientInFeatures = {
  group: ['@angular/common/http'],
  message:
    'Features must use the typed ApiClient from @flux/api instead of raw HttpClient. Boundary: Feature Data Access -> API Client -> HttpClient.',
};

// Sub-Phase 3.1: libs/ui stays fully decoupled (no @flux/* at all, so UI
// primitives can never reach the theme service, API clients, auth state,
// or business domains). Apps compose UI; UI never reaches back.
const noFluxInUi = {
  group: ['@flux/*'],
  message:
    'libs/ui is business-agnostic presentation only and must not depend on any @flux/* library (including @flux/theming: components consume CSS variables, never the theme service).',
};

// Sub-Phase 3.1: libs/theming is visual infrastructure only (tokens, CSS
// variables, theme mechanics from 3.2/3.3). It must not depend on any
// @flux/* library, including @flux/ui.
const noFluxInTheming = {
  group: ['@flux/*'],
  message:
    'libs/theming is visual infrastructure only and must not depend on any @flux/* library (including @flux/ui).',
};

// Sub-Phase 3.1 defense in depth: presentation infrastructure must never
// resolve business-feature or domain specifiers, even outside @flux/*
// barrels (relative paths, future aliases, type-only imports included).
const noBusinessInPresentation = {
  group: [
    '**catalog**',
    '**cart**',
    '**checkout**',
    '**order**',
    '**inventor**',
    '**payment**',
    '**stripe**',
    '**auth**',
  ],
  message:
    'Presentation infrastructure (libs/ui, libs/theming) must not import business features or domain services (catalog, cart, checkout, orders, inventory, payments, auth business logic).',
};

// Sub-Phase 3.1: presentation renders state owned elsewhere; it never
// performs HTTP. Only libs/api may touch raw HttpClient.
const noHttpInPresentation = {
  group: ['@angular/common/http'],
  message:
    'Presentation infrastructure (libs/ui, libs/theming) must not use HttpClient. Data access belongs to features via the typed ApiClient from @flux/api.',
};

export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.angular/**'] },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-restricted-imports': ['error', { patterns: [noLibTraversal, barrelOnly] }],
    },
  },
  {
    files: ['apps/storefront/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [noLibTraversal, barrelOnly, noCrossAppStorefront] },
      ],
    },
  },
  {
    files: ['apps/admin/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [noLibTraversal, barrelOnly, noCrossAppAdmin] },
      ],
    },
  },
  {
    files: ['libs/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noLibTraversal, barrelOnly, noAppFromLibs] }],
    },
  },
  {
    files: ['libs/ui/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noLibTraversal,
            barrelOnly,
            noAppFromLibs,
            noFluxInUi,
            noBusinessInPresentation,
            noHttpInPresentation,
          ],
        },
      ],
    },
  },
  {
    files: ['libs/theming/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noLibTraversal,
            barrelOnly,
            noAppFromLibs,
            noFluxInTheming,
            noBusinessInPresentation,
            noHttpInPresentation,
          ],
        },
      ],
    },
  },
  {
    files: ['apps/*/src/app/features/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noRawHttpClientInFeatures] }],
    },
  },
  {
    // The documented testing seam: feature specs may use
    // '@angular/common/http/testing' (HttpTestingController) while every
    // other boundary (barrels, traversal, cross-app) keeps applying.
    // Placed after the block above so it takes precedence for spec files.
    files: ['apps/*/src/app/features/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noLibTraversal, barrelOnly] }],
    },
  },
];
