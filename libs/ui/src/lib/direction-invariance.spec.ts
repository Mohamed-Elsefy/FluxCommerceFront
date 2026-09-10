/**
 * Direction-invariance tests for Sub-Phase 3.12 — Testing & Architectural
 * Verification.
 *
 * Proves the RTL contract behaviorally: every shared primitive renders
 * byte-identical markup under `dir="ltr"` and `dir="rtl"`. Direction
 * response must flow exclusively through CSS logical properties (audited
 * statically); no component may branch its rendering on direction, and no
 * per-direction markup variants may exist. Document direction switching
 * itself arrives with Phase 4 (`libs/i18n`).
 */

import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { Alert } from './alert/alert';
import { Badge } from './badge/badge';
import { Button } from './button/button';
import { Card } from './card/card';
import { Container } from './container/container';
import { Divider } from './divider/divider';
import { EmptyState } from './empty-state/empty-state';
import { ErrorState } from './error-state/error-state';
import { Flex } from './flex/flex';
import { Grid } from './grid/grid';
import { Icon } from './icon/icon';
import { Input } from './input/input';
import { LoadingIndicator } from './loading-indicator/loading-indicator';
import { RetryButton } from './retry-button/retry-button';
import { Skeleton } from './skeleton/skeleton';
import { Spinner } from './spinner/spinner';
import { Stack } from './stack/stack';
import { ThemeToggle } from './theme-toggle/theme-toggle';

const COMPONENTS: ReadonlyArray<{ readonly name: string; readonly component: Type<object> }> = [
  { name: 'Button', component: Button },
  { name: 'Icon', component: Icon },
  { name: 'Input', component: Input },
  { name: 'Badge', component: Badge },
  { name: 'Card', component: Card },
  { name: 'Spinner', component: Spinner },
  { name: 'Alert', component: Alert },
  { name: 'Divider', component: Divider },
  { name: 'Container', component: Container },
  { name: 'Stack', component: Stack },
  { name: 'Grid', component: Grid },
  { name: 'Flex', component: Flex },
  { name: 'LoadingIndicator', component: LoadingIndicator },
  { name: 'Skeleton', component: Skeleton },
  { name: 'EmptyState', component: EmptyState },
  { name: 'ErrorState', component: ErrorState },
  { name: 'RetryButton', component: RetryButton },
  { name: 'ThemeToggle', component: ThemeToggle },
];

function renderMarkup(component: Type<object>, direction: 'ltr' | 'rtl'): string {
  document.documentElement.setAttribute('dir', direction);
  try {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).innerHTML.replace(/\s+/g, ' ').trim();
  } finally {
    document.documentElement.removeAttribute('dir');
  }
}

afterEach(() => {
  document.documentElement.removeAttribute('dir');
});

describe('Direction invariance (LTR/RTL)', () => {
  it.each(COMPONENTS.map(({ name, component }) => [name, component] as const))(
    'renders %s identically under LTR and RTL',
    (_name, component) => {
      expect(renderMarkup(component, 'rtl')).toBe(renderMarkup(component, 'ltr'));
      expect(renderMarkup(component, 'ltr').length).toBeGreaterThan(0);
    },
  );
});
