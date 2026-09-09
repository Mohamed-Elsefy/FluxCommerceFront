// Sub-Phase 0.10 — scripted architectural verification audit.
//
// Checks the Phase 0 baseline constraints across workspace structure,
// standalone architecture, dependency direction, application targets,
// routing and testing infrastructure. Exit 0 when every check passes,
// exit 1 listing each violation (CI-friendly).
//
// This is intentionally coarser than `npm run lint:boundaries` (ESLint):
// it covers structural aspects lint rules cannot see. Both must stay green.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let count = 0;

function check(name, pass, detail = '') {
  count += 1;
  console.log(`${pass ? '  [PASS]' : '  [FAIL]'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) {
    failures.push(name);
  }
}

function readJson(path) {
  // Workspace configs are JSONC with leading /* */ banners (one or more).
  // Only leading banners are stripped: naive full-file comment stripping
  // would corrupt glob patterns such as "**/*". Anything else non-JSON
  // fails loudly instead of parsing into a wrong object.
  const text = readFileSync(join(root, path), 'utf8').replace(/^\s*(?:\/\*[\s\S]*?\*\/\s*)+/, '');
  return JSON.parse(text);
}

function listDirs(path) {
  return readdirSync(join(root, path), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function exists(path) {
  try {
    statSync(join(root, path));
    return true;
  } catch {
    return false;
  }
}

function collectTs(dir, out = []) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      collectTs(relative, out);
    } else if (entry.name.endsWith('.ts')) {
      out.push(relative);
    }
  }
  return out;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
}

function importSpecifiers(relativePath) {
  const source = stripComments(readFileSync(join(root, relativePath), 'utf8'));
  const found = new Set();
  for (const pattern of [
    /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]) {
    for (const match of source.matchAll(pattern)) {
      found.add(match[1]);
    }
  }
  return [...found];
}

const same = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

// ---------------------------------------------------------------- Workspace
console.log('Workspace');
const expectedApps = ['admin', 'storefront'];
const expectedLibs = ['api', 'auth', 'i18n', 'models', 'theming', 'ui', 'utils'];
const angular = readJson('angular.json');
const projectNames = Object.keys(angular.projects).sort();

check('apps/ contains only storefront and admin', same(listDirs('apps'), expectedApps));
check('libs/ contains only the 7 shared libraries', same(listDirs('libs'), expectedLibs));
check('angular.json projects match apps/', same(projectNames, expectedApps));
check(
  'every library has a barrel entry point and project config',
  expectedLibs.every(
    (lib) => exists(`libs/${lib}/src/public-api.ts`) && exists(`libs/${lib}/tsconfig.lib.json`),
  ),
);

// ------------------------------------------------------------- Architecture
console.log('Architecture');
const appSources = [...collectTs('apps/storefront/src'), ...collectTs('apps/admin/src')];
const libSources = expectedLibs.flatMap((lib) => collectTs(`libs/${lib}`));
const e2eSources = exists('e2e') ? collectTs('e2e') : [];
const allSources = [...appSources, ...libSources, ...e2eSources];

const readAll = (paths) => paths.map((path) => readFileSync(join(root, path), 'utf8')).join('\n');
check(
  'no NgModules anywhere (standalone architecture)',
  !/@NgModule\s*[(]/.test(readAll(allSources)),
);
check('no standalone: false opt-outs', !/standalone\s*:\s*false/.test(readAll(allSources)));
check(
  'every barrel re-exports its library modules',
  expectedLibs.every((lib) =>
    readFileSync(join(root, `libs/${lib}/src/public-api.ts`), 'utf8').includes('export *'),
  ),
);

const specifiersOf = (paths) =>
  paths.flatMap((path) => importSpecifiers(path).map((spec) => ({ path, spec })));
const allSpecifiers = specifiersOf(allSources);
check(
  'no relative traversal into libs/',
  !allSpecifiers.some(({ spec }) => spec.includes('libs')),
  `${allSpecifiers.filter(({ spec }) => spec.includes('libs')).length} violation(s)`,
);
check(
  'no deep @flux imports (barrels only)',
  !allSpecifiers.some(({ spec }) => /^@flux\/[^/]+\/.+/.test(spec)),
);

const inStorefront = (spec) => spec.includes('admin') || spec.includes('apps/');
const inAdmin = (spec) => spec.includes('storefront') || spec.includes('apps/');
const fromLibs = (spec) =>
  spec.includes('apps/') || spec.includes('storefront') || spec.includes('admin');
const storefrontSources = collectTs('apps/storefront/src');
const adminSources = collectTs('apps/admin/src');
check(
  'storefront never imports the admin application',
  !specifiersOf(storefrontSources).some(({ spec }) => inStorefront(spec)),
);
check(
  'admin never imports the storefront application',
  !specifiersOf(adminSources).some(({ spec }) => inAdmin(spec)),
);
check(
  'libraries never import from applications',
  !specifiersOf(libSources).some(({ spec }) => fromLibs(spec)),
);
// Sub-Phase 1.3 boundary: Feature Data Access -> API Client -> HttpClient.
// Only libs/api may touch raw HttpClient; applications consume @flux/api.
// The exact '@angular/common/http' specifier is checked so specs may still
// use '@angular/common/http/testing'.
const isRawHttpClient = (spec) => spec === '@angular/common/http';
check(
  'applications never import HttpClient directly (use ApiClient)',
  !specifiersOf(appSources).some(({ spec }) => isRawHttpClient(spec)),
);
check(
  'only libs/api uses HttpClient (single transport owner)',
  !specifiersOf(libSources.filter((path) => !path.startsWith('libs/api/'))).some(({ spec }) =>
    isRawHttpClient(spec),
  ),
);
// Sub-Phase 3.1 — UI Architecture Foundation: libs/ui is business-agnostic
// presentation only, libs/theming is visual infrastructure only. Neither
// may depend on any @flux/* barrel (decoupled from each other and from
// api/auth/i18n/models/utils), on business-feature/domain specifiers, on
// application code, or on HttpClient. Apps compose libs; libs never reach
// back. Naming: shared UI selectors carry the `flux-` prefix and barrels
// re-export their modules.
const uiSources = collectTs('libs/ui');
const themingSources = collectTs('libs/theming');
const presentationSources = [...uiSources, ...themingSources];
const isFluxBarrel = (spec) => /^@flux\/.+/.test(spec);
const businessPattern = /catalog|cart|checkout|orders?|inventory|inventor|payments?|stripe|auth/i;
const isBusinessSpecifier = (spec) => businessPattern.test(spec) && !spec.startsWith('@angular/');
check(
  '3.1: libs/ui imports no @flux/* barrel (fully decoupled presentation)',
  !specifiersOf(uiSources).some(({ spec }) => isFluxBarrel(spec)),
);
check(
  '3.1: libs/theming imports no @flux/* barrel (visual infrastructure only)',
  !specifiersOf(themingSources).some(({ spec }) => isFluxBarrel(spec)),
);
check(
  '3.1: presentation infrastructure imports no business feature/domain modules',
  !specifiersOf(presentationSources).some(({ spec }) => isBusinessSpecifier(spec)),
);
check(
  '3.1: presentation infrastructure never imports HttpClient',
  !specifiersOf(presentationSources).some(({ spec }) => isRawHttpClient(spec)),
);
const uiSelectors = [];
for (const path of uiSources.filter((candidate) => !candidate.endsWith('.spec.ts'))) {
  const source = stripComments(readFileSync(join(root, path), 'utf8'));
  for (const match of source.matchAll(/selector\s*:\s*['"]([^'"]+)['"]/g)) {
    uiSelectors.push({ path, selector: match[1] });
  }
}
check(
  '3.1: shared UI selectors use the flux- prefix (naming convention)',
  uiSelectors.length > 0 && uiSelectors.every(({ selector }) => selector.startsWith('flux-')),
  `${uiSelectors.length} selector(s)`,
);
// Sub-Phase 3.3 — Theme System: centralized `ThemeService` (signals) drives
// `data-theme` on the root element; the `:root` Light base plus dark
// overrides share token names, so components never branch on theme. Every
// browser-only access is platform-guarded (SSR/hydration safe), and UI
// components consume variables without importing the service.
const tokensPath = 'libs/theming/src/lib/tokens.css';
const tokensCss = exists(tokensPath) ? readFileSync(join(root, tokensPath), 'utf8') : '';
const themeServicePath = 'libs/theming/src/lib/theme.service.ts';
const themeServiceCode = exists(themeServicePath)
  ? readFileSync(join(root, themeServicePath), 'utf8')
  : '';
check(
  '3.3: ThemeService exists with a readonly theme signal and switching API',
  exists(themeServicePath) &&
    /class\s+ThemeService/.test(themeServiceCode) &&
    /readonly\s+theme\s*:\s*Signal<Theme>/.test(themeServiceCode) &&
    /setTheme\(/.test(themeServiceCode) &&
    /toggleTheme\(/.test(themeServiceCode) &&
    /provideTheming\(\)/.test(themeServiceCode),
);
check(
  '3.3: theme state starts from validated persistence with a default fallback',
  /readStored\(\)\s*\?\?\s*DEFAULT_THEME/.test(themeServiceCode) &&
    /isTheme\(/.test(themeServiceCode),
);
check(
  '3.3: browser-only APIs are platform-guarded (SSR/hydration safe)',
  /isPlatformBrowser\(/.test(themeServiceCode) &&
    /PLATFORM_ID/.test(themeServiceCode) &&
    /setAttribute\(THEME_ATTRIBUTE/.test(themeServiceCode),
);
const darkBlock = tokensCss.includes('[data-theme=')
  ? tokensCss.slice(tokensCss.indexOf('[data-theme='))
  : '';
check(
  '3.3: Dark theme overrides reuse token names under data-theme',
  /:root\[data-theme=['"]dark['"]\]/.test(tokensCss) &&
    ['--color-surface', '--color-text', '--color-border'].every((token) =>
      darkBlock.includes(token),
    ),
);
check(
  '3.3: UI components never depend on the theme service (variables only)',
  !uiSources
    .filter((path) => !path.endsWith('.spec.ts'))
    .some((path) =>
      /ThemeService|provideTheming/.test(stripComments(readFileSync(join(root, path), 'utf8'))),
    ),
);
check(
  '3.3: both apps compose provideTheming() at bootstrap',
  ['storefront', 'admin'].every((app) =>
    readFileSync(join(root, `apps/${app}/src/app/app.config.ts`), 'utf8').includes(
      'provideTheming()',
    ),
  ),
);
// Sub-Phase 3.2 — Design Tokens & CSS Variables: `libs/theming` owns the
// centralized `:root` token foundation (consumed globally by both apps via
// their build `styles` arrays, before app styles). Tokens are values only:
// no selectors, no rules, no physical-direction properties, no services.
const requiredTokens = [
  // Colors: brand, surfaces/text/border, status.
  '--color-primary',
  '--color-primary-contrast',
  '--color-surface',
  '--color-text',
  '--color-text-muted',
  '--color-border',
  '--color-success',
  '--color-warning',
  '--color-danger',
  '--color-info',
  // Typography: families, sizes, weights, line heights.
  '--font-family-sans',
  '--font-size-sm',
  '--font-size-md',
  '--font-size-lg',
  '--font-weight-medium',
  '--line-height-base',
  // Spacing.
  '--spacing-sm',
  '--spacing-lg',
  '--spacing-2xl',
  // Borders & radius.
  '--border-width-thin',
  '--radius-sm',
  '--radius-md',
  '--radius-full',
  // Elevation.
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg',
  // Sizing & container constraints.
  '--container-max-width',
  '--container-padding-inline',
  // Z-index scale.
  '--z-index-modal',
  // Motion: durations & easings.
  '--duration-base',
  '--ease-in-out',
];
check(
  '3.2: centralized tokens.css exists and declares :root custom properties',
  tokensCss.includes(':root'),
);
check(
  '3.2: token set covers all required categories with consistent names',
  requiredTokens.every((token) => tokensCss.includes(token)),
  `${requiredTokens.length} token(s)`,
);
check(
  '3.2: tokens are direction-agnostic (no physical-direction properties)',
  !/margin-left|margin-right|padding-left|padding-right|border-left|border-right|inset-left|inset-right/.test(
    tokensCss,
  ),
);
check(
  '3.2: both apps compose tokens.css globally, before their own styles',
  ['storefront', 'admin'].every((app) => {
    const styles = angular.projects[app]?.architect?.build?.options?.styles;
    return (
      Array.isArray(styles) &&
      styles[0] === 'libs/theming/src/lib/tokens.css' &&
      styles.some((entry) => entry === `apps/${app}/src/styles.css`)
    );
  }),
);
const asyncStateComponents = [
  'libs/ui/src/lib/async-state/loading-indicator.ts',
  'libs/ui/src/lib/async-state/skeleton.ts',
  'libs/ui/src/lib/async-state/empty-state.ts',
  'libs/ui/src/lib/async-state/error-state.ts',
  'libs/ui/src/lib/async-state/retry-button.ts',
];
check(
  '3.2: reusable components consume tokens instead of duplicating values',
  asyncStateComponents.every(
    (path) =>
      exists(path) &&
      /var\(--(spacing|radius|font-size|border-width|ease)-/.test(
        stripComments(readFileSync(join(root, path), 'utf8')),
      ),
  ),
  `${asyncStateComponents.length} component(s)`,
);
const uiProdBasenames = uiSources
  .filter((path) => !path.endsWith('.spec.ts'))
  .map((path) => path.split('/').pop());
check(
  '3.1: scope stop — no core UI primitives yet (Button/Input/Card arrive in 3.4)',
  !uiProdBasenames.some((name) =>
    /^(button|input|card|badge|icon|alert|divider|dialog|modal|table|toast|select|checkbox|radio|textarea)\.ts$/.test(
      name,
    ),
  ),
);
// Sub-Phase 1.12: circular import detection. Spec files are excluded —
// test-only seams must not fail production architecture checks.
function resolveRelativeImport(fromPath, spec) {
  const segments = fromPath.split('/');
  segments.pop();
  for (const part of spec.split('/')) {
    if (part === '.') {
      continue;
    } else if (part === '..') {
      segments.pop();
    } else {
      segments.push(part);
    }
  }
  const base = segments.join('/');
  for (const candidate of [`${base}.ts`, `${base}/index.ts`]) {
    if (exists(candidate)) {
      return candidate;
    }
  }
  return null;
}
function findCycle(nodes, edges) {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map(nodes.map((node) => [node, WHITE]));
  const stack = [];
  const visit = (node) => {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      if (color.get(next) === GRAY) {
        return [...stack.slice(stack.indexOf(next)), next];
      }
      if (color.get(next) === WHITE) {
        const cycle = visit(next);
        if (cycle) {
          return cycle;
        }
      }
    }
    stack.pop();
    color.set(node, BLACK);
    return null;
  };
  for (const node of nodes) {
    if (color.get(node) === WHITE) {
      const cycle = visit(node);
      if (cycle) {
        return cycle;
      }
    }
  }
  return null;
}
const prodSources = allSources.filter((path) => !path.endsWith('.spec.ts'));
const relativeEdges = new Map();
for (const path of prodSources) {
  const targets = new Set();
  for (const spec of importSpecifiers(path)) {
    if (spec.startsWith('.')) {
      const resolved = resolveRelativeImport(path, spec);
      if (resolved && resolved !== path) {
        targets.add(resolved);
      }
    }
  }
  relativeEdges.set(path, [...targets]);
}
const relativeCycle = findCycle(prodSources, relativeEdges);
check(
  'no circular relative imports across apps/ and libs/',
  relativeCycle === null,
  relativeCycle ? relativeCycle.join(' -> ') : '0 cycle(s)',
);
const libNodes = expectedLibs;
const libEdges = new Map(libNodes.map((lib) => [lib, []]));
for (const path of libSources.filter((candidate) => !candidate.endsWith('.spec.ts'))) {
  const from = path.split('/')[1];
  for (const spec of importSpecifiers(path)) {
    const match = /^@flux\/([^/]+)$/.exec(spec);
    if (match && match[1] !== from && libEdges.has(match[1])) {
      libEdges.get(from).push(match[1]);
    }
  }
}
const libCycle = findCycle(libNodes, libEdges);
check(
  'no circular library dependencies via @flux barrels',
  libCycle === null,
  libCycle ? libCycle.join(' -> ') : '0 cycle(s)',
);
const readCode = (path) => stripComments(readFileSync(join(root, path), 'utf8'));
const secretPattern = /secret|password|passwd|credential|apikey|accesstoken/i;
check(
  'no hard-coded API URLs outside environments/',
  !appSources
    .filter((path) => path.includes('/src/app/') && !path.includes('/environments/'))
    .some((path) => /localhost|https?:\/\//.test(readCode(path))),
);
check(
  'environment files contain no secrets',
  !['apps/storefront/src/environments', 'apps/admin/src/environments'].some((dir) =>
    collectTs(dir).some((path) => secretPattern.test(readCode(path))),
  ),
);

// ------------------------------------------------------------ Applications
console.log('Applications');
const storefrontBuild = angular.projects.storefront.architect.build.options;
const adminBuild = angular.projects.admin.architect.build.options;
const storefrontConfig = readFileSync(join(root, 'apps/storefront/src/app/app.config.ts'), 'utf8');
const adminConfig = readFileSync(join(root, 'apps/admin/src/app/app.config.ts'), 'utf8');

check(
  'storefront build is SSR-enabled',
  storefrontBuild.outputMode === 'server' &&
    typeof storefrontBuild.server === 'string' &&
    typeof storefrontBuild.ssr?.entry === 'string',
);
check(
  'storefront server files and hydration exist',
  [
    'apps/storefront/src/main.server.ts',
    'apps/storefront/src/server.ts',
    'apps/storefront/src/app/app.config.server.ts',
    'apps/storefront/src/app/app.routes.server.ts',
  ].every(exists) && storefrontConfig.includes('provideClientHydration'),
);
check(
  'admin build is CSR-only',
  adminBuild.outputMode === undefined &&
    adminBuild.server === undefined &&
    adminBuild.ssr === undefined,
);
check(
  'admin has no server files and no hydration',
  !exists('apps/admin/src/main.server.ts') &&
    !exists('apps/admin/src/server.ts') &&
    !exists('apps/admin/src/app/app.config.server.ts') &&
    !adminConfig.includes('provideClientHydration') &&
    !adminConfig.includes('provideServerRendering'),
);
check(
  'both apps have independent serve targets and start scripts',
  angular.projects.storefront.architect.serve !== undefined &&
    angular.projects.admin.architect.serve !== undefined &&
    readJson('package.json').scripts['start:storefront'] !== undefined &&
    readJson('package.json').scripts['start:admin'] !== undefined,
);
const tsconfig = readJson('tsconfig.json');
check(
  'all 7 @flux/* path aliases resolve to library barrels',
  expectedLibs.every(
    (lib) =>
      Array.isArray(tsconfig.compilerOptions.paths?.[`@flux/${lib}`]) &&
      tsconfig.compilerOptions.paths[`@flux/${lib}`][0] === `./libs/${lib}/src/public-api.ts`,
  ),
);

// ----------------------------------------------------------------- Routing
console.log('Routing');
for (const app of expectedApps) {
  const routesPath = `apps/${app}/src/app/app.routes.ts`;
  const routesSource = exists(routesPath) ? readFileSync(join(root, routesPath), 'utf8') : '';
  const appHtml = exists(`apps/${app}/src/app/app.html`)
    ? readFileSync(join(root, `apps/${app}/src/app/app.html`), 'utf8')
    : '';
  const appConfigSource = readFileSync(join(root, `apps/${app}/src/app/app.config.ts`), 'utf8');
  check(
    `${app} uses standalone routing with lazy pages and a 404 fallback`,
    routesSource.includes('loadComponent') &&
      routesSource.includes("'**'") &&
      appConfigSource.includes('provideRouter') &&
      appHtml.includes('router-outlet'),
  );
}

// ----------------------------------------------------------------- Testing
console.log('Testing');
check(
  'vitest and playwright configs plus smoke specs exist',
  ['vitest.config.ts', 'vitest.setup.ts', 'playwright.config.ts'].every(exists) &&
    e2eSources.length >= 2,
);
check(
  'both apps expose unit-test targets with the vitest runner',
  expectedApps.every(
    (app) => angular.projects[app].architect.test?.builder === '@angular/build:unit-test',
  ),
);
const scripts = readJson('package.json').scripts;
check(
  'test scripts cover unit and e2e suites',
  scripts['test:unit'] !== undefined && scripts['test:e2e'] !== undefined,
);

// ----------------------------------------------------------------- Summary
console.log(`\n${count - failures.length}/${count} checks passed.`);
if (failures.length > 0) {
  console.log('Violations:');
  for (const name of failures) {
    console.log(`  - ${name}`);
  }
  process.exit(1);
}
