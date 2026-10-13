import { getTestBed, ɵgetCleanupHook as getCleanupHook } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeEach } from 'vitest';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

// Mirror the Angular builder: reset the TestBed after each test so specs
// stay isolated when sharing one process (see singleThread in vitest.config.ts).
beforeEach(getCleanupHook(false));
afterEach(getCleanupHook(true));
