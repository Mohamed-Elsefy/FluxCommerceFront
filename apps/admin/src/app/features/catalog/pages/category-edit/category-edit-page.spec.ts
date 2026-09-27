import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  ApiError,
  errorResource,
  loadingResource,
  provideApi,
  provideAppEnvironment,
  successResource,
  type ResourceState,
} from '@flux/api';
import type { CategoryResponse } from '@flux/models';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { CatalogAdminApiService } from '../../data-access/catalog-admin-api.service';
import { CategoryDetailsState } from '../../state/category-details-state';
import { CategoryLookupState } from '../../state/category-lookup-state';
import { CategoryEditPage } from './category-edit-page';

function category(): CategoryResponse {
  return {
    id: 'cat-1',
    name: 'Alpha',
    slug: 'alpha',
    description: null,
    parentId: null,
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function setup(scenario: {
  category?: ResourceState<CategoryResponse>;
  updateCategory?: (id: string, body: unknown) => ReturnType<typeof of>;
}): {
  updateCategory: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
} {
  const updateCategory = vi.fn(
    (id: string, body: unknown) => scenario.updateCategory?.(id, body) ?? of(undefined),
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
        useValue: { paramMap: of(convertToParamMap({ id: 'cat-1' })) },
      },
      { provide: Router, useValue: { navigate } },
      { provide: CatalogAdminApiService, useValue: { updateCategory } },
      {
        provide: CategoryDetailsState,
        useValue: {
          category: signal(scenario.category ?? successResource(category())),
          transitionInFlight: signal(false),
          load: vi.fn(),
        },
      },
      {
        provide: CategoryLookupState,
        useValue: {
          categories: signal(successResource([])),
          options: signal([
            { value: 'cat-1', label: 'Alpha' },
            { value: 'c0', label: 'Root' },
          ]),
          load: vi.fn(),
        },
      },
    ],
  });
  window.localStorage.clear();
  return { updateCategory, navigate };
}

function render(): {
  fixture: ReturnType<typeof TestBed.createComponent<CategoryEditPage>>;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(CategoryEditPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('CategoryEditPage', () => {
  it('populates the form from the loaded category without self-parenting', () => {
    setup({});
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('Edit category');
    expect((element.querySelector('#category-name') as HTMLInputElement).value).toBe('Alpha');
    const parent = element.querySelector('#category-parent') as HTMLSelectElement;
    expect([...parent.options].map((option) => option.value)).toEqual(['', 'c0']);
  });

  it('updates the category, notifies, and navigates to details on success', () => {
    const { updateCategory, navigate } = setup({});
    const { element } = render();

    const name = element.querySelector('#category-name') as HTMLInputElement;
    name.value = 'Alpha Updated';
    name.dispatchEvent(new Event('input'));
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();

    expect(updateCategory).toHaveBeenCalledTimes(1);
    expect(updateCategory).toHaveBeenCalledWith(
      'cat-1',
      expect.objectContaining({ name: 'Alpha Updated' }),
    );
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('success');
    expect(notifications.at(-1)?.title).toBe('Category updated');
    expect(navigate).toHaveBeenCalledWith(['/catalog/categories', 'cat-1']);
  });

  it('keeps user input intact when a conflict fails the submit', () => {
    const { updateCategory, navigate } = setup({
      updateCategory: () => throwError(() => new ApiError({ status: 409, message: 'Conflict.' })),
    });
    const { fixture, element } = render();

    const name = element.querySelector('#category-name') as HTMLInputElement;
    name.value = 'Taken Name';
    name.dispatchEvent(new Event('input'));
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(updateCategory).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain('Could not save the category');
    expect((element.querySelector('#category-name') as HTMLInputElement).value).toBe('Taken Name');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders loading and error states for the category load', () => {
    setup({ category: loadingResource<CategoryResponse>() });
    const loading = render();
    expect(loading.element.querySelector('flux-loading-indicator')).not.toBeNull();
    TestBed.resetTestingModule();

    setup({
      category: errorResource<CategoryResponse>(new ApiError({ status: 404, message: 'Missing.' })),
    });
    const failed = render();
    expect(failed.element.querySelector('flux-error-state')).not.toBeNull();
    expect(failed.element.querySelector('app-category-form')).toBeNull();
  });
});
