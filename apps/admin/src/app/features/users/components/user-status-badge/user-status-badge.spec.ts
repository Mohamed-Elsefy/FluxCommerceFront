import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CultureService } from '@flux/i18n';
import { UserStatus } from '@flux/models';
import { UserStatusBadge } from './user-status-badge';

function setup(status: number): {
  fixture: ComponentFixture<UserStatusBadge>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  window.localStorage.clear();
  const fixture = TestBed.createComponent(UserStatusBadge);
  fixture.componentRef.setInput('status', status);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function badge(element: HTMLElement): HTMLElement | null {
  return element.querySelector('flux-badge .badge');
}

describe('UserStatusBadge', () => {
  it.each([
    [UserStatus.Pending, 'Pending', 'warning'],
    [UserStatus.Active, 'Active', 'success'],
    [UserStatus.Suspended, 'Suspended', 'warning'],
    [UserStatus.Locked, 'Locked', 'danger'],
    [UserStatus.Deleted, 'Deleted', 'neutral'],
  ])('renders %s with its localized label and tone', (status, label, tone) => {
    const { element } = setup(status);

    expect(badge(element)?.textContent?.trim(), String(status)).toBe(label);
    expect(badge(element)?.getAttribute('data-variant'), String(status)).toBe(tone);
  });

  it('renders unknown backend values verbatim with the neutral tone', () => {
    const { element } = setup(99);

    expect(badge(element)?.textContent?.trim()).toBe('99');
    expect(badge(element)?.getAttribute('data-variant')).toBe('neutral');
  });

  it.each(['fr', 'de', 'es', 'ar'] as const)('renders a non-empty label in %s', (culture) => {
    const { fixture, element } = setup(UserStatus.Active);
    TestBed.inject(CultureService).setCulture(culture);
    try {
      fixture.detectChanges();

      expect(badge(element)?.textContent?.trim().length).toBeGreaterThan(0);
    } finally {
      TestBed.inject(CultureService).setCulture('en');
    }
  });

  it('localizes known statuses per culture', () => {
    const { fixture, element } = setup(UserStatus.Locked);
    TestBed.inject(CultureService).setCulture('fr');
    try {
      fixture.detectChanges();

      expect(badge(element)?.textContent?.trim()).toBe('Verrouillé');
    } finally {
      TestBed.inject(CultureService).setCulture('en');
    }
  });
});
