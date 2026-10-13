import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Card } from './card';

@Component({
  selector: 'flux-card-host',
  imports: [Card],
  template: `<flux-card><p class="content">Card body</p></flux-card>`,
})
class CardHost {}

describe('Card', () => {
  it('renders projected content inside the card surface', () => {
    const fixture = TestBed.createComponent(CardHost);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.card')).not.toBeNull();
    expect(element.querySelector('.card .content')?.textContent).toBe('Card body');
  });
});
