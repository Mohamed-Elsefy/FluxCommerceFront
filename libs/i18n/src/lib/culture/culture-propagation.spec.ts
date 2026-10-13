/**
 * Culture propagation wiring tests for Sub-Phase 4.5.
 *
 * Verifies that `provideCulturePropagation()` binds the Phase 1
 * `ACTIVE_CULTURE_PROVIDER` seam to the central `CultureService`, so the
 * interceptor pipeline always observes the active culture (header injection
 * itself is covered in `@flux/api`'s pipeline suite).
 */

import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ACTIVE_CULTURE_PROVIDER } from '@flux/api';
import { CULTURE_STORAGE_KEY, CultureService } from './culture.service';
import { provideCulturePropagation } from './culture-propagation';

beforeEach(() => {
  window.localStorage.clear();
});

describe('provideCulturePropagation wiring', () => {
  it('binds the seam reader to the central CultureService', () => {
    TestBed.configureTestingModule({ providers: [provideCulturePropagation()] });
    const service = TestBed.inject(CultureService);
    const readCulture = TestBed.inject(ACTIVE_CULTURE_PROVIDER);

    expect(readCulture()).toBe(service.culture());

    service.setCulture('ar');

    expect(readCulture()).toBe('ar');
    expect(window.localStorage.getItem(CULTURE_STORAGE_KEY)).toBe('ar');

    service.setCulture('fr');

    expect(readCulture()).toBe('fr');
  });
});
