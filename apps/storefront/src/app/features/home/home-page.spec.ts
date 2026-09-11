import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { HomePage } from './home-page';

function setup(): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(HomePage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('HomePage', () => {
  it('renders the placeholder heading', () => {
    expect(setup().querySelector('h1')?.textContent).toContain('Storefront');
  });

  it('links the discovery entry point to the catalog feature', () => {
    const entry = setup().querySelector('section[aria-labelledby="discovery-title"] a');

    expect(entry?.getAttribute('href')).toBe('/catalog');
    expect(entry?.textContent?.trim()).toBe('Browse categories');
  });
});
