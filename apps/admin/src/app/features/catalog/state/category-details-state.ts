/**
 * Feature-owned category details state for Sub-Phase 13.5 — Category
 * Management.
 *
 * Scope: the single-category slot behind the category details and edit
 * pages (`GET /catalog/categories/{id}`) plus lifecycle transitions
 * with duplicate-submit prevention. Category writes (create/update)
 * run in the owning pages over the data-access service with their own
 * submit locks; this state only loads the settled truth and runs
 * transitions.
 *
 * Lifecycle contract: every supported transition (`activate`,
 * `deactivate`, `soft-delete`, `restore` — there is no `archive` for
 * categories) runs with the lock held and the category slot reloads on
 * success (the new status arrives backend-side). The backend owns
 * transition validity (`409` surfaces for the page to display, never
 * for the SPA to predict).
 *
 * Locality rules (same convention as `catalog-overview-state`, 13.2):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, envelopes unwrap here, dataless envelopes resolve to `error`.
 * CSR-safe: no browser APIs anywhere in this file.
 */

import { computed, inject, Injectable, OnDestroy, signal, type Signal } from '@angular/core';
import { finalize, map, Subscription, tap, type Observable } from 'rxjs';
import {
  ApiError,
  createResourceState,
  loadResourceState,
  UNKNOWN_ERROR_CODE,
  type ApiResponseWithData,
  type ResourceState,
  type ResourceStateStore,
} from '@flux/api';
import type { CategoryLifecycleAction, CategoryResponse } from '@flux/models';
import { CatalogAdminApiService } from '../data-access/catalog-admin-api.service';
import type { AdminCategoryRow } from '../models/catalog-admin.models';

/**
 * Feature-scoped category details state. Provide at the catalog route
 * level — never at root. All selectors are readonly signals; loads and
 * transitions are explicit calls driven by owning pages.
 */
@Injectable()
export class CategoryDetailsState implements OnDestroy {
  private readonly catalogApi = inject(CatalogAdminApiService);
  private loads = new Subscription();

  private readonly categoryStore: ResourceStateStore<AdminCategoryRow> =
    createResourceState<AdminCategoryRow>();
  private readonly transitionLock = signal(false);

  /** Current category (idle → loading → success | empty | error). */
  readonly category: Signal<ResourceState<AdminCategoryRow>> = this.categoryStore.state;

  /** Whether a lifecycle transition is in flight (dialog actions lock). */
  readonly transitionInFlight: Signal<boolean> = computed(() => this.transitionLock());

  /**
   * Loads the category slot. Previous loads tear down first, so
   * navigating between categories can never interleave records. The
   * edit page reuses this loader for form population (display sections
   * do not exist for categories — the record is the whole page).
   */
  load(id: string): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    this.loads.add(
      loadResourceState(
        this.categoryStore,
        this.catalogApi.getCategory(id).pipe(map(requireCategory)),
      ),
    );
  }

  /**
   * Runs one lifecycle transition for the loaded category. Concurrent
   * calls return `null` (duplicate-submit prevention at the state level);
   * otherwise the backend call runs with the lock held and the category
   * slot reloads on success (the new status arrives backend-side).
   * Failures — including `409` illegal transitions — propagate untouched
   * for the page to notify.
   */
  transition(id: string, action: CategoryLifecycleAction): Observable<unknown> | null {
    if (this.transitionLock()) {
      return null;
    }
    this.transitionLock.set(true);
    return this.catalogApi.transitionCategory(id, action).pipe(
      tap({ next: () => this.reload(id), error: () => undefined }),
      finalize(() => this.transitionLock.set(false)),
    );
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }

  private reload(id: string): void {
    this.loads.add(
      loadResourceState(
        this.categoryStore,
        this.catalogApi.getCategory(id).pipe(map(requireCategory)),
      ),
    );
  }
}

/** Unwraps a single-category envelope; a dataless `200` is a violation. */
function requireCategory(envelope: ApiResponseWithData<CategoryResponse>): CategoryResponse {
  const data = envelope.data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}
