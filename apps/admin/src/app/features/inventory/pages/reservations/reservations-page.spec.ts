import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import {
  ApiError,
  errorResource,
  idleResource,
  loadingResource,
  provideApi,
  provideAppEnvironment,
  successResource,
  type ResourceState,
} from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { InventoryReservationResponse } from '@flux/models';
import { ReservationState } from '../../state/reservation-state';
import { ReservationsPage } from './reservations-page';

const RESERVATION_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

function reservation(): InventoryReservationResponse {
  return {
    reservationId: RESERVATION_ID,
    orderId: '4fa85f64-5717-4562-b3fc-2c963f66afa6',
    sku: 'TEE-BLK-M',
    quantity: 2,
    status: 0,
    expiresAt: '2026-09-04T10:30:00Z',
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:00:00Z',
  };
}

function setup(
  scenario: {
    reservation?: ResourceState<InventoryReservationResponse>;
    params?: Record<string, string | null>;
  } = {},
): {
  lookup: ReturnType<typeof vi.fn>;
} {
  const lookup = vi.fn();
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
        provide: ReservationState,
        useValue: { reservation: signal(scenario.reservation ?? idleResource()), lookup },
      },
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap(scenario.params ?? {})) },
      },
    ],
  });
  window.localStorage.clear();
  return { lookup };
}

function render(): {
  fixture: ReturnType<typeof TestBed.createComponent<ReservationsPage>>;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(ReservationsPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function fillId(element: HTMLElement, value: string): void {
  const input = element.querySelector('#reservation-id') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
}

function submitLookup(element: HTMLElement): void {
  // jsdom never implements `requestSubmit()`, so a native submit-button
  // click performs no submission — dispatch the submit event directly.
  element
    .querySelector('.reservations-page-lookup')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('ReservationsPage', () => {
  it('auto-loads the route id on the deep-link entry', () => {
    const { lookup } = setup({ params: { id: RESERVATION_ID } });
    const fixture = TestBed.createComponent(ReservationsPage);
    fixture.detectChanges();

    expect(lookup).toHaveBeenCalledWith(RESERVATION_ID);
  });

  it('prompts for an id while untouched and blocks blank submits', () => {
    const { lookup } = setup();
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('Reservations');
    expect(element.textContent).toContain('Look up a reservation');
    submitLookup(element);

    expect(lookup).not.toHaveBeenCalled();
  });

  it('looks up the entered id and renders backend-issued facts verbatim', () => {
    const { lookup } = setup({ reservation: successResource(reservation()) });
    const { element } = render();

    fillId(element, RESERVATION_ID);
    submitLookup(element);

    expect(lookup).toHaveBeenCalledWith(RESERVATION_ID);
    const facts = element.querySelector('.reservations-page-facts')?.textContent ?? '';
    expect(facts).toContain(RESERVATION_ID);
    expect(facts).toContain('TEE-BLK-M');
    expect(element.querySelector('flux-badge')?.textContent?.trim()).toBe('Pending');
  });

  it('renders the loading state while the lookup runs', () => {
    setup({ reservation: loadingResource() });
    const { element } = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
  });

  it('renders the error state with retry that re-enters the editor value', () => {
    const { lookup } = setup({
      reservation: errorResource(new ApiError({ status: 404, message: 'Not found.' })),
    });
    const { fixture, element } = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    fillId(element, RESERVATION_ID);
    (element.querySelector('flux-error-state button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(lookup).toHaveBeenCalledWith(RESERVATION_ID);
  });

  it('localizes the lookup page for the active culture', () => {
    setup({});
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const { element } = render();

      expect(element.querySelector('h1')?.textContent).toBe('Réservations');
      expect(element.textContent).toContain('Rechercher une réservation');
    } finally {
      cultures.setCulture('en');
    }
  });
});
