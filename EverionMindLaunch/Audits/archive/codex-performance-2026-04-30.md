# Codex Performance Audit: Everion Mind

## Resolution — 2026-04-30

Addressed in this pass:

- Moved Sentry behind dynamic imports in `src/main.tsx` and `src/ErrorBoundary.tsx`.
- Changed hashed script runtime caching from `NetworkFirst` to `CacheFirst` in `src/sw.js`.
- Tightened Workbox precache ignores for rare/lazy routes and import panels in `vite.config.js`.
- Reduced launch Google Fonts preload to Fraunces, Inter Tight, and JetBrains Mono; removed Material Symbols from first paint.
- Removed duplicate source manifest link so VitePWA owns the generated manifest.
- Removed remote `@import` rules from inactive design-family CSS files to eliminate optimizer warnings.
- Fixed OmniSearch/cmdk composition from the companion codebase audit.

Deferred to `EverionMindLaunch/LAUNCH_CHECKLIST.md`:

- Split public landing from authenticated Supabase boot.
- Defer non-critical signed-in data fetches until after first useful render.
- Run a bundle visualizer for `lib-*` and `module-*` chunks.
- Prove improvements with production Lighthouse and keep mobile budgets visible.

Archived because all findings are either fixed here or tracked in the launch checklist with traceability.

Date: 2026-04-30

## Scope

Full performance-focused review of the Everion Mind PWA and desktop site, with emphasis on cold-load speed, PWA caching, preloading, bundle size, service worker behavior, fonts, and first authenticated render.

No product code changes were made during this audit. The only dashboard-related follow-up should be registering this audit in the launch knowledge base.

## Verification Run

- `npm run build` passed.
- PWA build generated `dist/sw.js`.
- PWA precache: **93 entries / 2,180.83 KiB**.
- Build emitted CSS optimizer warnings for late `@import` rules.
- Lighthouse against local production preview:

| Preset | Performance | Accessibility | Best Practices | SEO |
|---|---:|---:|---:|---:|
| Mobile | 74 | 92 | 100 | 100 |
| Desktop | 96 | 92 | 100 | 100 |

Mobile metrics:

| Metric | Result |
|---|---:|
| First Contentful Paint | 4.1s |
| Largest Contentful Paint | 4.5s |
| Speed Index | 4.1s |
| Time to Interactive | 4.5s |
| Total Blocking Time | 0ms |
| Cumulative Layout Shift | 0.018 |
| Main-thread work | 4.4s |
| Script boot-up | 0.9s |
| Total network transfer | 451 KiB |

## Executive Summary

Everion is not slow because nothing is cached. It is slow on mobile because too much non-essential work still enters the critical path or competes with it: eager modulepreloads, Sentry in the first graph, a large global CSS/theme/font surface, a broad PWA precache, and several authenticated data requests that begin as soon as the app shell mounts.

The desktop site looks healthy because CPU and network are forgiving. The mobile score exposes the actual user risk: first useful paint is around 4-5 seconds on Lighthouse mobile throttling, and the PWA install/update path downloads roughly 2.18 MB in the background before offline readiness.

## Performance Health Score

| Dimension | Score | Key Finding |
|---|---:|---|
| Initial mobile load | 2/4 | FCP 4.1s and LCP 4.5s on mobile |
| Bundle discipline | 2/4 | First graph includes Sentry/Supabase and 52 script requests |
| PWA caching | 2/4 | Precache is too broad and includes lazy feature chunks |
| Runtime/data loading | 2/4 | Signed-in boot starts several independent API/data fetches |
| Asset/font strategy | 2/4 | Heavy Google Fonts and CSS theme surface inflate first render |
| **Total** | **10/20** | Acceptable foundation, mobile cold load needs focused hardening |

## Detailed Findings

### P1: Mobile cold load is materially slow

Locations:

- `scripts/lighthouse.ts`
- `.lighthouse/2026-04-30T08-19-08-mobile.json`
- `dist/index.html`

