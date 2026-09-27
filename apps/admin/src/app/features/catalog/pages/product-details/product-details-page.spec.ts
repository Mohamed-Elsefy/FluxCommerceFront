import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { defer, of, throwError } from 'rxjs';
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
import { CatalogAdminApiService } from '../../data-access/catalog-admin-api.service';
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
  const catalogApi = {
    addProductImage: vi.fn(() => of(undefined)),
    updateProductImage: vi.fn(() => of(undefined)),
    deleteProductImage: vi.fn(() => of(undefined)),
    setPrimaryImage: vi.fn(() => of(undefined)),
    reorderProductImages: vi.fn(() => of(undefined)),
    createSpecification: vi.fn(() => of(undefined)),
    updateSpecification: vi.fn(() => of(undefined)),
    deleteSpecification: vi.fn(() => of(undefined)),
  };
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
      { provide: CatalogAdminApiService, useValue: catalogApi },
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
    expect(element.querySelector('.product-details-manage')?.getAttribute('href')).toBe(
      '/catalog/products/prod-1/variants',
    );
    expect(element.querySelector('.product-details-manage')?.textContent?.trim()).toBe(
      'Manage variants',
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

function imageTwo(): ProductImageResponse {
  return {
    id: 'img-2',
    productId: 'prod-1',
    imageUrl: '/images/tee-back.jpg',
    altText: null,
    displayOrder: 1,
    isPrimary: false,
    metadata: null,
    createdAtUtc: '2026-09-04T10:00:00Z',
  };
}

interface MediaApi {
  addProductImage: ReturnType<typeof vi.fn>;
  updateProductImage: ReturnType<typeof vi.fn>;
  deleteProductImage: ReturnType<typeof vi.fn>;
  setPrimaryImage: ReturnType<typeof vi.fn>;
  reorderProductImages: ReturnType<typeof vi.fn>;
  createSpecification: ReturnType<typeof vi.fn>;
  updateSpecification: ReturnType<typeof vi.fn>;
  deleteSpecification: ReturnType<typeof vi.fn>;
}

function setupMedia(scenario: DetailsScenario): { load: ReturnType<typeof vi.fn>; api: MediaApi } {
  const api: MediaApi = {
    addProductImage: vi.fn(() => of(undefined)),
    updateProductImage: vi.fn(() => of(undefined)),
    deleteProductImage: vi.fn(() => of(undefined)),
    setPrimaryImage: vi.fn(() => of(undefined)),
    reorderProductImages: vi.fn(() => of(undefined)),
    createSpecification: vi.fn(() => of(undefined)),
    updateSpecification: vi.fn(() => of(undefined)),
    deleteSpecification: vi.fn(() => of(undefined)),
  };
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
      { provide: CatalogAdminApiService, useValue: api },
      {
        provide: ProductDetailsState,
        useValue: {
          product: signal(scenario.product),
          variants: signal(scenario.variants ?? successResource([variant()])),
          images: signal(scenario.images ?? successResource([image(), imageTwo()])),
          specifications: signal(scenario.specs ?? successResource([spec()])),
          transitionInFlight: signal(false),
          load,
          transition,
        },
      },
      {
        provide: CategoryLookupState,
        useValue: {
          categories: signal(successResource([])),
          options: signal([]),
          load: vi.fn(),
        },
      },
    ],
  });
  window.localStorage.clear();
  return { load, api };
}

function sectionEl(element: HTMLElement, titleId: string): HTMLElement {
  return element.querySelector(`section[aria-labelledby="${titleId}"]`) as HTMLElement;
}

function rowButton(section: HTMLElement, row: number, label: string): HTMLButtonElement {
  const rows = section.querySelectorAll('tbody tr');
  const button = [...(rows[row]?.querySelectorAll('button') ?? [])].find(
    (node) => node.textContent?.trim() === label,
  );
  if (button === undefined) {
    throw new Error(`Missing "${label}" button in row ${row}.`);
  }
  return button as HTMLButtonElement;
}

function fillDialog(element: HTMLElement, entries: Record<string, string>): void {
  for (const [id, value] of Object.entries(entries)) {
    const input = element.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
  }
}

function submitDialog(element: HTMLElement): void {
  (element.querySelector('admin-dialog .form-actions-submit') as HTMLButtonElement).click();
}

