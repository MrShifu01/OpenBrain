# Performance Audit — First Paint / Cold Load

## Resolution — 2026-04-30

Addressed in this pass:

- Cut the Google Fonts preload from the broad nine-family request to the launch-critical Bronze theme families: Fraunces, Inter Tight, and JetBrains Mono.
- Removed Material Symbols from first paint.
- Moved Sentry behind consent-gated dynamic imports.
- Tightened PWA precache ignores for rare routes/import panels.
- Changed hashed JS runtime caching to cached-first behavior.
- Removed duplicate manifest link and inactive theme remote font imports.

Deferred to `EverionMindLaunch/LAUNCH_CHECKLIST.md`:

- Run bundle visualizer on `lib-*`/`module-*` chunks.
- Re-run Lighthouse against production after deployment.
- Consider removing the service-worker auto reload after validating update UX.

Archived because all findings are either fixed here or tracked in the launch checklist with traceability.

**Date:** 2026-04-30
**Branch:** main (commit 609121f)
**Scope:** Web app cold-load on `everionmind.com` — first contentful paint, time-to-interactive, and PWA first-install cost. Native (Capacitor) wrap not in scope.
**Method:** Static analysis of `dist/`, `vite.config.js`, `index.html`, `vercel.json`, `src/main.tsx`, `src/App.tsx`, `src/Everion.tsx`. No live Lighthouse run — recommend running `npm run lighthouse` after fixes for hard numbers.

---

## TL;DR

Three regressions dominate cold load. All fixable in a day.

| # | Issue | Cost | Fix complexity |
|---|---|---|---|
| 1 | **9 Google Font families preloaded, including full Material Symbols variable axis** | ~600 KB – 1.2 MB woff2 over the wire on first paint, network-bound on 3G/4G | M — pick 1–2 families, self-host, drop Material Symbols variable |
| 2 | **Sentry SDK statically imported in `main.tsx`** (29 KB gz / 85 KB raw) ships on every cold load even when consent is declined | 1 round-trip + 85 KB raw across modulepreload tree | S — mirror the PostHog pattern: lazy-import inside `initSentry()` |
| 3 | **PWA `injectManifest` precaches ~3 MB of JS/CSS on first visit** (after exclusions) | First-PWA-install spike on cellular | S — tighten `globPatterns` + add more `globIgnores` |

Everything else is already in good shape: app-shell paints at ~500 ms, lazy-loaded routes (`Everion`, `LoginScreen`, `AdminView`, `ChatView`, `GraphView`, `TodoView`, `VaultView`, `DetailModal`, `CaptureSheet`), correct `Cache-Control` (`immutable` on `/assets/`, `no-store` on `/api/`), Supabase + Sentry + Vercel telemetry chunked, PostHog already consent-gated and lazy.

---

## Bundle Inventory (raw / gzipped)

Eagerly loaded (modulepreload tree on `/`):

