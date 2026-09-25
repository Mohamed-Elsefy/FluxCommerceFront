import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_CULTURE_METADATA, type Culture } from '@flux/i18n';
import { StorefrontCultureSwitch } from './culture-switch';

function setup(selected: Culture = 'en'): {
  fixture: ComponentFixture<StorefrontCultureSwitch>;
  element: HTMLElement;
  emitted: Culture[];
} {
  const emitted: Culture[] = [];
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(StorefrontCultureSwitch);
  fixture.componentRef.setInput('cultures', SUPPORTED_CULTURE_METADATA);
  fixture.componentRef.setInput('selected', selected);
  fixture.componentInstance.cultureChange.subscribe((culture: Culture) => emitted.push(culture));
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement, emitted };
}

function select(element: HTMLElement): HTMLSelectElement {
  const field = element.querySelector('select');
  expect(field).not.toBeNull();
  return field as HTMLSelectElement;
}

describe('StorefrontCultureSwitch', () => {
  it('offers every supported culture by native name with the active one selected', () => {
    const { element } = setup('fr');
    const options = [...element.querySelectorAll('option')];

    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'English',
      'Français',
      'Deutsch',
      'Español',
      'العربية',
    ]);
    expect(options.find((option) => option.hasAttribute('selected'))?.getAttribute('value')).toBe(
      'fr',
    );
  });

  it('emits validated culture changes', () => {
    const { fixture, element, emitted } = setup('en');
    const field = select(element);

    field.value = 'ar';
    field.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted).toEqual(['ar']);
  });

  it('ignores unknown values without emitting', () => {
    const { fixture, emitted } = setup('en');

    fixture.componentInstance.onChange({ target: { value: 'xx' } } as unknown as Event);
    fixture.detectChanges();

    expect(emitted).toEqual([]);
  });

  it('renders the projected picker name', () => {
    const { element } = setup('en');

    expect(element.querySelector('.culture-switch-label')?.textContent).toBe('Language');
    expect(element.querySelector('select')?.getAttribute('aria-label')).toBe('Language');
  });
});