describe('ProductDetailsPage image management (13.6)', () => {
  it('renders section actions with row buttons (no set-primary on the primary row)', () => {
    setupMedia(successScenario());
    const { element } = render();
    const images = sectionEl(element, 'product-details-images-title');

    expect(images.querySelector('.product-details-add')?.textContent?.trim()).toBe('Add image');
    const firstRow = [...images.querySelectorAll('tbody tr')][0] as HTMLElement;
    const firstLabels = [...firstRow.querySelectorAll('button')].map((node) =>
      node.textContent?.trim(),
    );
    expect(firstLabels).toEqual(['↑', '↓', 'Edit', 'Delete']);
    const secondRow = [...images.querySelectorAll('tbody tr')][1] as HTMLElement;
    expect(
      [...secondRow.querySelectorAll('button')].map((node) => node.textContent?.trim()),
    ).toContain('Set primary');
  });

  it('adds an image through the dialog and refreshes on success', () => {
    const { load, api } = setupMedia(successScenario());
    const { fixture, element } = render();
    const images = sectionEl(element, 'product-details-images-title');

    (images.querySelector('.product-details-add') as HTMLButtonElement).click();
    fixture.detectChanges();
    fillDialog(element, { 'image-url': '/images/new.jpg', 'image-order': '2' });
    submitDialog(element);
    fixture.detectChanges();

    expect(api.addProductImage).toHaveBeenCalledWith('prod-1', {
      imageUrl: '/images/new.jpg',
      altText: null,
      isPrimary: false,
      displayOrder: 2,
      metadata: null,
    });
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('success');
    expect(notifications.at(-1)?.title).toBe('Image added');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('edits an image with stored-metadata round-tripping', () => {
    const withMeta = {
      ...image(),
      id: 'img-9',
      imageUrl: '/images/studio.jpg',
      metadata: { source: 'studio' },
    };
    const { api } = setupMedia({
      ...successScenario(),
      images: successResource([withMeta]),
    });
    const { fixture, element } = render();
    const images = sectionEl(element, 'product-details-images-title');

    rowButton(images, 0, 'Edit').click();
    fixture.detectChanges();
    fillDialog(element, { 'image-url': '/images/studio-2.jpg', 'image-order': '0' });
    submitDialog(element);
    fixture.detectChanges();

    expect(api.updateProductImage).toHaveBeenCalledWith('prod-1', 'img-9', {
      imageUrl: '/images/studio-2.jpg',
      altText: 'Tee',
      displayOrder: 0,
      metadata: { source: 'studio' },
    });
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.title).toBe('Image updated');
  });

  it('projects image validation errors onto the dialog form', () => {
    const rejection = new ApiError({
      status: 400,
      message: 'Validation failed.',
      validationErrors: { ImageUrl: ['URL is required.'] },
    });
    const { api } = setupMedia(successScenario());
    api.addProductImage.mockReturnValueOnce(throwError(() => rejection));
    const { fixture, element } = render();
    const images = sectionEl(element, 'product-details-images-title');

    (images.querySelector('.product-details-add') as HTMLButtonElement).click();
    fixture.detectChanges();
    fillDialog(element, { 'image-url': '/images/new.jpg', 'image-order': '2' });
    submitDialog(element);
    fixture.detectChanges();

    expect(element.textContent).toContain('URL is required.');
    expect(element.querySelector('admin-dialog .dialog-panel')).not.toBeNull();
  });

  it('prevents duplicate image submits while one is in flight', () => {
    const { api } = setupMedia(successScenario());
    let release!: (value: unknown) => void;
    const pending = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    api.addProductImage.mockReturnValueOnce(defer(() => pending));
    const { fixture, element } = render();
    const images = sectionEl(element, 'product-details-images-title');

    (images.querySelector('.product-details-add') as HTMLButtonElement).click();
    fixture.detectChanges();
    fillDialog(element, { 'image-url': '/images/new.jpg', 'image-order': '2' });
    submitDialog(element);
    submitDialog(element);

    expect(api.addProductImage).toHaveBeenCalledTimes(1);
    release(undefined);
    return pending;
  });

  it('deletes an image behind confirmation and refreshes', () => {
    const { load, api } = setupMedia(successScenario());
    const { fixture, element } = render();
    const images = sectionEl(element, 'product-details-images-title');

    rowButton(images, 1, 'Delete').click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Do you want to delete this image?');
    (element.querySelector('.product-details-dialog-confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(api.deleteProductImage).toHaveBeenCalledWith('prod-1', 'img-2');
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.title).toBe('Image deleted');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('marks a non-primary image primary without a dialog', () => {
    const { api } = setupMedia(successScenario());
    const { fixture, element } = render();
    const images = sectionEl(element, 'product-details-images-title');

    rowButton(images, 1, 'Set primary').click();
    fixture.detectChanges();

    expect(api.setPrimaryImage).toHaveBeenCalledWith('prod-1', 'img-2');
    expect(TestBed.inject(AdminNotificationService).notifications().at(-1)?.title).toBe(
      'Primary image updated',
    );
  });

  it('reorders with the exact settled id set swapped', () => {
    const { api } = setupMedia(successScenario());
    const { fixture, element } = render();
    const images = sectionEl(element, 'product-details-images-title');
    const down = [...images.querySelectorAll('tbody tr')][0]?.querySelectorAll('button')[1];
    expect(down?.textContent?.trim()).toBe('↓');

    (down as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(api.reorderProductImages).toHaveBeenCalledWith('prod-1', {
      orderedImageIds: ['img-2', 'img-1'],
    });
    expect(TestBed.inject(AdminNotificationService).notifications().at(-1)?.title).toBe(
      'Image order updated',
    );
  });

  it('notifies image failures without losing the page', () => {
    const { api } = setupMedia(successScenario());
    api.setPrimaryImage.mockReturnValueOnce(
      throwError(() => new ApiError({ status: 409, message: 'Conflict.' })),
    );
    const { fixture, element } = render();
    const images = sectionEl(element, 'product-details-images-title');

    rowButton(images, 1, 'Set primary').click();
    fixture.detectChanges();

    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('error');
    expect(notifications.at(-1)?.title).toBe('Image operation failed');
    expect(element.querySelector('h1')?.textContent).toBe('Tee');
  });
});

describe('ProductDetailsPage specification management (13.6)', () => {
  it('renders spec rows with edit and delete actions plus an add button', () => {
    setupMedia(successScenario());
    const { element } = render();
    const specs = sectionEl(element, 'product-details-specs-title');

    expect(specs.querySelector('.product-details-add')?.textContent?.trim()).toBe(
      'Add specification',
    );
    const labels = [...specs.querySelectorAll('tbody td.data-table-actions button')].map((node) =>
      node.textContent?.trim(),
    );
    expect(labels).toEqual(['Edit', 'Delete']);
  });

  it('adds a specification through the dialog and refreshes on success', () => {
    const { load, api } = setupMedia(successScenario());
    const { fixture, element } = render();
    const specs = sectionEl(element, 'product-details-specs-title');

    (specs.querySelector('.product-details-add') as HTMLButtonElement).click();
    fixture.detectChanges();
    fillDialog(element, { 'spec-name': 'Fit', 'spec-value': 'Slim' });
    submitDialog(element);
    fixture.detectChanges();

    expect(api.createSpecification).toHaveBeenCalledWith('prod-1', {
      name: 'Fit',
      value: 'Slim',
    });
    expect(TestBed.inject(AdminNotificationService).notifications().at(-1)?.title).toBe(
      'Specification added',
    );
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('edits a specification through the dialog', () => {
    const { api } = setupMedia(successScenario());
    const { fixture, element } = render();
    const specs = sectionEl(element, 'product-details-specs-title');

    rowButton(specs, 0, 'Edit').click();
    fixture.detectChanges();
    fillDialog(element, { 'spec-value': 'Wool' });
    submitDialog(element);
    fixture.detectChanges();

    expect(api.updateSpecification).toHaveBeenCalledWith('prod-1', 'spec-1', {
      name: 'Material',
      value: 'Wool',
    });
    expect(TestBed.inject(AdminNotificationService).notifications().at(-1)?.title).toBe(
      'Specification updated',
    );
  });

  it('renders a form-level notice for specification conflicts', () => {
    const { api } = setupMedia(successScenario());
    api.createSpecification.mockReturnValueOnce(
      throwError(() => new ApiError({ status: 409, message: 'Conflict.' })),
    );
    const { fixture, element } = render();
    const specs = sectionEl(element, 'product-details-specs-title');

    (specs.querySelector('.product-details-add') as HTMLButtonElement).click();
    fixture.detectChanges();
    fillDialog(element, { 'spec-name': 'Material', 'spec-value': 'Cotton' });
    submitDialog(element);
    fixture.detectChanges();

    expect(element.textContent).toContain('Could not save the specification');
  });

  it('deletes a specification behind confirmation naming the row', () => {
    const { load, api } = setupMedia(successScenario());
    const { fixture, element } = render();
    const specs = sectionEl(element, 'product-details-specs-title');

    rowButton(specs, 0, 'Delete').click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Do you want to delete “Material”?');
    (element.querySelector('.product-details-dialog-confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(api.deleteSpecification).toHaveBeenCalledWith('prod-1', 'spec-1');
    expect(TestBed.inject(AdminNotificationService).notifications().at(-1)?.title).toBe(
      'Specification deleted',
    );
    expect(load).toHaveBeenCalledTimes(2);
  });
});
