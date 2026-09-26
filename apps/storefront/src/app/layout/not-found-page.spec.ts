import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';
import { CultureService } from '@flux/i18n';
import { NotFoundPage } from './not-found-page';
import { NOT_FOUND_TRANSLATION_KEYS, translateNotFoundKey } from './not-found-translations';

function setup(culture: 'en' | 'fr' | 'ar' = 'en'): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  window.localStorage.clear();
  TestBed.inject(CultureService).setCulture(culture);
  const fixture = TestBed.createComponent(NotFoundPage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('NotFoundPage', () => {
  it('renders the localized 404 copy with a way back (11.11)', () => {
    const element = setup();

    expect(element.querySelector('h1')?.textContent).toBe('Page not found');
    expect(element.querySelector('p')?.textContent).toBe('The page you requested does not exist.');
    const back = element.querySelector('a');
    expect(back?.getAttribute('href')).toBe('/');
    expect(back?.textContent?.trim()).toBe('Back to home');
  });

  it('exposes honest, non-indexable metadata (11.11)', () => {
    setup();

    expect(TestBed.inject(Title).getTitle()).toBe('Page not found | FluxCommerce');
    expect(TestBed.inject(Meta).getTag('name="description"')?.getAttribute('content')).toBe(
      'The page you requested does not exist.',
    );
    expect(TestBed.inject(Meta).getTag('name="robots"')?.getAttribute('content')).toBe('noindex');
  });

  it('localizes copy per active culture without hardcoding (11.11)', () => {
    const french = setup('fr');
    expect(french.querySelector('h1')?.textContent).toBe('Page introuvable');

    TestBed.resetTestingModule();
    const arabic = setup('ar');
    expect(arabic.querySelector('h1')?.textContent).toBe('الصفحة غير موجودة');
    expect(arabic.querySelector('a')?.textContent?.trim()).toBe('العودة إلى الرئيسية');
  });

  it('resolves keys with deterministic fallback (11.11)', () => {
    expect(translateNotFoundKey('de', NOT_FOUND_TRANSLATION_KEYS.title)).toBe(
      'Seite nicht gefunden',
    );
    expect(translateNotFoundKey('es', NOT_FOUND_TRANSLATION_KEYS.backToHome)).toBe(
      'Volver al inicio',
    );
  });
});
