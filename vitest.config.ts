// Learn more about Vitest configuration options at https://vitest.dev/config/

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));
const libEntry = (lib: string): string => join(root, `libs/${lib}/src/public-api.ts`);

export default defineConfig({
  resolve: {
    // Workspace path aliases for the raw Vitest runner, mirroring the
    // `@flux/*` entries in tsconfig.json (which only TypeScript and the
    // Angular builder resolve). Required by cross-library specs.
    alias: {
      '@flux/api': libEntry('api'),
      '@flux/auth': libEntry('auth'),
      '@flux/ui': libEntry('ui'),
      '@flux/i18n': libEntry('i18n'),
      '@flux/theming': libEntry('theming'),
      '@flux/models': libEntry('models'),
      '@flux/utils': libEntry('utils'),
    },
  },
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
