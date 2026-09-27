import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  ApiError,
  errorResource,
  provideApi,
  provideAppEnvironment,
  successResource,
} from '@flux/api';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { CatalogAdminApiService } from '../../data-access/catalog-admin-api.service';
import { CategoryLookupState } from '../../state/category-lookup-state';
import { CategoryCreatePage } from './category-create-page';

function setup(scenario: {
  createCategory?: (body: unknown) => ReturnType<typeof of>;
  lookupFails?: boolean;
}): {
  createCategory: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
  lookupLoad: ReturnType<typeof vi.fn>;
} {
  const createCategory = vi.fn(
    (body: unknown) =>
      scenario.createCategory?.(body) ??
      of({ isSuccess: true, message: 'Created.', data: 'cat-new' }),
  );
  const navigate = vi.fn(() => Promise.resolve(true));
  const lookupLoad = vi.fn();
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
      { provide: Router, useValue: { navigate } },
      { provide: CatalogAdminApiService, useValue: { createCategory } },
      {
        provide: CategoryLookupState,
        useValue: {
          categories: signal(
            scenario.lookupFails
              ? errorResource(new ApiError({ status: 500, message: 'Server error.' }))
              : successResource([]),
          ),
          options: signal([{ value: 'c0', label: 'Root' }]),
          load: lookupLoad,
        },
      },
      { provide: Router, useValue: { navigate } },
    ],
  });
  window.localStorage.clear();
  return { createCategory, navigate, lookupLoad };
}

function render(): {
  fixture: ReturnType<typeof TestBed.createComponent<CategoryCreatePage>>;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(CategoryCreatePage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function fill(element: HTMLElement, id: string, value: string): void {
  const input = element.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
}

describe('CategoryCreatePage', () => {
  it('creates the category, notifies, and navigates to details on success', () => {
    const { createCategory, navigate } = setup({});
    const { element } = render();

    fill(element, 'category-name', 'Apparel');
    fill(element, 'category-slug', 'apparel');
    fill(element, 'category-parent', 'c0');
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();

    expect(createCategory).toHaveBeenCalledTimes(1);
    expect(createCategory).toHaveBeenCalledWith({
      name: 'Apparel',
      slug: 'apparel',
      description: null,
      parentId: 'c0',
    });
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('success');
    expect(notifications.at(-1)?.title).toBe('Category created');
    expect(navigate).toHaveBeenCalledWith(['/catalog/categories', 'cat-new']);
  });

  it('projects backend field errors onto the form without navigating', () => {
    const rejection = new ApiError({
      status: 400,
      message: 'Validation failed.',
      validationErrors: { Slug: ['Slug is already used.'] },
    });
    const { createCategory, navigate } = setup({
      createCategory: () => throwError(() => rejection),
    });
    const { fixture, element } = render();

    fill(element, 'category-name', 'Apparel');
    fill(element, 'category-slug', 'apparel');
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(createCategory).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain('Slug is already used.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders a form-level notice for non-validation failures', () => {
    const { navigate } = setup({
      createCategory: () => throwError(() => new ApiError({ status: 409, message: 'Conflict.' })),
    });
    const { fixture, element } = render();

    fill(element, 'category-name', 'Apparel');
    fill(element, 'category-slug', 'apparel');
    (element.querySelector('.form-actions-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element.textContent).toContain('Could not save the category');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('cancels back to the category list', () => {
    const { navigate, createCategory } = setup({});
    const { element } = render();

    (element.querySelector('.form-actions-cancel') as HTMLButtonElement).click();

    expect(navigate).toHaveBeenCalledWith(['/catalog/categories']);
    expect(createCategory).not.toHaveBeenCalled();
  });

  it('surfaces lookup failures with retry while keeping the form usable', () => {
    const { lookupLoad, createCategory } = setup({ lookupFails: true });
    const { fixture, element } = render();

    expect(element.textContent).toContain('Could not load this section');
    expect(element.querySelector('app-category-form')).not.toBeNull();
    (element.querySelector('flux-error-state button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(lookupLoad).toHaveBeenCalledTimes(2);
    expect(createCategory).not.toHaveBeenCalled();
  });
});
