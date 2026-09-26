/**
 * Admin auth feature translations — user-facing copy (`auth.*`) in all
 * five supported cultures (`en`/`fr`/`de`/`es`/`ar`).
 *
 * Covers the administrator login page: heading, labels, client-side
 * field messages, and submission copy. Form-level failures resolve
 * through the Phase 4 platform resolver (`errors.*`) instead of living
 * here. Lookup runs through the Phase 4 `translate` engine
 * (deterministic target → `en` → key-path fallback). Pure data + pure
 * lookup: no Angular, DOM, or storage access — SSR-safe.
 */

import {
  translate,
  type Culture,
  type TranslationDictionary,
  type TranslationParams,
  type TranslationResources,
} from '@flux/i18n';

/** Admin auth translation key paths owned by this feature (`auth.*`). */
export const ADMIN_AUTH_TRANSLATION_KEYS = {
  loginTitle: 'auth.login.title',
  loginSubtitle: 'auth.login.subtitle',
  loginEmailLabel: 'auth.login.emailLabel',
  loginPasswordLabel: 'auth.login.passwordLabel',
  loginEmailError: 'auth.login.emailError',
  loginPasswordError: 'auth.login.passwordError',
  loginErrorTitle: 'auth.login.errorTitle',
  loginSubmit: 'auth.login.submit',
  loginSubmitting: 'auth.login.submitting',
} as const;

/** English (`en`) auth vocabulary. Also the deterministic fallback source. */
const EN_AUTH: TranslationDictionary = {
  auth: {
    login: {
      title: 'Admin sign in',
      subtitle: 'Sign in with an administrator account to continue.',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      emailError: 'Enter a valid email address.',
      passwordError: 'Enter your password (8 or more characters).',
      errorTitle: 'Sign in failed',
      submit: 'Sign in',
      submitting: 'Signing in',
    },
  },
};

/** French (`fr`) auth vocabulary. */
const FR_AUTH: TranslationDictionary = {
  auth: {
    login: {
      title: 'Connexion admin',
      subtitle: 'Connectez-vous avec un compte administrateur pour continuer.',
      emailLabel: 'E-mail',
      passwordLabel: 'Mot de passe',
      emailError: 'Saisissez une adresse e-mail valide.',
      passwordError: 'Saisissez votre mot de passe (8 caractères ou plus).',
      errorTitle: 'Échec de la connexion',
      submit: 'Se connecter',
      submitting: 'Connexion…',
    },
  },
};

/** German (`de`) auth vocabulary. */
const DE_AUTH: TranslationDictionary = {
  auth: {
    login: {
      title: 'Admin-Anmeldung',
      subtitle: 'Melden Sie sich mit einem Administratorkonto an, um fortzufahren.',
      emailLabel: 'E-Mail',
      passwordLabel: 'Passwort',
      emailError: 'Geben Sie eine gültige E-Mail-Adresse ein.',
      passwordError: 'Geben Sie Ihr Passwort ein (mindestens 8 Zeichen).',
      errorTitle: 'Anmeldung fehlgeschlagen',
      submit: 'Anmelden',
      submitting: 'Anmelden…',
    },
  },
};

/** Spanish (`es`) auth vocabulary. */
const ES_AUTH: TranslationDictionary = {
  auth: {
    login: {
      title: 'Acceso de administración',
      subtitle: 'Inicie sesión con una cuenta de administrador para continuar.',
      emailLabel: 'Correo',
      passwordLabel: 'Contraseña',
      emailError: 'Introduzca un correo válido.',
      passwordError: 'Introduzca su contraseña (8 o más caracteres).',
      errorTitle: 'Error al iniciar sesión',
      submit: 'Iniciar sesión',
      submitting: 'Iniciando sesión…',
    },
  },
};

/** Arabic (`ar`) auth vocabulary. */
const AR_AUTH: TranslationDictionary = {
  auth: {
    login: {
      title: 'تسجيل دخول الإدارة',
      subtitle: 'سجّل الدخول بحساب إداري للمتابعة.',
      emailLabel: 'البريد',
      passwordLabel: 'كلمة المرور',
      emailError: 'أدخل بريدًا صالحًا.',
      passwordError: 'أدخل كلمتك (8 أحرف أو أكثر).',
      errorTitle: 'فشل تسجيل الدخول',
      submit: 'تسجيل الدخول',
      submitting: 'جارٍ تسجيل الدخول…',
    },
  },
};

/** Bundled auth dictionaries keyed by supported culture. */
export const ADMIN_AUTH_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_AUTH,
  fr: FR_AUTH,
  de: DE_AUTH,
  es: ES_AUTH,
  ar: AR_AUTH,
};

/**
 * Resolves an admin auth key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. Never throws.
 */
export function translateAdminAuthKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(ADMIN_AUTH_TRANSLATION_RESOURCES, culture, key, params);
}
