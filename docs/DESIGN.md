# DESIGN.md — Kinetic Bubble Neo

Design reference for the e-commerce store. Any AI agent or developer MUST read this file before writing or changing UI. Do not invent colors, radii, shadows, or fonts outside this file.

**Style:** neomorphic "bubble" surfaces + neo-brutalist structural outlines + frosted glass. Dark-first, full light parity. Bilingual EN (LTR) / AR (RTL).

---

## 1. Theme Mechanism

- Default: dark. Respect `prefers-color-scheme` on first visit, then persist user choice.
- Theme is set via `data-theme="dark|light"` on `<html>`; direction via `dir="ltr|rtl"` and `lang`.
- All components consume **CSS variables only**. No hardcoded hex in component CSS.
- Use CSS logical properties (`margin-inline-start`, `padding-inline`, `inset-inline-end`, `border-start-start-radius`) so RTL needs no overrides. Mirror directional icons (arrows, chevrons) in RTL.

```js
// theme.js
const root = document.documentElement;
const saved = localStorage.getItem('theme');
const initial = saved ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
root.dataset.theme = initial;
export const toggleTheme = () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  localStorage.setItem('theme', next);
};
```

---

## 2. Color Tokens

### 2.1 Brand accents (shared)

| Role | Name | Value | Usage |
|---|---|---|---|
| Primary | Cyber Lime | `#CCFF00` | Primary CTA, active states, cart highlights, focus ring |
| Secondary | Electric Violet | `#7928CA` | Secondary CTA, verified/enterprise badges, checked checkbox |
| Tertiary | Vibrant Tangerine | `#FF5E00` | Drops, low stock, flash sale, urgency badges |
| Quaternary | Neon Lavender | `#D8B4FE` | Hover halos, soft glass tint, text on violet-soft |

Rule: text ON a lime or tangerine fill is always `#0D1117`. Text ON violet fill is `#FFFFFF`.

### 2.2 Dark theme (default)

```css
:root,
[data-theme="dark"] {
  color-scheme: dark;

  /* Surfaces */
  --bg:               #0D1117;   /* root background */
  --surface-1:        #161B22;   /* cards, panels */
  --surface-2:        #21262D;   /* nested elements, hover, steppers */
  --surface-glass:    rgba(22, 27, 34, 0.80);
  --overlay:          rgba(1, 4, 9, 0.70);

  /* Borders */
  --border:           rgba(255, 255, 255, 0.10);
  --border-strong:    #30363D;
  --border-accent:    rgba(204, 255, 0, 0.35);   /* hover / focus */

  /* Text */
  --text:             #E6EDF3;
  --text-muted:       #8B949E;
  --text-faint:       #7D8590;
  --text-on-accent:   #0D1117;
  --text-on-violet:   #FFFFFF;

  /* Brand */
  --primary:          #CCFF00;
  --primary-hover:    #D8FF3D;
  --primary-text:     #CCFF00;       /* accent used AS text/icon on surfaces */
  --secondary:        #7928CA;
  --secondary-soft:   #2E1065;       /* violet pill fill */
  --secondary-soft-text: #D8B4FE;
  --tertiary:         #FF5E00;
  --tertiary-text:    #FF8A4C;
  --lavender:         #D8B4FE;

  /* Status */
  --success:          #3FB950;
  --warning:          #D29922;
  --error:            #FF7B72;
  --info:             #58A6FF;

  /* Effects */
  --glow-primary:     rgba(204, 255, 0, 0.12);
  --glow-secondary:   rgba(121, 40, 202, 0.45);
  --shadow-ambient:   0 16px 32px -8px rgba(0, 0, 0, 0.65);
  --shadow-bleed:     0 8px 24px -4px var(--glow-primary);
  --shadow-inset-press: inset 0 2px 4px rgba(0, 0, 0, 0.40);
  --highlight-top:    inset 0 1px 1px rgba(255, 255, 255, 0.60); /* primary button only */
  --blur:             blur(16px);
}
```

### 2.3 Light theme

