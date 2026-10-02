import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { CultureService } from '@flux/i18n';
import type { ProfileDraft } from '../../models/profile-edit.models';
import { ProfileForm, type ProfileFormCopy } from './profile-form';

const DRAFT: ProfileDraft = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  phoneNumber: '',
  avatarUrl: '',
  preferredLanguage: 'en',
  timeZone: 'UTC',
};

const COPY: ProfileFormCopy = {
  firstName: 'First name',
  lastName: 'Last name',
  phoneNumber: 'Phone',
  avatarUrl: 'Avatar URL',
  preferredLanguage: 'Language',
  timeZone: 'Time zone',
  languageHint: 'Current: en',
  timezoneHint: 'Current: UTC',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
};

async function setup(inputs: {
  initial?: ProfileDraft | null;
  serverErrors?: Record<string, string[]> | null;
  saving?: boolean;
}): Promise<{ fixture: ComponentFixture<ProfileForm>; component: ProfileForm }> {
  await TestBed.configureTestingModule({
    imports: [ProfileForm],
    providers: [provideRouter([]), CultureService],
  }).compileComponents();

  const fixture = TestBed.createComponent(ProfileForm);
  const component = fixture.componentInstance;
  component.initial = inputs.initial ?? DRAFT;
  component.serverErrors = inputs.serverErrors ?? null;
  component.saving = inputs.saving ?? false;
  component.copy = COPY;
  TestBed.inject(CultureService).setCulture('en');
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, component };
}

describe('ProfileForm rendering', () => {
  it('prefills six inputs from the draft', async () => {
    const { fixture } = await setup({});

    const values = [...fixture.nativeElement.querySelectorAll('input')].map(
      (node: HTMLInputElement) => node.value,
    );
    expect(values).toEqual(['Ada', 'Lovelace', '', '', 'en', 'UTC']);
  });

  it('disables actions while saving', async () => {
    const { fixture } = await setup({ saving: true });

    const buttons = [...fixture.nativeElement.querySelectorAll('button')];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
    expect(fixture.nativeElement.textContent).toContain('Saving…');
  });

  it('shows no field messages for a pristine valid form', async () => {
    const { fixture } = await setup({});

    expect(fixture.nativeElement.querySelector('.profile-form-errors')).toBeNull();
  });
});

describe('ProfileForm client validation', () => {
  it('flags a blank first name after submit', async () => {
    const { fixture, component } = await setup({});
    const onSave = vi.fn();
    component.save.subscribe(onSave);

    component.form.controls.firstName.setValue('');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(onSave).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.profile-form-errors')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('#profile-first-name')?.getAttribute('aria-invalid'),
    ).toBe('true');
  });
});

describe('ProfileForm server errors', () => {
  it('projects backend messages onto matching controls verbatim', async () => {
    // Server errors arrive post-mount (the page clears the save slot on
    // open): assigning after mount exercises the ngOnChanges path.
    const { fixture, component } = await setup({});
    component.serverErrors = { PhoneNumber: ['Too long.'] };
    component.form.controls.phoneNumber.markAsTouched();
    fixture.detectChanges();

    const lists = [...fixture.nativeElement.querySelectorAll('.profile-form-errors')];
    expect(lists).toHaveLength(1);
    expect(lists[0]?.textContent?.trim()).toBe('Too long.');
  });
});

describe('ProfileForm submission', () => {
  it('emits the validated draft on save', async () => {
    const { fixture, component } = await setup({});
    const onSave = vi.fn();
    component.save.subscribe(onSave);

    fixture.nativeElement.querySelector('form')?.dispatchEvent(new Event('submit'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      firstName: 'Ada',
      lastName: 'Lovelace',
      phoneNumber: '',
      avatarUrl: '',
      preferredLanguage: 'en',
      timeZone: 'UTC',
    });
  });

  it('emits cancelled without a draft', async () => {
    const { component } = await setup({});
    const onSave = vi.fn();
    const onCancel = vi.fn();
    component.save.subscribe(onSave);
    component.cancelled.subscribe(onCancel);

    component.onCancel();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
