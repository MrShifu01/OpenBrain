# Code Hygiene Audit
_Date: 2026-04-15_

## Sheriff (Illegal Imports)
**Tool not runnable.** The project uses `@softarc/eslint-plugin-sheriff` (ESLint integration) rather than a standalone Sheriff CLI — the `npx sheriff` package doesn't exist. Module boundary enforcement runs through ESLint, not a separate CLI audit. No findings to report from this step.

---

## Unused Files
**Knip + TSR agree on all of these.**

| File | Lines | Notes |
|------|-------|-------|
| `src/lib/completenessScore.ts` | 55 | Zero importers anywhere — pure dead code |
| `src/components/SurprisingConnections.tsx` | 184 | Only imported by itself / surpriseScore — dead cluster |
| `src/lib/surpriseScore.ts` | 109 | Only consumed by SurprisingConnections.tsx (also dead) |

**Total dead production code: ~348 lines across 3 files.**

False positives in tool output (not dead):
- `api/feed.ts`, `api/graph.ts`, `api/transfer.ts`, `api/cron/purge-trash.ts` — Vercel serverless routes, called via HTTP not imports. Confirmed via URL patterns in source (`/api/feed`, `/api/graph`, vercel.json rewrite comment).
- `src/sw.js` — service worker, registered by `vite-plugin-pwa` with `filename: 'sw.js'` in `vite.config.js`.
- All `tests/` and `src/__tests__/` files — test-only; TSR doesn't know about vitest entrypoints.

---

## Dead Exports
**Confirmed by both Knip + TSR (high confidence):**

| File | Export | Line |
|------|--------|------|
| `src/types.ts` | `ConfidenceLevel` | 32 |
| `src/context/BrainContext.tsx` | `BrainContextValue` | 4 |
| `src/context/EntriesContext.tsx` | `EntriesContextValue` | 4 |
| `src/lib/learningEngine.ts` | `getDecisionCount` | 302 |

**Knip only (lower confidence):**

| File | Export | Line |
|------|--------|------|
| `src/lib/conceptGraph.ts` | `applyFeedback` | 284 |
| `api/llm.ts` | `config` | 6 |

---

## Unused Types
Same as dead exports above — `ConfidenceLevel`, `BrainContextValue`, `EntriesContextValue` are type-only exports with no consumers.

---

## Duplicate Modules
No duplicate source files found. The `cn()` function exists in exactly one place (`src/lib/cn.ts`).

---

## Misplaced Dependencies
None. `shadcn` (code generator) is correctly in `devDependencies`. All runtime packages are under `dependencies`.

---

## Heavy / Replaceable Dependencies

| Package | Install size | Usage | Notes |
|---------|-------------|-------|-------|
| `pdfjs-dist` | 41 MB | Used (`fileExtract.ts`, dynamic import) | Produces 405KB chunk. Legitimate use — dynamic import limits impact. |
| `@sentry/react` | 16 MB | Used (`main.tsx`, `ErrorBoundary.tsx`, `ConsentBanner.tsx`) | Legitimate. |
| `mammoth` | 2.5 MB | Used (`fileExtract.ts`) | Legitimate — docx parsing. |

No packages flagged as unused by Knip that are also heavy. MSW (7.7MB) is a transitive dependency (not direct), not something you can remove.

---

## Duplicate Transitive Dependencies (e18e)
59 transitive duplicate packages — all caused by version conflicts between top-level direct deps. The most actionable:

| Package | Versions | Root cause |
|---------|---------|------------|
| `zod` | v3.25 vs v4.3 | `shadcn` pulls v3; dev tools pull v4 |
| `commander` | v2 / v11 / v14 | `@dotenvx/dotenvx`, `terser`, `shadcn` |
| `execa` | v5 / v9 | `@dotenvx/dotenvx` vs `shadcn` |

These are all in dev tooling deps (`shadcn`, `@dotenvx/dotenvx`) — no runtime impact. Not worth fixing unless bundle size becomes a problem.

---

## Build Issues
**Build succeeds.** One warning:

Three chunks exceed 500KB (minified, before gzip):
- `index-*.js` — 555KB (gzip: 158KB)
- `lib-*.js` — 495KB (gzip: 125KB)
- `pdf-*.js` — 405KB (gzip: 120KB)

The `pdf-*` chunk is expected (pdfjs-dist, dynamically imported). The `index` and `lib` chunks are the larger concern if LCP is a priority.

---

## Prioritized Action Table

| Priority | Action | Effort | Confidence |
|----------|--------|--------|-----------|
| **Quick win** | Delete `src/lib/completenessScore.ts` | ~1 min | High (Knip + TSR + manual grep) |
| **Quick win** | Delete `src/components/SurprisingConnections.tsx` + `src/lib/surpriseScore.ts` | ~2 min | High (dead cluster, both tools agree) |
| **Quick win** | Remove 4 dead exports: `ConfidenceLevel`, `BrainContextValue`, `EntriesContextValue`, `getDecisionCount` | ~10 min | High (both tools agree) |
| **Medium** | Investigate `applyFeedback` in `conceptGraph.ts` and `config` in `api/llm.ts` — were these planned features? | ~15 min | Medium (Knip only) |
| **Medium** | Add `knip.json` with `ignore` for `api/**` and `src/sw.js` to eliminate false positives in future runs | ~10 min | — |
| **Low** | Chunk splitting — split the 555KB index chunk with dynamic imports | ~1-2 hours | — |
| **Ignore** | 59 transitive duplicate deps from shadcn/dotenvx — no runtime impact | — | — |
