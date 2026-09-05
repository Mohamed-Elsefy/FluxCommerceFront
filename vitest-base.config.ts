// Learn more about Vitest configuration options at https://vitest.dev/config/
// Base options merged by the Angular unit-test builder (`runnerConfig`).
// One threads-pool worker: worker startup has a hardcoded 5s timeout and
// times out under load on this machine ("Timeout starting … runner"),
// including mid-run spawns. A single upfront worker removes that surface.
// (Vitest 4 has no single-thread mode.)

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'threads',
    maxWorkers: 1,
  },
});
