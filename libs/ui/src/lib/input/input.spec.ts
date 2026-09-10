import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Input } from './input';

function setup(configure: (instance: Input) => void = (): void => undefined): {
  instance: Input;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(Input);
  configure(fixture.componentInstance);
  fixture.detectChanges();
  return { instance: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
}

function control(element: HTMLElement): HTMLInputElement | null {
  return element.querySelector('input.control');
}

describe('Input', () => {
  it('renders a labeled control with default type and value', () => {
    const { element } = setup((instance) => {
      instance.label = 'Email';
      instance.value = 'ada@flux.local';
    });

    expect(element.querySelector('.label')?.textContent).toBe('Email');
    expect(control(element)?.getAttribute('type')).toBe('text');
    expect(control(element)?.value).toBe('ada@flux.local');
    expect(control(element)?.disabled).toBe(false);
  });

  it('emits typed values through valueChange', () => {
    const { instance, element } = setup();
    const emitted: string[] = [];
    instance.valueChange.subscribe((value) => emitted.push(value));

    const field = control(element);
    field!.value = 'ada';
    field!.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['ada']);
  });

  it('disables the control when disabled', () => {
    const { element } = setup((instance) => {
      instance.disabled = true;
    });

    expect(control(element)?.disabled).toBe(true);
  });

  it('renders errors accessibly and hides the hint while invalid', () => {
    const { element } = setup((instance) => {
      instance.hint = 'We never share your email.';
      instance.error = 'Enter a valid email.';
    });

    expect(control(element)?.getAttribute('aria-invalid')).toBe('true');
    expect(element.querySelector('.error')?.getAttribute('role')).toBe('alert');
    expect(element.querySelector('.error')?.textContent).toBe('Enter a valid email.');
    expect(element.querySelector('.hint')).toBeNull();
  });

  it('renders the hint when there is no error', () => {
    const { element } = setup((instance) => {
      instance.hint = 'We never share your email.';
    });

    expect(control(element)?.getAttribute('aria-invalid')).toBe('false');
    expect(element.querySelector('.hint')?.textContent).toBe('We never share your email.');
    expect(element.querySelector('.error')).toBeNull();
  });
});
