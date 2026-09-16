/**
 * Catalog contract mirrors for Sub-Phase 1.1.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §2 and
 * `docs/frontend-contract/DTO_REFERENCE.md` §2
 * (`FluxCommerce.Modules.Catalog.Contracts` records).
 *
 * Notes:
 * - Catalog contracts carry zero `DataAnnotations` (Fluent/domain only).
 * - Nullability is significant: requests use nullable `string | null`,
 *   responses use non-nullable `string` for names/slugs/skus.
 * - All enums are NUMBERS on the wire (see `./enums`).
 * - Timestamps are `DateTime`/`DateTime | null` (not `DateTimeOffset`).
 * - Writes: create → `201 ApiResponse<Guid|Guid[]>`; lifecycle/assign/
 *   update/delete → `204` empty. Reads: `200 ApiResponse<...>` (controller
 *   default `[Authorize]`; every `GET` is `[AllowAnonymous]`, writes need
 *   the `Admin` role).
 */

import type { Guid, IsoDateString } from '../common/shared-types';
import type {
  AttributeDataType,
  AttributeStatus,
  CatalogProductSortBy,
  CatalogProductSortDirection,
  CategoryStatus,
  ProductStatus,
  ProductVisibility,
  VariantStatus,
} from '../common/enums';

/** Nullable SEO sub-object on product create/update. `keywords` is `string[] | null`. */
export interface SeoRequest {
  title?: string | null;
  description?: string | null;
  keywords?: string[] | null;
}

/** Non-null keyword list on read (`IReadOnlyList<string>`, never null). */
export interface SeoResponse {
  title?: string | null;
  description?: string | null;
  keywords: string[];
}

/** `POST /catalog/products` / `PUT /catalog/products/{id}` body. */
export interface CreateProductRequest {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  categoryId: Guid;
  visibility: ProductVisibility;
  seo?: SeoRequest | null;
}

/** `PUT /catalog/products/{id}` body — same shape as create. */
export type UpdateProductRequest = CreateProductRequest;

/** `POST /catalog/categories` / `PUT /catalog/categories/{id}` body. */
export interface CreateCategoryRequest {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  parentId?: Guid | null;
}

/** `PUT /catalog/categories/{id}` body — same shape as create. */
export type UpdateCategoryRequest = CreateCategoryRequest;

/**
 * `POST /catalog/products/{productId}/variants` body.
 * `currency` is non-nullable (ISO-4217 upper, `^[A-Z]{3}$`); `unitPriceAmount`
 * is a JSON number (decimal — never float-math client-side).
 */
export interface CreateProductVariantRequest {
  sku?: string | null;
  name?: string | null;
  unitPriceAmount: number;
  currency: string;
}

/** `POST /catalog/products/{productId}/variants/batch` body — nullable wrapper. */
export interface CreateProductVariantsRequest {
  variants?: CreateProductVariantRequest[] | null;
}

/** `PUT .../variants/{variantId}` body — only these 2 fields, no price/status. */
export interface UpdateProductVariantRequest {
  sku?: string | null;
  name?: string | null;
}

/**
 * `POST /catalog/attribute-definitions` /
 * `PUT /catalog/attribute-definitions/{id}` body.
 * `sortOrder` / nullable `categoryId` exist only here.
 */
export interface CreateAttributeDefinitionRequest {
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  dataType: AttributeDataType;
  isRequired: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  sortOrder: number;
  categoryId?: Guid | null;
}

/** `PUT /catalog/attribute-definitions/{id}` body — same 9-field shape. */
export type UpdateAttributeDefinitionRequest = CreateAttributeDefinitionRequest;

/** `POST /catalog/products/{productId}/attributes` body. */
export interface AssignProductAttributeValueRequest {
  attributeDefinitionId: Guid;
  value?: string | null;
}

/**
 * `PUT .../attributes/{attributeDefinitionId}` body — single field only,
 * no `attributeDefinitionId` in the body.
 */
export interface UpdateProductAttributeValueRequest {
  value?: string | null;
}

/**
 * `POST /catalog/products/{productId}/images` body.
 * `metadata` is exactly a nullable string→string dictionary.
 */
export interface AddProductImageRequest {
  imageUrl?: string | null;
  altText?: string | null;
  isPrimary: boolean;
  displayOrder: number;
  metadata?: Record<string, string> | null;
}

/** `PUT .../images/{imageId}` body — no `isPrimary` here. */
export interface UpdateProductImageRequest {
  imageUrl?: string | null;
  altText?: string | null;
  displayOrder: number;
  metadata?: Record<string, string> | null;
}

/** `PUT .../images/reorder` body — ids must match the existing set. */
export interface ReorderProductImagesRequest {
  orderedImageIds?: Guid[] | null;
}

