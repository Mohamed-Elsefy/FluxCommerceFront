import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  ApiError,
  errorResource,
  provideApi,
  provideAppEnvironment,
  successResource,
} from '@flux/api';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { CatalogAdminApiService } from '../../data-access/catalog-admin-api.service';
import { CategoryLookupState } from '../../state/category-lookup-state';
import { ProductCreatePage } from './product-create-page';

function setup(scenario: {
  createProduct?: (body: unknown) => ReturnType<typeof of>;
  lookupFails?: boolean;
}): {
  createProduct: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
  lookupLoad: ReturnType<typeof vi.fn>;
} {
  const createProduct = vi.fn(
    (body: unknown) =>
      scenario.createProduct?.(body) ??
      of({ isSuccess: true, message: 'Created.', data: 'prod-new' }),
  );
  const navigate = vi.fn(() => Promise.resolve(true));
  const lookupLoad = vi.fn();
  const rejection = new ApiError({ status: 500, message: 'Server error.' });
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
      { provide: CatalogAdminApiService, useValue: { createProduct } },
      {
        provide: CategoryLookupState,
        useValue: {
          categories: signal(scenario.lookupFails ? errorResource(rejection) : successResource([])),
          options: signal([{ value: 'cat-1', label: 'Alpha' }]),
          load: lookupLoad,
        },
      },
      { provide: Router, useValue: { navigate } },
    ],
  });
  window.localStorage.clear();
  return { createProduct, navigate, lookupLoad };
}

function render(): {
  fixture: ReturnType<typeof TestBed.createComponent<ProductCreatePage>>;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(ProductCreatePage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function fill(element: HTMLElement, id: string, value: string): void {
  const input = element.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
}

describe('ProductCreatePage', () => {
  it('creates the product, notifies, and navigates to details on success', () => {
    const { createProduct, navigate } = setup({});
    const { element } = render();

    fill(element, 'product-name', 'Tee');
    fill(element, 'product-slug', 'tee');
    fill(element, 'product-category', 'cat-1');
    fill(element, 'product-visibility', '0');
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();

    expect(createProduct).toHaveBeenCalledTimes(1);
    expect(createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Tee', slug: 'tee', categoryId: 'cat-1', visibility: 0 }),
    );
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('success');
    expect(notifications.at(-1)?.title).toBe('Product created');
    expect(navigate).toHaveBeenCalledWith(['/catalog/products', 'prod-new']);
  });

  it('projects backend field errors onto the form without navigating', () => {
    const rejection = new ApiError({
      status: 400,
      message: 'Validation failed.',
      validationErrors: { Slug: ['Slug is already used.'] },
    });
    const { createProduct, navigate } = setup({
      createProduct: () => throwError(() => rejection),
    });
    const { fixture, element } = render();

    fill(element, 'product-name', 'Tee');
    fill(element, 'product-slug', 'tee');
    fill(element, 'product-category', 'cat-1');
    fill(element, 'product-visibility', '0');
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(createProduct).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain('Slug is already used.');
    expect(navigate).not.toHaveBeenCalled();
    expect(
      TestBed.inject(AdminNotificationService)
        .notifications()
        .filter((item) => item.type === 'error'),
    ).toHaveLength(0);
  });

  it('renders a form-level notice for non-validation failures', () => {
    const { navigate } = setup({
      createProduct: () => throwError(() => new ApiError({ status: 409, message: 'Conflict.' })),
    });
    const { fixture, element } = render();

    fill(element, 'product-name', 'Tee');
    fill(element, 'product-slug', 'tee');
    fill(element, 'product-category', 'cat-1');
    fill(element, 'product-visibility', '0');
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element.textContent).toContain('Could not save the product');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('cancels back to the product list', () => {
    const { navigate, createProduct } = setup({});
    const { element } = render();

    (element.querySelector('.form-actions-cancel') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith(['/catalog/products']);
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('surfaces lookup failures with retry while keeping the form usable', () => {
    const { lookupLoad, createProduct } = setup({ lookupFails: true });
    const { fixture, element } = render();

    expect(element.textContent).toContain('Could not load this section');
    expect(element.querySelector('app-product-form')).not.toBeNull();
    (element.querySelector('flux-error-state button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(lookupLoad).toHaveBeenCalledTimes(2);
    expect(createProduct).not.toHaveBeenCalled();
  });
});
