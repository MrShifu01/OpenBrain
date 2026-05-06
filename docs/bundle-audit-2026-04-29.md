# Bundle audit — 2026-04-29

Captured against `npm run build` output before public launch. Reads as the
"is anything obviously bad?" sanity check, not a deep-dive.

## Top chunks (raw / gzipped)

| Chunk                       | Raw   | Gzip  | Lazy?     |
| --------------------------- | ----- | ----- | --------- |
| exceljs.min                 | 930 KB | 256 KB | yes — only on data export |
| Everion (shell)             | 421 KB | 111 KB | dynamic-imported by App.tsx |
| pdf (PDF.js worker)         | 405 KB | 121 KB | yes — only on PDF capture |
| lib (vendor: react+supabase+etc) | 401 KB | ~110 KB | shared, on first paint |
| index (entry chunk)         | 255 KB | ~70 KB  | first paint |
| module (vendor split)       | 183 KB | ~55 KB | shared |
| supabase                    | 152 KB | 45 KB  | shared |
| jszip.min                   | 96 KB  | 30 KB  | yes — only on export |
| sentry                      | 85 KB  | 30 KB  | first paint |
| TodoView                    | 71 KB  | 19 KB  | yes — lazy on tab switch |
| VaultView                   | 33 KB  | 9 KB   | yes |
| LoginScreen                 | (large, lazy) | | yes |
| AdminView, ResetPassword, StatusPage | small | | yes |

## Findings

- **No chunk exceeds 500 KB gzipped.** The Vite warnings during build report
  *raw* size (>500 KB before gzip); after gzip every chunk is well under
  the 500 KB threshold the warning is calibrated for.
- **First-paint critical path is dominated by the vendor `lib` + entry
  `index` chunks** (~180 KB gzipped combined). That's React + Supabase +
  framework — already at the floor without ejecting a major dep.
- **Heavy features are already lazy** — `pdf`, `exceljs`, `jszip`,
  `Everion` (post-auth shell), every view (`TodoView`, `VaultView`,
  `GraphView`, `ChatView`, `AdminView`, `LoginScreen`,
  `ImportantMemoriesView`). Cold-load avoids paying for any of them.
- **Sentry adds 30 KB gzipped on first paint.** Loaded only after consent —
  the consent banner blocks the import. (See `src/main.tsx:36`.) On
  first-time visitors Sentry isn't fetched until they tap "accept".

## Action items (none urgent)

- [ ] **Defer @vercel/analytics + speed-insights** — they import in
  `main.tsx` regardless of consent. Move behind the same consent gate as
  Sentry / PostHog. Likely saves ~15 KB gzipped on first paint for
  declined-cookie users.
- [ ] **Audit the `lib` mega-chunk** post-launch — Vite groups vendor
  modules by default; manual `manualChunks` could split react / react-dom
  into a longer-cached chunk separate from supabase / sentry. Only worth
  doing once a CDN cache strategy is in place; otherwise the split adds
  HTTP overhead with no real win.
- [ ] **Consider lighter PDF renderer** if mobile install size becomes a
  concern. PDF.js is 405 KB raw; pdfjs-dist core is the same; lighter
  alternatives (pdfjs-extract, pdf-parse) sacrifice rendering. Not worth
  now — rendering quality matters.

## Method

```bash
npm run build
# Inspect dist/assets/, sort by gzip column in build log
ls -lS dist/assets/*.js | head
```
