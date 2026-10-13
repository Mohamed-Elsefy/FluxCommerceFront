/**
 * `libs/ui` foundation.
 *
 * Owns business-agnostic reusable UI primitives. Only shared building
 * blocks belong here; the complete design system arrives with Phase 3.
 */

/** T-shirt sizes shared by future UI primitives. */
export type ComponentSize = 'sm' | 'md' | 'lg';

/** Spacing scale shared by layout primitives (maps to `--spacing-*` tokens). */
export type LayoutGap = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/** Cross-axis alignment shared by Stack and Flex (logical, direction-aware). */
export type FlexAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';

/** Main-axis distribution shared by Stack and Flex. */
export type FlexJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
