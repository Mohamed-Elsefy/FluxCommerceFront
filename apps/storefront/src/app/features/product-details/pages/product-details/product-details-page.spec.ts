/**
 * Page tests for the `ProductDetailsPage` (Sub-Phases 6.1–6.5 — Foundation
 * + Page & Information + Image Gallery + Variant Selection + SKU Binding).
 *
 * `ProductDetailsState` is stubbed at its typed seam (its orchestration is
 * covered by `product-details-state.spec.ts`) so these tests own the page
 * logic: product + specifications + images + variants loads driven by the
 * `:id` route parameter, graceful missing/malformed ids (no fetch,
 * invalid state, slot reset), loading / success / error / not-found
 * rendering, error retry over all slots, specification rendering (wire
 * order, empty-hidden), gallery integration (rendering, empty fallback,
 * failure hiding), selector integration (rendering, selection forwarding,
 * clearing on product change), commercial integration (SKU binding,
 * no-selection prompt, unavailable handling), and the browser-only fetch
 * rule (the server prerenders the idle shell).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import {
  ApiError,
  emptyResource,
  errorResource,
  idleResource,
  loadingResource,
  successResource,
  type ResourceState,
} from '@flux/api';
import { CultureService } from '@flux/i18n';
import { VariantStatus, type ProductResponse } from '@flux/models';
import { ProductDetailsState } from '../../state/product-details-state';
import type {
  ProductDetails,
  ProductImage,
  ProductSpecification,
  ProductVariant,
} from '../../models/product-details.models';
import { ProductDetailsPage } from './product-details-page';

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';

const PRODUCT: ProductResponse = {
  id: PRODUCT_ID,
  name: 'Tee',
  slug: 'tee',
  description: 'A comfortable cotton tee.',
  seo: null,
  status: 1,
  visibility: 0,
  categoryId: '22222222-2222-2222-2222-222222222222',
  isDeleted: false,
  createdAtUtc: '2026-09-04T10:00:00Z',
  deletedAtUtc: null,
};

const SPECIFICATIONS: ProductSpecification[] = [
  {
    id: 'a1a1a1a1-1111-4111-8111-111111111111',
    productId: PRODUCT_ID,
    name: 'Material',
    value: 'Cotton',
  },
  {
    id: 'b2b2b2b2-2222-4222-8222-222222222222',
    productId: PRODUCT_ID,
    name: 'Fit',
    value: 'Regular',
  },
];

const VARIANTS: ProductVariant[] = [
  {
    id: 'aaaaaaaa-1111-4111-8111-111111111111',
    productId: PRODUCT_ID,
    sku: 'TEE-RED-M',
    name: 'Red / M',
    status: VariantStatus.Active,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  },
  {
    id: 'bbbbbbbb-2222-4222-8222-222222222222',
    productId: PRODUCT_ID,
    sku: 'TEE-BLUE-M',
    name: 'Blue / M',
    status: VariantStatus.Inactive,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  },
];

function setup(options: {
  snapshot?: ResourceState<ProductDetails>;
  specificationsSnapshot?: ResourceState<ProductSpecification[]>;
  imagesSnapshot?: ResourceState<ProductImage[]>;
  variantsSnapshot?: ResourceState<ProductVariant[]>;
  selectedVariantId?: string | null;
  selectedVariant?: ProductVariant | null;
  quantity?: number;
  productId?: string | null;
  culture?: 'en' | 'fr';
  platform?: 'browser' | 'server';
}): {
  fixture: ComponentFixture<ProductDetailsPage>;
  element: HTMLElement;
  loadCalls: unknown[];
  loadSpecificationsCalls: unknown[];
  loadImagesCalls: unknown[];
  loadVariantsCalls: unknown[];
  selectCalls: unknown[];
  quantityCalls: unknown[];
  clearSelectionCalls: number;
  resetQuantityCalls: number;
  resetCalls: number;
  setSelectedVariant: (variant: ProductVariant | null) => void;
} {
  const loadCalls: unknown[] = [];
  const loadSpecificationsCalls: unknown[] = [];
  const loadImagesCalls: unknown[] = [];
  const loadVariantsCalls: unknown[] = [];
  const selectCalls: unknown[] = [];
  const quantityCalls: unknown[] = [];
  const selectedVariant = signal<ProductVariant | null>(options.selectedVariant ?? null);
  let clearSelectionCalls = 0;
  let resetQuantityCalls = 0;
  let resetCalls = 0;
  const stateStub = {
    product: signal(options.snapshot ?? idleResource<ProductDetails>()),
    specifications: signal(
      options.specificationsSnapshot ?? idleResource<ProductSpecification[]>(),
    ),
    images: signal(options.imagesSnapshot ?? idleResource<ProductImage[]>()),
    variants: signal(options.variantsSnapshot ?? idleResource<ProductVariant[]>()),
    selectedVariantId: signal(options.selectedVariantId ?? null),
    selectedVariant,
    quantity: signal(options.quantity ?? 1),
    loadProduct: ((id: unknown) => {
      loadCalls.push(id);
    }) as ProductDetailsState['loadProduct'],
    loadSpecifications: ((id: unknown) => {
      loadSpecificationsCalls.push(id);
    }) as ProductDetailsState['loadSpecifications'],
    loadProductImages: ((id: unknown) => {
      loadImagesCalls.push(id);
    }) as ProductDetailsState['loadProductImages'],
    loadProductVariants: ((id: unknown) => {
      loadVariantsCalls.push(id);
    }) as ProductDetailsState['loadProductVariants'],
    selectVariant: ((id: unknown) => {
      selectCalls.push(id);
    }) as ProductDetailsState['selectVariant'],
    setQuantity: ((value: unknown) => {
      quantityCalls.push(value);
    }) as ProductDetailsState['setQuantity'],
    clearVariantSelection: (() => {
      clearSelectionCalls += 1;
    }) as ProductDetailsState['clearVariantSelection'],
    resetQuantity: (() => {
      resetQuantityCalls += 1;
    }) as ProductDetailsState['resetQuantity'],
    reset: (() => {
      resetCalls += 1;
    }) as ProductDetailsState['reset'],
  } as unknown as ProductDetailsState;
  const routeStub = {
    paramMap: of(
      convertToParamMap({
        ...(options.productId === undefined || options.productId === null
          ? {}
          : { id: options.productId }),
      }),
    ),
  } as unknown as ActivatedRoute;

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ProductDetailsState, useValue: stateStub },
      { provide: ActivatedRoute, useValue: routeStub },
      ...(options.platform === undefined
        ? []
        : [{ provide: PLATFORM_ID, useValue: options.platform }]),
    ],
  });
  window.localStorage.clear();
  TestBed.inject(CultureService).setCulture(options.culture ?? 'en');
  const fixture = TestBed.createComponent(ProductDetailsPage);
  fixture.detectChanges();
  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    loadCalls,
    loadSpecificationsCalls,
    loadImagesCalls,
    loadVariantsCalls,
    selectCalls,
    quantityCalls,
    clearSelectionCalls,
    resetQuantityCalls,
    resetCalls,
    setSelectedVariant: (variant: ProductVariant | null) => selectedVariant.set(variant),
  };
}

describe('ProductDetailsPage route parameter', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads every details slot and clears the selection for a valid route id on init', () => {
    const {
      loadCalls,
      loadSpecificationsCalls,
      loadImagesCalls,
      loadVariantsCalls,
      clearSelectionCalls,
      resetQuantityCalls,
    } = setup({
      productId: PRODUCT_ID,
    });

    expect(loadCalls).toEqual([PRODUCT_ID]);
    expect(loadSpecificationsCalls).toEqual([PRODUCT_ID]);
    expect(loadImagesCalls).toEqual([PRODUCT_ID]);
    expect(loadVariantsCalls).toEqual([PRODUCT_ID]);
    expect(clearSelectionCalls).toBe(1);
    expect(resetQuantityCalls).toBe(1);
  });

  it('never fetches and renders the invalid state for a missing id', () => {
    const {
      element,
      loadCalls,
      loadSpecificationsCalls,
      loadImagesCalls,
      loadVariantsCalls,
      resetCalls,
    } = setup({
      productId: null,
    });

    expect(loadCalls).toEqual([]);
    expect(loadSpecificationsCalls).toEqual([]);
    expect(loadImagesCalls).toEqual([]);
    expect(loadVariantsCalls).toEqual([]);
    expect(resetCalls).toBe(1);
    expect(element.querySelector('flux-empty-state')).not.toBeNull();
    expect(element.querySelector('flux-loading-indicator')).toBeNull();
  });

  it('never fetches and renders the invalid state for a malformed id', () => {
    const { element, loadCalls } = setup({ productId: 'not-a-product' });

    expect(loadCalls).toEqual([]);
    expect(element.querySelector('flux-empty-state')).not.toBeNull();
  });

  it('skips loading on the server (prerenders the idle shell)', () => {
    const { element, loadCalls } = setup({ productId: PRODUCT_ID, platform: 'server' });

    expect(loadCalls).toEqual([]);
    expect(element.querySelector('flux-loading-indicator')).toBeNull();
    expect(element.querySelector('h1')?.textContent).toBe('Product details');
  });
});

describe('ProductDetailsPage resource states', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the loading state while the product fetches', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: loadingResource<ProductDetails>(),
    });

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.querySelector('flux-error-state')).toBeNull();
  });

  it('renders the not-found state for 404 without an error state or retry', () => {
    const { element, fixture, loadCalls } = setup({
      productId: PRODUCT_ID,
      snapshot: errorResource(new ApiError({ status: 404, message: 'Not found.' })),
    });

    expect(element.querySelector('flux-empty-state')).not.toBeNull();
    expect(element.querySelector('flux-error-state')).toBeNull();
    expect(element.querySelector('.product-details-back a')?.getAttribute('href')).toBe('/catalog');
    expect(loadCalls).toEqual([PRODUCT_ID]);

    fixture.detectChanges();
    expect(loadCalls).toEqual([PRODUCT_ID]);
  });

  it('renders the error state on non-404 failures and retries all slots', () => {
    const {
      element,
      fixture,
      loadCalls,
      loadSpecificationsCalls,
      loadImagesCalls,
      loadVariantsCalls,
    } = setup({
      productId: PRODUCT_ID,
      snapshot: errorResource(new ApiError({ status: 500, message: 'Server error.' })),
    });

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    expect(element.querySelector('flux-empty-state')).toBeNull();
    expect(loadCalls).toEqual([PRODUCT_ID]);
    expect(loadSpecificationsCalls).toEqual([PRODUCT_ID]);
    expect(loadImagesCalls).toEqual([PRODUCT_ID]);
    expect(loadVariantsCalls).toEqual([PRODUCT_ID]);

    element.querySelector('flux-error-state button')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(loadCalls).toEqual([PRODUCT_ID, PRODUCT_ID]);
    expect(loadSpecificationsCalls).toEqual([PRODUCT_ID, PRODUCT_ID]);
    expect(loadImagesCalls).toEqual([PRODUCT_ID, PRODUCT_ID]);
    expect(loadVariantsCalls).toEqual([PRODUCT_ID, PRODUCT_ID]);
  });

  it('renders localized copy for the active culture', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: loadingResource<ProductDetails>(),
      culture: 'fr',
    });

    expect(element.querySelector('h1')?.textContent).toBe('Détails du produit');
    expect(element.querySelector('flux-loading-indicator')?.textContent).toContain(
      'Chargement du produit…',
    );
  });
});

describe('ProductDetailsPage information', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the product name as the heading with description and specifications', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      specificationsSnapshot: successResource(SPECIFICATIONS),
    });

    expect(element.querySelector('h1')?.textContent).toBe('Tee');
    expect(element.querySelector('.product-details-description')?.textContent?.trim()).toBe(
      'A comfortable cotton tee.',
    );
    const terms = [...element.querySelectorAll('.product-details-spec dt')].map((term) =>
      term.textContent?.trim(),
    );
    const values = [...element.querySelectorAll('.product-details-spec dd')].map((value) =>
      value.textContent?.trim(),
    );
    expect(terms).toEqual(['Material', 'Fit']);
    expect(values).toEqual(['Cotton', 'Regular']);
    expect(element.querySelector('flux-error-state')).toBeNull();
  });

  it('renders the localized fallback when the product has no description', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: successResource({ ...PRODUCT, description: null }),
      specificationsSnapshot: successResource(SPECIFICATIONS),
    });

    expect(element.querySelector('.product-details-description')?.textContent?.trim()).toBe(
      'No description available.',
    );
  });

  it('hides the specifications section when the product carries none', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      specificationsSnapshot: emptyResource<ProductSpecification[]>([]),
    });

    expect(element.querySelector('h1')?.textContent).toBe('Tee');
    expect(element.querySelector('.product-details-specs')).toBeNull();
  });

  it('still shows the product when specifications fail to load', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      specificationsSnapshot: errorResource(
        new ApiError({ status: 500, message: 'Server error.' }),
      ),
    });

    expect(element.querySelector('h1')?.textContent).toBe('Tee');
    expect(element.querySelector('.product-details-specs')).toBeNull();
    expect(element.querySelector('flux-error-state')).toBeNull();
  });
});

describe('ProductDetailsPage gallery', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  const GALLERY_IMAGES: ProductImage[] = [
    {
      id: 'c3c3c3c3-3333-4333-8333-333333333333',
      productId: PRODUCT_ID,
      imageUrl: '/images/tee-front.jpg',
      altText: 'Tee front view',
      displayOrder: 0,
      isPrimary: true,
      metadata: null,
      createdAtUtc: '2026-09-04T10:00:00Z',
    },
    {
      id: 'd4d4d4d4-4444-4444-8444-444444444444',
      productId: PRODUCT_ID,
      imageUrl: '/images/tee-back.jpg',
      altText: null,
      displayOrder: 1,
      isPrimary: false,
      metadata: null,
      createdAtUtc: '2026-09-04T10:00:00Z',
    },
  ];

  it('renders the gallery with backend images once the product succeeds', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      specificationsSnapshot: successResource(SPECIFICATIONS),
      imagesSnapshot: successResource(GALLERY_IMAGES),
    });

    const gallery = element.querySelector('product-details-gallery');
    expect(gallery).not.toBeNull();
    expect(gallery?.querySelector('.product-gallery-main-image')?.getAttribute('src')).toBe(
      '/images/tee-front.jpg',
    );
    expect(gallery?.querySelectorAll('.product-gallery-thumb')).toHaveLength(2);
  });

  it('shows the gallery missing-image fallback when the product carries no images', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      specificationsSnapshot: successResource(SPECIFICATIONS),
      imagesSnapshot: emptyResource<ProductImage[]>([]),
    });

    const gallery = element.querySelector('product-details-gallery');
    expect(gallery).not.toBeNull();
    expect(gallery?.querySelector('.product-gallery-empty')?.textContent).toBe(
      'No images available.',
    );
  });

  it('hides the gallery while images load and shows the localized loading label', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      specificationsSnapshot: successResource(SPECIFICATIONS),
      imagesSnapshot: loadingResource<ProductImage[]>(),
    });

    expect(element.querySelector('product-details-gallery')).toBeNull();
    expect(element.querySelector('flux-loading-indicator')?.textContent).toContain(
      'Loading images…',
    );
  });

  it('still shows the product when images fail to load', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      specificationsSnapshot: successResource(SPECIFICATIONS),
      imagesSnapshot: errorResource(new ApiError({ status: 500, message: 'Server error.' })),
    });

    expect(element.querySelector('h1')?.textContent).toBe('Tee');
    expect(element.querySelector('product-details-gallery')).toBeNull();
    expect(element.querySelector('flux-error-state')).toBeNull();
  });
});

describe('ProductDetailsPage variant selector', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function successSetup(
    variantsSnapshot: ResourceState<ProductVariant[]>,
    selectedVariantId: string | null = null,
  ) {
    return setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      specificationsSnapshot: successResource(SPECIFICATIONS),
      variantsSnapshot,
      selectedVariantId,
    });
  }

  it('renders the selector with backend options once variants succeed', () => {
    const { element } = successSetup(successResource(VARIANTS));

    const selector = element.querySelector('product-details-variant-selector');
    expect(selector).not.toBeNull();
    expect(selector?.querySelector('.variant-selector-title')?.textContent).toBe('Variant');
    const names = [...(selector?.querySelectorAll('.variant-selector-name') ?? [])].map((name) =>
      name.textContent?.trim(),
    );
    expect(names).toEqual(['Red / M', 'Blue / M']);
  });

  it('reflects the feature-state selection in the selector', () => {
    const { element } = successSetup(
      successResource(VARIANTS),
      'aaaaaaaa-1111-4111-8111-111111111111',
    );

    const buttons = [
      ...element.querySelectorAll('product-details-variant-selector .variant-selector-option'),
    ];
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1]?.getAttribute('aria-pressed')).toBe('false');
  });

  it('forwards selector choices to feature state', () => {
    const { element, fixture, selectCalls } = successSetup(successResource(VARIANTS));

    [
      ...element.querySelectorAll('product-details-variant-selector .variant-selector-option'),
    ][0]?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(selectCalls).toEqual(['aaaaaaaa-1111-4111-8111-111111111111']);
  });

  it('hides the selector when variants are loading, empty, or failed', () => {
    const pending: ResourceState<ProductVariant[]>[] = [
      loadingResource<ProductVariant[]>(),
      emptyResource<ProductVariant[]>([]),
      errorResource(new ApiError({ status: 500, message: 'Server error.' })),
    ];
    for (const variantsSnapshot of pending) {
      TestBed.resetTestingModule();
      const { element } = successSetup(variantsSnapshot);

      expect(element.querySelector('h1')?.textContent).toBe('Tee');
      expect(element.querySelector('product-details-variant-selector')).toBeNull();
      expect(element.querySelector('flux-error-state')).toBeNull();
    }
  });
});

describe('ProductDetailsPage commercial section', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function commercialSetup(
    variantsSnapshot: ResourceState<ProductVariant[]>,
    selectedVariant: ProductVariant | null = null,
  ) {
    return setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      specificationsSnapshot: successResource(SPECIFICATIONS),
      variantsSnapshot,
      selectedVariant,
    });
  }

  it('binds the selected variant SKU once variants succeed', () => {
    const { element } = commercialSetup(successResource(VARIANTS), VARIANTS[0] ?? null);

    const commercial = element.querySelector('product-details-variant-commercial');
    expect(commercial).not.toBeNull();
    expect(commercial?.querySelector('.variant-commercial-title')?.textContent).toBe(
      'Variant details',
    );
    expect(commercial?.querySelector('.variant-commercial-row dt')?.textContent).toBe('SKU');
    expect(commercial?.querySelector('.variant-commercial-row dd')?.textContent).toBe('TEE-RED-M');
  });

  it('updates the SKU instantly on selection switches with no stale data', () => {
    const { element, fixture, setSelectedVariant } = commercialSetup(
      successResource(VARIANTS),
      VARIANTS[0] ?? null,
    );
    expect(element.querySelector('.variant-commercial-row dd')?.textContent).toBe('TEE-RED-M');

    const blue = VARIANTS[1];
    expect(blue).toBeDefined();
    setSelectedVariant({ ...blue!, status: VariantStatus.Active });
    fixture.detectChanges();

    const rows = [...element.querySelectorAll('.variant-commercial-row')];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.querySelector('dd')?.textContent).toBe('TEE-BLUE-M');
    expect(element.textContent).not.toContain('TEE-RED-M');
  });

  it('prompts for a selection when nothing is selected', () => {
    const { element } = commercialSetup(successResource(VARIANTS), null);

    expect(element.querySelector('.variant-commercial-prompt')?.textContent).toBe(
      'Select a variant to see its details.',
    );
    expect(element.querySelector('.variant-commercial-list')).toBeNull();
  });

  it('hides the commercial section with the selector when variants carry none', () => {
    const { element } = commercialSetup(emptyResource<ProductVariant[]>([]));

    expect(element.querySelector('h1')?.textContent).toBe('Tee');
    expect(element.querySelector('product-details-variant-commercial')).toBeNull();
  });
});

describe('ProductDetailsPage quantity section', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function quantitySetup(variantsSnapshot: ResourceState<ProductVariant[]>, quantity = 1) {
    return setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      specificationsSnapshot: successResource(SPECIFICATIONS),
      variantsSnapshot,
      quantity,
    });
  }

  it('renders the quantity selector echoing feature-local quantity', () => {
    const { element } = quantitySetup(successResource(VARIANTS), 2);

    const selector = element.querySelector('product-details-quantity-selector');
    expect(selector).not.toBeNull();
    expect(selector?.querySelector('.quantity-selector-title')?.textContent).toBe('Quantity');
    expect(
      (selector?.querySelector('.quantity-selector-input') as HTMLInputElement | null)?.value,
    ).toBe('2');
  });

  it('forwards quantity changes to feature state', () => {
    const { element, fixture, quantityCalls } = quantitySetup(successResource(VARIANTS), 1);

    const buttons = [
      ...element.querySelectorAll('product-details-quantity-selector .quantity-selector-button'),
    ];
    buttons[1]?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(quantityCalls).toEqual([2]);
  });

  it('hides the quantity section with the selector when variants carry none', () => {
    const { element } = quantitySetup(emptyResource<ProductVariant[]>([]));

    expect(element.querySelector('h1')?.textContent).toBe('Tee');
    expect(element.querySelector('product-details-quantity-selector')).toBeNull();
  });
});
