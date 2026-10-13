/**
 * API error localization tests for Sub-Phase 4.7.
 *
 * Covers error-code-to-translation-key mapping, localized resolution of
 * normalized `ApiError` instances across all five supported cultures,
 * status/shape handling for codeless wire errors, deterministic fallback
 * for unknown codes, and independence from server-provided message text.
 */

import { describe, expect, it } from 'vitest';
import { ApiError } from '@flux/api';
import type { Culture } from '../culture/culture';
import {
  UNKNOWN_ERROR_TRANSLATION_KEY,
  mapErrorCodeToTranslationKey,
  resolveApiErrorDetails,
  resolveApiErrorMessage,
} from './error-localization';

function apiError(init: {
  status: number;
  message: string;
  code?: string;
  validationErrors?: Record<string, string[]>;
}): ApiError {
  return new ApiError(init);
}

describe('mapErrorCodeToTranslationKey', () => {
  it('maps stable transport and generic codes to base keys', () => {
    expect(mapErrorCodeToTranslationKey('NetworkError')).toBe('errors.network');
    expect(mapErrorCodeToTranslationKey('RequestCancelled')).toBe('errors.unknown');
    expect(mapErrorCodeToTranslationKey('UnknownError')).toBe('errors.unknown');
    expect(mapErrorCodeToTranslationKey('ValidationError')).toBe('errors.validation');
    expect(mapErrorCodeToTranslationKey('Unauthorized')).toBe('errors.unauthorized');
    expect(mapErrorCodeToTranslationKey('Forbidden')).toBe('errors.forbidden');
  });

  it('normalizes case and whitespace before matching', () => {
    expect(mapErrorCodeToTranslationKey('VALIDATION_ERROR')).toBe('errors.validation');
    expect(mapErrorCodeToTranslationKey(' validation_error ')).toBe('errors.validation');
    expect(mapErrorCodeToTranslationKey('UNAUTHORIZED')).toBe('errors.unauthorized');
    expect(mapErrorCodeToTranslationKey('FORBIDDEN')).toBe('errors.forbidden');
  });

  it('resolves unknown, domain, empty, and non-string codes to the generic fallback', () => {
    expect(mapErrorCodeToTranslationKey('Identity.UserNotFound')).toBe(
      UNKNOWN_ERROR_TRANSLATION_KEY,
    );
    expect(mapErrorCodeToTranslationKey('ORDER_NOT_FOUND')).toBe(UNKNOWN_ERROR_TRANSLATION_KEY);
    expect(mapErrorCodeToTranslationKey('')).toBe(UNKNOWN_ERROR_TRANSLATION_KEY);
    expect(mapErrorCodeToTranslationKey('   ')).toBe(UNKNOWN_ERROR_TRANSLATION_KEY);
    expect(mapErrorCodeToTranslationKey(null)).toBe(UNKNOWN_ERROR_TRANSLATION_KEY);
    expect(mapErrorCodeToTranslationKey(undefined)).toBe(UNKNOWN_ERROR_TRANSLATION_KEY);
  });
});

