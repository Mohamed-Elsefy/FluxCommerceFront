import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CatalogSectionCard } from './section-card';

function render(configure: (card: CatalogSectionCard) => void): HTMLElement {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(CatalogSectionCard);
  configure(fixture.componentInstance);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('CatalogSectionCard', () => {
  it('renders the title, description, and fact without links', () => {
    const element = render((card) => {
      card.title = 'Products';
      card.description = 'Products with variants.';
      card.fact = 'Total: 42';
    });

    expect(element.querySelector('.section-card-title')?.textContent).toBe('Products');
    expect(element.querySelector('.section-card-description')?.textContent).toBe(
      'Products with variants.',
    );
    expect(element.querySelector('.section-card-fact')?.textContent).toBe('Total: 42');
    expect(element.querySelector('a')).toBeNull();
  });
});
