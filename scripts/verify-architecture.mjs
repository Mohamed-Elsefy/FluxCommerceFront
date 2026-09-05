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
