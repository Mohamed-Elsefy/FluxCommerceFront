import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import {
  ApiError,
  emptyResource,
  errorResource,
  loadingResource,
  provideApi,
  provideAppEnvironment,
  successResource,
  type ResourceState,
} from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { VariantResponse } from '@flux/models';
import { VariantListState } from '../../state/variant-list-state';
import { VariantsListPage } from './variants-list-page';

function row(id: string, sku: string): VariantResponse {
  return {
    id,
    productId: 'prod-1',
    sku,
    name: `Variant ${id}`,
    unitPriceAmount: 29.99,
    currency: 'USD',
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function setup(scenario: { variants: ResourceState<readonly VariantResponse[]> }): {
  load: ReturnType<typeof vi.fn>;
} {
  const load = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideAppEnvironment({
        name: 'development',
        production: false,
        appName: 'test',
        apiBaseUrl: '/api',
      }),
      provideApi(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ productId: 'prod-1' })) },
      },
      { provide: VariantListState, useValue: { variants: signal(scenario.variants), load } },
    ],
  });
  window.localStorage.clear();
  return { load };
}

function render(): { element: HTMLElement } {
  const fixture = TestBed.createComponent(VariantsListPage);
  fixture.detectChanges();
  return { element: fixture.nativeElement as HTMLElement };
}

describe('VariantsListPage', () => {
  it('loads the collection on init and renders rows with navigation links', () => {
    const { load } = setup({ variants: successResource([row('v1', 'A-1'), row('v2', 'A-2')]) });
    const { element } = render();

    expect(load).toHaveBeenCalledWith('prod-1');
    expect(element.querySelector('h1')?.textContent).toBe('Variants');
    const body = [...element.querySelectorAll('tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim()),
    );
    expect(body).toEqual([
      ['A-1', 'Variant v1', '$29.99', 'Active'],
      ['A-2', 'Variant v2', '$29.99', 'Active'],
    ]);
    const links = [...element.querySelectorAll('tbody td a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/catalog/products/prod-1/variants/v1',
      '/catalog/products/prod-1/variants/v2',
    ]);
    expect(element.querySelector('.variants-list-back')?.getAttribute('href')).toBe(
      '/catalog/products/prod-1',
    );
  });

  it('renders the loading state while the collection loads', () => {
    setup({ variants: loadingResource<readonly VariantResponse[]>() });
    const { element } = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
  });

  it('renders the empty state for settled collections without rows', () => {
    setup({ variants: emptyResource<readonly VariantResponse[]>([]) });
    const { element } = render();

    expect(element.querySelector('flux-empty-state')).not.toBeNull();
    expect(element.textContent).toContain('No variants yet');
  });

  it('renders the error state with retry that reloads the scope', () => {
    const { load } = setup({
      variants: errorResource<readonly VariantResponse[]>(
        new ApiError({ status: 404, message: 'Not found.' }),
      ),
    });
    const { element } = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    expect(load).toHaveBeenCalledWith('prod-1');
    (element.querySelector('flux-error-state button') as HTMLButtonElement).click();

    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith('prod-1');
  });

  it('localizes the list for the active culture', () => {
    setup({ variants: successResource([row('v1', 'A-1')]) });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('de');
    try {
      const { element } = render();

      expect(element.querySelector('h1')?.textContent).toBe('Varianten');
      expect(element.querySelector('thead th')?.textContent?.trim()).toBe('SKU');
    } finally {
      cultures.setCulture('en');
    }
  });
});