Evidence:

- Mobile Lighthouse performance: **74**
- FCP: **4.1s**
- LCP: **4.5s**
- Main-thread work: **4.4s**
- Script boot-up: **0.9s**
- Network transfer: **451 KiB**

Impact: users on mobile, cellular, or lower-end Android devices see a delayed app start even though desktop feels fast.

Recommendation: treat mobile performance as the primary gate. Add a CI or pre-launch budget for mobile Lighthouse, not just desktop. Target mobile performance 85+ first, then 90+.

Suggested command: `/optimize`

### P1: Sentry is statically imported and ends up in the first-load graph

Locations:

- `src/main.tsx:11`
- `src/main.tsx:44`
- `vite.config.js:39`
- `dist/index.html`

Evidence:

- `src/main.tsx` has `import * as Sentry from "@sentry/react";`.
- `dist/index.html` modulepreloads `sentry-DtrHBkNs.js`.
- Lighthouse reports `sentry-DtrHBkNs.js` as mostly unused JavaScript: roughly **26 KiB wasted gzip**.
- Build output: `sentry-DtrHBkNs.js` is **85.01 kB raw / 29.12 kB gzip**.

Impact: Sentry is intended to be consent-gated, but the SDK still downloads during initial page load. That hurts mobile load and privacy expectations.

Recommendation: make Sentry a true dynamic import inside `initSentry()` and `ErrorBoundary` capture paths. Do not import `@sentry/react` at module top level in first-render code.

Suggested command: `/optimize`

### P1: PWA precache is too broad and downloads lazy app surface area

Locations:

- `vite.config.js:82`
- `vite.config.js:93`
- `src/sw.js:17`
- `dist/sw.js`

Evidence:

- Build reports PWA precache: **93 entries / 2,180.83 KiB**.
- Generated precache includes lazy or non-critical chunks such as:
  - `Everion-CPtdjohY.js` (**368.45 kB raw / 97.05 kB gzip**)
  - `lib-40gnxRKW.js` (**401.47 kB raw / 97.63 kB gzip**)
  - `TodoView-CX40vB5i.js` (**145.88 kB raw / 40.49 kB gzip**)
  - `supabase-DxDQO8ry.js` (**151.74 kB raw / 39.31 kB gzip**)
  - `sentry-DtrHBkNs.js` (**85.01 kB raw / 29.12 kB gzip**)

Impact: first PWA install and update compete with initial loading, especially on mobile. Users may perceive this as the app “still loading” or the PWA “not caching properly,” when the actual problem is over-caching too much upfront.

Recommendation: narrow the precache to app shell essentials only: `index.html`, core CSS, icons, manifest, and truly critical JS. Move feature chunks to runtime caching. Confirm `globIgnores` catches generated names, especially `sentry-*`, and add explicit ignores for large lazy chunks that should not be install-blocking.

Suggested command: `/optimize`

### P1: Script runtime uses NetworkFirst, which can make cached JS feel slow online

Location:

- `src/sw.js:20`

Current behavior:

```js
registerRoute(
  ({ request }) => request.destination === "script",
  new NetworkFirst({ cacheName: "js-chunks" }),
);
```

Impact: once online, script requests prefer network before cache. That is defensible for stale chunk recovery, but it weakens the “instant cached PWA” feel. On unreliable mobile connections, a cached script can wait behind a slow network attempt.

Recommendation: split strategy by asset type. Use `CacheFirst` or `StaleWhileRevalidate` for hashed `/assets/*.js` chunks because their filenames are immutable. Keep stale-chunk recovery logic for failed dynamic imports. Use `NetworkFirst` only for unversioned HTML/navigation or non-hashed resources.

Suggested command: `/optimize`

### P1: Public landing page still pays for auth/Supabase startup

Locations:

- `src/main.tsx:13`
- `src/App.tsx:2`
- `src/App.tsx:21`
- `src/lib/supabase.ts:1`
- `dist/index.html`

