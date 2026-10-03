/**
 * Page tests for the S1.9 `PaymentsMinePage`.
 *
 * Covers page orchestration only (resource rules in
 * `payments-mine-state.spec.ts`, transport in
 * `payment-api.service.spec.ts`): the loading shell before the page
 * settles, success rendering of backend rows with the status component,
 * empty rendering without a pager, error rendering with retry recovery,
 * pager-driven page moves, status-filter commits, and localized copy
 * with the document title.
 *
 * The real `PaymentsMineState` and `CultureService` are wired to a
 * stubbed `PaymentApiService` transport, so these tests pin the full
 * page → state → data-access delegation path without HTTP.
 *
 * Backend-authority pins: rows echo stubbed backend payloads (no math
 * performed here); statuses render verbatim; no order status exists
 * anywhere (no such contract field); no history timeline exists.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError, type Observable } from 'rxjs';
import { ApiError, type PagedApiResponse, type PagedResult } from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { PaymentMineRow } from '../../models/payments-mine.models';
import { PAYMENTS_MINE_DEFAULT_PAGE_SIZE } from '../../models/payments-mine.models';
import { PaymentApiService } from '../../data-access/payment-api.service';
import { PaymentsMineState } from '../../state/payments-mine-state';
import { PaymentsMinePage } from './payments-mine-page';

const PAYMENT_A = '22222222-2222-4222-8222-222222222222';

function row(overrides: Partial<PaymentMineRow> = {}): PaymentMineRow {
  return {
    id: PAYMENT_A,
    orderId: '11111111-1111-4111-8111-111111111111',
    customerId: '33333333-3333-4333-8333-333333333333',
    amount: 59.98,
    currency: 'USD',
    status: 'Succeeded',
    providerPaymentIntentId: 'pi_123',
    provider: 'stripe',
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:01:00Z',
    version: 3,
    ...overrides,
  };
}

function page(overrides: Partial<PagedResult<PaymentMineRow>> = {}): PagedResult<PaymentMineRow> {
  return {
    items: [row()],
    totalCount: 1,
    pageNumber: 1,
    pageSize: PAYMENTS_MINE_DEFAULT_PAGE_SIZE,
    ...overrides,
  };
}

function envelope(data: PagedResult<PaymentMineRow> | null): PagedApiResponse<PaymentMineRow> {
  return { isSuccess: true, data };
}

async function setup(
  source: () => Observable<PagedApiResponse<PaymentMineRow>> = () => of(envelope(page())),
): Promise<{
  fixture: ComponentFixture<PaymentsMinePage>;
  api: { listMine: ReturnType<typeof vi.fn> };
}> {
  const api = { listMine: vi.fn(source) };

  await TestBed.configureTestingModule({
    imports: [PaymentsMinePage],
    providers: [
      provideRouter([]),
      CultureService,
      PaymentsMineState,
      { provide: PaymentApiService, useValue: api },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(PaymentsMinePage);
  TestBed.inject(CultureService).setCulture('en');
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, api };
}

function textOf(fixture: ComponentFixture<PaymentsMinePage>, selector: string): string | null {
  return fixture.nativeElement.querySelector(selector)?.textContent?.trim() ?? null;
}

describe('PaymentsMinePage loading', () => {
  it('renders the loading shell before the page settles', async () => {
    const pending = new Subject<PagedApiResponse<PaymentMineRow>>();
    const { fixture } = await setup(() => pending.asObservable());

    expect(fixture.nativeElement.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(textOf(fixture, '#payments-mine-page-title')).toBe('My payments');

    pending.next(envelope(page()));
    pending.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('flux-loading-indicator')).toBeNull();
    expect(fixture.nativeElement.querySelector('ol')).not.toBeNull();
  });

  it('issues exactly one page request across init triggers', async () => {
    const { api } = await setup();
    expect(api.listMine).toHaveBeenCalledTimes(1);
    expect(api.listMine).toHaveBeenCalledWith(
      { pageNumber: 1, pageSize: PAYMENTS_MINE_DEFAULT_PAGE_SIZE },
      {},
    );
  });
});

describe('PaymentsMinePage rows', () => {
  it('renders backend rows verbatim with the status component', async () => {
    const { fixture } = await setup();

    const articles = [...fixture.nativeElement.querySelectorAll('.payments-mine-row')];
    expect(articles).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('11111111-1111-4111-8111-111111111111');
    expect(fixture.nativeElement.textContent).toContain('$59.98');
    expect(fixture.nativeElement.querySelector('payment-status')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Succeeded');
  });

  it('renders the empty state without rows or a pager', async () => {
    const { fixture } = await setup(() => of(envelope(page({ items: [], totalCount: 0 }))));

    expect(textOf(fixture, 'flux-empty-state')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('ol')).toBeNull();
    expect(fixture.nativeElement.querySelector('payments-mine-pagination')).toBeNull();
  });

  it('renders the error state with retry recovery', async () => {
    const failure = new ApiError({ status: 401, message: 'Anonymous.' });
    const api = { listMine: vi.fn(() => of(envelope(page()))) };
    vi.mocked(api.listMine).mockReturnValueOnce(throwError(() => failure));
    await TestBed.configureTestingModule({
      imports: [PaymentsMinePage],
      providers: [
        provideRouter([]),
        CultureService,
        PaymentsMineState,
        { provide: PaymentApiService, useValue: api },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PaymentsMinePage);
    TestBed.inject(CultureService).setCulture('en');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(textOf(fixture, 'flux-error-state')).not.toBeNull();

    (fixture.nativeElement.querySelector('flux-error-state button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('ol')).not.toBeNull();
  });
});

describe('PaymentsMinePage filter and pager', () => {
  it('commits status filters through the state with a page reset', async () => {
    const { fixture, api } = await setup();

    const select = fixture.nativeElement.querySelector(
      '#payments-status-filter',
    ) as HTMLSelectElement;
    select.value = 'Failed';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(api.listMine).toHaveBeenLastCalledWith(
      { pageNumber: 1, pageSize: PAYMENTS_MINE_DEFAULT_PAGE_SIZE, status: 'Failed' },
      expect.objectContaining({}),
    );
  });

  it('commits pager moves through the state', async () => {
    const { fixture, api } = await setup(() =>
      of(envelope(page({ totalCount: 45, pageNumber: 1 }))),
    );

    expect(fixture.nativeElement.querySelector('payments-mine-pagination nav')).not.toBeNull();

    const next = [
      ...fixture.nativeElement.querySelectorAll('payments-mine-pagination nav button'),
    ].find((button: HTMLButtonElement) => button.textContent?.trim() === 'Next') as
      HTMLButtonElement | undefined;
    expect(next).toBeTruthy();
    next?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.listMine).toHaveBeenLastCalledWith(
      { pageNumber: 2, pageSize: PAYMENTS_MINE_DEFAULT_PAGE_SIZE },
      expect.objectContaining({}),
    );
  });
});

describe('PaymentsMinePage localization', () => {
  it('localizes the title and sets the document title', async () => {
    const { fixture } = await setup();
    TestBed.inject(CultureService).setCulture('fr');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(textOf(fixture, '#payments-mine-page-title')).toBe('Mes paiements');
    expect(TestBed.inject(Title).getTitle()).toBe('Mes paiements');
    TestBed.inject(CultureService).setCulture('en');
  });

  it('renders under the RTL culture without key leakage', async () => {
    const { fixture } = await setup();
    TestBed.inject(CultureService).setCulture('ar');
    fixture.detectChanges();
    await fixture.whenStable();

    try {
      expect(textOf(fixture, '#payments-mine-page-title')).toBe('مدفوعاتي');
      expect(fixture.nativeElement.textContent).not.toContain('paymentMine.title');
    } finally {
      TestBed.inject(CultureService).setCulture('en');
    }
  });
});
