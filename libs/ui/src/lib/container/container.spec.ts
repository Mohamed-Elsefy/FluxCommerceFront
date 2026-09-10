import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Container } from './container';

@Component({
  selector: 'flux-container-host',
  imports: [Container],
  template: `<flux-container [size]="size"><p class="content">Page body</p></flux-container>`,
})
class ContainerHost {
  size: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'xl';
}

function setup(size: ContainerHost['size'] = 'xl'): HTMLElement {
  const fixture = TestBed.createComponent(ContainerHost);
  fixture.componentInstance.size = size;
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Container', () => {
  it('renders projected content constrained to the default size', () => {
    const element = setup();

    const container = element.querySelector('.container');
    expect(container).not.toBeNull();
    expect(container?.getAttribute('data-size')).toBe('xl');
    expect(element.querySelector('.container .content')?.textContent).toBe('Page body');
  });

  it('reflects sizes through inputs only', () => {
    for (const size of ['sm', 'md', 'lg', 'full'] as const) {
      const element = setup(size);

      expect(element.querySelector('.container')?.getAttribute('data-size')).toBe(size);
    }
  });
});
