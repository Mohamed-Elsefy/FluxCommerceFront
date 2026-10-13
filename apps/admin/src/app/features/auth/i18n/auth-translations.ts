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
  loginKicker: 'auth.login.kicker',
  loginBadge: 'auth.login.badge',
  loginEmailLabel: 'auth.login.emailLabel',
  loginPasswordLabel: 'auth.login.passwordLabel',
  loginEmailError: 'auth.login.emailError',
  loginPasswordError: 'auth.login.passwordError',
  loginErrorTitle: 'auth.login.errorTitle',
  loginSubmit: 'auth.login.submit',
  loginSubmitting: 'auth.login.submitting',
  loginPasswordShow: 'auth.login.passwordShow',
  loginPasswordHide: 'auth.login.passwordHide',
  loginSecurityNote: 'auth.login.securityNote',
} as const;

/** English (`en`) auth vocabulary. Also the deterministic fallback source. */
const EN_AUTH: TranslationDictionary = {
  auth: {
    login: {
      title: 'Admin sign in',
      subtitle: 'Sign in with an administrator account to continue.',
      kicker: '01 // Secure access',
      badge: 'Admin',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      emailError: 'Enter a valid email address.',
      passwordError: 'Enter your password (8 or more characters).',
      errorTitle: 'Sign in failed',
      submit: 'Sign in',
      submitting: 'Signing in',
      passwordShow: 'Show password',
      passwordHide: 'Hide password',
      securityNote: 'Restricted area. Sessions are verified on every request.',
    },
  },
};

/** French (`fr`) auth vocabulary. */
const FR_AUTH: TranslationDictionary = {
  auth: {
    login: {
      title: 'Connexion admin',
      subtitle: 'Connectez-vous avec un compte administrateur pour continuer.',
      kicker: '01 // Accès sécurisé',
      badge: 'Admin',
      emailLabel: 'E-mail',
      passwordLabel: 'Mot de passe',
      emailError: 'Saisissez une adresse e-mail valide.',
      passwordError: 'Saisissez votre mot de passe (8 caractères ou plus).',
      errorTitle: 'Échec de la connexion',
      submit: 'Se connecter',
      submitting: 'Connexion…',
      passwordShow: 'Afficher le mot de passe',
      passwordHide: 'Masquer le mot de passe',
      securityNote: 'Zone réservée. Les sessions sont vérifiées à chaque requête.',
    },
  },
};

/** German (`de`) auth vocabulary. */
const DE_AUTH: TranslationDictionary = {
  auth: {
    login: {
      title: 'Admin-Anmeldung',
      subtitle: 'Melden Sie sich mit einem Administratorkonto an, um fortzufahren.',
      kicker: '01 // Sicherer Zugriff',
      badge: 'Admin',
      emailLabel: 'E-Mail',
      passwordLabel: 'Passwort',
      emailError: 'Geben Sie eine gültige E-Mail-Adresse ein.',
      passwordError: 'Geben Sie Ihr Passwort ein (mindestens 8 Zeichen).',
      errorTitle: 'Anmeldung fehlgeschlagen',
      submit: 'Anmelden',
      submitting: 'Anmelden…',
      passwordShow: 'Passwort anzeigen',
      passwordHide: 'Passwort ausblenden',
      securityNote: 'Eingeschränkter Bereich. Sitzungen werden bei jeder Anfrage geprüft.',
    },
  },
};

/** Spanish (`es`) auth vocabulary. */
const ES_AUTH: TranslationDictionary = {
  auth: {
    login: {
      title: 'Acceso de administración',
      subtitle: 'Inicie sesión con una cuenta de administrador para continuar.',
      kicker: '01 // Acceso seguro',
      badge: 'Admin',
      emailLabel: 'Correo',
      passwordLabel: 'Contraseña',
      emailError: 'Introduzca un correo válido.',
      passwordError: 'Introduzca su contraseña (8 o más caracteres).',
      errorTitle: 'Error al iniciar sesión',
      submit: 'Iniciar sesión',
      submitting: 'Iniciando sesión…',
      passwordShow: 'Mostrar contraseña',
      passwordHide: 'Ocultar contraseña',
      securityNote: 'Zona restringida. Las sesiones se verifican en cada solicitud.',
    },
  },
};

/** Arabic (`ar`) auth vocabulary. */
const AR_AUTH: TranslationDictionary = {
  auth: {
    login: {
      title: 'تسجيل دخول الإدارة',
      subtitle: 'سجّل الدخول بحساب إداري للمتابعة.',
      kicker: '01 // دخول آمن',
      badge: 'إدارة',
      emailLabel: 'البريد',
      passwordLabel: 'كلمة المرور',
      emailError: 'أدخل بريدًا صالحًا.',
      passwordError: 'أدخل كلمتك (8 أحرف أو أكثر).',
      errorTitle: 'فشل تسجيل الدخول',
      submit: 'تسجيل الدخول',
      submitting: 'جارٍ تسجيل الدخول…',
      passwordShow: 'إظهار كلمة المرور',
      passwordHide: 'إخفاء كلمة المرور',
      securityNote: 'منطقة مقيدة. يتم التحقق من الجلسات مع كل طلب.',
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
