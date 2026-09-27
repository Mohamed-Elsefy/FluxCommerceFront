import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
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
import type {
  ProductImageResponse,
  ProductResponse,
  ProductSpecificationResponse,
  VariantResponse,
} from '@flux/models';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { CategoryLookupState } from '../../state/category-lookup-state';
import { ProductDetailsState } from '../../state/product-details-state';
import { ProductDetailsPage } from './product-details-page';

function product(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id: 'prod-1',
    name: 'Tee',
    slug: 'tee',
    description: 'Cotton tee',
    seo: null,
    status: 1,
    visibility: 0,
    categoryId: 'cat-1',
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
    ...overrides,
  };
}

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

function image(): ProductImageResponse {
  return {
    id: 'img-1',
    productId: 'prod-1',
    imageUrl: '/images/tee.jpg',
    altText: 'Tee',
    displayOrder: 0,
    isPrimary: true,
    metadata: null,
    createdAtUtc: '2026-09-04T10:00:00Z',
  };
}

function spec(): ProductSpecificationResponse {
  return { id: 'spec-1', productId: 'prod-1', name: 'Material', value: 'Cotton' };
}

interface DetailsScenario {
  product: ResourceState<ProductResponse>;
  variants?: ResourceState<readonly VariantResponse[]>;
  images?: ResourceState<readonly ProductImageResponse[]>;
  specs?: ResourceState<readonly ProductSpecificationResponse[]>;
}

function setup(scenario: DetailsScenario): {
  load: ReturnType<typeof vi.fn>;
  transition: ReturnType<typeof vi.fn>;
} {
  const load = vi.fn();
  const transition = vi.fn(() => of(undefined));
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
        useValue: { paramMap: of(convertToParamMap({ id: 'prod-1' })) },
      },
      {
        provide: ProductDetailsState,
        useValue: {
          product: signal(scenario.product),
          variants: signal(scenario.variants ?? successResource([variant()])),
          images: signal(scenario.images ?? successResource([image()])),
          specifications: signal(scenario.specs ?? successResource([spec()])),
          transitionInFlight: signal(false),
          load,
          transition,
        },
      },
      {
        provide: CategoryLookupState,
        useValue: {
          categories: signal(
            successResource([
              {
                id: 'cat-1',
                name: 'Alpha',
                slug: 'alpha',
                description: null,
                parentId: null,
                status: 0,
                isDeleted: false,
                createdAtUtc: '2026-09-04T10:00:00Z',
                deletedAtUtc: null,
              },
            ]),
          ),
          options: signal([]),
          load: vi.fn(),
        },
      },
    ],
  });
  window.localStorage.clear();
  return { load, transition };
}

function render(): {
  fixture: ReturnType<typeof TestBed.createComponent<ProductDetailsPage>>;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(ProductDetailsPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function successScenario(overrides: Partial<ProductResponse> = {}): DetailsScenario {
  return { product: successResource(product(overrides)) };
}

describe('ProductDetailsPage', () => {
  it('renders metadata, badges, sections, and forward actions on success', () => {
    setup(successScenario());
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('Tee');
    const badges = [...element.querySelectorAll('flux-badge')].map((badge) =>
      badge.textContent?.trim(),
    );
    expect(badges).toEqual(['Active', 'Visible']);
    expect(element.textContent).toContain('Alpha');
    expect(element.textContent).toContain('TEE-BLK-M');
    expect(element.textContent).toContain('/images/tee.jpg');
    expect(element.textContent).toContain('Cotton');
    const actions = [...element.querySelectorAll('.product-details-action')].map((button) =>
      button.textContent?.trim(),
    );
    expect(actions).toEqual(['Activate', 'Deactivate', 'Archive', 'Delete']);
    expect(element.querySelector('.product-details-edit')?.getAttribute('href')).toBe(
      '/catalog/products/prod-1/edit',
    );
  });

  it('offers only restore for deleted products', () => {
    setup(successScenario({ isDeleted: true, status: 2 }));
    const { element } = render();

    const actions = [...element.querySelectorAll('.product-details-action')].map((button) =>
      button.textContent?.trim(),
    );
    expect(actions).toEqual(['Restore']);
  });

  it('confirms a lifecycle action and notifies on success', () => {
    const { transition } = setup(successScenario());
    const { fixture, element } = render();

    const archive = [...element.querySelectorAll('.product-details-action')].find(
      (button) => button.textContent?.trim() === 'Archive',
    ) as HTMLButtonElement;
    archive.click();
    fixture.detectChanges();
    const dialog = element.querySelector('admin-dialog');
    expect(dialog).not.toBeNull();
    expect(element.textContent).toContain('Do you want to archive “Tee”?');

    const confirm = element.querySelector('.product-details-dialog-confirm') as HTMLButtonElement;
    confirm.click();
    fixture.detectChanges();

    expect(transition).toHaveBeenCalledWith('prod-1', 'archive');
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('success');
    expect(notifications.at(-1)?.title).toBe('Status updated');
  });

  it('closes the dialog without acting on cancel', () => {
    const { transition } = setup(successScenario());
    const { fixture, element } = render();

    const archive = [...element.querySelectorAll('.product-details-action')].find(
      (button) => button.textContent?.trim() === 'Archive',
    ) as HTMLButtonElement;
    archive.click();
    fixture.detectChanges();
    (element.querySelector('.product-details-dialog-cancel') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(transition).not.toHaveBeenCalled();
    expect(element.querySelector('admin-dialog .dialog-panel')).toBeNull();
  });

  it('notifies on transition failure without losing the page', () => {
    const rejection = new ApiError({ status: 409, message: 'Conflict.' });
    const { transition } = setup(successScenario());
    transition.mockReturnValueOnce(throwError(() => rejection));
    const { fixture, element } = render();

    const activate = [...element.querySelectorAll('.product-details-action')].find(
      (button) => button.textContent?.trim() === 'Activate',
    ) as HTMLButtonElement;
    activate.click();
    fixture.detectChanges();
    (element.querySelector('.product-details-dialog-confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('error');
    expect(notifications.at(-1)?.title).toBe('Status change failed');
    expect(element.querySelector('h1')?.textContent).toBe('Tee');
  });

  it('renders the error state with retry when the product fails', () => {
    const { load } = setup({
      product: errorResource(new ApiError({ status: 404, message: 'Not found.' })),
    });
    const { element } = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    (element.querySelector('flux-error-state button') as HTMLButtonElement).click();

    expect(load).toHaveBeenCalledWith('prod-1');
  });
});
