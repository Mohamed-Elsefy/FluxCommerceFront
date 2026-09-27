import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { provideApi, provideAppEnvironment, type ResourceStatus } from '@flux/api';
import { ApiError } from '@flux/api';
import { CultureService } from '@flux/i18n';
import { CatalogOverviewState } from '../../state/catalog-overview-state';
import type { CatalogOverview } from '../../models/catalog-admin.models';
import { CatalogHomePage } from './catalog-home-page';

interface OverviewScenario {
  status: ResourceStatus;
  overview: CatalogOverview | null;
  error?: ApiError | null;
}

function setup(scenario: OverviewScenario): { refresh: ReturnType<typeof vi.fn> } {
  const refresh = vi.fn();
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
        provide: CatalogOverviewState,
        useValue: {
          status: signal(scenario.status),
          overview: signal(scenario.overview),
          error: signal(scenario.error ?? null),
          refresh,
        },
      },
    ],
  });
  window.localStorage.clear();
  return { refresh };
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(CatalogHomePage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('CatalogHomePage', () => {
  it('loads the overview on init and renders section facts on success', () => {
    const { refresh } = setup({
      status: 'success',
      overview: { productTotal: 42, categoryTotal: 7 },
    });
    const element = render();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(element.querySelector('h1')?.textContent).toBe('Catalog');
    const cards = [...element.querySelectorAll('app-catalog-section-card')];
    expect(cards.map((card) => card.querySelector('.section-card-fact')?.textContent)).toEqual([
      'Total: 42',
      'Total: 7',
    ]);
    expect(element.querySelector('a')).toBeNull();
  });

  it('renders the loading state while the overview loads', () => {
    setup({ status: 'loading', overview: null });
    const element = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.querySelector('app-catalog-section-card')).toBeNull();
  });

  it('renders the error state with retry that re-enters refresh', () => {
    const { refresh } = setup({
      status: 'error',
      overview: null,
      error: new ApiError({ status: 403, message: 'Forbidden.' }),
    });
    const element = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    expect(element.textContent).toContain('Could not load the catalog overview');

    const retry = element.querySelector('flux-error-state button');
    expect(retry).not.toBeNull();
    (retry as HTMLButtonElement).click();

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('renders the empty state when no catalog data exists', () => {
    setup({ status: 'empty', overview: { productTotal: 0, categoryTotal: 0 } });
    const element = render();

    expect(element.querySelector('flux-empty-state')).not.toBeNull();
    expect(element.textContent).toContain('No catalog data yet');
    expect(element.querySelector('app-catalog-section-card')).toBeNull();
  });

  it('localizes the landing page for the active culture', () => {
    setup({ status: 'success', overview: { productTotal: 3, categoryTotal: 1 } });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('Catalogue');
      const facts = [...element.querySelectorAll('.section-card-fact')].map(
        (fact) => fact.textContent,
      );
      expect(facts).toEqual(['Total : 3', 'Total : 1']);
    } finally {
      cultures.setCulture('en');
    }
  });
});
