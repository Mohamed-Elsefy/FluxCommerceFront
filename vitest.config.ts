// Learn more about Vitest configuration options at https://vitest.dev/config/

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['libs/**/*.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // One threads-pool worker: worker startup has a hardcoded 5s timeout
    // and times out under load on this machine ("Timeout starting …
    // runner"), including mid-run spawns. A single upfront worker removes
    // that surface. (Vitest 4 has no single-thread mode.)
    pool: 'threads',
    maxWorkers: 1,
  },
});
