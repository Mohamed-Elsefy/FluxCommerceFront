import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { StorefrontFooter } from './footer';

function setup(): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(StorefrontFooter);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('StorefrontFooter', () => {
  it('renders the brand, explore group, and copyright line', () => {
    const element = setup();

    expect(element.querySelector('.brand')?.textContent).toBe('FluxCommerce');
    expect(element.querySelector('.group h2')?.textContent).toBe('Explore');
    expect(element.querySelector('.group .nav a')?.textContent?.trim()).toBe('Home');
    expect(element.querySelector('.legal')?.textContent).toContain(`${new Date().getFullYear()}`);
  });
});
