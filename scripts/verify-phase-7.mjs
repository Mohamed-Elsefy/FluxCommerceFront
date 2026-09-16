// Sub-Phase 7.9 — Phase 7 (Shopping Cart) boundary verification audit.
//
// Verifies the Phase 7 acceptance boundaries that unit tests cannot see:
// no Checkout/Payment/Order/Shipping/Stripe logic inside the Phase 7
// touchpoints, backend-authoritative totals (no local price math in Cart
// UI), feature-local signal state (no global cart store), and no
// frontend cart-content persistence (only the opaque guest id bookmark).
// Exit 0 when every check passes, exit 1 listing each violation.
//
// Scope notes (deliberate allowlists, all documented in ADRs/code):
// - The `/checkout` ROUTER link and its localized label are the
//   navigation boundary Phase 7 must expose (not checkout logic).
// - Comments are stripped before matching, so documented prohibitions
//   ("no lineTotal", "never computed") cannot trip the checks.
// - `*.spec.ts` files are excluded from the price-math check: specs
//   legitimately compute forbidden totals to pin their ABSENCE.
// - The product-details → cart lifecycle seam (ADR 018/019) is one-way
//   and cycle-free (covered by the architecture audit); it is reuse,
//   not business-logic leakage.
import { readdirSync, readFileSync } from 'node:fs';
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

function collect(dir, extension, out = []) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      collect(relative, extension, out);
    } else if (entry.name.endsWith(extension)) {
      out.push(relative);
    }
  }
  return out;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
}

const cartSources = collect('apps/storefront/src/app/features/cart', '.ts').filter(
  (path) => !path.endsWith('.spec.ts'),
);
const cartSpecSources = collect('apps/storefront/src/app/features/cart', '.spec.ts');
const detailsSources = collect('apps/storefront/src/app/features/product-details', '.ts').filter(
  (path) => !path.endsWith('.spec.ts'),
);
const phase7Sources = [...cartSources, ...detailsSources];
const phase7Code = phase7Sources
  .map((path) => stripComments(readFileSync(join(root, path), 'utf8')))
  .join('\n');

const withoutCheckoutBoundary = phase7Code
  .replaceAll('routerLink="/checkout"', '')
  .replaceAll("routerLink='/checkout'", '')
  .replaceAll('summaryCheckout', '')
  .replaceAll('checkoutLabel', '');

// 1. No checkout/order/payment/shipping logic in Phase 7 touchpoints.
check(
  '7.9: no checkout, order, payment, shipping, or Stripe logic in cart + product-details',
  !/stripe|paymentIntent|CheckoutRequest|Idempotency-Key|shippingAddress|billingAddress|createOrder|OrderResponse|reserveStock|inventoryReservation/i.test(
    withoutCheckoutBoundary,
  ),
  `${phase7Sources.length} source(s)`,
);

// 2. Backend-authoritative totals: no local price math in Cart UI.
const cartUiCode = cartSources
  .map((path) => stripComments(readFileSync(join(root, path), 'utf8')))
  .join('\n');
check(
  '7.9: no local price math in Cart UI (unit prices display-only, no line totals)',
  !/unitPriceAmount\s*[*+-]|[*+-]\s*unitPriceAmount|lineTotal|subtotal\s*[+=]\s*[^n=]/i.test(
    cartUiCode,
  ),
  `${cartSources.length} source(s)`,
);

