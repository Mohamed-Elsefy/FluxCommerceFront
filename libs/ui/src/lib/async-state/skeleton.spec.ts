import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('renders three decorative bars by default', () => {
    const fixture = TestBed.createComponent(Skeleton);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.bar')).toHaveLength(3);
    expect(element.querySelector('.skeleton')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('.skeleton')?.getAttribute('data-animated')).toBe('true');
  });

  it('honors line counts and the animation toggle through inputs only', () => {
    const fixture = TestBed.createComponent(Skeleton);
    fixture.componentInstance.lines = 5;
    fixture.componentInstance.animate = false;
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.bar')).toHaveLength(5);
    expect(element.querySelector('.skeleton')?.getAttribute('data-animated')).toBe('false');
  });

  it('renders nothing for non-positive line counts', () => {
    const fixture = TestBed.createComponent(Skeleton);
    fixture.componentInstance.lines = -2;
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.bar')).toHaveLength(0);
  });
});
