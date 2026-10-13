import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError, provideApi, provideAppEnvironment } from '@flux/api';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { CatalogAdminApiService } from '../../data-access/catalog-admin-api.service';
import { VariantCreatePage } from './variant-create-page';

function setup(scenario: {
  createVariant?: (productId: string, body: unknown) => ReturnType<typeof of>;
}): {
  createVariant: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
} {
  const createVariant = vi.fn(
    (productId: string, body: unknown) =>
      scenario.createVariant?.(productId, body) ??
      of({ isSuccess: true, message: 'Created.', data: 'var-new' }),
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
        useValue: { paramMap: of(convertToParamMap({ productId: 'prod-1' })) },
      },
      { provide: Router, useValue: { navigate } },
      { provide: CatalogAdminApiService, useValue: { createVariant } },
    ],
  });
  window.localStorage.clear();
  return { createVariant, navigate };
}

function render(): {
  fixture: ReturnType<typeof TestBed.createComponent<VariantCreatePage>>;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(VariantCreatePage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function fill(element: HTMLElement, id: string, value: string): void {
  const input = element.querySelector(`#${id}`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
}

describe('VariantCreatePage', () => {
  it('creates the variant, notifies, and navigates to details on success', () => {
    const { createVariant, navigate } = setup({});
    const { element } = render();

    fill(element, 'variant-sku', 'TEE-BLK-M');
    fill(element, 'variant-name', 'Black / M');
    fill(element, 'variant-price', '29.99');
    fill(element, 'variant-currency', 'usd');
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();

    expect(createVariant).toHaveBeenCalledTimes(1);
    expect(createVariant).toHaveBeenCalledWith('prod-1', {
      sku: 'TEE-BLK-M',
      name: 'Black / M',
      unitPriceAmount: 29.99,
      currency: 'USD',
    });
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('success');
    expect(notifications.at(-1)?.title).toBe('Variant created');
    expect(navigate).toHaveBeenCalledWith(['/catalog/products/prod-1/variants', 'var-new']);
  });

  it('projects backend field errors onto the form without navigating', () => {
    const rejection = new ApiError({
      status: 400,
      message: 'Validation failed.',
      validationErrors: { Sku: ['SKU is already used.'] },
    });
    const { createVariant, navigate } = setup({
      createVariant: () => throwError(() => rejection),
    });
    const { fixture, element } = render();

    fill(element, 'variant-sku', 'TEE-BLK-M');
    fill(element, 'variant-name', 'Black / M');
    fill(element, 'variant-price', '29.99');
    fill(element, 'variant-currency', 'USD');
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(createVariant).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain('SKU is already used.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders a form-level notice for non-validation failures', () => {
    const { navigate } = setup({
      createVariant: () => throwError(() => new ApiError({ status: 409, message: 'Conflict.' })),
    });
    const { fixture, element } = render();

    fill(element, 'variant-sku', 'TEE-BLK-M');
    fill(element, 'variant-name', 'Black / M');
    fill(element, 'variant-price', '29.99');
    fill(element, 'variant-currency', 'USD');
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element.textContent).toContain('Could not save the variant');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('cancels back to the variant list', () => {
    const { navigate, createVariant } = setup({});
    const { element } = render();

    (element.querySelector('.form-actions-cancel') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith(['/catalog/products/prod-1/variants']);
    expect(createVariant).not.toHaveBeenCalled();
  });
});