```css
[data-theme="light"] {
  color-scheme: light;

  /* Surfaces */
  --bg:               #F6F8FA;
  --surface-1:        #FFFFFF;
  --surface-2:        #EEF1F5;
  --surface-glass:    rgba(255, 255, 255, 0.72);
  --overlay:          rgba(13, 17, 23, 0.45);

  /* Borders */
  --border:           rgba(13, 17, 23, 0.10);
  --border-strong:    #D0D7DE;
  --border-accent:    rgba(80, 102, 0, 0.55);

  /* Text */
  --text:             #0D1117;
  --text-muted:       #57606A;
  --text-faint:       #6E7781;
  --text-on-accent:   #0D1117;
  --text-on-violet:   #FFFFFF;

  /* Brand */
  --primary:          #CCFF00;       /* fills only, always with dark text */
  --primary-hover:    #B8E600;
  --primary-text:     #506600;       /* lime NEVER used as text on light: use this */
  --secondary:        #7928CA;
  --secondary-soft:   #F1E6FF;
  --secondary-soft-text: #5B1FA3;
  --tertiary:         #FF5E00;       /* fills only */
  --tertiary-text:    #B03F00;
  --lavender:         #D8B4FE;

  /* Status */
  --success:          #1A7F37;
  --warning:          #9A6700;
  --error:            #CF222E;
  --info:             #0969DA;

  /* Effects */
  --glow-primary:     rgba(204, 255, 0, 0.45);
  --glow-secondary:   rgba(121, 40, 202, 0.22);
  --shadow-ambient:   0 16px 32px -12px rgba(13, 17, 23, 0.18);
  --shadow-bleed:     0 8px 24px -8px rgba(121, 40, 202, 0.16);
  --shadow-inset-press: inset 0 2px 4px rgba(13, 17, 23, 0.18);
  --highlight-top:    inset 0 1px 1px rgba(255, 255, 255, 0.80);
  --blur:             blur(16px);
}
```

### 2.4 Contrast rules (WCAG AA minimum)

- Lime/tangerine as a **fill** → text `--text-on-accent`.
- Lime as **text/icon** only in dark theme (`--primary-text`); in light use `--primary-text` (`#506600`).
- Never place `--text-muted` on `--surface-2` for body copy under 14px.
- Never rely on color alone for state; pair with icon/label.

---

## 3. Typography

| Token | Family | Size / Line | Weight | Tracking |
|---|---|---|---|---|
| display-lg | Syne | 56 / 64 | 800 | -0.03em |
| display-lg-mobile | Syne | 36 / 44 | 800 | -0.02em |
| headline-xl | Syne | 40 / 48 | 700 | -0.02em |
| headline-xl-mobile | Syne | 28 / 36 | 700 | -0.01em |
| headline-lg | Syne | 32 / 40 | 700 | -0.015em |
| headline-md | Syne | 24 / 32 | 700 | -0.01em |
| headline-sm | Syne | 20 / 28 | 600 | 0 |
| body-xl | Plus Jakarta Sans | 18 / 28 | 400 | -0.005em |
| body-lg | Plus Jakarta Sans | 16 / 24 | 400 | 0 |
| body-md | Plus Jakarta Sans | 14 / 20 | 400 | 0 |
| body-sm | Plus Jakarta Sans | 12 / 16 | 400 | 0.01em |
| label-lg | Plus Jakarta Sans | 14 / 20 | 700 | 0.02em |
| label-md | Plus Jakarta Sans | 12 / 16 | 700 | 0.04em |
| label-sm | Plus Jakarta Sans | 10 / 12 | 800 | 0.06em, UPPERCASE |
| mono-label | Space Mono (or JetBrains Mono) | 10–11 / 14 | 400–700 | 0.08em, UPPERCASE |

- `mono-label` is for section indices (`01 // PRODUCTS`), stat captions, SKU/rarity/ID values, and tabular numerics.
- **Arabic (RTL):** Syne is LTR-only. In `[lang="ar"]` use **Cairo** (weight 800/700) for headlines and **IBM Plex Sans Arabic** for body/labels. Disable negative letter-spacing and UPPERCASE for Arabic.
- Prices and numerals use `font-variant-numeric: tabular-nums`.

```css
:root {
  --font-display: 'Syne', system-ui, sans-serif;
  --font-body:    'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono:    'Space Mono', ui-monospace, monospace;
}
[lang="ar"] {
  --font-display: 'Cairo', system-ui, sans-serif;
  --font-body:    'IBM Plex Sans Arabic', 'Cairo', system-ui, sans-serif;
}
[lang="ar"] * { letter-spacing: 0 !important; text-transform: none !important; }
```

---

## 4. Shape, Spacing, Layout

### 4.1 Radius

