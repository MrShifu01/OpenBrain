# Lighthouse — pre-launch prep

Real Lighthouse runs against the production URL with a real Chrome instance.
Cannot be reliably scripted from this dev environment. Run from your machine
when the production deploy is live; this doc collects the things to check
and the fixes that are already in place so you don't waste runs.

## Targets (per LAUNCH_CHECKLIST P1)

| Metric          | Target |
| --------------- | ------ |
| Performance     | ≥ 90   |
| Accessibility   | ≥ 95   |
| Best Practices  | ≥ 95   |
| SEO             | ≥ 95   |

Run mobile and desktop separately; mobile budgets are tighter.

## Already addressed

- **Bundle size** — every heavy view is lazy-loaded (Everion shell, TodoView,
  VaultView, GraphView, ChatView, LoginScreen, ImportantMemoriesView,
  AdminView, ResetPasswordView, StatusPage). pdf and exceljs only fetch on
  capture/export.
- **Cold-load** — settings now fire-and-forget instead of blocking
  `setSession` (commit 0f96f96 era). Phase 2 entry fetch uses cursor
  pagination with a 500-row page size and 5000-row hard cap.
- **og.png compressed** (8.7 KB).
- **Service worker** — Workbox precaches the shell so repeat visits hit a
  cache-first path.
- **Critical CSS** — Tailwind atomic classes, no separate bundle.
- **Fonts** — preloaded from Google Fonts, async-injected so they don't
  block first paint (`src/main.tsx:28`).
- **Image formats** — favicon SVG, PWA icons WebP, og.png is the only
  raster image on the marketing surface.

## Likely flags after first run

- **Performance — LCP** on the landing-page hero. Fix: add
  `loading="eager"` + `fetchpriority="high"` on the hero image, lazy-load
  everything below the fold.
- **Performance — TBT** from React hydration. Mostly unavoidable on a
  React SPA; verify the lazy imports are doing their job.
- **Best Practices — CSP `unsafe-inline`** in `style-src` flags.
  Documented in `LAUNCH_CHECKLIST.md` P2 — nonce migration deferred.
- **Accessibility — color contrast** on `var(--ink-soft)` over
  `var(--surface)` in some cards. Check with the inspector once flagged;
  bump the lightness if needed.
- **SEO — Robots / canonical** — verify `robots.txt` allows crawling and
  every public page emits a canonical link. `useDocumentMeta` already
  emits one for views that opt in.

## How to run

```bash
# Mobile
npx lighthouse https://everionmind.com \
  --chrome-flags="--headless" \
  --only-categories=performance,accessibility,best-practices,seo \
  --form-factor=mobile \
  --output=html --output-path=.lighthouse/mobile.html

# Desktop
npx lighthouse https://everionmind.com \
  --chrome-flags="--headless" \
  --form-factor=desktop \
  --output=html --output-path=.lighthouse/desktop.html
```

`.lighthouse/` is gitignored. Open the HTML in a browser to read the
report; failed audits link to specific elements.
