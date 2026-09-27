import { describe, expect, it } from 'vitest';
import {
  categoryNameOf,
  categoryStatusDisplay,
  categoryToFormValue,
  emptyCatalogOverview,
  emptyCategoryFormValue,
  emptyImageFormValue,
  emptyProductFormValue,
  emptySpecFormValue,
  emptyVariantFormValue,
  imageToFormValue,
  isCatalogOverviewEmpty,
  moveImageIds,
  productStatusDisplay,
  productToFormValue,
  productVisibilityDisplay,
  specToFormValue,
  toAddImageRequest,
  toCategoryOptions,
  toCreateCategoryRequest,
  toCreateProductRequest,
  toCatalogOverview,
  toCreateSpecRequest,
  toCreateVariantRequest,
  toFormErrorPath,
  toUpdateCategoryRequest,
  toUpdateImageRequest,
  toUpdateProductRequest,
  toUpdateSpecRequest,
  toUpdateVariantRequest,
  variantStatusDisplay,
  variantToFormValue,
  type AdminCategoryPage,
  type AdminProductPage,
} from './catalog-admin.models';
import type {
  CategoryResponse,
  ProductImageResponse,
  ProductResponse,
  ProductSpecificationResponse,
  VariantResponse,
} from '@flux/models';

function productPage(totalCount: number): AdminProductPage {
  return { items: [], totalCount, pageNumber: 1, pageSize: 1 };
}

function categoryPage(totalCount: number): AdminCategoryPage {
  return { items: [], totalCount, pageNumber: 1, pageSize: 1 };
}

describe('catalog-admin models', () => {
  it('projects the overview from backend-issued totals verbatim', () => {
    expect(toCatalogOverview(productPage(42), categoryPage(7))).toEqual({
      productTotal: 42,
      categoryTotal: 7,
    });
  });

  it('exposes a zero overview for the no-data case', () => {
    expect(emptyCatalogOverview()).toEqual({ productTotal: 0, categoryTotal: 0 });
  });

  it('treats only the all-zero overview as empty', () => {
    expect(isCatalogOverviewEmpty(emptyCatalogOverview())).toBe(true);
    expect(isCatalogOverviewEmpty(null)).toBe(true);
    expect(isCatalogOverviewEmpty({ productTotal: 0, categoryTotal: 1 })).toBe(false);
    expect(isCatalogOverviewEmpty({ productTotal: 1, categoryTotal: 0 })).toBe(false);
    expect(isCatalogOverviewEmpty({ productTotal: 3, categoryTotal: 2 })).toBe(false);
  });
});