```css
:root {
  --r-sm: 0.5rem;     /* 8px  — tiny inner elements */
  --r-md: 1rem;       /* 16px — min floor for nested radii */
  --r-lg: 1.5rem;     /* 24px — multiline inputs, small cards */
  --r-xl: 2rem;       /* 32px — product cards, panels (default squircle) */
  --r-2xl: 2.25rem;   /* 36px — modals, cart drawer top corners */
  --r-pill: 9999px;   /* all buttons, chips, inputs, badges */
}
```

- Sharp corners are prohibited.
- Nested radius: `inner = outer - padding`, never below `--r-md`.

### 4.2 Spacing (8pt grid, 4pt micro-steps)

`--s-2xs:.25rem  --s-xs:.5rem  --s-sm:.75rem  --s-md:1rem  --s-lg:1.5rem  --s-xl:2rem  --s-2xl:3rem  --s-3xl:4rem`

- Data-dense UI (tables, chips, inputs): `xs`–`sm`.
- Hero, promo, showcase: `xl`–`3xl`.

### 4.3 Grid

| Breakpoint | Columns | Gutter | Margin |
|---|---|---|---|
| Mobile 320–767 | 4 | 16px | 20px |
| Tablet 768–1199 | 8 | 16px | 32px |
| Desktop 1200+ | 12 | 24px | 48px |

Max content width: 1440px (catalog), 1600px (full-bleed showcase).
Product grid: 4 cols desktop → 2 tablet → 1–2 mobile (or horizontal carousel with 16px edge peek).

### 4.4 Border width

Structural rim is **1.5px** on all elevated surfaces; **2px** on primary button and radio.

---

## 5. Elevation & Interaction

Surfaces push up like rubberized acrylic.

```css
.surface {
  background: var(--surface-1);
  border: 1.5px solid var(--border);
  box-shadow: var(--shadow-ambient), var(--shadow-bleed);
  backdrop-filter: var(--blur);
  transition: transform .25s var(--spring), border-color .2s, box-shadow .2s;
}
.surface:hover, .surface:focus-within { border-color: var(--border-accent); }

:root { --spring: cubic-bezier(.34, 1.56, .64, 1); }
```

- Resting interactive elements sit at `translateY(-4px)`; on `:active` → `translateY(0)` + `--shadow-inset-press`.
- Primary button micro-press: `translateY(2px)`.
- Focus ring (all focusable): `outline: 2px solid var(--primary-text); outline-offset: 3px;` plus 8px lime halo for inputs.
- `prefers-reduced-motion: reduce` → remove springs, rotations, pulses; keep opacity transitions only.

---

## 6. Components

### 6.1 Buttons (always pill, `--r-pill`)

| Variant | Fill | Text | Border | Notes |
|---|---|---|---|---|
| Primary | `--primary` | `--text-on-accent`, label-lg | 2px `--primary` | `--highlight-top` inset; leading icon allowed; used for Checkout / Add to Cart |
| Secondary (violet) | `--secondary-soft` | `--secondary-soft-text` | 1.5px `--secondary` | Trailing arrow icon (mirrored in RTL) |
| Glass | `--surface-glass` | `--text` | 1.5px `--border` | Hover: border `--secondary` + `0 0 24px var(--glow-secondary)` |
| Ghost | transparent | `--text` | 1.5px `--border` | Icon in an illuminated 24px circle |
| Quick action (in card footer) | `--primary` | `--text-on-accent` | none | Compact: 32px height, label-md |
| FAB | `--primary` / `--secondary` / `--surface-2` | contrast | 1.5px | 48px circle, icon only, `aria-label` required |

```css
.btn { display:inline-flex; align-items:center; gap:.5rem; height:48px; padding-inline:1.5rem;
  border-radius:var(--r-pill); font:700 14px/20px var(--font-body); letter-spacing:.02em;
  cursor:pointer; transform:translateY(-4px); transition:transform .2s var(--spring), box-shadow .2s; }
.btn:active { transform:translateY(0); box-shadow:var(--shadow-inset-press); }
.btn--primary { background:var(--primary); color:var(--text-on-accent);
  border:2px solid var(--primary); box-shadow:var(--highlight-top), 0 8px 24px -4px var(--glow-primary); }
.btn--primary:hover { background:var(--primary-hover); }
.btn--primary:active { transform:translateY(2px); }
.btn--secondary { background:var(--secondary-soft); color:var(--secondary-soft-text); border:1.5px solid var(--secondary); }
.btn--glass { background:var(--surface-glass); color:var(--text); border:1.5px solid var(--border); backdrop-filter:var(--blur); }
.btn--glass:hover { border-color:var(--secondary); box-shadow:0 0 24px var(--glow-secondary); }
.btn--ghost { background:transparent; color:var(--text); border:1.5px solid var(--border); }
.btn:disabled { opacity:.45; pointer-events:none; }
```

