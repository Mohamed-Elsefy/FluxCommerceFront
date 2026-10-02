import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { provideApi, provideAppEnvironment } from '@flux/api';
import { AuthService } from '@flux/auth';
import { CultureService } from '@flux/i18n';
import { DashboardPage } from './dashboard-page';

function configure(): void {
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
    ],
  });
  window.localStorage.clear();
}

function authenticate(roles: readonly string[] = ['Admin']): void {
  TestBed.inject(AuthService).setAuthenticated({
    user: {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'boss@flux.local',
      displayName: 'Boss Admin',
      roles: [...roles],
      permissions: [],
      isEmailVerified: true,
    },
    accessToken: 'test-access-token',
  });
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(DashboardPage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('DashboardPage', () => {
  it('renders the page header with the upcoming-module grid', () => {
    configure();
    window.localStorage.clear();
    authenticate();
    const element = render();

    expect(element.querySelector('h1')?.textContent).toBe('Dashboard');
    const cards = [...element.querySelectorAll('app-dashboard-card')];
    expect(cards.map((card) => card.querySelector('.dashboard-card-title')?.textContent)).toEqual([
      'Catalog',
      'Inventory',
      'Orders',
      'Payments',
    ]);
    expect(
      cards.every((card) => card.querySelector('flux-badge')?.textContent?.trim() === 'Upcoming'),
    ).toBe(true);
    expect(element.querySelector('a')).toBeNull();
  });

  it('renders the signed-in administrator facts', () => {
    configure();
    window.localStorage.clear();
    authenticate();
    const element = render();

    expect(element.querySelector('.dashboard-session')?.textContent).toContain('Boss Admin');
    expect(element.querySelector('.dashboard-session')?.textContent).toContain('boss@flux.local');
    expect(element.querySelector('.dashboard-session')?.textContent).toContain('Admin');
  });

  it('localizes the dashboard for the active culture', () => {
    configure();
    window.localStorage.clear();
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      authenticate();
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('Tableau de bord');
      expect(element.querySelector('flux-badge')?.textContent?.trim()).toBe('Bientôt');
    } finally {
      cultures.setCulture('en');
    }
  });
});
