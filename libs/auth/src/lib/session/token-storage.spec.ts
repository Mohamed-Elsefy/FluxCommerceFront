/**
 * Unit tests for Sub-Phase 2.3 — Token Storage & Session Model.
 *
 * Scope: `TokenStorageService` lifecycle (save/load/replace/clear),
 * corrupt-payload resilience, and SSR safety (server platform never touches
 * `localStorage`). No HTTP, no interceptors, no UI.
 */

import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTH_SESSION_STORAGE_KEY,
  TOKEN_STORAGE,
  TokenStorageService,
  type StoredSession,
} from './token-storage';
import type { CurrentUser } from '../state/auth-session';

const USER: CurrentUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ada@flux.local',
  displayName: 'Ada Lovelace',
  roles: ['Customer'],
  isEmailVerified: true,
};

const SESSION: StoredSession = {
  refreshToken: 'refresh-1',
  user: USER,
  authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
};

function storedRaw(): string | null {
  return window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
}

describe('TokenStorageService on the browser platform', () => {
  let storage: TokenStorageService;

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({});
    storage = TestBed.inject(TokenStorageService);
  });

  it('is the default TOKEN_STORAGE implementation', () => {
    expect(TestBed.inject(TOKEN_STORAGE)).toBe(storage);
  });

  it('loads null when nothing is stored', () => {
    expect(storage.loadSession()).toBeNull();
  });

  it('round-trips a saved session', () => {
    storage.saveSession(SESSION);

    expect(storedRaw()).not.toBeNull();
    expect(storage.loadSession()).toEqual(SESSION);
  });

  it('replaces the stored snapshot on rotation', () => {
    storage.saveSession(SESSION);
    const rotated: StoredSession = {
      ...SESSION,
      refreshToken: 'refresh-2',
      user: { ...USER, roles: ['Customer', 'Admin'] },
    };
    storage.replaceSession(rotated);

    expect(storage.loadSession()).toEqual(rotated);
  });

  it('clears the stored snapshot and stays idempotent', () => {
    storage.saveSession(SESSION);
    storage.clearSession();

    expect(storage.loadSession()).toBeNull();
    expect(storedRaw()).toBeNull();
    expect(() => storage.clearSession()).not.toThrow();
  });

  it('treats corrupt payloads as absent and removes them', () => {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, '{not-json');

    expect(storage.loadSession()).toBeNull();
    expect(storedRaw()).toBeNull();
  });

  it('rejects misshapen payloads and removes them', () => {
    for (const raw of ['{}', '[]', 'null', '{"refreshToken":""}', '{"refreshToken":"x"}']) {
      window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, raw);

      expect(storage.loadSession()).toBeNull();
      expect(storedRaw()).toBeNull();
    }
  });

  it('refuses to persist sessions with empty secrets', () => {
    storage.saveSession({ ...SESSION, refreshToken: '' });

    expect(storage.loadSession()).toBeNull();
    expect(storedRaw()).toBeNull();
  });
});

describe('TokenStorageService on the server platform (SSR)', () => {
  let storage: TokenStorageService;

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    storage = TestBed.inject(TokenStorageService);
  });

  it('loads null without touching storage', () => {
    expect(storage.loadSession()).toBeNull();
    expect(storedRaw()).toBeNull();
  });

  it('treats saves and clears as safe no-ops', () => {
    expect(() => storage.saveSession(SESSION)).not.toThrow();
    expect(() => storage.replaceSession(SESSION)).not.toThrow();
    expect(() => storage.clearSession()).not.toThrow();
    expect(storedRaw()).toBeNull();
  });
});
