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
import type { VariantResponse } from '@flux/models';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { CatalogAdminApiService } from '../../data-access/catalog-admin-api.service';
import { VariantDetailsState } from '../../state/variant-details-state';
import { VariantEditPage } from './variant-edit-page';

function variant(): VariantResponse {
  return {
    id: 'var-1',
    productId: 'prod-1',
    sku: 'TEE-BLK-M',
    name: 'Black / M',
    unitPriceAmount: 29.99,
    currency: 'USD',
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function setup(scenario: {
  variant?: ResourceState<VariantResponse>;
  updateVariant?: (productId: string, variantId: string, body: unknown) => ReturnType<typeof of>;
}): {
  updateVariant: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
} {
  const updateVariant = vi.fn(
    (productId: string, variantId: string, body: unknown) =>
      scenario.updateVariant?.(productId, variantId, body) ?? of(undefined),
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
        useValue: {
          paramMap: of(convertToParamMap({ productId: 'prod-1', variantId: 'var-1' })),
        },
      },
      { provide: Router, useValue: { navigate } },
      { provide: CatalogAdminApiService, useValue: { updateVariant } },
      {
        provide: VariantDetailsState,
        useValue: {
          variant: signal(scenario.variant ?? successResource(variant())),
          load: vi.fn(),
        },
      },
    ],
  });
  window.localStorage.clear();
  return { updateVariant, navigate };
}

function render(): {
  fixture: ReturnType<typeof TestBed.createComponent<VariantEditPage>>;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(VariantEditPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('VariantEditPage', () => {
  it('populates the form with editable money and status controls', () => {
    setup({});
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('Edit variant');
    expect((element.querySelector('#variant-sku') as HTMLInputElement).value).toBe('TEE-BLK-M');
    expect((element.querySelector('#variant-price') as HTMLInputElement).disabled).toBe(false);
    expect((element.querySelector('#variant-currency') as HTMLInputElement).disabled).toBe(false);
    expect(element.querySelector('#variant-status')).not.toBeNull();
  });

  it('updates the variant with paired money and status, notifies, and navigates', () => {
    const { updateVariant, navigate } = setup({});
    const { element } = render();

    const name = element.querySelector('#variant-name') as HTMLInputElement;
    name.value = 'Black / L';
    name.dispatchEvent(new Event('input'));
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();

    expect(updateVariant).toHaveBeenCalledTimes(1);
    expect(updateVariant).toHaveBeenCalledWith('prod-1', 'var-1', {
      sku: 'TEE-BLK-M',
      name: 'Black / L',
      unitPriceAmount: 29.99,
      currency: 'USD',
      status: 0,
    });
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('success');
    expect(notifications.at(-1)?.title).toBe('Variant updated');
    expect(navigate).toHaveBeenCalledWith(['/catalog/products/prod-1/variants', 'var-1']);
  });

  it('keeps user input intact when a duplicate SKU fails the submit', () => {
    const { updateVariant, navigate } = setup({
      updateVariant: () => throwError(() => new ApiError({ status: 409, message: 'Conflict.' })),
    });
    const { fixture, element } = render();

    const sku = element.querySelector('#variant-sku') as HTMLInputElement;
    sku.value = 'TAKEN';
    sku.dispatchEvent(new Event('input'));
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(updateVariant).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain('Could not save the variant');
    expect((element.querySelector('#variant-sku') as HTMLInputElement).value).toBe('TAKEN');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders loading and error states for the variant load', () => {
    setup({ variant: loadingResource<VariantResponse>() });
    const loading = render();
    expect(loading.element.querySelector('flux-loading-indicator')).not.toBeNull();
    TestBed.resetTestingModule();

    setup({
      variant: errorResource<VariantResponse>(new ApiError({ status: 404, message: 'Missing.' })),
    });
    const failed = render();
    expect(failed.element.querySelector('flux-error-state')).not.toBeNull();
    expect(failed.element.querySelector('app-variant-form')).toBeNull();
  });
});