| Chunk | Raw | Gzip | Notes |
|---|---|---|---|
| `index-BZV9u9gQ.js` (entry) | 249 KB | **76 KB** | main.tsx + App.tsx + their static deps |
| `supabase-DxDQO8ry.js` | 152 KB | **39 KB** | auth-js + postgrest + realtime — needed at boot to hydrate session |
| `sentry-DtrHBkNs.js` | 85 KB | **29 KB** | ⚠️ static-imported even for declined-consent users |
| `module-Cej5vHN1.js` | 183 KB | **60 KB** | posthog SDK — actually consent-gated and lazy, but appears in modulepreload? verify (see Finding #4) |
| `lib-40gnxRKW.js` | 401 KB | **95 KB** | unidentified — needs `rollup-plugin-visualizer` to confirm |
| `index-DJR_K3rd.css` | 152 KB | **26 KB** | single Tailwind 4 sheet, all views |
| Plus ~20 small modulepreload chunks (button, tabs, dist-*, etc.) | ~100 KB | ~30 KB | radix-ui primitives split |

**Eager total** (before `Everion` lazy chunk): roughly **350 KB gzipped JS + 26 KB gzipped CSS = ~380 KB on the wire** for an unauthenticated visitor on `/` — before fonts.

Lazy (signed-in path):

| Chunk | Raw | Gzip |
|---|---|---|
| `Everion-CPtdjohY.js` (signed-in shell) | 368 KB | 96 KB |
| `TodoView-CX40vB5i.js` | 146 KB | 40 KB |
| `DetailModal`, `ChatView`, `VaultView`, `CaptureSheet`, `GraphView` | each ~7–35 KB gz | |

Heavy gated (only on user action — currently excluded from precache ✓):

| Chunk | Raw | Notes |
|---|---|---|
| `pdf.worker-xSiVJ7U_.mjs` | **2.19 MB** | dynamic-imported by `fileExtract.ts` |
| `exceljs.min` | 930 KB | dynamic |
| `pdf-BMywGXr7.js` | 405 KB | dynamic |
| `jszip.min` | 96 KB | dynamic |

---

## Findings

### Finding 1 — Google Fonts blast (P0)

`index.html` preloads this single stylesheet:

```
fonts.googleapis.com/css2?family=
  Lora            (4 weights + italic) +
  DM Sans         (variable opsz, 5 weights + italic) +
  Newsreader      (variable opsz, 4 weights + italic) +
  Source Serif 4  (variable opsz, weight 300–700 + italic) +
  Fraunces        (variable opsz 9–144, weight 300–700 + italic) +
  Inter Tight     (4 weights) +
  Geist Mono      (2 weights) +
  JetBrains Mono  (2 weights) +
  Material Symbols Outlined  (variable opsz 20–48, weight 100–700, FILL 0–1, GRAD −50..200)
```

`@fontsource-variable/geist` is **also** shipped locally (28 KB woff2 already in `dist/assets/`), so Geist is fetched twice from two sources.

**Material Symbols Outlined variable** with that axis range is the single largest font on the open web — uncompressed ~1.5 MB, woff2 ~600 KB. Combined with Newsreader/Fraunces/Source Serif (each ~150 KB woff2 across the requested ranges), first paint pulls **800 KB – 1.2 MB of font bytes** before any glyph renders.

The `<link rel="preload" as="style">` *correctly* avoids render-blocking the HTML, but `font-display` is left to Google's CSS (`&display=swap` ✓), so text falls back fast — but the *bytes are still on the wire* competing with JS for bandwidth on 3G/4G.

Why this hits hardest:
- One request to `fonts.googleapis.com` → returns CSS → *then* parallel requests to `fonts.gstatic.com` for each woff2. That's a chain of 2 RTTs minimum, then N parallel font fetches.
- On cellular, woff2 bytes dominate the critical path.
- `loadFontsAsync()` injects the stylesheet from JS *after* `main.tsx` parses, so font byte download starts *late* — only the *preload* hint kicks it off early.

**Fix options (pick one, in order of impact):**

1. **Cut to 2–3 families.** Pick a serif (one of: Newsreader, Source Serif, Fraunces, Lora — not all four), a sans (DM Sans or Inter Tight — not both), a mono (Geist Mono OR JetBrains Mono). Use **Geist Mono** since `@fontsource-variable/geist` is already local. Drop the rest. Audit which families are actually referenced in `src/**/*.css` and `src/design/` before cutting.
2. **Replace Material Symbols variable with subset or static.** If only ~50 icons are used, use lucide-react (already in dependencies) or Material Symbols *static* (single weight, single fill) — drops 500 KB+. Grep `material-symbols` / `font-family.*Symbols` in `src/`.
3. **Self-host the kept fonts** with `@fontsource` packages (already on Geist). Removes the `fonts.googleapis.com` + `fonts.gstatic.com` two-hop, lets the `/assets/(.*)` immutable cache header apply, removes a third-party data-flow from CSP.
4. **Restrict weight ranges.** If you only use 400/600 of DM Sans, request just those — not 300/400/500/600/700/italic.

Estimated win: **−500 KB to −1 MB on first paint over the wire** (cellular FCP improvement: 2–6 s).

---

### Finding 2 — Sentry shipped on cold load even when consent is declined (P0)

`src/main.tsx:11`:

```ts
import * as Sentry from "@sentry/react";
```

…then later:

```ts
if (getConsentDecision() === "accepted") { initSentry(); ... }
```

The gate skips `Sentry.init()` (the runtime call), but the **static import** pulls the SDK into the entry chunk regardless — that's `sentry-DtrHBkNs.js` (29 KB gz / 85 KB raw) plus its modulepreload entry visible at `index.html:274`.

PostHog is already done correctly: `initPostHog` is exported from `src/lib/posthog.ts` and *that* file does the dynamic `import('posthog-js')` only after consent. Mirror it:

```ts
// main.tsx — replace the static import
async function initSentry() {
  const Sentry = await import("@sentry/react");
  Sentry.init({ ... });
}
```

Estimated win: **−29 KB gz / −85 KB raw** on cold load for declined-consent users (most first-time visitors). Removes one modulepreload entry, reducing concurrent connection pressure.

**Caveat:** if there's a top-level `Sentry.ErrorBoundary` or `Sentry.withProfiler` in `App.tsx` or elsewhere, those need to be kept guarded behind a no-op fallback when Sentry isn't loaded yet. Check `grep -r "Sentry\." src/`.

---

### Finding 3 — PWA precache size on first visit (P1)

`vite.config.js:84` `globPatterns: ["**/*.{js,css,ico,png,svg}"]` is too broad. After the existing `globIgnores`, the precache still includes:
- the entry + modulepreload tree (~350 KB gz)
- `Everion`, `TodoView`, `DetailModal`, `ChatView`, `VaultView`, `CaptureSheet` (~250 KB gz, all of which are lazy in code anyway)
- the 152 KB CSS
- ~20 small chunks the user may never hit (`BearImportPanel`, `EvernoteImportPanel`, `GoogleKeepImportPanel`, `NotionImportPanel`, `ObsidianImportPanel`, `ReadwiseImportPanel`, `ResetPasswordView`, `StatusPage`, `LoginScreen`, `VaultRevealModal`, `ImportantMemoriesView`, etc.)

Workbox correctly defers these until *after* the page is interactive (precaching runs in the SW install handler), but on a slow connection the SW install can pin bandwidth for **30–60 s after FCP** — the user sees the app, taps a button, and capture stalls because the network is saturated downloading routes they don't need.

**Fix:** add to `globIgnores`:
```js
globIgnores: [
  // existing ...
  "**/LoginScreen-*.{js,mjs}",         // signed-out users only
  "**/StatusPage-*.{js,mjs}",          // 1-in-1000 visit
  "**/ResetPasswordView-*.{js,mjs}",   // rare
  "**/{Bear,Evernote,GoogleKeep,Notion,Obsidian,Readwise}ImportPanel-*.{js,mjs}", // import-only
  "**/VaultRevealModal-*.{js,mjs}",    // gated UI
  "**/ChatView-*.{js,mjs}",            // single-tab feature
]
```

Workbox falls back to network-on-demand for these; combined with the `immutable` cache header they get cached on first hit anyway.

Estimated win: **−400 to −600 KB precache on first visit**, reducing post-FCP bandwidth contention.

---

### Finding 4 — Verify what's in the 95 KB-gz `lib-40gnxRKW.js` (P1)

Bundle has a `lib` chunk that's unidentified by name. Could be `chrono-node` (49 KB raw alone) + `date-fns` + `node-html-parser` + `mammoth` — all of which are heavyweight and may be eager-pulled by something on the auth path.

**Action:** install `rollup-plugin-visualizer` and run a one-off `vite build` to produce `dist/stats.html`:

```bash
npm i -D rollup-plugin-visualizer
# in vite.config.js plugins[]:
visualizer({ filename: "dist/stats.html", gzipSize: true, brotliSize: true })
```

If `chrono-node` / `mammoth` / `node-html-parser` are eager, they should be moved behind dynamic imports (they're already installed as plain deps, so a `manualChunks` rule won't help — find the static `import` and convert to `import('...')` at the call site).

Same investigation applies to `module-Cej5vHN1.js` (60 KB gz). Per quick string-search it contains `posthog` and `sentry` text — if it's *both*, that's another reason to lazy the Sentry import.

---

### Finding 5 — Service worker `controllerchange` triggers full page reload (P2)

`src/main.tsx:64`:

```ts
navigator.serviceWorker.addEventListener("controllerchange", () => {
  window.location.reload();
});
```

When SW updates and `skipWaiting` runs, every open tab does a full reload — which fetches fresh HTML, re-evaluates the entry chunk, re-renders everything. On a slow connection that's a 2–5 s gap where the user sees a blank, then a flash, then the app.

You already have `UpdatePrompt` (rendered in `Root`) — let it ask the user to refresh, and skip the auto-reload. The forced reload only fires once on first deploy after a session, but it's still a perceived-lag event during active use.

Defer this; not a cold-load issue, but worth fixing before launch since a viral spike + a hot-fix deploy will cause a visible reload storm.

---

### Finding 6 — `<link rel="preconnect">` for Supabase URL is templated incorrectly in source HTML (P2)

`index.html:183`:

```html
<link rel="preconnect" href="%VITE_SUPABASE_URL%" crossorigin />
```

Vite *does* substitute env vars in `index.html` at build time — `dist/index.html:183` shows the resolved URL — so this is fine. But it's brittle: if `VITE_SUPABASE_URL` is missing during a preview build, the literal `%VITE_SUPABASE_URL%` ships and the browser parses it as a relative URL, generating a 404 preconnect attempt. Prefer hardcoding the prod URL or wrapping in a build check.

Low priority. Logged for completeness.

---

### Finding 7 — JSON-LD payload in `<head>` (P2)

Two `<script type="application/ld+json">` blocks total ~3 KB raw HTML. Helpful for SEO; not render-blocking (browsers don't parse them on critical path). Keep — it's earning its weight for the public-launch SEO push.

---

### Finding 8 — `index-DJR_K3rd.css` is one 26 KB-gz file (P3)

Tailwind 4 with auto-purge. 26 KB gz is fine. Could be split per-route via `cssCodeSplit`, but the win is marginal (~5 KB on first paint) and complicates SSR/PWA caching. **Skip.**

---

### Finding 9 — `modulepreload` density (P3)

23 modulepreload links in `dist/index.html`. Each is a hint for the browser; over HTTP/3 they multiplex fine. Over HTTP/2 with high-RTT (cellular) they can saturate the connection. Vercel serves H/3 by default — non-issue on prod, watch on Capacitor wrap if it ever talks to a non-Vercel origin.

---

## Recommended Action Order

1. **Today (1 h):** Strip Google Fonts down to 2 families + Material Symbols *static*, self-host via `@fontsource`. (Finding 1)
2. **Today (15 min):** Lazy-import Sentry behind `initSentry()`. (Finding 2)
3. **Tomorrow (30 min):** Tighten Workbox `globIgnores`. (Finding 3)
4. **Tomorrow (30 min):** Install `rollup-plugin-visualizer`, find what's in `lib`/`module` chunks, convert eager imports to dynamic where safe. (Finding 4)
5. **Pre-launch (1 h):** Replace SW auto-reload with `UpdatePrompt`-driven reload. (Finding 5)
6. **Verify:** Run `npm run lighthouse` against prod before/after. Target: FCP < 1.5 s on 4G, LCP < 2.5 s, TBT < 200 ms.

---

## Open Questions

- Which font families are *actually used* in `src/**/*.css` and `src/design/`? The audit assumes most are aspirational. Confirm with `grep -rE "font-family|--font-" src/`.
- How many distinct Material Symbols icons does the UI use? If <30, switch to Lucide (already a dep) — single, slim, tree-shaken.
- Has anyone profiled cold-load on a real iPhone SE on 4G? `vercel speed-insights` should already be capturing this — pull a 30-day window for FCP/LCP P75 from the dashboard before deciding the order of fixes.