describe('resolveApiErrorMessage', () => {
  it('produces the correct localized message per culture for the same code', () => {
    const network: Readonly<Record<Culture, string>> = {
      en: 'A network error occurred. Please check your connection.',
      fr: "Une erreur réseau s'est produite. Vérifiez votre connexion.",
      de: 'Ein Netzwerkfehler ist aufgetreten. Bitte überprüfen Sie Ihre Verbindung.',
      es: 'Se ha producido un error de red. Compruebe su conexión.',
      ar: 'حدث خطأ في الشبكة. يرجى التحقق من اتصالك.',
    };
    for (const [culture, message] of Object.entries(network) as [Culture, string][]) {
      expect(
        resolveApiErrorMessage(
          apiError({ status: 0, code: 'NetworkError', message: 'x' }),
          culture,
        ),
      ).toBe(message);
    }
  });

  it('localizes validation errors in every supported culture', () => {
    const validation: Readonly<Record<Culture, string>> = {
      en: 'Please correct the highlighted fields and try again.',
      fr: 'Veuillez corriger les champs signalés et réessayer.',
      de: 'Bitte korrigieren Sie die markierten Felder und versuchen Sie es erneut.',
      es: 'Corrija los campos resaltados e inténtelo de nuevo.',
      ar: 'يرجى تصحيح الحقول المميزة وحاول مرة أخرى.',
    };
    for (const [culture, message] of Object.entries(validation) as [Culture, string][]) {
      expect(
        resolveApiErrorMessage(
          apiError({ status: 400, code: 'VALIDATION_ERROR', message: 'x' }),
          culture,
        ),
      ).toBe(message);
    }
  });

  it('resolves codeless wire errors by status and shape', () => {
    expect(resolveApiErrorMessage(apiError({ status: 401, message: 'x' }), 'en')).toBe(
      'You are not authorized. Please sign in.',
    );
    expect(resolveApiErrorMessage(apiError({ status: 401, message: 'x' }), 'ar')).toBe(
      'غير مصرح لك. يرجى تسجيل الدخول.',
    );
    expect(resolveApiErrorMessage(apiError({ status: 403, message: 'x' }), 'en')).toBe(
      'Access to this resource is forbidden.',
    );
    expect(
      resolveApiErrorMessage(
        new ApiError({ status: 400, message: 'x', validationErrors: { Email: ['Bad.'] } }),
        'en',
      ),
    ).toBe('Please correct the highlighted fields and try again. Email: Bad.');
  });

  it('lists every field detail after the validation header', () => {
    expect(
      resolveApiErrorMessage(
        apiError({
          status: 400,
          message: 'x',
          validationErrors: {
            customerId: ["The value 'سسس' is not valid."],
            search: ['Too long.', 'Bad format.'],
          },
        }),
        'en',
      ),
    ).toBe(
      "Please correct the highlighted fields and try again. customerId: The value 'سسس' is not valid. search: Too long. search: Bad format.",
    );
  });

  it('keeps the generic validation header when no field details exist', () => {
    expect(
      resolveApiErrorMessage(apiError({ status: 400, message: 'x', validationErrors: {} }), 'en'),
    ).toBe('Please correct the highlighted fields and try again.');
    expect(resolveApiErrorDetails(apiError({ status: 400, message: 'x' }))).toEqual([]);
    expect(
      resolveApiErrorDetails(
        apiError({ status: 400, message: 'x', validationErrors: { Email: ['Bad.'] } }),
      ),
    ).toEqual(['Email: Bad.']);
  });

  it('falls back deterministically for unmapped statuses, codes, and nullish errors', () => {
    expect(resolveApiErrorMessage(apiError({ status: 400, message: 'x' }), 'en')).toBe(
      'An unexpected error occurred.',
    );
    expect(resolveApiErrorMessage(apiError({ status: 404, message: 'x' }), 'en')).toBe(
      'An unexpected error occurred.',
    );
    expect(resolveApiErrorMessage(apiError({ status: 500, message: 'x' }), 'ar')).toBe(
      'حدث خطأ غير متوقع.',
    );
    expect(
      resolveApiErrorMessage(apiError({ status: 404, code: 'Order.NotFound', message: 'x' }), 'ar'),
    ).toBe('حدث خطأ غير متوقع.');
    expect(resolveApiErrorMessage(null, 'en')).toBe('An unexpected error occurred.');
    expect(resolveApiErrorMessage(undefined, 'ar')).toBe('حدث خطأ غير متوقع.');
  });

  it('never branches on or echoes server-provided message text', () => {
    expect(
      resolveApiErrorMessage(
        apiError({ status: 0, code: 'NetworkError', message: 'TOTALLY UNRELATED server text' }),
        'en',
      ),
    ).toBe('A network error occurred. Please check your connection.');
    const arabicDetail = 'تفاصيل خادم مخصصة';
    const resolved = resolveApiErrorMessage(
      apiError({ status: 409, code: 'Cart.CustomFutureCode', message: arabicDetail }),
      'ar',
    );
    expect(resolved).toBe('حدث خطأ غير متوقع.');
    expect(resolved).not.toContain(arabicDetail);
  });
});
