# Performance Report — OpenBrain
**Date:** 2026-04-02
**Framework:** Plain React 19 · Vite 8 · CSR · PWA
**Bundle:** 448KB JS (single chunk) + 7.4KB CSS

---

## Scores

| # | Dimension | Score | Weight | Contribution |
|---|---|---|---|---|
| 1 | Data Loading Strategy | 50/100 | ×0.25 | 12.5 |
| 2 | Rendering & Hydration | 55/100 | ×0.20 | 11.0 |
| 3 | Bundle Size | 40/100 | ×0.20 | 8.0 |
| 4 | List & Grid Performance | 25/100 | ×0.15 | 3.75 |
| 5 | UX Responsiveness | 55/100 | ×0.10 | 5.5 |
| 6 | Asset & Cache Optimisation | 65/100 | ×0.10 | 6.5 |
| | **PERFORMANCE SCORE** | | | **47.25 → D** |

---

## Detailed Findings

### 1. Data Loading Strategy — 50/100
- ✓ localStorage cache: entries load instantly on repeat visits
- ✓ API fetch on mount with graceful fallback to cache
- ✗ No pagination — always fetches up to 500 entries in one request
- ✗ Chat sent `JSON.stringify(entries)` (all 500) on every message — would exceed 10K system prompt limit at ~50+ entries
- ✗ Search filter runs synchronously on every keystroke

### 2. Rendering & Hydration — 55/100
- Pure CSR, no hydration concerns
- ✓ Views are conditionally rendered (not in DOM when inactive)
- ✓ Graph `requestAnimationFrame` loop correctly cancels on unmount
- ✓ `useMemo` on filtered entries
- ✗ No `React.lazy` or code splitting — all 8 views compile into one chunk
- ✗ No `Suspense` boundaries
- ✗ GraphView uses `INITIAL_ENTRIES` static array — ignores live DB entries

### 3. Bundle Size — 40/100
- Single JS chunk: **448KB minified** (~130KB gzipped est.)
- Supabase SDK accounts for ~200KB of that
- Zero dynamic imports or chunk splitting
- All 8 views + all sub-components in one parse/eval hit
- No `@vercel/analytics` or `@vercel/speed-insights`

### 4. List & Grid Performance — 25/100
- Grid renders up to 500 entries as real DOM nodes (CSS grid `.map()`)
- Timeline renders full sorted array as DOM nodes
- No `@tanstack/react-virtual` installed
- Currently 25 entries → fast. At 200+ entries → noticeable jank on scroll and filter changes

### 5. UX Responsiveness — 55/100
- ✓ PWA with Workbox (offline capable)
- ✓ Canvas graph animation smooth (rAF)
- ✓ Loading states shown during AI calls
- ✗ No view transitions between tabs
- ✗ Search has no debounce (fires filter on every keystroke)
- ✗ No `Suspense` fallbacks for async view loading

### 6. Asset & Cache Optimisation — 65/100
- ✓ Workbox caches all static assets (`**/*.{js,css,html,ico,png,svg}`)
- ✓ System fonts only — no external font loading overhead
- ✓ API routes now have `Cache-Control: no-store`
- ✗ Missing `Cache-Control: immutable` header on `/assets/*` in vercel.json
- ✗ No CDN cache hint for hashed static assets

---

## Auto-Fixed (this session)

| # | Fix | File |
|---|---|---|
| 1 | Add `Cache-Control: public, max-age=31536000, immutable` on `/assets/*` | `vercel.json` |
| 2 | Slice entries to top 100 in chat system prompt (prevents 10K limit breach) | `src/OpenBrain.jsx` |
| 3 | Debounce search input — 200ms delay before filter runs | `src/OpenBrain.jsx` |

---

## PRs Queued

| PR | Task | Expected Impact |
|---|---|---|
| PERF_PR_1.md | Code-split 8 views with `React.lazy` + `Suspense` | Bundle drops ~60% (448KB → ~180-220KB) |
| PERF_PR_2.md | Virtualise grid + timeline with `@tanstack/react-virtual` | Smooth at 500+ entries; O(viewport) render cost |

---

## Next Actions

| Priority | Action |
|---|---|
| HIGH | Implement PERF_PR_1 — code split views (`React.lazy`) |
| HIGH | Implement PERF_PR_2 — virtualise grid + timeline (`npm install @tanstack/react-virtual`) |
| MED | Fix GraphView to accept and use live `entries` prop instead of `INITIAL_ENTRIES` |
| MED | Add `@vercel/speed-insights` for real field data: `npm install @vercel/speed-insights` |
| LOW | Add cursor-based pagination to `/api/entries` (offset param) for large datasets |
| LOW | Consider dynamic import of Supabase SDK to split its ~200KB from initial chunk |