function productResponse(): ProductResponse {
  return {
    id: 'prod-1',
    name: 'Tee',
    slug: 'tee',
    description: 'Cotton tee',
    seo: { title: 'Tee', description: null, keywords: ['cotton', 'summer'] },
    status: 1,
    visibility: 0,
    categoryId: 'cat-1',
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function categoryResponse(id: string, name: string): CategoryResponse {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    description: null,
    parentId: null,
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

describe('product form value', () => {
  it('exposes a blank value for the create page', () => {
    expect(emptyProductFormValue()).toEqual({
      name: null,
      slug: null,
      description: null,
      categoryId: null,
      visibility: null,
      seoTitle: null,
      seoDescription: null,
      seoKeywords: null,
    });
  });

  it('projects a loaded product into the form (edit population)', () => {
    expect(productToFormValue(productResponse())).toEqual({
      name: 'Tee',
      slug: 'tee',
      description: 'Cotton tee',
      categoryId: 'cat-1',
      visibility: '0',
      seoTitle: 'Tee',
      seoDescription: null,
      seoKeywords: 'cotton, summer',
    });
  });

  it('projects the form into the create body (blanks to null, keywords split)', () => {
    expect(
      toCreateProductRequest({
        name: '  Tee  ',
        slug: 'tee',
        description: '   ',
        categoryId: 'cat-1',
        visibility: '0',
        seoTitle: null,
        seoDescription: 'Nice tee',
        seoKeywords: 'cotton,  , summer,',
      }),
    ).toEqual({
      name: 'Tee',
      slug: 'tee',
      description: null,
      categoryId: 'cat-1',
      visibility: 0,
      seo: { title: null, description: 'Nice tee', keywords: ['cotton', 'summer'] },
    });
  });

  it('omits the seo object when every seo field is blank', () => {
    const body = toCreateProductRequest({
      ...emptyProductFormValue(),
      name: 'Tee',
      slug: 'tee',
      categoryId: 'cat-1',
      visibility: '1',
    });

    expect(body.seo).toBeNull();
    expect(body.visibility).toBe(1);
  });

  it('projects updates through the same shape as creates', () => {
    const value = {
      ...emptyProductFormValue(),
      name: 'Tee',
      slug: 'tee',
      categoryId: 'cat-1',
      visibility: '0',
    };

    expect(toUpdateProductRequest(value)).toEqual(toCreateProductRequest(value));
  });
});

describe('category options', () => {
  it('projects rows into options preserving response order', () => {
    expect(
      toCategoryOptions([categoryResponse('c2', 'Beta'), categoryResponse('c1', 'Alpha')]),
    ).toEqual([
      { value: 'c2', label: 'Beta' },
      { value: 'c1', label: 'Alpha' },
    ]);
  });

  it('resolves display names with raw-id fallback outside the lookup', () => {
    const rows = [categoryResponse('c1', 'Alpha')];

    expect(categoryNameOf(rows, 'c1')).toBe('Alpha');
    expect(categoryNameOf(rows, 'missing')).toBe('missing');
  });
});

describe('server field-error paths', () => {
  it('maps C# property names to dotted control paths', () => {
    expect(toFormErrorPath('Name')).toBe('name');
    expect(toFormErrorPath('CategoryId')).toBe('categoryId');
    expect(toFormErrorPath('Seo.Title')).toBe('seo.title');
    expect(toFormErrorPath('pageNumber')).toBe('pageNumber');
  });
});

describe('status and visibility display', () => {
  it('maps every known status to its bundle key and variant', () => {
    expect(productStatusDisplay(0)).toEqual({ labelKey: 'catalog.status.draft', variant: 'info' });
    expect(productStatusDisplay(1)).toEqual({
      labelKey: 'catalog.status.active',
      variant: 'success',
    });
    expect(productStatusDisplay(2)).toEqual({
      labelKey: 'catalog.status.inactive',
      variant: 'warning',
    });
    expect(productStatusDisplay(3)).toEqual({
      labelKey: 'catalog.status.archived',
      variant: 'neutral',
    });
  });

  it('falls back for unknown future values instead of crashing', () => {
    expect(productStatusDisplay(99)).toEqual({
      labelKey: 'catalog.status.unknown',
      variant: 'neutral',
    });
    expect(productVisibilityDisplay(99)).toEqual({
      labelKey: 'catalog.visibility.unknown',
      variant: 'neutral',
    });
  });

  it('maps visibility values to their bundle keys and variants', () => {
    expect(productVisibilityDisplay(0)).toEqual({
      labelKey: 'catalog.visibility.visible',
      variant: 'success',
    });
    expect(productVisibilityDisplay(1)).toEqual({
      labelKey: 'catalog.visibility.hidden',
      variant: 'warning',
    });
  });
});

function variantResponse(): VariantResponse {
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

describe('variant form value', () => {
  it('exposes a blank value for the create page', () => {
    expect(emptyVariantFormValue()).toEqual({ sku: null, name: null, price: null, currency: null });
  });

  it('projects a loaded variant into the form (edit population)', () => {
    expect(variantToFormValue(variantResponse())).toEqual({
      sku: 'TEE-BLK-M',
      name: 'Black / M',
      price: '29.99',
      currency: 'USD',
    });
  });

  it('projects the form into the create body (price parsed, currency uppercased)', () => {
    expect(
      toCreateVariantRequest({
        sku: '  tee-blk-m ',
        name: 'Black / M',
        price: ' 29.99 ',
        currency: 'usd',
      }),
    ).toEqual({ sku: 'tee-blk-m', name: 'Black / M', unitPriceAmount: 29.99, currency: 'USD' });
  });

  it('projects updates with sku and name only (no money fields)', () => {
    expect(
      toUpdateVariantRequest({
        sku: 'TEE-BLK-M',
        name: 'Black / M',
        price: '29.99',
        currency: 'USD',
      }),
    ).toEqual({ sku: 'TEE-BLK-M', name: 'Black / M' });
  });
});

describe('category form value', () => {
  it('exposes a blank value for the create page', () => {
    expect(emptyCategoryFormValue()).toEqual({
      name: null,
      slug: null,
      description: null,
      parentId: null,
    });
  });

  it('projects a loaded category into the form (edit population)', () => {
    expect(categoryToFormValue({ ...categoryResponse('c1', 'Alpha'), parentId: 'c0' })).toEqual({
      name: 'Alpha',
      slug: 'alpha',
      description: null,
      parentId: 'c0',
    });
    expect(categoryToFormValue(categoryResponse('c1', 'Alpha'))).toMatchObject({
      parentId: null,
    });
  });

  it('projects the form into the create body (blanks to null, empty parent to null)', () => {
    expect(
      toCreateCategoryRequest({
        name: '  Apparel ',
        slug: 'apparel',
        description: '  ',
        parentId: '',
      }),
    ).toEqual({ name: 'Apparel', slug: 'apparel', description: null, parentId: null });
    expect(
      toCreateCategoryRequest({ name: 'Kid', slug: 'kid', description: null, parentId: 'c1' }),
    ).toMatchObject({ parentId: 'c1' });
  });

  it('projects updates through the same shape as creates', () => {
    const value = { name: 'Kid', slug: 'kid', description: null, parentId: 'c1' };

    expect(toUpdateCategoryRequest(value)).toEqual(toCreateCategoryRequest(value));
  });
});

describe('category status display', () => {
  it('maps every known status to its bundle key and variant', () => {
    expect(categoryStatusDisplay(0)).toEqual({
      labelKey: 'catalog.categoryStatus.active',
      variant: 'success',
    });
    expect(categoryStatusDisplay(1)).toEqual({
      labelKey: 'catalog.categoryStatus.inactive',
      variant: 'warning',
    });
  });

  it('falls back for unknown future values instead of crashing', () => {
    expect(categoryStatusDisplay(99)).toEqual({
      labelKey: 'catalog.categoryStatus.unknown',
      variant: 'neutral',
    });
  });
});

describe('image form value', () => {
  const IMAGE: ProductImageResponse = {
    id: 'img-1',
    productId: 'prod-1',
    imageUrl: '/images/tee.jpg',
    altText: 'Tee',
    displayOrder: 0,
    isPrimary: true,
    metadata: { source: 'studio' },
    createdAtUtc: '2026-09-04T10:00:00Z',
  };

  it('exposes a blank value for the add dialog', () => {
    expect(emptyImageFormValue()).toEqual({
      url: null,
      altText: null,
      order: null,
      primary: false,
    });
  });

  it('projects a loaded image into the form with primary always false', () => {
    expect(imageToFormValue(IMAGE)).toEqual({
      url: '/images/tee.jpg',
      altText: 'Tee',
      order: '0',
      primary: false,
    });
  });

  it('projects the form into the add body (order parsed, metadata null)', () => {
    expect(
      toAddImageRequest({ url: ' /images/tee.jpg ', altText: '  ', order: '2', primary: true }),
    ).toEqual({
      imageUrl: '/images/tee.jpg',
      altText: null,
      isPrimary: true,
      displayOrder: 2,
      metadata: null,
    });
  });

  it('round-trips stored metadata on update (never primary)', () => {
    expect(
      toUpdateImageRequest(
        { url: '/images/tee.jpg', altText: null, order: '1', primary: true },
        IMAGE,
      ),
    ).toEqual({
      imageUrl: '/images/tee.jpg',
      altText: null,
      displayOrder: 1,
      metadata: { source: 'studio' },
    });
  });

  it('moves ids within the settled set and ignores out-of-range moves', () => {
    expect(moveImageIds(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveImageIds(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveImageIds(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveImageIds(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
    expect(moveImageIds(['a'], 0, 1)).toEqual(['a']);
  });
});

describe('specification form value', () => {
  const SPEC: ProductSpecificationResponse = {
    id: 'spec-1',
    productId: 'prod-1',
    name: 'Material',
    value: 'Cotton',
  };

  it('exposes a blank value and round-trips records through both bodies', () => {
    expect(emptySpecFormValue()).toEqual({ name: null, value: null });
    expect(specToFormValue(SPEC)).toEqual({ name: 'Material', value: 'Cotton' });
    expect(toCreateSpecRequest({ name: '  Material ', value: '  ' })).toEqual({
      name: 'Material',
      value: null,
    });
    expect(toUpdateSpecRequest({ name: 'Material', value: 'Wool' })).toEqual(
      toCreateSpecRequest({ name: 'Material', value: 'Wool' }),
    );
  });
});

describe('variant status display', () => {
  it('maps every known status to its bundle key and variant', () => {
    expect(variantStatusDisplay(0)).toEqual({
      labelKey: 'catalog.variantStatus.active',
      variant: 'success',
    });
    expect(variantStatusDisplay(1)).toEqual({
      labelKey: 'catalog.variantStatus.inactive',
      variant: 'warning',
    });
  });

  it('falls back for unknown future values instead of crashing', () => {
    expect(variantStatusDisplay(99)).toEqual({
      labelKey: 'catalog.variantStatus.unknown',
      variant: 'neutral',
    });
  });
});
