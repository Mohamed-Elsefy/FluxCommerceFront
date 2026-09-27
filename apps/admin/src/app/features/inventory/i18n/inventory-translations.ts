/**
 * Admin inventory feature translations — user-facing copy (`inventory.*`)
 * in all five supported cultures (`en`/`fr`/`de`/`es`/`ar`).
 *
 * Covers the Sub-Phase 13.8 landing page only (header plus the three
 * upcoming-section cards). Stock, reservation, and adjustment copy
 * arrives with Sub-Phases 13.9–13.10. Lookup runs through the Phase 4
 * `translate` engine (deterministic target → `en` → key-path fallback).
 * Pure data + pure lookup: no Angular, DOM, or storage access —
 * SSR-safe.
 */

import {
  translate,
  type Culture,
  type TranslationDictionary,
  type TranslationParams,
  type TranslationResources,
} from '@flux/i18n';

/** Admin inventory translation key paths owned by this feature (`inventory.*`). */
export const INVENTORY_TRANSLATION_KEYS = {
  title: 'inventory.title',
  subtitle: 'inventory.subtitle',
  stockTitle: 'inventory.sections.stockTitle',
  stockDescription: 'inventory.sections.stockDescription',
  reservationsTitle: 'inventory.sections.reservationsTitle',
  reservationsDescription: 'inventory.sections.reservationsDescription',
  adjustmentsTitle: 'inventory.sections.adjustmentsTitle',
  adjustmentsDescription: 'inventory.sections.adjustmentsDescription',
  upcomingBadge: 'inventory.sections.upcoming',
} as const;

/** English (`en`) inventory vocabulary. Also the deterministic fallback source. */
const EN_INVENTORY: TranslationDictionary = {
  inventory: {
    title: 'Inventory',
    subtitle: 'Stock levels, reservations, and adjustments.',
    sections: {
      stockTitle: 'Stock',
      stockDescription: 'Current on-hand, reserved, and available quantities per SKU.',
      reservationsTitle: 'Reservations',
      reservationsDescription: 'Order-linked stock holds and their lifecycle states.',
      adjustmentsTitle: 'Adjustments',
      adjustmentsDescription: 'Additive stock corrections with confirmation.',
      upcoming: 'Upcoming',
    },
  },
};

/** French (`fr`) inventory vocabulary. */
const FR_INVENTORY: TranslationDictionary = {
  inventory: {
    title: 'Inventaire',
    subtitle: 'Niveaux de stock, réservations et ajustements.',
    sections: {
      stockTitle: 'Stock',
      stockDescription: 'Quantités disponibles, réservées et totales par SKU.',
      reservationsTitle: 'Réservations',
      reservationsDescription: 'Retenues de stock liées aux commandes et leurs états.',
      adjustmentsTitle: 'Ajustements',
      adjustmentsDescription: 'Corrections de stock additives avec confirmation.',
      upcoming: 'Bientôt',
    },
  },
};

/** German (`de`) inventory vocabulary. */
const DE_INVENTORY: TranslationDictionary = {
  inventory: {
    title: 'Bestand',
    subtitle: 'Bestände, Reservierungen und Anpassungen.',
    sections: {
      stockTitle: 'Bestand',
      stockDescription: 'Verfügbare, reservierte und Gesamtmengen je SKU.',
      reservationsTitle: 'Reservierungen',
      reservationsDescription: 'Bestellbezogene Reservierungen und ihre Zustände.',
      adjustmentsTitle: 'Anpassungen',
      adjustmentsDescription: 'Additive Bestandskorrekturen mit Bestätigung.',
      upcoming: 'Demnächst',
    },
  },
};

/** Spanish (`es`) inventory vocabulary. */
const ES_INVENTORY: TranslationDictionary = {
  inventory: {
    title: 'Inventario',
    subtitle: 'Niveles de stock, reservas y ajustes.',
    sections: {
      stockTitle: 'Stock',
      stockDescription: 'Cantidades disponibles, reservadas y totales por SKU.',
      reservationsTitle: 'Reservas',
      reservationsDescription: 'Retenciones de stock vinculadas a pedidos y sus estados.',
      adjustmentsTitle: 'Ajustes',
      adjustmentsDescription: 'Correcciones de stock aditivas con confirmación.',
      upcoming: 'Próximamente',
    },
  },
};

/** Arabic (`ar`) inventory vocabulary. */
const AR_INVENTORY: TranslationDictionary = {
  inventory: {
    title: 'المخزون',
    subtitle: 'مستويات المخزون والحجوزات والتعديلات.',
    sections: {
      stockTitle: 'المخزون',
      stockDescription: 'الكميات المتاحة والمحجوزة والإجمالية لكل SKU.',
      reservationsTitle: 'الحجوزات',
      reservationsDescription: 'حجوزات المخزون المرتبطة بالطلبات وحالاتها.',
      adjustmentsTitle: 'التعديلات',
      adjustmentsDescription: 'تصحيحات المخزون الإضافية مع التأكيد.',
      upcoming: 'قريبًا',
    },
  },
};

/** Bundled inventory dictionaries keyed by supported culture. */
export const INVENTORY_TRANSLATION_RESOURCES: TranslationResources = {
  en: EN_INVENTORY,
  fr: FR_INVENTORY,
  de: DE_INVENTORY,
  es: ES_INVENTORY,
  ar: AR_INVENTORY,
};

/**
 * Resolves an inventory key to its localized string with deterministic
 * fallback: target culture → `en` → the key path itself. Never throws.
 */
export function translateInventoryKey(
  culture: Culture,
  key: string,
  params: TranslationParams = {},
): string {
  return translate(INVENTORY_TRANSLATION_RESOURCES, culture, key, params);
}
