/**
 * Unit tests for the Sub-Phase 7.5 `GuestCartStorageService`.
 *
 * Covers the identity-bookmark lifecycle only (save/load/clear of the
 * opaque backend-issued `cartId`): round-trips, blank-entry rejection
 * and cleanup, overwrite on rotation (fresh cart after recovery), clear
 * idempotency, and SSR safety (server platform never touches
 * `localStorage`). No HTTP, no feature state, no UI.
 *
 * Deliberately NOT covered here (backend's verdict, not storage rules):
 * id syntax validation — any non-blank string persists, and garbage ids
 * surface as `400 Cart.InvalidCartId` through the 7.5 recovery flow.
 */

import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  GUEST_CART_STORAGE,
  GUEST_CART_STORAGE_KEY,
  GuestCartStorageService,
} from './guest-cart-storage.service';

const CART_ID = '11111111-1111-4111-8111-111111111111';
const ROTATED_ID = '22222222-2222-4222-8222-222222222222';

function storedRaw(): string | null {
  return window.localStorage.getItem(GUEST_CART_STORAGE_KEY);
}

describe('GuestCartStorageService on the browser platform', () => {
  let storage: GuestCartStorageService;

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({});
    storage = TestBed.inject(GuestCartStorageService);
  });

  it('is the default GUEST_CART_STORAGE implementation', () => {
    expect(TestBed.inject(GUEST_CART_STORAGE)).toBe(storage);
  });

  it('loads null when nothing is stored', () => {
    expect(storage.loadGuestCartId()).toBeNull();
  });

  it('round-trips the backend-issued cart id and nothing more', () => {
    storage.saveGuestCartId(CART_ID);

    expect(storedRaw()).toBe(CART_ID);
    expect(storage.loadGuestCartId()).toBe(CART_ID);
  });

  it('trims surrounding whitespace on save', () => {
    storage.saveGuestCartId(`  ${CART_ID}  `);

    expect(storage.loadGuestCartId()).toBe(CART_ID);
  });

  it('overwrites the stored id (fresh cart after recovery)', () => {
    storage.saveGuestCartId(CART_ID);
    storage.saveGuestCartId(ROTATED_ID);

    expect(storage.loadGuestCartId()).toBe(ROTATED_ID);
  });

  it('clears the stored id and stays idempotent', () => {
    storage.saveGuestCartId(CART_ID);
    storage.clearGuestCartId();

    expect(storage.loadGuestCartId()).toBeNull();
    expect(storedRaw()).toBeNull();
    expect(() => storage.clearGuestCartId()).not.toThrow();
  });

  it('treats blank entries as absent and removes them', () => {
    for (const raw of ['', '   ', '\t\n ']) {
      window.localStorage.setItem(GUEST_CART_STORAGE_KEY, raw);

      expect(storage.loadGuestCartId()).toBeNull();
      expect(storedRaw()).toBeNull();
    }
  });

  it('refuses to persist blank ids', () => {
    for (const raw of ['', '   ']) {
      storage.saveGuestCartId(raw);

      expect(storage.loadGuestCartId()).toBeNull();
      expect(storedRaw()).toBeNull();
    }
  });

  it('persists any non-blank id verbatim (syntax is the backend verdict)', () => {
    storage.saveGuestCartId('not-a-guid');

    expect(storage.loadGuestCartId()).toBe('not-a-guid');
  });

  it('stores only the id string (never cart contents)', () => {
    storage.saveGuestCartId(CART_ID);

    expect(storedRaw()).toBe(CART_ID);
  });
});

describe('GuestCartStorageService on the server platform (SSR)', () => {
  let storage: GuestCartStorageService;

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    storage = TestBed.inject(GuestCartStorageService);
  });

  it('loads null without touching storage', () => {
    expect(storage.loadGuestCartId()).toBeNull();
    expect(storedRaw()).toBeNull();
  });

  it('treats saves and clears as safe no-ops', () => {
    expect(() => storage.saveGuestCartId(CART_ID)).not.toThrow();
    expect(() => storage.clearGuestCartId()).not.toThrow();
    expect(storedRaw()).toBeNull();
  });
});
