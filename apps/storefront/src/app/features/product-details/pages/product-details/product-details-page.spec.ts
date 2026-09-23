/**
 * Page tests for the `ProductDetailsPage` (Sub-Phases 6.1–6.9 — Foundation
 * + Page & Information + Image Gallery + Variant Selection + SKU Binding +
 * Quantity Selection + Add to Cart Integration + SSR & SEO).
 *
 * `ProductDetailsState` is stubbed at its typed seam (its orchestration is
 * covered by `product-details-state.spec.ts`) and `GuestCartService` is
 * stubbed at its seam (its lifecycle is covered by
 * `guest-cart.service.spec.ts`), so these tests own the page logic:
 * product + specifications + images + variants loads driven by the
 * `:id` route parameter on both platforms (server fetch feeds SSR +
 * transfer; the server never renders browser-only shells), graceful
 * missing/malformed ids (no fetch, invalid state, slot reset), loading /
 * success / error / not-found rendering, error retry over all slots,
 * specification rendering (wire order, empty-hidden), gallery integration
 * (rendering, empty fallback, failure hiding), selector integration
 * (rendering, selection forwarding, clearing on product change),
 * commercial integration (SKU + backend-issued unit-price binding,
 * no-selection prompt, unavailable handling), quantity integration
 * (rendering, forwarding), guest add-to-cart integration (guest lifecycle
 * bootstrap, gated mounting, priced guest submission, no-identity
 * fallback), submission-feedback lifecycle resets, and dynamic SSR-safe
 * metadata (title, description, OpenGraph per resource state, incl. 404).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, computed, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { Subscription, of } from 'rxjs';
import {
  ApiError,
  emptyResource,
  errorResource,
  idleResource,
  loadingResource,
  successResource,
  type ResourceState,
} from '@flux/api';
import { CultureService, formatCurrency } from '@flux/i18n';
import { CANONICAL_LINK_SELECTOR, FALLBACK_SOCIAL_IMAGE } from '@flux/utils';
import { AuthService } from '@flux/auth';
import { VariantStatus, type ProductResponse } from '@flux/models';
import { GuestCartService } from '../../../cart/state/guest-cart.service';
import { AuthenticatedCartService } from '../../../cart/state/authenticated-cart.service';
import type { CartIdentity } from '../../../cart/models/cart.models';
import { ProductDetailsState } from '../../state/product-details-state';
import { isSelectableVariant } from '../../models/product-details.models';
import type {
  AddToCartStatus,
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
    unitPriceAmount: 29.99,
    currency: 'USD',
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
    unitPriceAmount: 14.5,
    currency: 'USD',
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
  addToCartStatus?: AddToCartStatus;
  addToCartError?: ApiError | null;
  guestIdentity?: CartIdentity | null;
  authenticated?: boolean;
  productId?: string | null;
  culture?: 'en' | 'fr' | 'ar';
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
  resetAddToCartCalls: unknown[];
  resetCalls: number;
  guestInitializeCount: () => number;
  guestSubmissions: { cartId: unknown; pricing: unknown }[];
  authSubmissions: { pricing: unknown }[];
  establishCount: () => number;
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
  const resetAddToCartCalls: unknown[] = [];
  let resetCalls = 0;
  const guestSubmissions: { cartId: unknown; pricing: unknown }[] = [];
  let guestInitializeCalls = 0;
  const authSubmissions: { pricing: unknown }[] = [];
  let establishCalls = 0;
  const stateStub = {
    product: signal(options.snapshot ?? idleResource<ProductDetails>()),
    specifications: signal(
      options.specificationsSnapshot ?? idleResource<ProductSpecification[]>(),
    ),
    images: signal(options.imagesSnapshot ?? idleResource<ProductImage[]>()),
    variants: signal(options.variantsSnapshot ?? idleResource<ProductVariant[]>()),
    selectedVariantId: signal(options.selectedVariantId ?? null),
    selectedVariant,
    selectedVariantSelectable: computed(() => {
      const selected = selectedVariant();
      return selected !== null && isSelectableVariant(selected);
    }),
    quantity: signal(options.quantity ?? 1),
    addToCartStatus: signal(options.addToCartStatus ?? 'idle'),
    addToCartError: signal(options.addToCartError ?? null),
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
    resetAddToCartStatus: (() => {
      resetAddToCartCalls.push(true);
    }) as ProductDetailsState['resetAddToCartStatus'],
    submitGuestAddToCart: ((cartId: unknown, pricing: unknown) => {
      guestSubmissions.push({ cartId, pricing });
      return Subscription.EMPTY;
    }) as ProductDetailsState['submitGuestAddToCart'],
    submitAddToCart: ((pricing: unknown) => {
      authSubmissions.push({ pricing });
      return Subscription.EMPTY;
    }) as ProductDetailsState['submitAddToCart'],
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
      {
        provide: GuestCartService,
        useValue: {
          initialize: (() => {
            guestInitializeCalls += 1;
            return Subscription.EMPTY;
          }) as GuestCartService['initialize'],
          identity: signal<CartIdentity | null>(options.guestIdentity ?? null),
        } as unknown as GuestCartService,
      },
      {
        provide: AuthenticatedCartService,
        useValue: {
          establishAuthenticated: (() => {
            establishCalls += 1;
            return Subscription.EMPTY;
          }) as AuthenticatedCartService['establishAuthenticated'],
        } as unknown as AuthenticatedCartService,
      },
      {
        provide: AuthService,
        useValue: {
          isAuthenticated: signal(options.authenticated ?? false),
        } as unknown as AuthService,
      },
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
    resetAddToCartCalls,
    resetCalls,
    guestInitializeCount: () => guestInitializeCalls,
    guestSubmissions,
    authSubmissions,
    establishCount: () => establishCalls,
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
      resetAddToCartCalls,
    } = setup({
      productId: PRODUCT_ID,
    });

    expect(loadCalls).toEqual([PRODUCT_ID]);
    expect(loadSpecificationsCalls).toEqual([PRODUCT_ID]);
    expect(loadImagesCalls).toEqual([PRODUCT_ID]);
    expect(loadVariantsCalls).toEqual([PRODUCT_ID]);
    expect(clearSelectionCalls).toBe(1);
    expect(resetQuantityCalls).toBe(1);
    expect(resetAddToCartCalls).toHaveLength(1);
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

  it('fetches on the server for SSR (idle shell until settle, no browser APIs)', () => {
    const { element, loadCalls } = setup({ productId: PRODUCT_ID, platform: 'server' });

    expect(loadCalls).toEqual([PRODUCT_ID]);
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

  it('renders Arabic copy for the RTL culture without direction branching', () => {
    const { element } = setup({ productId: null, culture: 'ar' });

    expect(element.querySelector('h1')?.textContent).toBe('تفاصيل المنتج');
    expect(element.querySelector('flux-empty-state .title')?.textContent).toBe(
      'رابط المنتج غير صالح',
    );
    expect(element.querySelector('flux-empty-state .message')?.textContent).toBe(
      'رابط المنتج هذا مفقود أو غير صالح.',
    );
  });

  it('keeps every labelled section reference resolvable (landmark integrity)', () => {
    const { element } = setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      specificationsSnapshot: successResource(SPECIFICATIONS),
    });

    for (const labelled of [...element.querySelectorAll('[aria-labelledby]')]) {
      const target = labelled.getAttribute('aria-labelledby');
      expect(target).not.toBeNull();
      expect(
        element.querySelector(`#${target}`),
        `aria-labelledby target missing: ${target}`,
      ).not.toBeNull();
    }
    expect(element.querySelector('h1')?.textContent).toBe('Tee');
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

  it('clears stale submission feedback on selector choices', () => {
    const { element, fixture, resetAddToCartCalls } = successSetup(successResource(VARIANTS));
    expect(resetAddToCartCalls).toHaveLength(1);

    [
      ...element.querySelectorAll('product-details-variant-selector .variant-selector-option'),
    ][0]?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(resetAddToCartCalls).toHaveLength(2);
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

  it('binds the selected variant SKU and backend unit price once variants succeed', () => {
    const { element } = commercialSetup(successResource(VARIANTS), VARIANTS[0] ?? null);

    const commercial = element.querySelector('product-details-variant-commercial');
    expect(commercial).not.toBeNull();
    expect(commercial?.querySelector('.variant-commercial-title')?.textContent).toBe(
      'Variant details',
    );
    const rows = [...(commercial?.querySelectorAll('.variant-commercial-row') ?? [])];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector('dt')?.textContent).toBe('SKU');
    expect(rows[0]?.querySelector('dd')?.textContent).toBe('TEE-RED-M');
    expect(rows[1]?.querySelector('dt')?.textContent).toBe('Unit price');
    expect(rows[1]?.querySelector('dd')?.textContent).toBe(formatCurrency(29.99, 'USD', 'en'));
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
    expect(rows).toHaveLength(2);
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

  it('clears stale submission feedback on quantity changes', () => {
    const { element, fixture, resetAddToCartCalls } = quantitySetup(successResource(VARIANTS), 1);
    expect(resetAddToCartCalls).toHaveLength(1);

    const buttons = [
      ...element.querySelectorAll('product-details-quantity-selector .quantity-selector-button'),
    ];
    buttons[1]?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(resetAddToCartCalls).toHaveLength(2);
  });

  it('hides the quantity section with the selector when variants carry none', () => {
    const { element } = quantitySetup(emptyResource<ProductVariant[]>([]));

    expect(element.querySelector('h1')?.textContent).toBe('Tee');
    expect(element.querySelector('product-details-quantity-selector')).toBeNull();
  });
});

describe('ProductDetailsPage add-to-cart section (ADR 018)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  const GUEST_CART_ID = '11111111-1111-4111-8111-111111111111';

  function cartSetup(
    options: {
      guestIdentity?: CartIdentity | null;
      authenticated?: boolean;
      selectedVariant?: ProductVariant | null;
      addToCartStatus?: AddToCartStatus;
      addToCartError?: ApiError | null;
    } = {},
  ) {
    return setup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      specificationsSnapshot: successResource(SPECIFICATIONS),
      variantsSnapshot: successResource(VARIANTS),
      selectedVariant:
        options.selectedVariant === undefined ? (VARIANTS[0] ?? null) : options.selectedVariant,
      addToCartStatus: options.addToCartStatus ?? 'idle',
      addToCartError: options.addToCartError ?? null,
      guestIdentity:
        options.guestIdentity === undefined
          ? { kind: 'guest', cartId: GUEST_CART_ID }
          : options.guestIdentity,
      authenticated: options.authenticated ?? false,
    });
  }

  it('mounts the button beside quantity once variants succeed', () => {
    const { element } = cartSetup();

    const button = element.querySelector(
      'product-details-add-to-cart .add-to-cart-button',
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.textContent?.trim()).toBe('Add to cart');
  });

  it('delegates first-render synchronization to the session lifecycle', () => {
    // The page never bootstraps the guest flow directly on init — the
    // lifecycle service constructor effect owns first render (pinned with
    // real services in `cart-page.spec.ts` / `authenticated-cart.service.spec.ts`).
    const { guestInitializeCount } = cartSetup();

    expect(guestInitializeCount()).toBe(0);
  });

  it('enables submission for a selectable variant with guest identity', () => {
    const { element } = cartSetup();

    expect(
      (element.querySelector('.add-to-cart-button') as HTMLButtonElement | null)?.disabled,
    ).toBe(false);
  });

  it('disables submission until guest identity is established', () => {
    const { element } = cartSetup({ guestIdentity: null });

    expect(
      (element.querySelector('.add-to-cart-button') as HTMLButtonElement | null)?.disabled,
    ).toBe(true);
  });

  it('disables submission without a selected variant', () => {
    const { element } = cartSetup({ selectedVariant: null });

    expect(
      (element.querySelector('.add-to-cart-button') as HTMLButtonElement | null)?.disabled,
    ).toBe(true);
  });

  it('submits the backend-issued snapshot to the guest cart on add', () => {
    const { element, fixture, guestSubmissions } = cartSetup();

    element.querySelector('.add-to-cart-button')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(guestSubmissions).toEqual([
      {
        cartId: GUEST_CART_ID,
        pricing: { unitPriceAmount: 29.99, currency: 'USD' },
      },
    ]);
  });

  it('establishes the lifecycle when adding without identity instead of submitting', () => {
    // The disabled button already blocks this path in the DOM (defense in
    // depth); the direct call pins the page-level fallback.
    const { fixture, guestInitializeCount, guestSubmissions } = cartSetup({
      guestIdentity: null,
    });

    fixture.componentInstance.onAddToCart();

    expect(guestSubmissions).toHaveLength(0);
    expect(guestInitializeCount()).toBe(1);
  });

  it('enables submission for an authenticated session without guest identity', () => {
    const { element } = cartSetup({ authenticated: true, guestIdentity: null });

    expect(
      (element.querySelector('.add-to-cart-button') as HTMLButtonElement | null)?.disabled,
    ).toBe(false);
  });

  it('submits the backend-issued snapshot to the session cart when authenticated', () => {
    const { element, fixture, authSubmissions, guestSubmissions } = cartSetup({
      authenticated: true,
      guestIdentity: null,
    });

    element.querySelector('.add-to-cart-button')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(authSubmissions).toEqual([{ pricing: { unitPriceAmount: 29.99, currency: 'USD' } }]);
    expect(guestSubmissions).toHaveLength(0);
  });

  it('re-establishes the session cart when the authenticated add finds no active cart', () => {
    const noCart = new ApiError({
      status: 404,
      message: 'Cart not found.',
      code: 'Cart.CartNotFound',
    });
    const { fixture, establishCount } = cartSetup({
      authenticated: true,
      guestIdentity: null,
      addToCartError: noCart,
    });

    fixture.componentInstance.onAddToCart();

    expect(establishCount()).toBe(1);
  });
});

describe('ProductDetailsPage metadata (6.9 SSR & SEO)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function metaOf(fixture: ComponentFixture<ProductDetailsPage>): {
    title: string;
    description: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogType: string | null;
    ogUrl: string | null;
    ogImage: string | null;
    twitterCard: string | null;
    canonical: string | null;
  } {
    const meta = TestBed.inject(Meta);
    return {
      title: TestBed.inject(Title).getTitle(),
      description: meta.getTag("name='description'")?.getAttribute('content') ?? null,
      ogTitle: meta.getTag("property='og:title'")?.getAttribute('content') ?? null,
      ogDescription: meta.getTag("property='og:description'")?.getAttribute('content') ?? null,
      ogType: meta.getTag("property='og:type'")?.getAttribute('content') ?? null,
      ogUrl: meta.getTag("property='og:url'")?.getAttribute('content') ?? null,
      ogImage: meta.getTag("property='og:image'")?.getAttribute('content') ?? null,
      twitterCard: meta.getTag("name='twitter:card'")?.getAttribute('content') ?? null,
      canonical:
        TestBed.inject(DOCUMENT)
          .head.querySelector(CANONICAL_LINK_SELECTOR)
          ?.getAttribute('href') ?? null,
    };
  }

  function metadataSetup(options: {
    snapshot?: ResourceState<ProductDetails>;
    imagesSnapshot?: ResourceState<ProductImage[]>;
    productId?: string | null;
    platform?: 'browser' | 'server';
  }) {
    return setup({
      specificationsSnapshot: successResource(SPECIFICATIONS),
      ...options,
    });
  }

  it('sets product title, description, and OpenGraph tags on success', () => {
    const { fixture } = metadataSetup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
    });

    expect(metaOf(fixture)).toEqual({
      title: 'Tee | FluxCommerce',
      description: 'A comfortable cotton tee.',
      ogTitle: 'Tee | FluxCommerce',
      ogDescription: 'A comfortable cotton tee.',
      ogType: 'website',
      ogUrl: `/catalog/products/${PRODUCT_ID}`,
      ogImage: FALLBACK_SOCIAL_IMAGE,
      twitterCard: 'summary_large_image',
      canonical: `/catalog/products/${PRODUCT_ID}`,
    });
  });

  it('falls back to the localized description when the backend provides none', () => {
    const { fixture } = metadataSetup({
      productId: PRODUCT_ID,
      snapshot: successResource({ ...PRODUCT, description: null }),
    });

    expect(metaOf(fixture).description).toBe('No description available.');
  });

  it('sets not-found metadata without throwing on a 404', () => {
    const { element, fixture } = metadataSetup({
      productId: PRODUCT_ID,
      snapshot: errorResource(new ApiError({ status: 404, message: 'Not found.' })),
    });

    expect(element.querySelector('flux-empty-state')).not.toBeNull();
    expect(metaOf(fixture).title).toBe('Product not found | FluxCommerce');
    expect(metaOf(fixture).description).toBe(
      'This product does not exist or is no longer available.',
    );
  });

  it('sets error metadata without throwing on generic failures', () => {
    const { fixture } = metadataSetup({
      productId: PRODUCT_ID,
      snapshot: errorResource(new ApiError({ status: 500, message: 'Server error.' })),
    });

    expect(metaOf(fixture).title).toBe('Could not load the product | FluxCommerce');
  });

  it('applies shell metadata on the server without browser APIs', () => {
    const { element, fixture } = metadataSetup({
      productId: PRODUCT_ID,
      platform: 'server',
    });

    expect(element.querySelector('h1')?.textContent).toBe('Product details');
    expect(metaOf(fixture).title).toBe('Product details | FluxCommerce');
    expect(metaOf(fixture).ogType).toBe('website');
    expect(metaOf(fixture).canonical).toBe(`/catalog/products/${PRODUCT_ID}`);
  });

  it('falls back to the catalog canonical for invalid ids (11.3)', () => {
    const { fixture } = metadataSetup({ productId: null });

    expect(metaOf(fixture).canonical).toBe('/catalog');
    expect(metaOf(fixture).ogUrl).toBe('/catalog');
    expect(metaOf(fixture).ogImage).toBe(FALLBACK_SOCIAL_IMAGE);
    expect(TestBed.inject(DOCUMENT).head.querySelectorAll(CANONICAL_LINK_SELECTOR).length).toBe(1);
  });

  it('uses the backend-primary image for og:image on success (11.4)', () => {
    const { fixture } = metadataSetup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      imagesSnapshot: successResource([
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
      ]),
    });

    expect(metaOf(fixture).ogImage).toBe('/images/tee-front.jpg');
  });

  it('falls back to the bundled social image when the product has no usable images (11.4)', () => {
    const { fixture } = metadataSetup({
      productId: PRODUCT_ID,
      snapshot: successResource(PRODUCT),
      imagesSnapshot: emptyResource<ProductImage[]>([]),
    });

    expect(metaOf(fixture).ogImage).toBe(FALLBACK_SOCIAL_IMAGE);
  });

  it('never presents product imagery for failed lookups (11.4)', () => {
    const { fixture } = metadataSetup({
      productId: PRODUCT_ID,
      snapshot: errorResource(new ApiError({ status: 404, message: 'Not found.' })),
      imagesSnapshot: successResource([
        {
          id: 'c3c3c3c3-3333-4333-8333-333333333333',
          productId: PRODUCT_ID,
          imageUrl: '/images/tee-front.jpg',
          altText: null,
          displayOrder: 0,
          isPrimary: true,
          metadata: null,
          createdAtUtc: '2026-09-04T10:00:00Z',
        },
      ]),
    });

    expect(metaOf(fixture).title).toBe('Product not found | FluxCommerce');
    expect(metaOf(fixture).ogImage).toBe(FALLBACK_SOCIAL_IMAGE);
  });
});