Heights: 48px default, 40px compact, 32px in-card. Touch target ≥ 44px on mobile.

### 6.2 Product Card ("Pod")

Structure (top → bottom):
1. **Image well** — `--r-lg` radius inside a `--r-xl` card, `--surface-2` background, product image `object-fit: cover`/`contain`. Subtle inner radial glow in accent color.
2. **Sticker badge** — pill, absolute top-inline-end, rotated between -3° and +3°. Variants: `drop` (tangerine fill, pulsing dot), `neural/verified` (violet), `turbo` (lime), `new` (lavender).
3. **Meta row** — `mono-label` SKU/spec (muted) + optional rating/rarity.
4. **Title** — headline-sm; **description** — body-sm, muted, 2-line clamp.
5. **Footer deck** — one integrated pill container (`--surface-2`, `--r-pill`) holding: price (label + `mono` value or Syne bold), quick-add button (or qty stepper once in cart), and category tag.

```css
.card { border-radius:var(--r-xl); padding:var(--s-md); background:var(--surface-1);
  border:1.5px solid var(--border); box-shadow:var(--shadow-ambient), var(--shadow-bleed);
  transform:translateY(-4px); transition:transform .3s var(--spring), border-color .2s; }
.card:hover { border-color:var(--border-accent); transform:translateY(-8px); }
.card__media { border-radius:var(--r-lg); aspect-ratio:1/1; background:var(--surface-2); overflow:hidden; position:relative; }
.card__sticker { position:absolute; inset-block-start:.75rem; inset-inline-end:.75rem; transform:rotate(3deg); }
.card__footer { display:flex; align-items:center; justify-content:space-between; gap:.5rem;
  padding:.5rem .5rem .5rem 1rem; border-radius:var(--r-pill); background:var(--surface-2); }
```

States: hover (lift + lime rim), loading (skeleton shimmer in `--surface-2`), out-of-stock (image 50% opacity, button disabled, "Sold out" badge), low-stock (tangerine badge).

### 6.3 Cart

**Cart drawer**
- Anchored to inline-end edge on desktop (max-width 420px) and bottom sheet on mobile.
- Mobile sheet radius: `--r-2xl` top-start and top-end corners. Background `--surface-1` + `--blur`, scrim `--overlay`.
- Header: title (headline-md) + item count pill (lime) + close ghost FAB.
- Line item: 64px squircle thumbnail (`--r-md`), title, variant meta (muted), price (mono), **quantity stepper**.
- Sticky checkout dock: floating pill container at bottom with subtotal + full-width Primary button "Checkout". Shipping/discount rows above in body-sm.
- Empty state: large icon in `--surface-2` circle, headline-sm, primary pill "Continue shopping".

**Quantity stepper**: pill container `--surface-2`; `−` and `+` are 32px micro-squircle buttons (`--r-md`, `--surface-1`, 1.5px border); value in mono-label, min-width 2ch. `+` turns lime on hover. Disable `−` at 1 (or show remove icon).

**Cart icon (header)**: glass pill "Bag" + count bubble (lime circle, dark text, 18px) that does a rubber-band scale on add.

### 6.4 Navigation / Header

- Sticky glass bar: `--surface-glass` + `--blur`, bottom border 1.5px `--border`.
- Logo (lowercase wordmark, Syne 800) · pill search field · nav as a **segmented pill group** (active = lime fill, dark text) · currency chip · language toggle (EN | عربي) · theme toggle (circle ghost) · Bag pill · account circle.
- Mobile: logo + search icon + bag; nav moves into a bottom sheet or bottom pill dock.

### 6.4b Chips, Filter Pills & Segmented Switcher

- Pill, padding `.5rem 1rem`, label-md, `--surface-glass`, `--text-muted`, 1.5px `--border`.
- Selected: solid `--primary` (or `--tertiary` for urgency filters), dark bold text, `0 0 8px var(--glow-primary)`.
- Segmented switcher: one pill track in `--surface-2`; selected segment is a lime pill sliding with spring easing (`transform` animation, not width).

