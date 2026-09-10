/**
 * Sub-Phase 4.2 — Base translation dictionaries.
 *
 * Statically bundled base vocabulary for all five supported cultures. Every
 * dictionary exposes the same key set so fallback only triggers for keys
 * introduced later (feature namespaces) or for incomplete custom bundles.
 *
 * Strictly business-agnostic: only the generic `common` and `errors`
 * namespaces live here. Feature-specific content arrives with the feature
 * that owns it and must not be added to these base resources.
 *
 * Pure data with no Angular, DOM, or storage access: safe for SSR.
 */

import { isSupportedCulture, type Culture } from './culture';
import type { TranslationDictionary, TranslationResources } from './translation-model';

/** Base English (`en`) vocabulary. Also the deterministic fallback source. */
export const EN_TRANSLATIONS: TranslationDictionary = {
  common: {
    actions: {
      save: 'Save',
      cancel: 'Cancel',
      close: 'Close',
      retry: 'Retry',
    },
    validation: {
      required: 'This field is required.',
      invalid: 'The value entered is invalid.',
      minLength: 'Enter at least {min} characters.',
    },
  },
  errors: {
    unauthorized: 'You are not authorized. Please sign in.',
    forbidden: 'Access to this resource is forbidden.',
    network: 'A network error occurred. Please check your connection.',
    unknown: 'An unexpected error occurred.',
  },
};

/** Base French (`fr`) vocabulary. */
export const FR_TRANSLATIONS: TranslationDictionary = {
  common: {
    actions: {
      save: 'Enregistrer',
      cancel: 'Annuler',
      close: 'Fermer',
      retry: 'Réessayer',
    },
    validation: {
      required: 'Ce champ est obligatoire.',
      invalid: 'La valeur saisie est invalide.',
      minLength: 'Saisissez au moins {min} caractères.',
    },
  },
  errors: {
    unauthorized: "Vous n'êtes pas autorisé. Veuillez vous connecter.",
    forbidden: "L'accès à cette ressource est interdit.",
    network: "Une erreur réseau s'est produite. Vérifiez votre connexion.",
    unknown: "Une erreur inattendue s'est produite.",
  },
};

/** Base German (`de`) vocabulary. */
export const DE_TRANSLATIONS: TranslationDictionary = {
  common: {
    actions: {
      save: 'Speichern',
      cancel: 'Abbrechen',
      close: 'Schließen',
      retry: 'Erneut versuchen',
    },
    validation: {
      required: 'Dieses Feld ist erforderlich.',
      invalid: 'Der eingegebene Wert ist ungültig.',
      minLength: 'Geben Sie mindestens {min} Zeichen ein.',
    },
  },
  errors: {
    unauthorized: 'Sie sind nicht autorisiert. Bitte melden Sie sich an.',
    forbidden: 'Der Zugriff auf diese Ressource ist verboten.',
    network: 'Ein Netzwerkfehler ist aufgetreten. Bitte überprüfen Sie Ihre Verbindung.',
    unknown: 'Ein unerwarteter Fehler ist aufgetreten.',
  },
};

/** Base Spanish (`es`) vocabulary. */
export const ES_TRANSLATIONS: TranslationDictionary = {
  common: {
    actions: {
      save: 'Guardar',
      cancel: 'Cancelar',
      close: 'Cerrar',
      retry: 'Reintentar',
    },
    validation: {
      required: 'Este campo es obligatorio.',
      invalid: 'El valor introducido no es válido.',
      minLength: 'Introduzca al menos {min} caracteres.',
    },
  },
  errors: {
    unauthorized: 'No tiene autorización. Inicie sesión.',
    forbidden: 'El acceso a este recurso está prohibido.',
    network: 'Se ha producido un error de red. Compruebe su conexión.',
    unknown: 'Se ha producido un error inesperado.',
  },
};

/** Base Arabic (`ar`) vocabulary. */
export const AR_TRANSLATIONS: TranslationDictionary = {
  common: {
    actions: {
      save: 'حفظ',
      cancel: 'إلغاء',
      close: 'إغلاق',
      retry: 'إعادة المحاولة',
    },
    validation: {
      required: 'هذا الحقل مطلوب.',
      invalid: 'القيمة المدخلة غير صالحة.',
      minLength: 'أدخل {min} أحرف على الأقل.',
    },
  },
  errors: {
    unauthorized: 'غير مصرح لك. يرجى تسجيل الدخول.',
    forbidden: 'الوصول إلى هذا المورد محظور.',
    network: 'حدث خطأ في الشبكة. يرجى التحقق من اتصالك.',
    unknown: 'حدث خطأ غير متوقع.',
  },
};

/** All bundled base dictionaries keyed by supported culture. */
export const TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_TRANSLATIONS,
  fr: FR_TRANSLATIONS,
  de: DE_TRANSLATIONS,
  es: ES_TRANSLATIONS,
  ar: AR_TRANSLATIONS,
};

/** Lists the supported culture codes a resource bundle provides. */
export function bundledCultures(resources: TranslationResources): Culture[] {
  return Object.keys(resources).filter((code): code is Culture => isSupportedCulture(code));
}