Evidence:

- `App` imports `supabase` at top level.
- `main.tsx` imports `App` eagerly.
- `dist/index.html` modulepreloads `supabase-DxDQO8ry.js`.
- Lighthouse reports duplicated/unused Supabase work in the first graph, with roughly **34 KiB wasted gzip** per reported entry.

Impact: anonymous visitors and landing-page users download auth client code before they choose to sign in. Signed-in users need auth, but public users should not pay that cost.

Recommendation: split public landing and authenticated boot. Keep `Landing` outside the auth bundle, and load the auth/session dispatcher only when the path or user intent requires it (`/login`, hash tokens, invite, stored session check after minimal shell).

Suggested command: `/optimize`

### P1: Global font strategy downloads too many font families/weights

Locations:

- `index.html:181`
- `index.html:193`
- `src/main.tsx:37`
- `src/index.css:4`
- `src/design/family-*.css`

Evidence:

- Lighthouse mobile resource summary: **6 font requests / 194 KiB transfer**.
- First font downloads included Fraunces and Inter Tight at high priority.
- Root CSS also imports `@fontsource-variable/geist`, adding local Geist font files to the build.
- Optional design-family CSS files contain additional Google Fonts `@import` rules.

Impact: fonts are one of the largest mobile transfers in the cold-load waterfall and are prioritized very early. The UI also risks duplicated font discovery because fonts are referenced from both HTML/JS injection and design-family CSS.

Recommendation: define a single launch-critical font set. Self-host only the active production family, subset it, and lazy-load/admin-gate experimental theme font families. Remove duplicate Google Fonts injection between `index.html`, `main.tsx`, and family CSS.

Suggested command: `/optimize`

### P2: CSS bundle is large and includes inactive theme variants

Locations:

- `src/index.css:7`
- `src/index.css:8`
- `src/design/DesignThemeContext.tsx:23`
- `src/design/bridge.css:7`

Evidence:

- `dist/assets/index-DJR_K3rd.css`: **151.78 kB raw / 26.12 kB gzip**.
- `src/index.css` imports every design family stylesheet.
- Several extra variants are admin-gated in `DesignThemeContext`, but their CSS is still loaded for every visitor.
- Build emits six CSS optimizer warnings for `@import` rules after other rules.

Impact: global CSS parse/style calculation contributes to mobile main-thread work. Lighthouse mobile attributed **2.19s** to style/layout.

Recommendation: ship only the active/default launch theme in the base CSS. Lazy-load extra theme CSS when `extraThemes` is enabled or when a user chooses that theme. Move any necessary `@import` rules to the top-level import layer or remove remote CSS imports from family files.

Suggested command: `/optimize`

### P2: First signed-in render starts multiple data fetches in parallel

Locations:

- `src/hooks/useBrain.ts:13`
- `src/hooks/useDataLayer.ts:59`
- `src/hooks/useDataLayer.ts:70`
- `src/hooks/useDataLayer.ts:99`
- `src/hooks/useDataLayer.ts:109`
- `src/hooks/useDataLayer.ts:144`

Behavior:

- `/api/brains` resolves active brain.
- `/api/vault` checks vault existence.
- `/api/vault-entries` fetches vault metadata.
- `/api/entries?limit=20` fetches first page.
- `entryRepo.listAll()` starts background full fetch up to 5,000 entries.
- `/api/search?threshold=0.55` prefetches graph/search links.

Impact: the UI is trying to be helpful, but on mobile this creates network contention immediately after auth. It also makes “load complete” ambiguous because phase 2 and search prefetch keep working after first paint.

Recommendation: prioritize first useful view: active brain + cached entries + first 20 entries. Defer vault metadata, graph/search prefetch, and full list hydration until idle, after first interaction, or after the first page is visible. Use `requestIdleCallback` with timeouts or an internal boot queue.

Suggested command: `/optimize`

