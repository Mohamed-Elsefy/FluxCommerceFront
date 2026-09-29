import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError, provideApi, provideAppEnvironment } from '@flux/api';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { InventoryAdminApiService } from '../../data-access/inventory-admin-api.service';
import { AdjustmentsPage } from './adjustments-page';

function stockRecord() {
  return {
    sku: 'TEE-BLK-M',
    onHandQuantity: 125,
    reservedQuantity: 2,
    availableQuantity: 123,
    updatedAtUtc: '2026-09-04T10:05:00Z',
  };
}

function setup(scenario: { adjustStock?: (sku: string, body: unknown) => ReturnType<typeof of> }): {
  adjustStock: ReturnType<typeof vi.fn>;
} {
  const adjustStock = vi.fn(
    (sku: string, body: unknown) =>
      scenario.adjustStock?.(sku, body) ??
      of({ isSuccess: true, message: 'Adjusted.', data: stockRecord() }),
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
      { provide: InventoryAdminApiService, useValue: { adjustStock } },
    ],
  });
  window.localStorage.clear();
  return { adjustStock };
}

function render(): {
  fixture: ReturnType<typeof TestBed.createComponent<AdjustmentsPage>>;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(AdjustmentsPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function fill(element: HTMLElement, id: string, value: string): void {
  const input = element.querySelector(`#${id}`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
}

function openConfirm(element: HTMLElement): void {
  element
    .querySelector('.adjustments-page-form')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('AdjustmentsPage', () => {
  it('renders the adjustment form without a result', () => {
    setup({});
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('Adjustments');
    expect(element.querySelector('#adjust-sku')).not.toBeNull();
    expect(element.querySelector('#adjust-quantity')).not.toBeNull();
    expect(element.querySelector('.adjustments-page-facts')).toBeNull();
  });

  it('blocks invalid submits without opening the dialog', () => {
    const { adjustStock } = setup({});
    const { element } = render();

    fill(element, 'adjust-quantity', '0');
    openConfirm(element);

    expect(adjustStock).not.toHaveBeenCalled();
    expect(element.querySelector('admin-dialog .dialog-panel')).toBeNull();
  });

  it('confirms the adjustment and renders the backend-returned record', () => {
    const { adjustStock } = setup({});
    const { fixture, element } = render();

    fill(element, 'adjust-sku', 'tee-blk-m');
    fill(element, 'adjust-quantity', '25');
    openConfirm(element);
    fixture.detectChanges();
    expect(element.textContent).toContain('Add 25 units to “TEE-BLK-M”?');
    (element.querySelector('.adjustments-page-dialog-confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(adjustStock).toHaveBeenCalledWith('TEE-BLK-M', { quantity: 25 });
    const facts = element.querySelector('.adjustments-page-facts')?.textContent ?? '';
    expect(facts).toContain('125');
    expect(facts).toContain('123');
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('success');
    expect(notifications.at(-1)?.title).toBe('Stock adjusted');
  });

  it('closes the dialog without acting on cancel', () => {
    const { adjustStock } = setup({});
    const { fixture, element } = render();

    fill(element, 'adjust-sku', 'TEE-BLK-M');
    fill(element, 'adjust-quantity', '25');
    openConfirm(element);
    fixture.detectChanges();
    (element.querySelector('.adjustments-page-dialog-cancel') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(adjustStock).not.toHaveBeenCalled();
    expect(element.querySelector('admin-dialog .dialog-panel')).toBeNull();
  });

  it('projects backend field errors onto the form without closing it', () => {
    const rejection = new ApiError({
      status: 400,
      message: 'Validation failed.',
      validationErrors: { Quantity: ['Quantity must be positive.'] },
    });
    const { adjustStock } = setup({ adjustStock: () => throwError(() => rejection) });
    const { fixture, element } = render();

    fill(element, 'adjust-sku', 'TEE-BLK-M');
    fill(element, 'adjust-quantity', '25');
    openConfirm(element);
    fixture.detectChanges();
    (element.querySelector('.adjustments-page-dialog-confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(adjustStock).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain('Quantity must be positive.');
    expect(element.querySelector('admin-dialog .dialog-panel')).toBeNull();
    expect(element.textContent).not.toContain('Updated stock');
  });

  it('renders a form-level notice for non-validation failures', () => {
    setup({
      adjustStock: () => throwError(() => new ApiError({ status: 409, message: 'Conflict.' })),
    });
    const { fixture, element } = render();

    fill(element, 'adjust-sku', 'TEE-BLK-M');
    fill(element, 'adjust-quantity', '25');
    openConfirm(element);
    fixture.detectChanges();
    (element.querySelector('.adjustments-page-dialog-confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element.textContent).toContain('Could not adjust stock');
    expect(element.querySelector('.adjustments-page-create-link')).toBeNull();
  });

  it('names the missing SKU and links to creation on 404', () => {
    setup({
      adjustStock: () => throwError(() => new ApiError({ status: 404, message: 'Not found.' })),
    });
    const { fixture, element } = render();

    fill(element, 'adjust-sku', 'ssd-121');
    fill(element, 'adjust-quantity', '25');
    openConfirm(element);
    fixture.detectChanges();
    (element.querySelector('.adjustments-page-dialog-confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element.textContent).toContain('No inventory item exists for “SSD-121”.');
    const link = element.querySelector('.adjustments-page-create-link');
    expect(link?.textContent?.trim()).toBe('Create inventory item');
    expect(link?.getAttribute('href')).toBe('/inventory/new?sku=SSD-121');
    expect((element.querySelector('#adjust-sku') as HTMLInputElement).value).toBe('ssd-121');
  });
});
