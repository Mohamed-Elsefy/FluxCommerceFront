/**
 * Customer profile-edit form for Supplement S1, Step S1.4 — Profile
 * Editing.
 *
 * Presentational only: renders the typed profile form from an `initial`
 * draft, emits validated drafts on submit, and presents client + server
 * field messages. No HTTP, no state writes, no navigation — the owning
 * page orchestrates `AccountState.saveProfile` and session re-sync.
 *
 * Data flow:
 *
 * ```text
 * ProfilePage (initial draft + server errors + copy)
 *     ↓ ProfileForm (this file — form state only)
 *     ↓ save (ProfileDraft) / cancelled
 * ```
 *
 * Message rule: backend field messages (already localized server-side,
 * applied under the `server` key) win over client messages; client
 * messages resolve through the Phase 4 `resolveValidationMessage`
 * engine for the active culture. Messages appear once the control is
 * touched or dirty and expose `role="alert"`.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CultureService, resolveValidationMessage } from '@flux/i18n';
import {
  PROFILE_SERVER_ERROR_KEY,
  ProfileDraft,
  ProfileFormGroup,
  applyProfileServerErrors,
  clearProfileServerErrors,
  createProfileFormGroup,
} from '../../models/profile-edit.models';

/**
 * Localized form copy (labels, hints, actions). Fully resolved by the
 * owning page — this component interpolates nothing itself.
 */
export interface ProfileFormCopy {
  readonly firstName: string;
  readonly lastName: string;
  readonly phoneNumber: string;
  readonly avatarUrl: string;
  readonly preferredLanguage: string;
  readonly timeZone: string;
  readonly languageHint: string;
  readonly timezoneHint: string;
  readonly save: string;
  readonly saving: string;
  readonly cancel: string;
}

/** Empty draft fallback (the page always mounts with a loaded profile). */
const EMPTY_DRAFT: ProfileDraft = {
  firstName: '',
  lastName: '',
  phoneNumber: '',
  avatarUrl: '',
  preferredLanguage: '',
  timeZone: '',
};

@Component({
  selector: 'profile-form',
  imports: [ReactiveFormsModule],
  templateUrl: './profile-form.html',
  styleUrl: './profile-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileForm implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly cultures = inject(CultureService);

  /** Prefilled draft (backend profile snapshot). */
  @Input() initial: ProfileDraft | null = null;

  /** Backend field-error map (`errors{}` keyed by C# property names). */
  @Input()
  set serverErrors(value: Record<string, string[]> | null) {
    this.currentServerErrors = value;
    // Guard: pre-init assignments land before the group exists (the owning
    // page always mounts with a cleared save slot, so nothing is lost).
    if (this.form !== undefined) {
      this.applyServerErrors();
    }
  }
  get serverErrors(): Record<string, string[]> | null {
    return this.currentServerErrors;
  }
  private currentServerErrors: Record<string, string[]> | null = null;
  /** In-flight save (disables the form actions). */
  @Input() saving = false;
  /** Localized labels, hints, and actions. */
  @Input() copy: ProfileFormCopy | null = null;

  /** Validated draft for the page to submit. */
  @Output() readonly save = new EventEmitter<ProfileDraft>();
  /** Edit cancellation (the page hides the form). */
  @Output() readonly cancelled = new EventEmitter<void>();

  /** Typed profile-edit group (built once from `initial`). */
  form!: ProfileFormGroup;

  ngOnInit(): void {
    this.form = createProfileFormGroup(this.formBuilder, this.initial ?? EMPTY_DRAFT);
  }

  /**
   * Submits the validated draft. Every attempt reveals messages
   * (`markAllAsTouched`), so server errors arriving after a submit always
   * render; invalid drafts never emit.
   */
  onSubmit(): void {
    clearProfileServerErrors(this.form);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.save.emit(this.form.getRawValue());
  }

  /** Cancels editing (the page hides the form). */
  onCancel(): void {
    this.cancelled.emit();
  }

  /** Whether a field shows messages (touched/dirty + invalid + non-empty). */
  shouldShow(field: keyof ProfileDraft): boolean {
    const control = this.form.controls[field];
    return (
      control.invalid && (control.touched || control.dirty) && this.fieldMessages(field).length > 0
    );
  }

  /**
   * Field messages: backend messages first (verbatim, already localized),
   * otherwise the single resolved client message. Empty when valid.
   */
  fieldMessages(field: keyof ProfileDraft): string[] {
    const control = this.form.controls[field];
    const errors = control.errors;
    if (errors === null) {
      return [];
    }
    const server = errors[PROFILE_SERVER_ERROR_KEY];
    if (Array.isArray(server)) {
      return server.filter((message): message is string => typeof message === 'string');
    }
    const client = resolveValidationMessage(errors, this.cultures.culture());
    return client === null ? [] : [client];
  }

  /** Applies the current `serverErrors` input onto matching controls. */
  private applyServerErrors(): void {
    if (this.serverErrors === null) {
      return;
    }
    applyProfileServerErrors(this.form, this.serverErrors);
  }
}
