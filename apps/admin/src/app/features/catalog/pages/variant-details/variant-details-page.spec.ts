import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  ApiError,
  errorResource,
  provideApi,
  provideAppEnvironment,
  successResource,
  type ResourceState,
} from '@flux/api';
import type { VariantResponse } from '@flux/models';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { CatalogAdminApiService } from '../../data-access/catalog-admin-api.service';
import { VariantDetailsState } from '../../state/variant-details-state';
import { VariantDetailsPage } from './variant-details-page';

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
  deleteVariant?: () => ReturnType<typeof of>;
}): {
  load: ReturnType<typeof vi.fn>;
  deleteVariant: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
} {
  const load = vi.fn();
  const deleteVariant = vi.fn(() => scenario.deleteVariant?.() ?? of(undefined));
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
        useValue: {
          paramMap: of(convertToParamMap({ productId: 'prod-1', variantId: 'var-1' })),
        },
      },
      { provide: CatalogAdminApiService, useValue: { deleteVariant } },
      {
        provide: VariantDetailsState,
        useValue: {
          variant: signal(scenario.variant ?? successResource(variant())),
          load,
        },
      },
    ],
  });
  window.localStorage.clear();
  const navigate = vi
    .spyOn(TestBed.inject(Router), 'navigate')
    .mockImplementation(() => Promise.resolve(true));
  return { load, deleteVariant, navigate };
}

function render(): {
  fixture: ReturnType<typeof TestBed.createComponent<VariantDetailsPage>>;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(VariantDetailsPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('VariantDetailsPage', () => {
  it('renders the record with status badge, edit link, and delete action', () => {
    setup({});
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('TEE-BLK-M');
    expect(element.querySelector('flux-badge')?.textContent?.trim()).toBe('Active');
    expect(element.textContent).toContain('$29.99');
    expect(element.querySelector('.variant-details-edit')?.getAttribute('href')).toBe(
      '/catalog/products/prod-1/variants/var-1/edit',
    );
    expect(element.querySelector('.variant-details-delete')?.textContent?.trim()).toBe(
      'Delete variant',
    );
  });

  it('confirms deletion and notifies before returning to the list', () => {
    const { deleteVariant, navigate } = setup({});
    const { fixture, element } = render();

    (element.querySelector('.variant-details-delete') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Do you want to delete “TEE-BLK-M”?');

    (element.querySelector('.variant-details-dialog-confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(deleteVariant).toHaveBeenCalledWith('prod-1', 'var-1');
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('success');
    expect(notifications.at(-1)?.title).toBe('Variant deleted');
    expect(navigate).toHaveBeenCalledWith(['/catalog/products/prod-1/variants']);
  });

  it('closes the dialog without acting on cancel', () => {
    const { deleteVariant } = setup({});
    const { fixture, element } = render();

    (element.querySelector('.variant-details-delete') as HTMLButtonElement).click();
    fixture.detectChanges();
    (element.querySelector('.variant-details-dialog-cancel') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(deleteVariant).not.toHaveBeenCalled();
    expect(element.querySelector('admin-dialog .dialog-panel')).toBeNull();
  });

  it('notifies on deletion failure without losing the page', () => {
    const rejection = new ApiError({ status: 409, message: 'Conflict.' });
    const { navigate } = setup({ deleteVariant: () => throwError(() => rejection) });
    const { fixture, element } = render();

    (element.querySelector('.variant-details-delete') as HTMLButtonElement).click();
    fixture.detectChanges();
    (element.querySelector('.variant-details-dialog-confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('error');
    expect(notifications.at(-1)?.title).toBe('Could not delete the variant');
    expect(element.querySelector('h1')?.textContent).toBe('TEE-BLK-M');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders the error state with retry when the variant fails', () => {
    const { load } = setup({
      variant: errorResource(new ApiError({ status: 404, message: 'Not found.' })),
    });
    const { element } = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    (element.querySelector('flux-error-state button') as HTMLButtonElement).click();

    expect(load).toHaveBeenCalledWith('prod-1', 'var-1');
  });
});
