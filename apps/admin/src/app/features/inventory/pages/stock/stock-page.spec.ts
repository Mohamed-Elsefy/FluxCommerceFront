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
import type { InventoryItemResponse } from '@flux/models';
import { StockState } from '../../state/stock-state';
import { StockPage } from './stock-page';

function stock(): InventoryItemResponse {
  return {
    sku: 'TEE-BLK-M',
    onHandQuantity: 100,
    reservedQuantity: 2,
    availableQuantity: 98,
    updatedAtUtc: '2026-09-04T10:00:00Z',
  };
}

function setup(
  scenario: {
    stock?: ResourceState<InventoryItemResponse>;
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
        provide: StockState,
        useValue: { stock: signal(scenario.stock ?? idleResource()), lookup },
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
  fixture: ReturnType<typeof TestBed.createComponent<StockPage>>;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(StockPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function fillSku(element: HTMLElement, value: string): void {
  const input = element.querySelector(`#stock-sku`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
}

function submitLookup(element: HTMLElement): void {
  // jsdom never implements `requestSubmit()`, so a native submit-button
  // click performs no submission — dispatch the submit event directly.
  element
    .querySelector('.stock-page-lookup')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('StockPage', () => {
  it('auto-loads the route SKU on the deep-link entry', () => {
    const { lookup } = setup({ stock: successResource(stock()), params: { sku: 'TEE-BLK-M' } });
    render();

    expect(lookup).toHaveBeenCalledWith('TEE-BLK-M');
  });

  it('prompts for a SKU while untouched and blocks blank submits', () => {
    const { lookup } = setup();
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('Stock');
    expect(element.textContent).toContain('Look up a SKU');
    submitLookup(element);

    expect(lookup).not.toHaveBeenCalled();
  });

  it('looks up the entered SKU and renders backend-issued facts verbatim', () => {
    const { lookup } = setup({ stock: successResource(stock()) });
    const { element } = render();

    fillSku(element, 'tee-blk-m');
    submitLookup(element);

    expect(lookup).toHaveBeenCalledWith('tee-blk-m');
    const facts = element.querySelector('.stock-page-facts')?.textContent ?? '';
    expect(facts).toContain('TEE-BLK-M');
    expect(facts).toContain('100');
    expect(facts).toContain('98');
  });

  it('renders the loading state while the lookup runs', () => {
    setup({ stock: loadingResource() });
    const { element } = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
  });

  it('renders the error state with retry that re-enters the editor value', () => {
    const { lookup } = setup({
      stock: errorResource(new ApiError({ status: 404, message: 'Not found.' })),
    });
    const { fixture, element } = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    fillSku(element, 'missing');
    (element.querySelector('flux-error-state button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(lookup).toHaveBeenCalledWith('missing');
  });

  it('localizes the lookup page for the active culture', () => {
    setup({});
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const { element } = render();

      expect(element.querySelector('h1')?.textContent).toBe('Stock');
      expect(element.textContent).toContain('Rechercher un SKU');
    } finally {
      cultures.setCulture('en');
    }
  });
});
