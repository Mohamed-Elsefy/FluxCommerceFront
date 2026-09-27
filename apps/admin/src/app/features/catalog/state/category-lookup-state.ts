/**
 * Feature-owned category lookup state for Sub-Phase 13.3 — Product
 * Management.
 *
 * Scope: one shared category snapshot behind the product list (display
 * names), the create form, and the edit form (select options). The full
 * category management slice (search, create, edit, delete, hierarchy UI)
 * arrives with Sub-Phase 13.5 — this state performs no category writes
 * and owns no query transitions.
 *
 * The lookup pages through `GET /catalog/categories` with the backend
 * maximum (`pageSize: 100`): the endpoint exposes no search and no larger
 * page, so names outside the first hundred fall back to raw ids
 * (`categoryNameOf`) instead of fabricated data. Load-once per route
 * instance (each navigation creates a fresh route-provided instance);
 * reloads stay explicit for future slices.
 *
 * Locality rules (same convention as `catalog-overview-state`, 13.2):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, dataless envelopes resolve to `error`. CSR-safe: no browser
 * APIs anywhere in this file.
 */

import { computed, inject, Injectable, OnDestroy, type Signal } from '@angular/core';
import { map, Subscription, type Observable } from 'rxjs';
import {
  ApiError,
  createResourceState,
  loadResourceState,
  UNKNOWN_ERROR_CODE,
  type ApiResponseWithData,
  type PagedApiResponse,
  type PagedResult,
  type ResourceState,
  type ResourceStateStore,
} from '@flux/api';
import type { CategoryResponse } from '@flux/models';
import { CatalogAdminApiService } from '../data-access/catalog-admin-api.service';
import { toCategoryOptions, type CategoryOption } from '../models/catalog-admin.models';

/** Lookup fetch size: the backend maximum page (`1..100`). */
export const CATEGORY_LOOKUP_PAGE_SIZE = 100;

/**
 * Feature-scoped category lookup state. Provide at the catalog route
 * level — never at root. All selectors are readonly signals; the only
 * transition is the explicit `load()` driven by owning pages.
 */
@Injectable()
export class CategoryLookupState implements OnDestroy {
  private readonly catalogApi = inject(CatalogAdminApiService);
  private readonly loads = new Subscription();

  private readonly snapshot: ResourceStateStore<readonly CategoryResponse[]> =
    createResourceState<readonly CategoryResponse[]>();

  /** Current category snapshot (idle → loading → success | empty | error). */
  readonly categories: Signal<ResourceState<readonly CategoryResponse[]>> = this.snapshot.state;

  /** Select options projected from the settled snapshot (`[]` until then). */
  readonly options: Signal<readonly CategoryOption[]> = computed(() =>
    toCategoryOptions(this.snapshot.data() ?? []),
  );

  /**
   * Loads the lookup snapshot (load-once guard: in-flight and settled
   * snapshots never refetch implicitly — reloads stay explicit).
   */
  load(): void {
    if (this.snapshot.isLoading() || this.snapshot.data() !== null) {
      return;
    }
    const request: Observable<readonly CategoryResponse[]> = this.catalogApi
      .listCategories({ pageNumber: 1, pageSize: CATEGORY_LOOKUP_PAGE_SIZE })
      .pipe(map(requireCategoryItems));
    this.loads.add(loadResourceState(this.snapshot, request));
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps the category items; a dataless `200` is a contract violation. */
function requireCategoryItems(
  envelope: PagedApiResponse<CategoryResponse>,
): readonly CategoryResponse[] {
  const data = (envelope as ApiResponseWithData<PagedResult<CategoryResponse>>).data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data.items;
}
