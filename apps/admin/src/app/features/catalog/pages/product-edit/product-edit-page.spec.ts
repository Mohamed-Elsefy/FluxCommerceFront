import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  ApiError,
  errorResource,
  loadingResource,
  provideApi,
  provideAppEnvironment,
  successResource,
  type ResourceState,
} from '@flux/api';
import type { ProductResponse } from '@flux/models';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { CatalogAdminApiService } from '../../data-access/catalog-admin-api.service';
import { CategoryLookupState } from '../../state/category-lookup-state';
import { ProductDetailsState } from '../../state/product-details-state';
import { ProductEditPage } from './product-edit-page';

function product(): ProductResponse {
  return {
    id: 'prod-1',
    name: 'Tee',
    slug: 'tee',
    description: null,
    seo: null,
    status: 0,
    visibility: 1,
    categoryId: 'cat-1',
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function setup(scenario: {
  product?: ResourceState<ProductResponse>;
  updateProduct?: (id: string, body: unknown) => ReturnType<typeof of>;
}): {
  updateProduct: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
} {
  const updateProduct = vi.fn(
    (id: string, body: unknown) => scenario.updateProduct?.(id, body) ?? of(undefined),
  );
  const navigate = vi.fn(() => Promise.resolve(true));
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
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ id: 'prod-1' })) },
      },
      { provide: Router, useValue: { navigate } },
      { provide: CatalogAdminApiService, useValue: { updateProduct } },
      {
        provide: ProductDetailsState,
        useValue: {
          product: signal(scenario.product ?? successResource(product())),
          loadProduct: vi.fn(),
        },
      },
      {
        provide: CategoryLookupState,
        useValue: {
          categories: signal(successResource([])),
          options: signal([{ value: 'cat-1', label: 'Alpha' }]),
          load: vi.fn(),
        },
      },
    ],
  });
  window.localStorage.clear();
  return { updateProduct, navigate };
}

function render(): {
  fixture: ReturnType<typeof TestBed.createComponent<ProductEditPage>>;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(ProductEditPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('ProductEditPage', () => {
  it('populates the form from the loaded product', () => {
    setup({});
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('Edit product');
    expect((element.querySelector('#product-name') as HTMLInputElement).value).toBe('Tee');
    expect((element.querySelector('#product-visibility') as HTMLSelectElement).value).toBe('1');
  });

  it('updates the product, notifies, and navigates to details on success', () => {
    const { updateProduct, navigate } = setup({});
    const { element } = render();

    const name = element.querySelector('#product-name') as HTMLInputElement;
    name.value = 'Tee Updated';
    name.dispatchEvent(new Event('input'));
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();

    expect(updateProduct).toHaveBeenCalledTimes(1);
    expect(updateProduct).toHaveBeenCalledWith(
      'prod-1',
      expect.objectContaining({ name: 'Tee Updated' }),
    );
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('success');
    expect(notifications.at(-1)?.title).toBe('Product updated');
    expect(navigate).toHaveBeenCalledWith(['/catalog/products', 'prod-1']);
  });

  it('keeps user input intact when a conflict fails the submit', () => {
    const { updateProduct, navigate } = setup({
      updateProduct: () => throwError(() => new ApiError({ status: 409, message: 'Conflict.' })),
    });
    const { fixture, element } = render();

    const name = element.querySelector('#product-name') as HTMLInputElement;
    name.value = 'Taken Name';
    name.dispatchEvent(new Event('input'));
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(updateProduct).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain('Could not save the product');
    expect((element.querySelector('#product-name') as HTMLInputElement).value).toBe('Taken Name');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders loading and error states for the product load', () => {
    setup({ product: loadingResource<ProductResponse>() });
    const loading = render();
    expect(loading.element.querySelector('flux-loading-indicator')).not.toBeNull();
    TestBed.resetTestingModule();

    setup({
      product: errorResource<ProductResponse>(new ApiError({ status: 404, message: 'Missing.' })),
    });
    const failed = render();
    expect(failed.element.querySelector('flux-error-state')).not.toBeNull();
    expect(failed.element.querySelector('app-product-form')).toBeNull();
  });
});
