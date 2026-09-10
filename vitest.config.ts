// Learn more about Vitest configuration options at https://vitest.dev/config/

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));
const libEntry = (lib: string): string => join(root, `libs/${lib}/src/public-api.ts`);

/**
 * Inlines `templateUrl`/`styleUrl` component resources for the raw Vitest
 * runner (used for `libs/*` specs). The Angular builder performs this
 * inlining for `ng test`/`ng build`, but raw Vitest has no Angular compiler
 * plugin — without this transform, TestBed fails with "Component is not
 * resolved ... Did you run and wait for 'resolveComponentResources()'?".
 *
 * Rewrites (scoped to `libs/` sources containing external resources):
 *
 * ```text
 * templateUrl: './alert.html'  →  template: (await import('./alert.html?raw')).default
 * styleUrl: './alert.css'      →  styles: [(await import('./alert.css?raw')).default]
 * ```
 *
 * Safe under `ng test`: when the Angular plugin has already inlined a
 * resource, no `templateUrl`/`styleUrl` remains and this transform is a
 * no-op. Only the singular `templateUrl`/`styleUrl` forms are supported —
 * the workspace convention (one template, one stylesheet per component).
 */
function angularComponentResources(): Plugin {
  return {
    name: 'flux-angular-component-resources',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').includes('/libs/') || !id.endsWith('.ts')) {
        return null;
      }
      if (!/templateUrl\s*:|styleUrl\s*:/.test(code)) {
        return null;
      }
      const out = code
        .replace(
          /templateUrl\s*:\s*['"]([^'"]+)['"]/g,
          (_, url: string) => `template: (await import('${url}?raw')).default`,
        )
        .replace(
          /styleUrl\s*:\s*['"]([^'"]+)['"]/g,
          (_, url: string) => `styles: [(await import('${url}?raw')).default]`,
        );
      return out === code ? null : out;
    },
  };
}

export default defineConfig({
  plugins: [angularComponentResources()],
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
