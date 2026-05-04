# Brand assets

Where the canonical assets live, what dimensions they need to be at, and the rules for using them.

> **Stub** — fill the TODO placeholders once final brand work is done. Currently shipping under "Evara Mind" working name pending final brand decision (see `EML/BRAINSTORM.md` § brand-name).

## Logo

| Asset | Where it lives | Required sizes |
|---|---|---|
| Primary logomark (icon) | TODO `public/logo-icon.svg` | SVG (vector) + PNG @ 512, 192, 64, 32 |
| Logomark monochrome | TODO `public/logo-icon-mono.svg` | SVG, single color |
| Wordmark | TODO `public/logo-wordmark.svg` | SVG; horizontal lockup |
| App icon (iOS) | TODO `Mobile/icons/ios/` | 1024×1024 (no alpha, no rounded corners) |
| App icon (Android) | TODO `Mobile/icons/android/` | 512×512 + adaptive icon foreground/background |
| Favicon | `public/favicon.ico` (currently shipping) | 16, 32, 48 multi-res ICO |
| OG image | `public/og.png` | 1200×630 |
| Twitter / X card | TODO `public/twitter-card.png` | 1600×900 |

> **Memory**: never silently swap the logo / wordmark / brand colours / brand fonts. If the asset is missing or broken, fix the original or ask. Do not substitute a placeholder.

## Color tokens

Source of truth: `src/index.css` :root tokens. Reproduced here for designers.

| Token | Hex | Use |
|---|---|---|
| `--ember` | TODO | Primary action / accent |
| `--ink` | TODO | Primary text |
| `--ink-soft` | TODO | Secondary text |
| `--surface` | TODO | Card / panel background |
| `--bg` | TODO | App background |
| `--line-soft` | TODO | Borders, dividers |
| `--moss` | TODO | Success state |
| `--danger` | TODO | Destructive state |

Filled values live in `src/index.css`. If you update them there, update this table or it'll drift.

## Typography

| Use | Family | Weight | Source |
|---|---|---|---|
| UI sans (body, labels, buttons) | TODO | 400 / 600 | Self-hosted? Google Fonts? |
| Display (hero, large titles) | TODO | 600 / 700 | — |
| Mono (code, IDs) | TODO | 400 | system mono OK if licensing is friction |

Self-host fonts wherever possible (Vercel CDN-hosts via Next/font equivalent — for Vite, drop into `public/fonts/`). Avoid runtime fetches from `fonts.googleapis.com` — adds latency + privacy footprint.

## Usage rules

- **Do** keep at least 1 logo-height clearspace around the wordmark.
- **Do** use the monochrome logomark on photos, video, complex backgrounds.
- **Don't** stretch, recolor, rotate, or add effects to the logo.
- **Don't** put the wordmark on a background lighter than `--surface` without testing contrast.
- **Don't** remix the logomark with other glyphs (no "logo + emoji" combos).

## Marketing assets (homepage, social, press)

| Asset | Source | Latest version |
|---|---|---|
| Homepage hero illustration | TODO | — |
| Product Hunt thumbnail (240×240) | TODO | — |
| Product Hunt gallery (1270×760, 4 images) | TODO | — |
| Twitter / X header (1500×500) | TODO | — |
| LinkedIn page banner (1128×191) | TODO | — |
| Instagram post template | TODO | — |
| App Store screenshots | TODO `Mobile/icons/screenshots-ios/` | — (see `Mobile/ios-submission.md`) |
| Play Store screenshots | TODO `Mobile/icons/screenshots-android/` | — (see `Specs/play-console-submission.md`) |

## Press kit

Bundled and downloadable from `everion.smashburgerbar.co.za/press` (TODO). Should include:
- Logo (SVG + PNG)
- App icons (iOS + Android)
- Founder headshot (1024×1024)
- Product screenshots (3–5 hero shots)
- Brand color palette
- One-paragraph company description
- Founder bio
- Contact email for press: TODO

(See `Brand/press-kit.md` for the press-kit content.)

## TODO / open

- [ ] Finalize brand name (working: "Evara Mind") — see `EML/BRAINSTORM.md`
- [ ] Commission or design final logomark
- [ ] Lock color tokens (validate against WCAG AA contrast — do automated check on launch)
- [ ] Lock display font (license-cleared for embedded use)
- [ ] Ship press-kit page
- [ ] Generate full app-icon set (use a tool like RealFaviconGenerator + iconset-generator)

## References

- `src/index.css` — color tokens (canonical)
- `Brand/voice-tone.md`
- `Brand/press-kit.md`
- `Mobile/ios-submission.md` § Required assets
- `Specs/play-console-submission.md`