/** `POST .../specifications` / `PUT .../specifications/{specificationId}` body. */
export interface CreateProductSpecificationRequest {
  name?: string | null;
  value?: string | null;
}

/** `PUT .../specifications/{specificationId}` body — same shape. */
export type UpdateProductSpecificationRequest = CreateProductSpecificationRequest;

/** `GET /catalog/products/{id}` (+ paged list/search item detail) payload. */
export interface ProductResponse {
  id: Guid;
  name: string;
  slug: string;
  description?: string | null;
  seo?: SeoResponse | null;
  status: ProductStatus;
  visibility: ProductVisibility;
  categoryId: Guid;
  isDeleted: boolean;
  createdAtUtc: IsoDateString;
  deletedAtUtc?: IsoDateString | null;
}

/** `GET /catalog/categories/{id}` (+ paged list item) payload. */
export interface CategoryResponse {
  id: Guid;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: Guid | null;
  status: CategoryStatus;
  isDeleted: boolean;
  createdAtUtc: IsoDateString;
  deletedAtUtc?: IsoDateString | null;
}

/** Variant payload — backend-issued unit price snapshot plus currency. */
export interface VariantResponse {
  id: Guid;
  productId: Guid;
  sku: string;
  name: string;
  unitPriceAmount: number;
  currency: string;
  status: VariantStatus;
  isDeleted: boolean;
  createdAtUtc: IsoDateString;
  deletedAtUtc?: IsoDateString | null;
}

/** `GET /catalog/attribute-definitions/{id}` (+ list item) payload. */
export interface AttributeDefinitionResponse {
  id: Guid;
  name: string;
  slug: string;
  description?: string | null;
  dataType: AttributeDataType;
  isRequired: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  sortOrder: number;
  categoryId?: Guid | null;
  status: AttributeStatus;
  isDeleted: boolean;
  createdAtUtc: IsoDateString;
  deletedAtUtc?: IsoDateString | null;
}

/** Attribute value payload — denormalized names, `value` non-null. */
export interface ProductAttributeValueResponse {
  id: Guid;
  productId: Guid;
  attributeDefinitionId: Guid;
  attributeName: string;
  attributeSlug: string;
  dataType: AttributeDataType;
  value: string;
}

/** Image payload — no `UpdatedAt`/`DeletedAt`; list ordered by `displayOrder`. */
export interface ProductImageResponse {
  id: Guid;
  productId: Guid;
  imageUrl: string;
  altText?: string | null;
  displayOrder: number;
  isPrimary: boolean;
  metadata?: Record<string, string> | null;
  createdAtUtc: IsoDateString;
}

/** Specification payload — `name`/`value` both non-null. */
export interface ProductSpecificationResponse {
  id: Guid;
  productId: Guid;
  name: string;
  value: string;
}

/** Storefront search list item (`GET /catalog`) — never a POST body. */
export interface CatalogProductListItem {
  id: Guid;
  name: string;
  slug: string;
  description?: string | null;
  categoryId: Guid;
  primaryImage?: CatalogImageSummary | null;
}

/** Primary-image summary embedded in `CatalogProductListItem`. */
export interface CatalogImageSummary {
  id: Guid;
  imageUrl: string;
  altText?: string | null;
  displayOrder: number;
  isPrimary: boolean;
}

/** Variant summary for product details — backend-issued unit price snapshot plus currency. */
export interface CatalogVariantSummary {
  id: Guid;
  sku: string;
  name: string;
  unitPriceAmount: number;
  currency: string;
}

/** Attribute summary for product details. */
export interface CatalogAttributeSummary {
  attributeDefinitionId: Guid;
  name: string;
  slug: string;
  dataType: AttributeDataType;
  value: string;
}

/** Specification summary for product details. */
export interface CatalogSpecificationSummary {
  id: Guid;
  name: string;
  value: string;
}

/** Full storefront product-details read model. */
export interface CatalogProductDetails {
  id: Guid;
  name: string;
  slug: string;
  description?: string | null;
  seo?: SeoResponse | null;
  categoryId: Guid;
  images: CatalogImageSummary[];
  variants: CatalogVariantSummary[];
  attributes: CatalogAttributeSummary[];
  specifications: CatalogSpecificationSummary[];
}

/** Category tree read model. */
export interface CatalogCategoryTree {
  id: Guid;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: Guid | null;
  children: CatalogCategoryTree[];
}

/**
 * `GET /catalog` (storefront search) query.
 * Enums are numeric on the wire for JSON but the query binder also accepts
 * case-insensitive names (`?status=Active` ≡ `?status=1`).
 */
export interface CatalogSearchQuery {
  searchTerm?: string;
  categoryId?: Guid;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  sortBy?: CatalogProductSortBy;
  sortDirection?: CatalogProductSortDirection;
  pageNumber?: number;
  pageSize?: number;
}
