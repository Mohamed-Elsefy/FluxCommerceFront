import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  emptyResource,
  errorResource,
  loadingResource,
  provideApi,
  provideAppEnvironment,
  successResource,
  type ResourceState,
} from '@flux/api';
import { CultureService } from '@flux/i18n';
import { ReservationListState } from '../../state/reservation-list-state';
import type { AdminReservationPage } from '../../models/inventory-admin.models';
import { ReservationListPage } from './reservation-list-page';

function row(id: string) {
  return {
    reservationId: id,
    orderId: '4fa85f64-5717-4562-b3fc-2c963f66afa6',
    sku: 'TEE-BLK-M',
    quantity: 2,
    status: 0,
    expiresAt: '2026-09-04T10:30:00Z',
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:00:00Z',
  };
}

function setup(scenario: { page?: ResourceState<AdminReservationPage> }): {
  load: ReturnType<typeof vi.fn>;
  setPage: ReturnType<typeof vi.fn>;
  setFilters: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
} {
  const load = vi.fn();
  const setPage = vi.fn();
  const setFilters = vi.fn();
  const reload = vi.fn();
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
        provide: ReservationListState,
        useValue: {
          page: signal(scenario.page ?? loadingResource<AdminReservationPage>()),
          load,
          setPage,
          setFilters,
          reload,
        },
      },
    ],
  });
  window.localStorage.clear();
  return { load, setPage, setFilters, reload };
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(ReservationListPage);
  TestBed.inject(CultureService).setCulture('en');
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ReservationListPage', () => {
  it('loads the first page on init and renders rows with deep links', () => {
    const { load } = setup({
      page: successResource<AdminReservationPage>({
        items: [row('res-1'), row('res-2')],
        totalCount: 2,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const element = render();

    expect(load).toHaveBeenCalledTimes(1);
    expect(element.querySelector('h1')?.textContent).toBe('Reservations list');
    const links = [...element.querySelectorAll('admin-data-table a')].map((node) =>
      node.getAttribute('href'),
    );
    expect(links).toContain('/inventory/reservations/res-1');
    expect(links).toContain('/inventory/reservations/res-2');
    expect(element.textContent).toContain('Pending');
  });

  it('commits filters on apply', () => {
    const { setFilters } = setup({ page: emptyResource<AdminReservationPage>() });
    const element = render();

    const form = element.querySelector('.reservation-list-filters') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));

    expect(setFilters).toHaveBeenCalledTimes(1);
  });

  it('clears filters through the filter bar', () => {
    const { setFilters } = setup({ page: loadingResource<AdminReservationPage>() });
    const element = render();

    const clear = element.querySelector('.filter-bar-clear') as HTMLButtonElement;
    expect(clear).not.toBeNull();
    clear.click();

    expect(setFilters).toHaveBeenCalledWith({});
  });

  it('commits pager moves through the state', () => {
    const { setPage } = setup({
      page: successResource<AdminReservationPage>({
        items: [row('res-1')],
        totalCount: 25,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const element = render();

    const next = [...element.querySelectorAll('admin-pagination button')].find(
      (button) => button.textContent?.trim() === 'Next',
    ) as HTMLButtonElement;
    next.click();

    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('renders the empty state for out-of-range pages', () => {
    setup({ page: emptyResource<AdminReservationPage>() });
    const element = render();

    expect(element.querySelector('admin-data-table')).not.toBeNull();
    expect(element.textContent).toContain('No reservations found');
  });

  it('renders the error state with retry', () => {
    const { reload } = setup({
      page: errorResource<AdminReservationPage>(new ApiError({ status: 400, message: 'Invalid.' })),
    });
    const element = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    const retry = element.querySelector('flux-error-state button') as HTMLButtonElement;
    retry.click();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
