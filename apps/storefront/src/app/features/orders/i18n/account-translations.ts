/**
 * Storefront Account feature translations for Sub-Phase 10.2 — Customer
 * Account & Profile.
 *
 * Feature-owned, business-specific copy (`account` namespace) in all
 * five supported cultures (`en`/`fr`/`de`/`es`/`ar`). Per the Phase 4
 * ownership rule, this bundle lives in the orders feature and never
 * touches `libs/i18n` dictionaries. Generic vocabulary (retry) stays in
 * the base resources (`common.actions.retry`).
 *
 * Lookup runs through the Phase 4 `translate` engine (deterministic
 * target → `en` → key-path fallback, `{param}` interpolation), resolved
 * against the active `CultureService.culture()` at the consuming
 * shell/page. Pure data + pure lookup: no Angular, DOM, or storage
 * access — SSR-safe.
 */

import {
  translate,
  type Culture,
  type TranslationDictionary,
  type TranslationResources,
  type TranslationParams,
} from '@flux/i18n';

/** Account translation key paths owned by this feature (`account.*`). */
export const ACCOUNT_TRANSLATION_KEYS = {
  shellTitle: 'account.shell.title',
  shellNavLabel: 'account.shell.navLabel',
  shellSignedInAs: 'account.shell.signedInAs',
  shellLogout: 'account.shell.logout',
  shellLoggingOut: 'account.shell.loggingOut',
  navProfile: 'account.nav.profile',
  navOrders: 'account.nav.orders',
  profileTitle: 'account.profile.title',
  profileLoading: 'account.profile.loading',
  profileLoadErrorTitle: 'account.profile.loadErrorTitle',
  profileFieldName: 'account.profile.fields.name',
  profileFieldEmail: 'account.profile.fields.email',
  profileFieldEmailVerified: 'account.profile.fields.emailVerified',
  profileFieldPhone: 'account.profile.fields.phone',
  profileFieldAvatar: 'account.profile.fields.avatar',
  profileFieldRoles: 'account.profile.fields.roles',
  profileFieldLanguage: 'account.profile.fields.language',
  profileFieldTimezone: 'account.profile.fields.timezone',
  profileFieldMemberSince: 'account.profile.fields.memberSince',
  profileVerifiedYes: 'account.profile.verifiedYes',
  profileVerifiedNo: 'account.profile.verifiedNo',
  profileNotProvided: 'account.profile.notProvided',
  profileEditTitle: 'account.profile.edit.title',
  profileEditSave: 'account.profile.edit.save',
  profileEditSaving: 'account.profile.edit.saving',
  profileEditCancel: 'account.profile.edit.cancel',
  profileEditSaveSuccess: 'account.profile.edit.saveSuccess',
  profileEditSaveErrorTitle: 'account.profile.edit.saveErrorTitle',
  profileEditLanguageHint: 'account.profile.edit.languageHint',
  profileEditTimezoneHint: 'account.profile.edit.timezoneHint',
} as const;

/** English (`en`) account vocabulary. Also the deterministic fallback source. */
const EN_ACCOUNT: TranslationDictionary = {
  account: {
    shell: {
      title: 'My account',
      navLabel: 'Account sections',
      signedInAs: 'Signed in as {email}',
      logout: 'Sign out',
      loggingOut: 'Signing out…',
    },
    nav: {
      profile: 'Profile',
      orders: 'Orders',
    },
    profile: {
      title: 'Profile',
      loading: 'Loading your profile…',
      loadErrorTitle: 'Profile unavailable',
      fields: {
        name: 'Name',
        email: 'Email',
        emailVerified: 'Email verified',
        phone: 'Phone',
        avatar: 'Avatar',
        roles: 'Roles',
        language: 'Language',
        timezone: 'Time zone',
        memberSince: 'Member since',
      },
      verifiedYes: 'Yes',
      verifiedNo: 'No',
      notProvided: 'Not provided',
      edit: {
        title: 'Edit profile',
        save: 'Save changes',
        saving: 'Saving…',
        cancel: 'Cancel',
        saveSuccess: 'Your profile was updated.',
        saveErrorTitle: 'Could not save changes',
        languageHint: 'Current: {culture}. Applies to your profile only.',
        timezoneHint: 'IANA time zone name (e.g. UTC). Applies to your profile only.',
      },
    },
  },
};

/** French (`fr`) account vocabulary. */
const FR_ACCOUNT: TranslationDictionary = {
  account: {
    shell: {
      title: 'Mon compte',
      navLabel: 'Rubriques du compte',
      signedInAs: 'Connecté en tant que {email}',
      logout: 'Se déconnecter',
      loggingOut: 'Déconnexion…',
    },
    nav: {
      profile: 'Profil',
      orders: 'Commandes',
    },
    profile: {
      title: 'Profil',
      loading: 'Chargement de votre profil…',
      loadErrorTitle: 'Profil indisponible',
      fields: {
        name: 'Nom',
        email: 'E-mail',
        emailVerified: 'E-mail vérifié',
        phone: 'Téléphone',
        avatar: 'Avatar',
        roles: 'Rôles',
        language: 'Langue',
        timezone: 'Fuseau horaire',
        memberSince: 'Membre depuis',
      },
      verifiedYes: 'Oui',
      verifiedNo: 'Non',
      notProvided: 'Non renseigné',
      edit: {
        title: 'Modifier le profil',
        save: 'Enregistrer',
        saving: 'Enregistrement…',
        cancel: 'Annuler',
        saveSuccess: 'Votre profil a été mis à jour.',
        saveErrorTitle: 'Impossible d’enregistrer les modifications',
        languageHint: 'Actuelle : {culture}. S’applique à votre profil uniquement.',
        timezoneHint:
          'Nom de fuseau horaire IANA (p. ex. UTC). S’applique à votre profil uniquement.',
      },
    },
  },
};

