/**
 * Component tests for the Sub-Phase 5.2 `CategoryNav`.
 *
 * Covers the presentational contract only: every category renders a link
 * to the Catalog listing route with its id in the `categoryId` query
 * parameter, the active category carries `aria-current`, descriptions
 * render when provided, and no HTTP or state is involved (inputs only).
 * The router stays real to prove navigation-target behavior.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import type { Category } from '../../models/catalog.models';
import { CategoryNav } from './category-nav';

const CATEGORIES: readonly Category[] = [
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Apparel',
    slug: 'apparel',
    description: 'Wearables and basics.',
    parentId: null,
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Accessories',
    slug: 'accessories',
    description: null,
    parentId: null,
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  },
];

function setup(input: {
  categories?: readonly Category[];
  activeCategoryId?: string | null;
  basePath?: string;
}): {
  fixture: ComponentFixture<CategoryNav>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(CategoryNav);
  fixture.componentRef.setInput('categories', input.categories ?? CATEGORIES);
  fixture.componentRef.setInput('activeCategoryId', input.activeCategoryId ?? null);
  fixture.componentRef.setInput('label', 'Categories');
  if (input.basePath !== undefined) {
    fixture.componentRef.setInput('basePath', input.basePath);
  }
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function links(element: HTMLElement): HTMLAnchorElement[] {
  return [...element.querySelectorAll('nav.category-nav a')].map(
    (link) => link as HTMLAnchorElement,
  );
}

describe('CategoryNav', () => {
  it('renders one listing link per category with its id in the query state', () => {
    const { element } = setup({});

    expect(links(element).map((link) => link.getAttribute('href'))).toEqual([
      '/catalog?categoryId=22222222-2222-2222-2222-222222222222',
      '/catalog?categoryId=33333333-3333-3333-3333-333333333333',
    ]);
    expect(links(element).map((link) => link.textContent?.trim())).toEqual([
      'Apparel',
      'Accessories',
    ]);
  });

  it('marks the active category for assistive technology', () => {
    const { element } = setup({ activeCategoryId: CATEGORIES[0]?.id ?? null });

    expect(links(element)[0]?.getAttribute('aria-current')).toBe('page');
    expect(links(element)[1]?.getAttribute('aria-current')).toBeNull();
  });

  it('selects nothing when the active id matches no category', () => {
    const { element } = setup({ activeCategoryId: 'unknown-category' });

    for (const link of links(element)) {
      expect(link.getAttribute('aria-current')).toBeNull();
    }
  });

  it('renders descriptions only when the backend provides them', () => {
    const { element } = setup({});
    const items = [...element.querySelectorAll('nav.category-nav li')];

    expect(items[0]?.querySelector('p')?.textContent).toBe('Wearables and basics.');
    expect(items[1]?.querySelector('p')).toBeNull();
  });

  it('labels the navigation landmark', () => {
    const { element } = setup({});

    expect(element.querySelector('nav.category-nav')?.getAttribute('aria-label')).toBe(
      'Categories',
    );
  });

  it('targets a custom listing base path when provided', () => {
    const { element } = setup({ basePath: '/products' });

    expect(links(element).map((link) => link.getAttribute('href'))).toEqual([
      '/products?categoryId=22222222-2222-2222-2222-222222222222',
      '/products?categoryId=33333333-3333-3333-3333-333333333333',
    ]);
  });
});