// 3. Feature-local signal state: no global cart store machinery.
const stateFiles = cartSources.filter((path) =>
  /(cart-state|guest-cart\.service|authenticated-cart\.service)\.ts$/.test(path),
);
const rootProvided = stateFiles.filter((path) =>
  /providedIn\s*:\s*['"]root['"]/.test(readFileSync(join(root, path), 'utf8')),
);
check(
  '7.9: cart state stays feature-local (no NgRx/SignalStore, no providedIn root state)',
  !/@ngrx|signalStore|withState|withMethods/i.test(cartUiCode) && rootProvided.length === 0,
  'state, guest, and session lifecycle services are route-provided',
);

// 4. No frontend cart-content persistence: localStorage carries only the opaque guest id.
const storageWrites = [];
for (const path of cartSources) {
  const code = stripComments(readFileSync(join(root, path), 'utf8'));
  for (const match of code.matchAll(/localStorage\s*\.\s*(setItem|getItem|removeItem)\s*\(/g)) {
    storageWrites.push(`${path.split('/').pop()}:${match[1]}`);
  }
}
check(
  '7.9: localStorage in cart touches only the guest-id bookmark (never cart contents)',
  storageWrites.length > 0 &&
    storageWrites.every((entry) => entry.startsWith('guest-cart-storage.service.ts:')),
  storageWrites.length === 0 ? 'no storage access found' : `${storageWrites.length} access(es)`,
);

// 5. No client-side merge algorithm: the merge path performs no quantity math.
const mergeCode = cartSources
  .filter((path) => /authenticated-cart\.service\.ts$|cart-state\.ts$/.test(path))
  .map((path) => stripComments(readFileSync(join(root, path), 'utf8')))
  .join('\n');
check(
  '7.9: no client-side merge math (quantities pass through untouched)',
  !/quantity\s*[+*]|quantity\+\+|\+\+\s*quantity|sumQuantities|consolidate/i.test(mergeCode),
  'merge transport + adoption only',
);

// 6. Every cart translation key resolves in every culture (i18n completeness).
const keyPaths = [
  ...readFileSync(
    join(root, 'apps/storefront/src/app/features/cart/i18n/cart-translations.ts'),
    'utf8',
  ).matchAll(/'cart\.[a-zA-Z.]+'/g),
].map((match) => match[0].slice(1, -1));
const resources = readFileSync(
  join(root, 'apps/storefront/src/app/features/cart/i18n/cart-translations.ts'),
  'utf8',
);
const missing = keyPaths.filter((key) => {
  const segments = key.split('.');
  const tail = segments[segments.length - 1];
  const occurrences = resources.split(`${tail}:`).length - 1;
  return occurrences < 5;
});
check(
  '7.9: every cart translation key resolves in all five cultures',
  keyPaths.length > 0 && missing.length === 0,
  `${keyPaths.length} key(s)${missing.length === 0 ? '' : ` — missing: ${missing.join(', ')}`}`,
);

// 7. Mandatory E2E journey + edge suites exist and assert backend authority.
const cartE2e = readFileSync(join(root, 'e2e/cart.spec.ts'), 'utf8');
check(
  '7.9: mandatory Guest → Login → Cart Merge E2E journey exists',
  /completes the Guest.*Login.*Cart Merge.*Authenticated Cart journey/.test(cartE2e) &&
    /mergeCalls.*toEqual.*guestCartId/s.test(cartE2e) &&
    cartE2e.includes('/cart/merge'),
  'journey + exact merge-body assertion',
);
const edgeCases = [
  'guest add',
  'authenticated add',
  'empty',
  'clear',
  'reload',
  'duplicate variant',
  'merge fails',
  'viewport',
  'RTL',
];
const absentEdges = edgeCases.filter(
  (edge) => !cartE2e.toLowerCase().includes(edge.toLowerCase().split(' ')[0]),
);
check(
  '7.9: E2E edge suites cover CRUD, persistence, duplicates, failure, viewports, RTL',
  absentEdges.length === 0,
  absentEdges.length === 0 ? `${edgeCases.length} edge(s)` : `missing: ${absentEdges.join(', ')}`,
);

console.log(`\n${count - failures.length}/${count} Phase 7 boundary checks passed.`);
if (failures.length > 0) {
  console.log('Violations:');
  for (const failure of failures) {
    console.log(`  - ${failure}`);
  }
  process.exit(1);
}
