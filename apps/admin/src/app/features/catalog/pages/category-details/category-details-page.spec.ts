import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
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
import type { CategoryResponse } from '@flux/models';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { CategoryDetailsState } from '../../state/category-details-state';
import { CategoryLookupState } from '../../state/category-lookup-state';
import { CategoryDetailsPage } from './category-details-page';

function category(overrides: Partial<CategoryResponse> = {}): CategoryResponse {
  return {
    id: 'cat-1',
    name: 'Alpha',
    slug: 'alpha',
    description: 'Top level',
    parentId: null,
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
    ...overrides,
  };
}

function setup(scenario: { category?: ResourceState<CategoryResponse> }): {
  load: ReturnType<typeof vi.fn>;
  transition: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
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
        useValue: { paramMap: of(convertToParamMap({ id: 'cat-1' })) },
      },
      {
        provide: CategoryDetailsState,
        useValue: {
          category: signal(scenario.category ?? successResource(category())),
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
  const navigate = vi
    .spyOn(TestBed.inject(Router), 'navigate')
    .mockImplementation(() => Promise.resolve(true));
  return { load, transition, navigate };
}

function render(): {
  fixture: ReturnType<typeof TestBed.createComponent<CategoryDetailsPage>>;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(CategoryDetailsPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('CategoryDetailsPage', () => {
  it('renders metadata, badge, parent, and forward actions on success', () => {
    setup({});
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('Alpha');
    expect(element.querySelector('flux-badge')?.textContent?.trim()).toBe('Active');
    expect(element.textContent).toContain('Top level');
    expect(element.textContent).toContain('—');
    const actions = [...element.querySelectorAll('.category-details-action')].map((button) =>
      button.textContent?.trim(),
    );
    expect(actions).toEqual(['Activate', 'Deactivate', 'Delete']);
    expect(element.querySelector('.category-details-edit')?.getAttribute('href')).toBe(
      '/catalog/categories/cat-1/edit',
    );
  });

  it('offers only restore for deleted categories', () => {
    setup({ category: successResource(category({ isDeleted: true, status: 1 })) });
    const { element } = render();

    const actions = [...element.querySelectorAll('.category-details-action')].map((button) =>
      button.textContent?.trim(),
    );
    expect(actions).toEqual(['Restore']);
  });

  it('confirms a lifecycle action and notifies on success', () => {
    const { transition } = setup({});
    const { fixture, element } = render();

    const deactivate = [...element.querySelectorAll('.category-details-action')].find(
      (button) => button.textContent?.trim() === 'Deactivate',
    ) as HTMLButtonElement;
    deactivate.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Do you want to deactivate “Alpha”?');

    (element.querySelector('.category-details-dialog-confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(transition).toHaveBeenCalledWith('cat-1', 'deactivate');
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('success');
    expect(notifications.at(-1)?.title).toBe('Status updated');
  });

  it('closes the dialog without acting on cancel', () => {
    const { transition } = setup({});
    const { fixture, element } = render();

    const deactivate = [...element.querySelectorAll('.category-details-action')].find(
      (button) => button.textContent?.trim() === 'Deactivate',
    ) as HTMLButtonElement;
    deactivate.click();
    fixture.detectChanges();
    (element.querySelector('.category-details-dialog-cancel') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(transition).not.toHaveBeenCalled();
    expect(element.querySelector('admin-dialog .dialog-panel')).toBeNull();
  });

  it('notifies on transition failure without losing the page', () => {
    const rejection = new ApiError({ status: 409, message: 'Conflict.' });
    const { transition } = setup({});
    transition.mockReturnValueOnce(throwError(() => rejection));
    const { fixture, element } = render();

    const deactivate = [...element.querySelectorAll('.category-details-action')].find(
      (button) => button.textContent?.trim() === 'Deactivate',
    ) as HTMLButtonElement;
    deactivate.click();
    fixture.detectChanges();
    (element.querySelector('.category-details-dialog-confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('error');
    expect(notifications.at(-1)?.title).toBe('Status change failed');
    expect(element.querySelector('h1')?.textContent).toBe('Alpha');
  });

  it('renders the error state with retry when the category fails', () => {
    const { load } = setup({
      category: errorResource(new ApiError({ status: 404, message: 'Not found.' })),
    });
    const { element } = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    (element.querySelector('flux-error-state button') as HTMLButtonElement).click();

    expect(load).toHaveBeenCalledWith('cat-1');
  });
});
