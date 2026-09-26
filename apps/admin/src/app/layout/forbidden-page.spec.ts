import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { CultureService } from '@flux/i18n';
import { ForbiddenPage } from './forbidden-page';

describe('ForbiddenPage', () => {
  it('renders the access-denied heading', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    window.localStorage.clear();
    const fixture = TestBed.createComponent(ForbiddenPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Access denied');
  });

  it('localizes the denial for the active culture', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    window.localStorage.clear();
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('de');
    try {
      const fixture = TestBed.createComponent(ForbiddenPage);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('h1')?.textContent).toBe('Zugriff verweigert');
    } finally {
      cultures.setCulture('en');
    }
  });
});