/** German (`de`) account vocabulary. */
const DE_ACCOUNT: TranslationDictionary = {
  account: {
    shell: {
      title: 'Mein Konto',
      navLabel: 'Kontobereiche',
      signedInAs: 'Angemeldet als {email}',
      logout: 'Abmelden',
      loggingOut: 'Wird abgemeldet…',
    },
    nav: {
      profile: 'Profil',
      orders: 'Bestellungen',
    },
    profile: {
      title: 'Profil',
      loading: 'Dein Profil wird geladen…',
      loadErrorTitle: 'Profil nicht verfügbar',
      fields: {
        name: 'Name',
        email: 'E-Mail',
        emailVerified: 'E-Mail bestätigt',
        phone: 'Telefon',
        avatar: 'Avatar',
        roles: 'Rollen',
        language: 'Sprache',
        timezone: 'Zeitzone',
        memberSince: 'Mitglied seit',
      },
      verifiedYes: 'Ja',
      verifiedNo: 'Nein',
      notProvided: 'Nicht angegeben',
      edit: {
        title: 'Profil bearbeiten',
        save: 'Änderungen speichern',
        saving: 'Wird gespeichert…',
        cancel: 'Abbrechen',
        saveSuccess: 'Dein Profil wurde aktualisiert.',
        saveErrorTitle: 'Änderungen konnten nicht gespeichert werden',
        languageHint: 'Aktuell: {culture}. Gilt nur für dein Profil.',
        timezoneHint: 'IANA-Zeitzonenname (z. B. UTC). Gilt nur für dein Profil.',
      },
    },
  },
};

/** Spanish (`es`) account vocabulary. */
const ES_ACCOUNT: TranslationDictionary = {
  account: {
    shell: {
      title: 'Mi cuenta',
      navLabel: 'Secciones de la cuenta',
      signedInAs: 'Sesión iniciada como {email}',
      logout: 'Cerrar sesión',
      loggingOut: 'Cerrando sesión…',
    },
    nav: {
      profile: 'Perfil',
      orders: 'Pedidos',
    },
    profile: {
      title: 'Perfil',
      loading: 'Cargando tu perfil…',
      loadErrorTitle: 'Perfil no disponible',
      fields: {
        name: 'Nombre',
        email: 'Correo electrónico',
        emailVerified: 'Correo verificado',
        phone: 'Teléfono',
        avatar: 'Avatar',
        roles: 'Roles',
        language: 'Idioma',
        timezone: 'Zona horaria',
        memberSince: 'Miembro desde',
      },
      verifiedYes: 'Sí',
      verifiedNo: 'No',
      notProvided: 'No proporcionado',
      edit: {
        title: 'Editar perfil',
        save: 'Guardar cambios',
        saving: 'Guardando…',
        cancel: 'Cancelar',
        saveSuccess: 'Tu perfil se ha actualizado.',
        saveErrorTitle: 'No se pudieron guardar los cambios',
        languageHint: 'Actual: {culture}. Solo se aplica a tu perfil.',
        timezoneHint: 'Nombre de zona horaria IANA (p. ej., UTC). Solo se aplica a tu perfil.',
      },
    },
  },
};

/** Arabic (`ar`) account vocabulary. */
const AR_ACCOUNT: TranslationDictionary = {
  account: {
    shell: {
      title: 'حسابي',
      navLabel: 'أقسام الحساب',
      signedInAs: 'تم تسجيل الدخول باسم {email}',
      logout: 'تسجيل الخروج',
      loggingOut: 'جارٍ تسجيل الخروج…',
    },
    nav: {
      profile: 'الملف الشخصي',
      orders: 'الطلبات',
    },
    profile: {
      title: 'الملف الشخصي',
      loading: 'جارٍ تحميل ملفك الشخصي…',
      loadErrorTitle: 'الملف الشخصي غير متاح',
      fields: {
        name: 'الاسم',
        email: 'البريد الإلكتروني',
        emailVerified: 'تم التحقق من البريد',
        phone: 'الهاتف',
        avatar: 'الصورة الرمزية',
        roles: 'الأدوار',
        language: 'اللغة',
        timezone: 'المنطقة الزمنية',
        memberSince: 'عضو منذ',
      },
      verifiedYes: 'نعم',
      verifiedNo: 'لا',
      notProvided: 'غير متوفر',
      edit: {
        title: 'تعديل الملف الشخصي',
        save: 'حفظ التغييرات',
        saving: 'جارٍ الحفظ…',
        cancel: 'إلغاء',
        saveSuccess: 'تم تحديث ملفك الشخصي.',
        saveErrorTitle: 'تعذّر حفظ التغييرات',
        languageHint: 'الحالية: {culture}. ينطبق على ملفك الشخصي فقط.',
        timezoneHint: 'اسم منطقة زمنية بصيغة IANA (مثل UTC). ينطبق على ملفك الشخصي فقط.',
      },
    },
  },
};

/** Bundled account dictionaries keyed by supported culture. */
export const ACCOUNT_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_ACCOUNT,
  fr: FR_ACCOUNT,
  de: DE_ACCOUNT,
  es: ES_ACCOUNT,
  ar: AR_ACCOUNT,
};

/**
 * Resolves an account key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. `params` fills
 * `{placeholder}` slots (e.g. `{email}`). Never throws.
 */
export function translateAccountKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(ACCOUNT_TRANSLATION_RESOURCES, culture, key, params);
}
