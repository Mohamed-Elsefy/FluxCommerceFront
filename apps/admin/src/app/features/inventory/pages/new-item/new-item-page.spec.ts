import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError, provideApi, provideAppEnvironment } from '@flux/api';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { InventoryAdminApiService } from '../../data-access/inventory-admin-api.service';
import { NewItemPage } from './new-item-page';

function createdRecord() {
  return {
    sku: 'SSD-121',
    onHandQuantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
    updatedAtUtc: '2026-09-29T10:00:00Z',
  };
}

function setup(
  scenario: {
    createItem?: (body: unknown) => ReturnType<typeof of>;
    querySku?: string | null;
  } = {},
): {
  createItem: ReturnType<typeof vi.fn>;
} {
  const createItem = vi.fn(
    (body: unknown) =>
      scenario.createItem?.(body) ??
      of({ isSuccess: true, message: 'Created.', data: createdRecord() }),
  );
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
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap(
              scenario.querySku === undefined || scenario.querySku === null
                ? {}
                : { sku: scenario.querySku },
            ),
          },
        },
      },
      { provide: InventoryAdminApiService, useValue: { createItem } },
    ],
  });
  window.localStorage.clear();
  return { createItem };
}

function render(): {
  fixture: ReturnType<typeof TestBed.createComponent<NewItemPage>>;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(NewItemPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function fill(element: HTMLElement, id: string, value: string): void {
  const input = element.querySelector(`#${id}`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
}

function submit(element: HTMLElement): void {
  element
    .querySelector('.new-item-page-form')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('NewItemPage', () => {
  it('renders the creation form without a result', () => {
    setup({});
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('New inventory item');
    expect(element.querySelector('#new-item-sku')).not.toBeNull();
    expect(element.querySelector('#new-item-quantity')).not.toBeNull();
    expect(element.querySelector('.new-item-page-facts')).toBeNull();
  });

  it('prefills the SKU from the ?sku= query parameter', () => {
    setup({ querySku: 'ssd-121' });
    const { element } = render();

    expect((element.querySelector('#new-item-sku') as HTMLInputElement).value).toBe('ssd-121');
  });

  it('blocks invalid submits without traffic', () => {
    const { createItem } = setup({});
    const { element } = render();

    fill(element, 'new-item-quantity', '-5');
    submit(element);

    expect(createItem).not.toHaveBeenCalled();
    expect(element.querySelector('.new-item-page-facts')).toBeNull();
  });

  it('creates the item with the normalized body and renders the backend-returned record', () => {
    const { createItem } = setup({});
    const { fixture, element } = render();

    fill(element, 'new-item-sku', 'ssd-121');
    fill(element, 'new-item-quantity', '0');
    submit(element);
    fixture.detectChanges();

    expect(createItem).toHaveBeenCalledWith({ sku: 'SSD-121', onHandQuantity: 0 });
    const facts = element.querySelector('.new-item-page-facts')?.textContent ?? '';
    expect(facts).toContain('SSD-121');
    expect(element.querySelector('.new-item-page-view-stock')?.getAttribute('href')).toBe(
      '/inventory/stock/SSD-121',
    );
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('success');
    expect(notifications.at(-1)?.title).toBe('Inventory item created');
  });

  it('renders duplicate SKUs as the form-level notice with input preserved', () => {
    const { createItem } = setup({
      createItem: () => throwError(() => new ApiError({ status: 409, message: 'Conflict.' })),
    });
    const { fixture, element } = render();

    fill(element, 'new-item-sku', 'SSD-121');
    fill(element, 'new-item-quantity', '10');
    submit(element);
    fixture.detectChanges();

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.new-item-page-facts')).toBeNull();
    expect((element.querySelector('#new-item-sku') as HTMLInputElement).value).toBe('SSD-121');
  });
});
