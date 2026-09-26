import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CultureService } from '@flux/i18n';
import { HomePage } from './home-page';

describe('HomePage', () => {
  it('renders the placeholder heading', () => {
    TestBed.configureTestingModule({});
    window.localStorage.clear();
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Admin');
  });

  it('localizes the placeholder for the active culture', () => {
    TestBed.configureTestingModule({});
    window.localStorage.clear();
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('ar');
    try {
      const fixture = TestBed.createComponent(HomePage);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('h1')?.textContent).toBe('الإدارة');
    } finally {
      cultures.setCulture('en');
    }
  });
});
