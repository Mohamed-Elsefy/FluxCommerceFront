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
  stockHeading: 'inventory.stock.heading',
  stockSubheading: 'inventory.stock.subheading',
  stockSkuLabel: 'inventory.stock.skuLabel',
  stockSkuPlaceholder: 'inventory.stock.skuPlaceholder',
  stockSkuClear: 'inventory.stock.skuClear',
  stockLookup: 'inventory.stock.lookup',
  stockIdleTitle: 'inventory.stock.idleTitle',
  stockIdleMessage: 'inventory.stock.idleMessage',
  stockLoading: 'inventory.stock.loading',
  stockErrorTitle: 'inventory.stock.errorTitle',
  stockFactSku: 'inventory.stock.factSku',
  stockFactOnHand: 'inventory.stock.factOnHand',
  stockFactReserved: 'inventory.stock.factReserved',
  stockFactAvailable: 'inventory.stock.factAvailable',
  stockFactUpdated: 'inventory.stock.factUpdated',
} as const;

/** English (`en`) inventory vocabulary. Also the deterministic fallback source. */
const EN_INVENTORY: TranslationDictionary = {
  inventory: {
    title: 'Inventory',
    subtitle: 'Stock levels, reservations, and adjustments.',
    stock: {
      heading: 'Stock',
      subheading: 'Inspect the backend-provided state of one SKU.',
      skuLabel: 'SKU',
      skuPlaceholder: 'e.g. TEE-BLK-M',
      skuClear: 'Clear',
      lookup: 'Look up',
      idleTitle: 'Look up a SKU',
      idleMessage: 'Enter a stock-keeping unit to inspect its inventory state.',
      loading: 'Loading stock…',
      errorTitle: 'Could not load stock',
      factSku: 'SKU',
      factOnHand: 'On hand',
      factReserved: 'Reserved',
      factAvailable: 'Available',
      factUpdated: 'Updated',
    },
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
    stock: {
      heading: 'Stock',
      subheading: 'Consultez l’état backend d’un SKU.',
      skuLabel: 'SKU',
      skuPlaceholder: 'p. ex. TEE-BLK-M',
      skuClear: 'Effacer',
      lookup: 'Rechercher',
      idleTitle: 'Rechercher un SKU',
      idleMessage: 'Saisissez une unité de stock pour voir son état.',
      loading: 'Chargement du stock…',
      errorTitle: 'Impossible de charger le stock',
      factSku: 'SKU',
      factOnHand: 'En stock',
      factReserved: 'Réservé',
      factAvailable: 'Disponible',
      factUpdated: 'Mis à jour',
    },
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
    stock: {
      heading: 'Bestand',
      subheading: 'Backend-Stand einer SKU einsehen.',
      skuLabel: 'SKU',
      skuPlaceholder: 'z. B. TEE-BLK-M',
      skuClear: 'Leeren',
      lookup: 'Nachschlagen',
      idleTitle: 'SKU nachschlagen',
      idleMessage: 'Geben Sie eine SKU ein, um ihren Bestand zu sehen.',
      loading: 'Bestand wird geladen…',
      errorTitle: 'Bestand konnte nicht geladen werden',
      factSku: 'SKU',
      factOnHand: 'Im Bestand',
      factReserved: 'Reserviert',
      factAvailable: 'Verfügbar',
      factUpdated: 'Aktualisiert',
    },
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
    stock: {
      heading: 'Stock',
      subheading: 'Consulte el estado backend de un SKU.',
      skuLabel: 'SKU',
      skuPlaceholder: 'p. ej. TEE-BLK-M',
      skuClear: 'Borrar',
      lookup: 'Consultar',
      idleTitle: 'Consultar un SKU',
      idleMessage: 'Introduzca una unidad de stock para ver su estado.',
      loading: 'Cargando stock…',
      errorTitle: 'No se pudo cargar el stock',
      factSku: 'SKU',
      factOnHand: 'En stock',
      factReserved: 'Reservado',
      factAvailable: 'Disponible',
      factUpdated: 'Actualizado',
    },
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
    stock: {
      heading: 'المخزون',
      subheading: 'اطّلع على حالة SKU من الخادم.',
      skuLabel: 'SKU',
      skuPlaceholder: 'مثال: TEE-BLK-M',
      skuClear: 'مسح',
      lookup: 'بحث',
      idleTitle: 'ابحث عن SKU',
      idleMessage: 'أدخل وحدة مخزون لعرض حالتها.',
      loading: 'جارٍ تحميل المخزون…',
      errorTitle: 'تعذّر تحميل المخزون',
      factSku: 'SKU',
      factOnHand: 'في المخزن',
      factReserved: 'محجوز',
      factAvailable: 'المتاح',
      factUpdated: 'حُدّث',
    },
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
