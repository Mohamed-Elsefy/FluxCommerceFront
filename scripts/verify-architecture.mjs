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
      styles.includes('libs/theming/src/lib/tokens.css') &&
      styles.indexOf('libs/theming/src/lib/tokens.css') <
        styles.indexOf(`apps/${app}/src/styles.css`)
    );
  }),
);
const asyncStateComponents = [
  'libs/ui/src/lib/loading-indicator/loading-indicator.ts',
  'libs/ui/src/lib/skeleton/skeleton.ts',
  'libs/ui/src/lib/empty-state/empty-state.ts',
  'libs/ui/src/lib/error-state/error-state.ts',
  'libs/ui/src/lib/retry-button/retry-button.ts',
];
check(
  '3.2: reusable components consume tokens instead of duplicating values',
  asyncStateComponents.every((path) => {
    const cssPath = path.replace(/\.ts$/, '.css');
    return (
      exists(path) &&
      exists(cssPath) &&
      /var\(--(spacing|radius|font-size|border-width|ease)-/.test(
        readFileSync(join(root, cssPath), 'utf8'),
      )
    );
  }),
  `${asyncStateComponents.length} component(s)`,
);
// Sub-Phase 3.4 — Core UI Primitives: the focused business-agnostic set
// (Button, Icon, Input, Badge, Card, Spinner, Alert, Divider). Each consumes
// theming tokens, stays RTL-safe through logical properties, and ships with
// component tests. Layout primitives (3.5), shells/navigation (3.6+), and the
// optional controls (Checkbox/Radio/Select/Textarea) are out of scope.
const primitiveFiles = [
  'libs/ui/src/lib/button/button.ts',
  'libs/ui/src/lib/icon/icon.ts',
  'libs/ui/src/lib/input/input.ts',
  'libs/ui/src/lib/badge/badge.ts',
  'libs/ui/src/lib/card/card.ts',
  'libs/ui/src/lib/spinner/spinner.ts',
  'libs/ui/src/lib/alert/alert.ts',
  'libs/ui/src/lib/divider/divider.ts',
];
const layoutFiles = [
  'libs/ui/src/lib/container/container.ts',
  'libs/ui/src/lib/stack/stack.ts',
  'libs/ui/src/lib/grid/grid.ts',
  'libs/ui/src/lib/flex/flex.ts',
];
const uiProdSources = uiSources.filter((path) => !path.endsWith('.spec.ts'));
const uiProdBasenames = uiProdSources.map((path) => path.split('/').pop() ?? '');
const readUi = (path) => readFileSync(join(root, path), 'utf8');
check(
  '3.4: all eight primitives exist with flux- selectors',
  primitiveFiles.every(
    (path) =>
      exists(path) &&
      /selector\s*:\s*['"]flux-(button|icon|input|badge|card|spinner|alert|divider)['"]/.test(
        readUi(path),
      ),
  ),
  `${primitiveFiles.length} primitive(s)`,
);
check(
  '3.4: primitives consume theming tokens (no hard-coded visual values)',
  primitiveFiles.every((path) => {
    const cssPath = path.replace(/\.ts$/, '.css');
    return exists(cssPath) && /var\(--/.test(readFileSync(join(root, cssPath), 'utf8'));
  }),
);
check(
  '3.4: primitive styling is RTL-safe (logical properties only)',
  !/margin-left|margin-right|padding-left|padding-right|border-left|border-right|text-align:\s*left|text-align:\s*right/.test(
    uiProdSources
      .map((path) => {
        const cssPath = path.replace(/\.ts$/, '.css');
        const inline = readUi(path);
        return exists(cssPath) ? `${inline}\n${readFileSync(join(root, cssPath), 'utf8')}` : inline;
      })
      .map(stripComments)
      .join('\n'),
  ),
);
check(
  'ui components keep markup and styles in sibling files (ts/html/css structure)',
  [...primitiveFiles, ...asyncStateComponents, ...layoutFiles].every((path) => {
    const code = readUi(path);
    const dir = path.slice(0, path.lastIndexOf('/'));
    const base = path.split('/').pop()?.replace(/\.ts$/, '');
    return (
      code.includes(`templateUrl: './${base}.html'`) &&
      code.includes(`styleUrl: './${base}.css'`) &&
      exists(`${dir}/${base}.html`) &&
      exists(`${dir}/${base}.css`) &&
      !/^\s*template:\s*`/m.test(code) &&
      !/^\s*styles:\s*`/m.test(code)
    );
  }),
  `${primitiveFiles.length + asyncStateComponents.length + layoutFiles.length} component(s)`,
);
check(
  '3.4: barrel exports all eight primitives',
  primitiveFiles.every((path) => {
    const base = path.split('/').pop()?.replace(/\.ts$/, '');
    return readUi('libs/ui/src/public-api.ts').includes(`./lib/${base}`);
  }),
);
// Sub-Phase 3.5 — Layout Primitives: generic Container/Stack/Grid/Flex
// composition (token gaps, logical properties, no business meaning).
// Shells/navigation (3.6+) and optional controls stay out of scope.
check(
  '3.5: all four layout primitives exist with flux- selectors',
  layoutFiles.every(
    (path) =>
      exists(path) && /selector\s*:\s*['"]flux-(container|stack|grid|flex)['"]/.test(readUi(path)),
  ),
  `${layoutFiles.length} primitive(s)`,
);
check(
  '3.5: layout primitives consume spacing/container tokens and stay generic',
  layoutFiles.every((path) => {
    const cssPath = path.replace(/\.ts$/, '.css');
    const code = readUi(path);
    return (
      exists(cssPath) &&
      /var\(--(spacing|container)-/.test(readFileSync(join(root, cssPath), 'utf8')) &&
      !/catalog|cart|checkout|order|product|payment/i.test(code)
    );
  }),
);
check(
  '3.5: barrel exports all four layout primitives',
  layoutFiles.every((path) => {
    const base = path.split('/').pop()?.replace(/\.ts$/, '');
    return readUi('libs/ui/src/public-api.ts').includes(`./lib/${base}/${base}`);
  }),
);
check(
  'scope stop — shared libs stay shell-free (shells live in apps, never libs/ui)',
  !uiProdBasenames.some((name) =>
    /^(header|sidebar|footer|nav|navigation|shell|breadcrumb|page-header|mobile-menu|user-menu)/.test(
      name,
    ),
  ),
);
// Sub-Phase 3.6 — Storefront Application Shell: Header (brand, desktop nav,
// mobile toggle, AuthNav entry points), Navigation (one component, both
// placements, active-route styling), Footer, and the Main outlet composer.
// Auth state is reused from Phase 2 (`AuthNav`/`AuthService` signals are
// never replicated); no business features; Admin shell waits for 3.7.
const storefrontShellFiles = [
  'apps/storefront/src/app/layout/header/header.ts',
  'apps/storefront/src/app/layout/navigation/navigation.ts',
  'apps/storefront/src/app/layout/footer/footer.ts',
  'apps/storefront/src/app/layout/app-layout/app-layout.ts',
];
const storefrontLayoutSources = collectTs('apps/storefront/src/app/layout').filter(
  (path) => !path.endsWith('.spec.ts'),
);
// Translation dictionaries name business areas in prose (`Catalog`,
// `Cart` labels) but import nothing — they are copy, not coupling.
// The business-words check below targets code, so dictionaries stay
// out of its input (import-shape coupling is covered separately by
// the no-deep-imports and library-direction checks).
const storefrontLayoutCodeSources = storefrontLayoutSources.filter(
  (path) => !path.endsWith('-translations.ts'),
);
const storefrontLayoutCode = storefrontLayoutSources
  .map((path) => stripComments(readFileSync(join(root, path), 'utf8')))
  .join('\n');
const storefrontLayoutBusinessCode = storefrontLayoutCodeSources
  .map((path) => stripComments(readFileSync(join(root, path), 'utf8')))
  .join('\n');
const storefrontLayoutTemplates = storefrontLayoutSources
  .map((path) => path.replace(/\.ts$/, '.html'))
  .filter((path) => exists(path))
  .map((path) => readFileSync(join(root, path), 'utf8'))
  .join('\n');
check(
  '3.6: shell exists with header, navigation, outlet composer, and footer',
  storefrontShellFiles.every(
    (path) =>
      exists(path) &&
      /selector\s*:\s*['"](storefront-header|storefront-nav|storefront-footer|app-layout)['"]/.test(
        readFileSync(join(root, path), 'utf8'),
      ),
  ),
  `${storefrontShellFiles.length} component(s)`,
);
check(
  '3.6: shell files keep markup and styles in siblings (ts/html/css structure)',
  storefrontShellFiles.every((path) => {
    const code = readFileSync(join(root, path), 'utf8');
    const dir = path.slice(0, path.lastIndexOf('/'));
    const base = path.split('/').pop()?.replace(/\.ts$/, '');
    return (
      code.includes(`templateUrl: './${base}.html'`) &&
      code.includes(`styleUrl: './${base}.css'`) &&
      exists(`${dir}/${base}.html`) &&
      exists(`${dir}/${base}.css`) &&
      !/^\s*template:\s*`/m.test(code) &&
      !/^\s*styles:\s*`/m.test(code)
    );
  }),
);
check(
  '3.6: header composes navigation and Phase 2 auth entry points',
  /AuthNav|AuthService/.test(
    readFileSync(join(root, 'apps/storefront/src/app/layout/header/header.ts'), 'utf8'),
  ) &&
    readFileSync(
      join(root, 'apps/storefront/src/app/layout/app-layout/app-layout.ts'),
      'utf8',
    ).includes('RouterOutlet'),
);
check(
  '3.6: auth state is reused, never replicated (no token handling or session writes in layout)',
  !/TokenStorage|refreshToken|setAuthenticated|markInitializedAnonymous|replaceAccessToken/i.test(
    storefrontLayoutCode,
  ),
);
check(
  '3.6: navigation exposes active-route styling accessibly',
  /routerLinkActive/.test(storefrontLayoutTemplates) &&
    /ariaCurrentWhenActive/.test(storefrontLayoutTemplates),
);
check(
  '3.6: shell styling is responsive and logical (media queries, no physical props)',
  ['apps/storefront/src/app/layout/header/header.css'].every((path) =>
    /@media/.test(readFileSync(join(root, path), 'utf8')),
  ) &&
    !/margin-left|margin-right|padding-left|padding-right|border-left|border-right/.test(
      storefrontLayoutSources
        .map((path) => {
          const cssPath = path.replace(/\.ts$/, '.css');
          return exists(cssPath) ? readFileSync(join(root, cssPath), 'utf8') : '';
        })
        .join('\n'),
    ),
);
check(
  '3.6: shell touches no browser APIs (SSR/hydration safe)',
  !/window\.|document\.|localStorage/.test(storefrontLayoutCode),
);
check(
  '3.6: no business features in the shell (no catalog/cart/checkout/orders)',
  !/\bcatalog\b|\bcart\b|\bcheckout\b|\borders?\b|\bpayments?\b|\binventory\b|\bproduct\b/i.test(
    storefrontLayoutBusinessCode,
  ),
);
// Sub-Phase 3.7 — Admin Application Shell: Sidebar (destinations, active
// state, mobile drawer), Header (context, drawer toggle, AuthNav user
// area), and the Main outlet composer. Drawer state is the only shell
// state; route protection stays in `app.routes.ts` (Phase 2 guards); no
// business modules.
const adminShellFiles = [
  'apps/admin/src/app/layout/sidebar/sidebar.ts',
  'apps/admin/src/app/layout/header/header.ts',
  'apps/admin/src/app/layout/app-layout/app-layout.ts',
];
const adminLayoutSources = collectTs('apps/admin/src/app/layout').filter(
  (path) => !path.endsWith('.spec.ts'),
);
const adminLayoutCode = adminLayoutSources
  .map((path) => stripComments(readFileSync(join(root, path), 'utf8')))
  .join('\n');
const adminLayoutTemplates = adminLayoutSources
  .map((path) => path.replace(/\.ts$/, '.html'))
  .filter((path) => exists(path))
  .map((path) => readFileSync(join(root, path), 'utf8'))
  .join('\n');
check(
  '3.7: shell exists with sidebar, header, and outlet composer',
  adminShellFiles.every(
    (path) =>
      exists(path) &&
      /selector\s*:\s*['"](admin-sidebar|admin-header|app-layout)['"]/.test(
        readFileSync(join(root, path), 'utf8'),
      ),
  ),
  `${adminShellFiles.length} component(s)`,
);
check(
  '3.7: shell files keep markup and styles in siblings (ts/html/css structure)',
  adminShellFiles.every((path) => {
    const code = readFileSync(join(root, path), 'utf8');
    const dir = path.slice(0, path.lastIndexOf('/'));
    const base = path.split('/').pop()?.replace(/\.ts$/, '');
    return (
      code.includes(`templateUrl: './${base}.html'`) &&
      code.includes(`styleUrl: './${base}.css'`) &&
      exists(`${dir}/${base}.html`) &&
      exists(`${dir}/${base}.css`) &&
      !/^\s*template:\s*`/m.test(code) &&
      !/^\s*styles:\s*`/m.test(code)
    );
  }),
);
check(
  '3.7: shell composes sidebar, header, outlet, and Phase 2 auth entry points',
  readFileSync(join(root, 'apps/admin/src/app/layout/app-layout/app-layout.ts'), 'utf8').includes(
    'RouterOutlet',
  ) &&
    readFileSync(join(root, 'apps/admin/src/app/layout/header/header.ts'), 'utf8').includes(
      'AuthNav',
    ) &&
    /drawerOpen/.test(
      readFileSync(join(root, 'apps/admin/src/app/layout/app-layout/app-layout.ts'), 'utf8'),
    ),
);
check(
  '3.7: auth state is reused, never replicated (no AuthService in layout)',
  !/AuthService|TokenStorage|refreshToken/i.test(adminLayoutCode),
);
check(
  '3.7: sidebar exposes active-route styling accessibly',
  /routerLinkActive/.test(adminLayoutTemplates) &&
    /ariaCurrentWhenActive/.test(adminLayoutTemplates),
);
check(
  '3.7: shell styling is responsive and logical (media queries, no physical props)',
  ['apps/admin/src/app/layout/app-layout/app-layout.css'].every((path) =>
    /@media/.test(readFileSync(join(root, path), 'utf8')),
  ) &&
    !/margin-left|margin-right|padding-left|padding-right|border-left|border-right/.test(
      adminLayoutSources
        .map((path) => {
          const cssPath = path.replace(/\.ts$/, '.css');
          return exists(cssPath) ? readFileSync(join(root, cssPath), 'utf8') : '';
        })
        .join('\n'),
    ),
);
check(
  '3.7: shell touches no browser APIs (SSR/hydration safe)',
  !/window\.|document\.|localStorage/.test(adminLayoutCode),
);
// Phase 13 evolution: sidebar-destination copy lives in the layout bundle
// by the 12.3 convention (labels resolve through `layout.nav.*`), so the
// word guard below scans layout code WITHOUT the translations dictionary —
// copy text is not module coupling. Destinations themselves stay composed
// outside the shell (`admin-navigation.ts`, covered by nav specs).
const adminLayoutCodeWithoutCopy = adminLayoutSources
  .filter((path) => !path.includes('/layout-translations/'))
  .map((path) => stripComments(readFileSync(join(root, path), 'utf8')))
  .join('\n');
check(
  '3.7: no business modules in the shell (no catalog/orders/inventory/users)',
  !/\bcatalog\b|\bproducts?\b|\borders?\b|\binventory\b|\bpayments?\b|\bcustomers?\b|\busers\b/i.test(
    adminLayoutCodeWithoutCopy,
  ),
);
// Sub-Phase 3.8 — Responsive Foundation: the canonical breakpoint scale
// lives in `libs/theming` (`--breakpoint-sm/md/lg/xl`); every viewport
// media query repeats those exact values (complements such as 63.99rem
// allowed — `var()` is invalid in `@media` conditions). Display type and
// container padding scale fluidly (`clamp()`), layout children can shrink
// below content size, and responsiveness stays in single components — no
// Mobile/Desktop duplicates.
const breakpointTokens = {
  '--breakpoint-sm': '30rem',
  '--breakpoint-md': '48rem',
  '--breakpoint-lg': '64rem',
  '--breakpoint-xl': '80rem',
};
check(
  '3.8: canonical breakpoints are centralized as theming tokens',
  Object.entries(breakpointTokens).every(([token, value]) =>
    tokensCss.includes(`${token}: ${value}`),
  ),
  `${Object.keys(breakpointTokens).length} token(s)`,
);
function collectCss(dir, out = []) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      collectCss(relative, out);
    } else if (entry.name.endsWith('.css')) {
      out.push(relative);
    }
  }
  return out;
}
const workspaceCss = [...collectCss('apps/storefront/src'), ...collectCss('apps/admin/src')];
const canonicalWidths = [30, 48, 64, 80];
const offScale = [];
for (const path of workspaceCss) {
  const css = readFileSync(join(root, path), 'utf8');
  for (const match of css.matchAll(/\(\s*(?:min|max)-width\s*:\s*([\d.]+)\s*(rem|px|em)\s*\)/g)) {
    const value = Number(match[1]);
    const unit = match[2];
    const onScale =
      unit === 'rem' && canonicalWidths.some((width) => Math.abs(value - width) <= 0.011);
    if (!onScale) {
      offScale.push(`${path}: ${match[0]}`);
    }
  }
}
check(
  '3.8: every viewport media query uses canonical breakpoint values',
  offScale.length === 0,
  offScale.length === 0 ? '0 violation(s)' : offScale.join('; '),
);
check(
  '3.8: display type and container padding scale fluidly (no breakpoint overrides)',
  /--font-size-lg:\s*clamp\(/.test(tokensCss) &&
    /--font-size-xl:\s*clamp\(/.test(tokensCss) &&
    /--font-size-2xl:\s*clamp\(/.test(tokensCss) &&
    /--container-padding-inline:\s*clamp\(/.test(tokensCss),
);
check(
  '3.8: layout children can shrink below content size (overflow-safe)',
  ['libs/ui/src/lib/stack/stack.css', 'libs/ui/src/lib/flex/flex.css'].every((path) =>
    /min-inline-size:\s*0/.test(readFileSync(join(root, path), 'utf8')),
  ) &&
    /min-inline-size:\s*0/.test(readFileSync(join(root, 'libs/ui/src/lib/grid/grid.css'), 'utf8')),
);
check(
  '3.8: single-component responsive patterns (no Mobile/Desktop duplicates)',
  ![...appSources, ...libSources]
    .filter((path) => !path.endsWith('.spec.ts'))
    .map((path) => path.split('/').pop() ?? '')
    .some((name) => /(^|[-_.])(mobile|desktop|tablet)([-_.]|$)/i.test(name)),
);
// Sub-Phase 3.9 — RTL Foundation: direction response flows exclusively
// through CSS logical properties. No physical-direction properties, no
// forced text direction, no direction branching in code, and no
// per-direction selectors or component duplicates. Direction switching
// itself (document `dir`, translations, localized formatting) arrives with
// Phase 4 (`libs/i18n`); presentation is already symmetric.
const rtlPhysicalProp =
  /margin-left|margin-right|padding-left|padding-right|border-left|border-right|border-top-left-radius|border-top-right-radius|border-bottom-left-radius|border-bottom-right-radius|float\s*:\s*(left|right)|text-align\s*:\s*(left|right)|translateX\s*\(|\[dir\s*=|:dir\s*\(|scaleX\s*\(/;
const rtlStandaloneProp = /[{;]\s*(left|right)\s*:/;
const rtlDirectionValue = /([-\w]*direction)\s*:\s*(ltr|rtl)/g;
function forcesTextDirection(css) {
  for (const match of css.matchAll(rtlDirectionValue)) {
    if (match[1] === 'direction') {
      return true;
    }
  }
  return false;
}
const workspaceCssAll = [
  ...collectCss('apps/storefront/src'),
  ...collectCss('apps/admin/src'),
  ...expectedLibs.flatMap((lib) => collectCss(`libs/${lib}`)),
];
const workspaceCssText = workspaceCssAll
  .map((path) => readFileSync(join(root, path), 'utf8'))
  .join('\n');
check(
  '3.9: no physical-direction properties workspace-wide',
  !rtlPhysicalProp.test(workspaceCssText) && !rtlStandaloneProp.test(workspaceCssText),
  `${workspaceCssAll.length} stylesheet(s)`,
);
check(
  '3.9: components never force text direction (Phase 4 owns `dir`)',
  !forcesTextDirection(workspaceCssText),
);
check(
  '3.9: no direction branching in code (no dir reads, no RTL flags)',
  ![...appSources, ...libSources]
    .filter((path) => !path.endsWith('.spec.ts'))
    .map((path) => stripComments(readFileSync(join(root, path), 'utf8')))
    .some((code) => /document\.dir|isRTL|isRtl|\.dir\s*===?/.test(code)),
);
check(
  '3.9: no device- or direction-duplicated components',
  ![...appSources, ...libSources]
    .filter((path) => !path.endsWith('.spec.ts'))
    .map((path) => path.split('/').pop() ?? '')
    .some((name) => /(^|[-_.])(mobile|desktop|tablet|rtl|ltr)([-_.]|$)/i.test(name)),
);
// Sub-Phase 3.10 — Navigation & Shared Shell Components: only genuinely
// reusable, business-agnostic, stable abstractions enter `libs/ui`.
// ThemeToggle qualifies (both shells deferred it and compose it now, dumb
// button wired by shells to `ThemeService`); Breadcrumb, PageHeader,
// MobileMenu, and UserMenu have no consumers and stay unbuilt; app shells
// stay app-owned; business widgets stay feature-owned.
const themeTogglePath = 'libs/ui/src/lib/theme-toggle/theme-toggle.ts';
const themeToggleCode = exists(themeTogglePath)
  ? readFileSync(join(root, themeTogglePath), 'utf8')
  : '';
check(
  '3.10: ThemeToggle is shared dumb chrome (no service, no @flux deps)',
  exists(themeTogglePath) &&
    /selector\s*:\s*['"]flux-theme-toggle['"]/.test(themeToggleCode) &&
    /EventEmitter/.test(themeToggleCode) &&
    !/ThemeService|provideTheming|@flux\/theming/.test(stripComments(themeToggleCode)),
);
check(
  '3.10: barrel exports ThemeToggle',
  readUi('libs/ui/src/public-api.ts').includes('./lib/theme-toggle/theme-toggle'),
);
check(
  '3.10: both shells compose the toggle wired to ThemeService',
  [
    'apps/storefront/src/app/layout/header/header.ts',
    'apps/admin/src/app/layout/header/header.ts',
  ].every((path) => {
    const component = readFileSync(join(root, path), 'utf8');
    const template = readFileSync(join(root, path.replace(/\.ts$/, '.html')), 'utf8');
    return (
      component.includes('ThemeToggle') &&
      component.includes('ThemeService') &&
      template.includes('toggleTheme()')
    );
  }),
);
const approvedUiModules = new Set([
  'ui-primitives',
  'button',
  'icon',
  'input',
  'badge',
  'card',
  'spinner',
  'alert',
  'divider',
  'container',
  'stack',
  'grid',
  'flex',
  'loading-indicator',
  'skeleton',
  'empty-state',
  'error-state',
  'retry-button',
  'theme-toggle',
  'chip',
]);
check(
  '3.10: libs/ui holds only approved shared modules (ownership rule)',
  uiProdBasenames
    .filter((name) => name !== 'public-api.ts')
    .every((name) => approvedUiModules.has(name.replace(/\.ts$/, ''))),
  `${uiProdBasenames.length} module(s)`,
);
check(
  '3.10: no business widgets in libs/ui (ProductCard/OrderSummary stay feature-owned)',
  !uiProdBasenames.some((name) =>
    /^(product|catalog|categor|cart|checkout|order|payment|inventory|customer|account|dashboard|admin)/.test(
      name,
    ),
  ),
);
// Sub-Phase 3.11 — Accessibility & UX Hardening: native semantics with
// visible `:focus-visible` states on every interactive stylesheet, no
// clickable non-semantic elements, Escape dismissal with focus return for
// overlays/drawers, honest ARIA only where HTML falls short, and WCAG AA
// text contrast (4.5:1) computed from the token values in both themes.
const focusVisibleStylesheets = [
  'libs/ui/src/lib/button/button.css',
  'libs/ui/src/lib/chip/chip.css',
  'libs/ui/src/lib/retry-button/retry-button.css',
  'libs/ui/src/lib/input/input.css',
  'libs/ui/src/lib/theme-toggle/theme-toggle.css',
  'libs/auth/src/lib/components/auth-nav/auth-nav.css',
  'apps/storefront/src/app/layout/navigation/navigation.css',
  'apps/storefront/src/app/layout/header/header.css',
  'apps/storefront/src/app/layout/app-layout/app-layout.css',
  'apps/admin/src/app/layout/sidebar/sidebar.css',
  'apps/admin/src/app/layout/header/header.css',
  'apps/admin/src/app/layout/app-layout/app-layout.css',
];
check(
  '3.11: every interactive stylesheet exposes a visible focus state',
  focusVisibleStylesheets.every((path) =>
    /:focus-visible/.test(readFileSync(join(root, path), 'utf8')),
  ),
  `${focusVisibleStylesheets.length} stylesheet(s)`,
);
function collectHtml(dir, out = []) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      collectHtml(relative, out);
    } else if (entry.name.endsWith('.html')) {
      out.push(relative);
    }
  }
  return out;
}
const workspaceTemplates = [
  ...collectHtml('apps/storefront/src'),
  ...collectHtml('apps/admin/src'),
  ...expectedLibs.flatMap((lib) => collectHtml(`libs/${lib}`)),
];
check(
  '3.11: no clickable non-semantic elements (native buttons/links/inputs only)',
  !workspaceTemplates.some((path) =>
    /<(div|span)[^>]*\(click\)=/.test(readFileSync(join(root, path), 'utf8')),
  ),
  `${workspaceTemplates.length} template(s)`,
);
check(
  '3.11: overlays and drawers dismiss on Escape',
  /keydown\.escape/.test(
    readFileSync(join(root, 'apps/storefront/src/app/layout/header/header.ts'), 'utf8'),
  ) &&
    /keydown\.escape/.test(
      readFileSync(join(root, 'apps/admin/src/app/layout/app-layout/app-layout.ts'), 'utf8'),
    ),
);
check(
  '3.11: drawer and menu toggles expose expanded state',
  /aria-expanded/.test(
    readFileSync(join(root, 'apps/storefront/src/app/layout/header/header.html'), 'utf8'),
  ) &&
    /aria-expanded/.test(
      readFileSync(join(root, 'apps/admin/src/app/layout/header/header.html'), 'utf8'),
    ),
);
function tokenValue(block, name) {
  const match = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  return match ? match[1] : null;
}
function relativeLuminance(hex) {
  const channels = [0, 2, 4].map((index) => {
    const value = parseInt(hex.slice(index + 1, index + 3), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrastRatio(foreground, background) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}
const lightMarker = ":root[data-theme='light']";
const lightIdx = tokensCss.lastIndexOf(lightMarker);
const lightThemeBlock =
  lightIdx !== -1
    ? tokensCss.slice(lightIdx)
    : tokensCss.slice(0, tokensCss.indexOf('[data-theme='));
const darkThemeBlock = lightIdx !== -1 ? tokensCss.slice(0, lightIdx) : tokensCss;
// Kinetic canonical pairs (DESIGN §2.4): body text, muted, status on surfaces,
// fills with their contrast text. Lime-as-text is dark-only by design and is
// excluded (light uses --primary-text olive instead).
const contrastPairs = [
  ['text', 'surface-1'],
  ['text-muted', 'surface-1'],
  ['text-on-accent', 'primary'],
  ['text-on-violet', 'secondary'],
  ['success', 'surface-1'],
  ['warning', 'surface-1'],
  ['error', 'surface-1'],
  ['info', 'surface-1'],
];
const lowContrast = [];
for (const [blockName, block] of [
  ['light', lightThemeBlock],
  ['dark', darkThemeBlock],
]) {
  for (const [foreground, background] of contrastPairs) {
    const foregroundValue = tokenValue(block, `--${foreground}`);
    const backgroundValue = tokenValue(block, `--${background}`);
    if (foregroundValue === null || backgroundValue === null) {
      lowContrast.push(`${blockName}: --${foreground} unresolved`);
    } else if (contrastRatio(foregroundValue, backgroundValue) < 4.5) {
      lowContrast.push(`${blockName}: --${foreground} on --${background} below 4.5:1`);
    }
  }
}
check(
  '3.11: text contrast meets WCAG AA (4.5:1) in Light and Dark themes',
  lowContrast.length === 0,
  lowContrast.length === 0 ? `${contrastPairs.length * 2} pair(s)` : lowContrast.join('; '),
);
check(
  '3.11: loading and disabled states are exposed to assistive technology',
  /aria-busy/.test(readFileSync(join(root, 'libs/ui/src/lib/button/button.html'), 'utf8')) &&
    /aria-invalid/.test(readFileSync(join(root, 'libs/ui/src/lib/input/input.html'), 'utf8')) &&
    /\[disabled\]/.test(readFileSync(join(root, 'libs/ui/src/lib/input/input.html'), 'utf8')) &&
    /\[disabled\]/.test(
      readFileSync(join(root, 'libs/ui/src/lib/retry-button/retry-button.html'), 'utf8'),
    ),
);
// Sub-Phase 3.12 — Testing & Architectural Verification: presentation
// libraries expose a closed import surface (Angular + relative only, so UI
// can never reach business features through any specifier shape), the Dark
// theme overrides every Light color token, the Theme x Direction x Viewport
// matrix is covered by unit + E2E suites, the global reset precedes tokens
// in both apps, and Dialog stays unbuilt (deferred by the 3.4 scope).
const presentationProdSources = [...uiSources, ...themingSources].filter(
  (path) => !path.endsWith('.spec.ts'),
);
const foreignImports = presentationProdSources.flatMap((path) =>
  importSpecifiers(path)
    .filter((spec) => !spec.startsWith('.') && !spec.startsWith('@angular/'))
    .map((spec) => `${path}: ${spec}`),
);
check(
  '3.12: libs/ui and libs/theming import only Angular and relative modules',
  foreignImports.length === 0,
  foreignImports.length === 0 ? '0 violation(s)' : foreignImports.join('; '),
);
function colorTokens(block) {
  const found = new Set();
  for (const match of block.matchAll(/(--color-[\w-]+)\s*:/g)) {
    found.add(match[1]);
  }
  return found;
}
const lightColors = colorTokens(lightThemeBlock);
const missingInDark = [...lightColors].filter((token) => !colorTokens(darkThemeBlock).has(token));
check(
  '3.12: Dark theme overrides every Light color token',
  missingInDark.length === 0,
  missingInDark.length === 0
    ? `${lightColors.size} token(s)`
    : `missing: ${missingInDark.join(', ')}`,
);
const matrixSpec = readFileSync(join(root, 'e2e/storefront.spec.ts'), 'utf8');
check(
  '3.12: E2E covers theme switching, viewports, and RTL rendering',
  /data-theme/.test(matrixSpec) &&
    /setViewportSize/.test(matrixSpec) &&
    /['"]rtl['"]/.test(matrixSpec) &&
    /375/.test(matrixSpec) &&
    /768/.test(matrixSpec) &&
    /1280/.test(matrixSpec),
);
check(
  '3.12: unit suite covers direction-invariant rendering',
  exists('libs/ui/src/lib/direction-invariance.spec.ts'),
);
check(
  '3.12: global reset (box-sizing, body margin) wired first in both apps',
  exists('libs/theming/src/lib/reset.css') &&
    /box-sizing:\s*border-box/.test(
      readFileSync(join(root, 'libs/theming/src/lib/reset.css'), 'utf8'),
    ) &&
    ['storefront', 'admin'].every(
      (app) =>
        angular.projects[app]?.architect?.build?.options?.styles?.[0] ===
        'libs/theming/src/lib/reset.css',
    ),
);
check(
  '3.12: no Dialog implementation exists outside the admin portal (the 3.4 deferral stands everywhere except Sub-Phase 12.7)',
  ![...collectTs('apps/storefront/src'), ...libSources]
    .filter((path) => !path.endsWith('.spec.ts'))
    .map((path) => path.split('/').pop() ?? '')
    .some((name) => /^(dialog|modal)/.test(name)),
);
check(
  'scope stop — no optional controls (Checkbox/Radio/Select/Textarea unjustified)',
  !uiProdBasenames.some((name) =>
    /^(checkbox|radio|select|textarea|dialog|modal|table|toast|pagination)\.ts$/.test(name),
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

// ------------------------------------------------- Phase 9.11: payments security & SSR
console.log('Phase 9.11');
const scannedSources = [...appSources, ...libSources, ...e2eSources];
const paymentsSources = collectTs('apps/storefront/src/app/features/payments');
const paymentsProdSources = paymentsSources.filter((path) => !path.endsWith('.spec.ts'));
check(
  '9.11: no Stripe secret keys anywhere in app/library/e2e sources',
  !scannedSources.some((path) => /sk_test|sk_live|whsec_/.test(readCode(path))),
  `${scannedSources.length} file(s) scanned`,
);
check(
  '9.11: payments feature ships no console output',
  !paymentsSources.some((path) => /console\./.test(readCode(path))),
  `${paymentsSources.length} file(s) scanned`,
);
check(
  '9.11: payments feature persists nothing (no storage APIs in shipped code)',
  !paymentsProdSources.some((path) => /localStorage|sessionStorage|IndexedDB/.test(readCode(path))),
  `${paymentsProdSources.length} file(s) scanned`,
);
check(
  '9.11: browser-only APIs in payments stay behind platform guards',
  paymentsProdSources.every((path) => {
    const code = readCode(path);
    return !/(\bdocument\b|\bwindow\b)/.test(code) || code.includes('isPlatformBrowser');
  }),
  `${paymentsProdSources.length} file(s) scanned`,
);
const paymentServerRoutes = exists('apps/storefront/src/app/app.routes.server.ts')
  ? readFileSync(join(root, 'apps/storefront/src/app/app.routes.server.ts'), 'utf8')
  : '';
check(
  '9.11: payment param routes render on demand (no prerender)',
  paymentServerRoutes.includes('payment/:orderId') &&
    paymentServerRoutes.includes('RenderMode.Server'),
);

// ------------------------------------------------- Phase 12.8: admin state
// Sub-Phase 12.8 — Admin State & Data Lifecycle: signals plus local and
// feature-local state only. No store library (NgRx, SignalStore) and no
// home-grown global admin store may enter apps/admin without demonstrated
// complexity. The only root-provided admin services are the allowlisted
// pair below: the notification center (genuinely cross-feature toasts,
// commissioned by 12.7) and the stateless login orchestration (no owned
// state — session state stays in `AuthService`). Any new global admin
// state must extend the allowlist with justification, which forces the
// conscious review 12.8 demands instead of silent store growth.
console.log('Phase 12.8');
const adminProdSources = adminSources.filter((path) => !path.endsWith('.spec.ts'));
check(
  '12.8: admin never imports a store library (no NgRx/SignalStore)',
  !specifiersOf(adminProdSources).some(({ spec }) => spec.startsWith('@ngrx')),
);
const manifestDeps = {
  ...readJson('package.json').dependencies,
  ...readJson('package.json').devDependencies,
};
check(
  '12.8: no store library in dependencies',
  !Object.keys(manifestDeps).some((dep) => dep.startsWith('@ngrx')),
);
const adminRootStateAllowlist = new Set([
  'apps/admin/src/app/shared/notifications/notification-service.ts',
  'apps/admin/src/app/features/auth/data-access/admin-auth-data-access.ts',
]);
const rootProvided = adminProdSources.filter((path) =>
  /providedIn\s*:\s*['"]root['"]/.test(stripComments(readFileSync(join(root, path), 'utf8'))),
);
check(
  '12.8: no new global admin state (root-provided services stay allowlisted)',
  rootProvided.every((path) => adminRootStateAllowlist.has(path)),
  `${rootProvided.length} service(s)`,
);

// ------------------------------------------------- Phase 12.11: cleanup
// Sub-Phase 12.11 — Architecture Verification & Cleanup: no parallel
// admin rebuilds of shared infrastructure. Transport (`AdminApiClient`)
// and session (`AdminAuthService`) duplicates are forbidden outright —
// features compose `ApiClient`/`IdentityApiService` and `AuthService`
// through their own data-access instead. Admin-owned UI primitives
// (`AdminPagination`, notification center, tables, dialogs, filters,
// forms) are intentionally NOT flagged here: no shared equivalents
// exist (`libs/ui` is a closed set, cross-app imports are forbidden),
// so they extend rather than duplicate the infrastructure.
console.log('Phase 12.11');
const adminProdCode = adminProdSources
  .map((path) => readFileSync(join(root, path), 'utf8'))
  .map(stripComments)
  .join('\n');
check(
  '12.11: no parallel admin transport/session rebuilds (AdminApiClient/AdminAuthService)',
  !/AdminApiClient|AdminAuthService/.test(adminProdCode),
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