### 6.5 Inputs

- Pill (`--r-pill`) for single-line, `--r-lg` for textarea. Height 48px.
- Background `--bg` (dark) / `--surface-1` (light), border 1.5px `--border-strong`.
- Focus: border `--primary-text`, halo `0 0 0 4px var(--glow-primary)`.
- Floating label: `label-sm` uppercase (Latin) above/inside; error → border `--error` + message in body-sm with icon.
- Search bar variant: leading search icon, trailing small Primary "Query/Search" pill inside the field.

### 6.6 Checkbox & Radio

- **Checkbox:** 20px, 12px squircle radius (6px visual at this size scales with `--r-sm`), border 1.5px `--border-strong`; checked → `--secondary` fill + black/white check per contrast (dark: black check on violet is specified; use `#FFFFFF` if contrast < 4.5).
- **Radio:** 22px circle, 2px rim; selected shows rubber-band animated 10px `--primary` dot.
- **Toggle switch:** pill track, thumb circle; on = `--primary` track, dark thumb.

### 6.7 Badges & Status

| Badge | Fill | Text | Extra |
|---|---|---|---|
| Drop / Live | `--tertiary` | `--text-on-accent` | pulsing neon dot (1.6s) |
| Verified / Enterprise | `--secondary-soft` | `--secondary-soft-text` | 1.5px violet border |
| In stock / Active | `--success` at 15% | `--success` | dot |
| Rarity / Limited | `--tertiary` | dark | mono numerals `#014/100` |
| Count bubble | `--primary` | dark | 18px circle |

All pill-shaped, label-sm/mono-label.

### 6.8 Stat / Info Tiles

- Squircle card (`--r-xl`), small icon circle top-start, status chip top-end, large display number (Syne 800, 48–56px), caption (body-sm muted), optional micro bar chart/progress bar (pill track `--surface-2`, fill `--primary` or `--lavender`).

### 6.9 Section Header

`mono-label` index (`01 // SECTION`) in `--text-muted` + headline-lg title + optional filter chips aligned to inline-end. Spacing below: `--s-xl`.

### 6.10 Modals, Toasts, Tables

- **Modal / checkout sheet:** `--r-2xl`, `--surface-1`, 1.5px border, `--overlay` scrim, focus trapped, `Esc` closes.
- **Toast:** glass pill, leading status dot, auto-dismiss 4s, `role="status"`, placed bottom-center (above mobile dock).
- **Table:** tight spacing (`xs`–`sm`), header in label-md uppercase, row hover `--surface-2`, no hard corners (wrap in `--r-xl` container).

### 6.11 Footer

Single glass panel, top radius `--r-2xl`; wordmark, one-line tagline (muted), links (label-md), legal line (body-sm, `--text-faint`).

---

## 7. Imagery & Iconography

- Icons: outline set, 1.5px stroke, 20/24px, rounded caps (e.g. Lucide). Icon color `--text-muted`, active `--primary-text`.
- Product imagery: dark/neutral studio backgrounds, soft accent glow behind subject. Provide `alt` text and `width/height` to avoid layout shift; lazy-load below the fold.

---

## 8. Motion

| Use | Duration | Easing |
|---|---|---|
| Hover/lift | 250–300ms | `--spring` |
| Press | 120ms | ease-out |
| Drawer/modal | 320ms | `cubic-bezier(.2,.8,.2,1)` |
| Toast/badge pulse | 1.6s loop | ease-in-out |
| Skeleton shimmer | 1.4s loop | linear |

Animate only `transform` and `opacity` where possible.

---

## 9. Accessibility Checklist

- AA contrast in both themes (see §2.4).
- Visible focus ring on every interactive element.
- Min touch target 44×44px.
- `lang` and `dir` set correctly; mirrored icons in RTL.
- Icon-only buttons have `aria-label`; cart count changes announced via `aria-live="polite"`.
- Respect `prefers-reduced-motion`.

---

## 10. Do / Don't

**Do**
- Use tokens from §2 only; both themes must be verified for every new component.
- Keep lime for the single most important action per view.
- Use pills for interactive controls, squircles for containers.

**Don't**
- No sharp corners, no flat 0px-radius boxes.
- No lime text on light backgrounds (use `--primary-text`).
- No more than one primary button per card/section.
- No Syne for Arabic text.
- No hardcoded colors or physical `left/right` properties.