### P2: Build still emits CSS optimizer warnings

Locations:

- `src/design/family-aurora.css:6`
- `src/design/family-atelier.css:7`
- `src/design/family-blueprint.css:7`
- `src/design/family-botanical.css:6`
- `src/design/family-newsprint.css:6`
- `src/design/family-zine.css:7`

Impact: these warnings mean CSS `@import` rules are not positioned where the optimizer expects them. Depending on browser/build behavior, some remote fonts can be ignored, delayed, or loaded inconsistently.

Recommendation: remove remote `@import` rules from individual theme files or consolidate them at the top of `src/index.css`. Prefer self-hosted, subset fonts for the launch theme.

Suggested command: `/normalize`

### P2: Duplicate manifests create inconsistent PWA metadata

Locations:

- `index.html:42`
- `vite.config.js:68`
- `public/manifest.json`
- `dist/manifest.webmanifest`

Evidence:

- Source HTML links `/manifest.json`.
- VitePWA injects an additional `/manifest.webmanifest`.
- The two manifests disagree on description and colors.

Impact: browsers may see two PWA manifests with different identity/theme metadata. It is unlikely to be the main speed issue, but it makes PWA behavior harder to reason about.

Recommendation: keep one canonical manifest. Let VitePWA generate it, or remove VitePWA manifest injection and maintain `public/manifest.json`, but do not ship both.

Suggested command: `/harden`

## Why It Feels Slow

The most likely user-visible causes are:

1. Mobile throttling exposes a 4-5 second first meaningful render.
2. The first graph downloads Sentry and Supabase even when they are not immediately useful.
3. PWA install/update downloads a broad 2.18 MB precache in the background.
4. Runtime script caching prefers network over cache for scripts.
5. Fonts are high-priority and heavy relative to the first screen.
6. Signed-in boot starts multiple API paths immediately.

## Positive Findings

- Heavy file parsers are dynamically imported: PDF, Excel, Mammoth, and JSZip are not in the main entry.
- Large PDF/Excel chunks are excluded from PWA precache.
- The app has a visible inline boot shell, so users do not see a blank screen while JS loads.
- Desktop Lighthouse performance is strong at **96**.
- CLS is healthy on mobile at **0.018**.
- Total Blocking Time is **0ms**, so the main issue is load and layout timing, not long blocking tasks.
- Static assets under `/assets/*` get immutable cache headers in `vercel.json`.

## Recommended Fix Order

1. **P1 `/optimize`** — Make Sentry truly lazy and remove it from the initial modulepreload graph.
2. **P1 `/optimize`** — Narrow the PWA precache to shell essentials and move lazy feature chunks to runtime caching.
3. **P1 `/optimize`** — Change hashed JS runtime caching from `NetworkFirst` to `CacheFirst` or `StaleWhileRevalidate`.
4. **P1 `/optimize`** — Split public landing from authenticated Supabase boot so anonymous users do not pay for auth code.
5. **P1 `/optimize`** — Reduce launch fonts to one self-hosted, subset family set; lazy-load experimental theme fonts.
6. **P2 `/optimize`** — Defer vault, graph/search, and full-entry hydration until after first useful render.
7. **P2 `/normalize`** — Fix CSS `@import` ordering and inactive theme CSS loading.
8. **P2 `/harden`** — Consolidate duplicate PWA manifests.
9. **P3 `/polish`** — Re-run Lighthouse mobile/desktop and update the launch audit with before/after numbers.

## Acceptance Targets

- Mobile Lighthouse performance: **85+** short term, **90+** before public launch.
- Mobile LCP: under **2.5s**.
- Mobile FCP: under **1.8s**.
- Main-thread work: under **2.5s** on Lighthouse mobile.
- PWA precache: under **1 MB gzip-equivalent**, limited to app shell essentials.
- Initial anonymous landing route: no Sentry SDK, no PostHog SDK, no Supabase auth bundle unless needed.
