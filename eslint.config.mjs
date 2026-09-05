// Enforced direction: Applications -> Features -> Shared Libraries.
//
// - apps/storefront and apps/admin must not import each other.
// - Shared libraries (libs/*) are consumed ONLY through their @flux/*
//   barrel entry points (libs/<lib>/src/public-api.ts). Relative
//   traversal into libs/ and deep @flux/<lib>/... imports are forbidden.
// - Libraries must never import from applications (never the reverse).
// - No features exist yet (they arrive in Sub-Phase 0.5). The convention
//   is fixed now: Feature A must not import Feature B internals; cross-
//   feature needs go through a stable contract, a shared abstraction, or
//   the backend API. The same per-scope pattern below extends to features
//   in 0.5.
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
];
