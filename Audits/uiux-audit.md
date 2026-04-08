# UI/UX Audit — Everion
**Date**: 2026-04-08
**Auditor**: Claude Code (Sonnet 4.6)
**Scope**: Modified files from feature/master-sprint merge — all components and views in the current working tree

---

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | No focus traps; interactive cards non-keyboard; missing modal roles |
| 2 | Performance | 3 | VirtualGrid column count stale on window resize |
| 3 | Theming | 3 | Hard-coded `rgba(0,0,0,X)` backdrops across all modals |
| 4 | Responsive Design | 3 | 32px close button; static VirtualGrid columns |
| 5 | Anti-Patterns | 3 | Onboarding emoji decoratives; backdrop blur; feature icon grid |
| **Total** | | **14/20** | **Good (address weak dimensions)** |

---

## Anti-Patterns Verdict

**Does this look AI-generated?** Mostly no — the warm amber + sage on warm charcoal palette actively resists the AI slop aesthetic. The OKLCH token system, Lora/DM Sans pairing, and expo ease-out animations are intentional and on-brand.

**One tell remains**: the onboarding modal uses large decorative emojis (🧠, 🚀 at `text-4xl`) above headings + a feature list of `w-8 h-8 icon + label + desc` rows — this is the "icon above heading" anti-pattern. Backdrop blur on the onboarding overlay is a trace of glassmorphism. These are isolated, not systemic.

---

## Executive Summary

- **Audit Health Score**: **14/20** (Good)
- **Issue count**: P0: 0 / P1: 5 / P2: 6 / P3: 4
- **Top critical issues**:
  1. Modals missing focus traps — tab key escapes all overlays
  2. `EntryCard` and `VirtualTimeline` rows not keyboard-operable
  3. `PreviewModal` in `QuickCapture.tsx` missing `role="dialog"` and `aria-modal`
  4. Hard-coded `rgba(0,0,0,X)` backdrops don't adapt to light mode
  5. `VirtualGrid` column count snapshotted at render, never updates on resize

---

## Detailed Findings by Severity

### P1 — Major (fix before release)

**[P1] No focus trap in any modal**
- **Location**: `CaptureSheet.tsx:249`, `OnboardingModal.tsx:232`, `QuickCapture.tsx:35` (PreviewModal)
- **Category**: Accessibility
- **Impact**: Tab key moves focus behind the modal overlay. Screen reader and keyboard users can interact with obscured content.
- **WCAG**: 2.4.3 Focus Order (AA)
- **Recommendation**: Implement focus trap with `useEffect` that queries `[tabIndex], button, input, textarea, select` inside the modal and loops focus between first/last on Tab/Shift+Tab.
- **Suggested command**: `/harden`

---

**[P1] `EntryCard` not keyboard-operable**
- **Location**: `EntryList.tsx:31` — `<article onClick={...}>` with no `tabIndex`, no `onKeyDown`, no `role`
- **Category**: Accessibility
- **Impact**: Keyboard-only users cannot select any entry in the grid. Effectively blocks the primary content browsing action.
- **WCAG**: 2.1.1 Keyboard (A)
- **Recommendation**: Add `tabIndex={0}`, `role="button"` (or convert to `<button>`), and `onKeyDown={(e) => e.key === 'Enter' && onSelect(e)}`.
- **Suggested command**: `/harden`

---

**[P1] `VirtualTimeline` rows not keyboard-operable**
- **Location**: `EntryList.tsx:206` — `<div onClick={...}>` with no interactive semantics
- **Category**: Accessibility
- **Impact**: Same as EntryCard — timeline view is inaccessible to keyboard users.
- **WCAG**: 2.1.1 Keyboard (A)
- **Recommendation**: Add `role="button"`, `tabIndex={0}`, `onKeyDown` handler.
- **Suggested command**: `/harden`

---

**[P1] `PreviewModal` in `QuickCapture.tsx` missing dialog semantics**
- **Location**: `QuickCapture.tsx:35` — `<div className="fixed inset-0 z-50...">` with no `role="dialog"`, `aria-modal`, or `aria-labelledby`
- **Category**: Accessibility
- **Impact**: Screen readers don't announce this as a modal; users won't know they're in a dialog context. Contrast with `CaptureSheet.tsx:250` which correctly has `role="dialog" aria-modal="true" aria-label="New entry"`.
- **WCAG**: 4.1.2 Name, Role, Value (AA)
- **Recommendation**: Add `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the "Preview before saving" heading.
- **Suggested command**: `/harden`

---

**[P1] Close button below 44px touch target**
- **Location**: `CaptureSheet.tsx:276` — `className="w-8 h-8 ..."` (32×32px); `CaptureSheet.tsx` PreviewModal `:53` — `text-lg ✕` button (no explicit sizing)
- **Category**: Responsive Design / Accessibility
- **Impact**: Difficult to tap on mobile. The global `button { min-height: 44px }` rule in `index.css:259` applies but `w-8 h-8` forces width to 32px — the target is too narrow.
- **WCAG**: 2.5.5 Target Size
- **Recommendation**: Change to `w-11 h-11` (44px) to match the theme toggle button pattern in `DesktopSidebar.tsx:150`.
- **Suggested command**: `/adapt`

---

### P2 — Minor (fix in next pass)

**[P2] Hard-coded `rgba(0,0,0,X)` backdrops — don't adapt to light mode**
- **Location**:
  - `CaptureSheet.tsx:242`: `rgba(0,0,0,0.5)`
  - `QuickCapture.tsx:36`: `rgba(0,0,0,0.65)`
  - `OnboardingModal.tsx:233`: `rgba(0,0,0,0.7)`
- **Category**: Theming
- **Impact**: In light mode, a pure-black overlay feels harsh and inconsistent with the warm cream surface system.
- **Recommendation**: Replace with a CSS variable, e.g. `--color-scrim: oklch(12% 0.009 60 / 0.6)` in dark and `oklch(20% 0.005 60 / 0.5)` in light. Reference via `var(--color-scrim)`.
- **Suggested command**: `/colorize`

---

**[P2] Hard-coded timeline line color**
- **Location**: `EntryList.tsx:191` — `background: "rgba(72,72,71,0.15)"`
- **Category**: Theming
- **Impact**: Eyeballed warm-grey value won't respond to light mode — the line will be barely visible in light mode.
- **Recommendation**: Replace with `var(--color-outline-variant)`.
- **Suggested command**: `/colorize`

---

**[P2] `VirtualGrid` column count stale on window resize**
- **Location**: `EntryList.tsx:120-127` — `COLS` computed from `window.innerWidth` at render time, never recalculated
- **Category**: Performance / Responsive Design
- **Impact**: If the user resizes a desktop window (or rotates a tablet), the grid layout won't adapt. Also problematic in SSR contexts where `window` is undefined.
- **Recommendation**: Move `COLS` into a `useState` initialized by a `useLayoutEffect` with a `ResizeObserver`, or use CSS `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` and remove the JS column logic entirely.
- **Suggested command**: `/adapt`

---

**[P2] `OnboardingModal` backdrop blur — glassmorphism trace**
- **Location**: `OnboardingModal.tsx:233` — `backdropFilter: "blur(4px)"`
- **Category**: Anti-Patterns
- **Impact**: The brand explicitly rejects glassmorphism. All other modals (`CaptureSheet`, `QuickCapture` `PreviewModal`) use solid backdrops correctly.
- **Recommendation**: Remove `backdropFilter: "blur(4px)"`. The scrim opacity (0.7) is already strong enough for context separation.
- **Suggested command**: `/normalize`

---

**[P2] No `aria-live` region for chat messages**
- **Location**: `ChatView.tsx:45` — messages list has no live region
- **Category**: Accessibility
- **Impact**: When the AI sends a response, screen reader users won't be notified. The chat is effectively silent to assistive technology.
- **WCAG**: 4.1.3 Status Messages (AA)
- **Recommendation**: Wrap the messages container (or a status element) with `aria-live="polite"` and `aria-atomic="false"`.
- **Suggested command**: `/harden`

---

**[P2] `SettingsView` "Clear history" button below touch target**
- **Location**: `SettingsView.tsx:57` — `style={{ minHeight: 36 }}` overrides the global 44px rule
- **Category**: Responsive Design
- **Impact**: Touch target too small on mobile.
- **Recommendation**: Change to `minHeight: 44` or use the standard `py-2.5` class pattern used elsewhere.
- **Suggested command**: `/adapt`

---

### P3 — Polish (fix if time permits)

**[P3] Onboarding emoji decoratives above heading**
- **Location**: `OnboardingModal.tsx:261` — `<div className="mb-3 text-4xl">{step === START_STEP ? "🚀" : "🧠"}</div>`
- **Category**: Anti-Patterns
- **Impact**: The "large icon above heading" pattern is an anti-pattern per brand guidelines. Emojis at 40px with no semantic value feel like an AI product template.
- **Recommendation**: Remove the emoji decorative or replace with a small inline brand mark. Let the Lora headline carry the moment.
- **Suggested command**: `/distill`

---

**[P3] Onboarding feature list uses icon+heading+desc grid pattern**
- **Location**: `OnboardingModal.tsx:374-406` — four feature rows each with `w-8 h-8 icon + label + desc`
- **Category**: Anti-Patterns
- **Impact**: This is the "identical card grid" anti-pattern — same structure, same spacing, different text. Feels templated.
- **Recommendation**: Replace with a simple bulleted or prose list. Use Lora for the feature names and let typography carry the hierarchy.
- **Suggested command**: `/distill`

---

**[P3] `OnboardingModal` step buttons use `role="checkbox"` on `<button>` element**
- **Location**: `OnboardingModal.tsx:287` — `<button role="checkbox" aria-checked={active}>`
- **Category**: Accessibility
- **Impact**: Mixed semantics — `<button>` and `role="checkbox"` conflict. ARIA spec prohibits overriding native semantics with conflicting roles. AT may announce this incorrectly.
- **Recommendation**: Either use `<input type="checkbox">` + `<label>`, or keep `<button>` and replace `aria-checked` with `aria-pressed`.
- **Suggested command**: `/harden`

---

## Patterns & Systemic Issues

1. **Hard-coded rgba backdrops across all modals** — `rgba(0,0,0,X)` appears in 3 files. A single `--color-scrim` token would fix all instances and future modals.
2. **Missing keyboard interactivity on clickable non-button elements** — both `EntryCard` (`<article>`) and `VirtualTimeline` rows (`<div>`) use `onClick` without proper interactive semantics. Convention needed: if it's clickable, it must be a `<button>` or carry `role="button"` + `tabIndex`.
3. **Focus management in modals** — no modal implements a focus trap. This is a systemic gap, not per-component.

---

## Positive Findings

- **Token system is exceptional**: OKLCH-based, perceptually uniform, dual light/dark, warm-tinted neutrals. Production-grade.
- **Animation discipline**: Exclusively `transform`/`opacity`, expo ease-out, no bounce anywhere. Fully aligned with brand.
- **Virtual scrolling**: `@tanstack/react-virtual` used correctly in both grid and timeline.
- **`prefers-reduced-motion`**: Properly implemented in `index.css:179` — blanket 0.01ms duration override.
- **Touch target global rule**: `button { min-height: 44px }` in `index.css:259` is a smart systemic safeguard.
- **Anti-glassmorphism migration done**: The `glass-panel` class is now a solid surface.
- **Typography pairing**: Lora + DM Sans is distinctive, editorial, and fully on-brand.
- **`CaptureSheet` dialog semantics**: Correct `role="dialog" aria-modal aria-label` — this is the template other modals should follow.

---

## Recommended Actions (priority order)

1. **[P1] `/harden`** — Focus traps in `CaptureSheet`, `OnboardingModal`, `QuickCapture` PreviewModal; keyboard interactivity on `EntryCard` + `VirtualTimeline` rows; `PreviewModal` dialog semantics; `OnboardingModal` `role="checkbox"` fix; `aria-live` in chat
2. **[P2] `/colorize`** — Replace all `rgba(0,0,0,X)` backdrops with `--color-scrim` token; fix timeline line to `var(--color-outline-variant)`
3. **[P2] `/adapt`** — 32px close button → 44px; `VirtualGrid` static columns fix; Settings "Clear history" touch target
4. **[P2] `/normalize`** — Remove `backdropFilter: "blur(4px)"` from `OnboardingModal`
5. **[P3] `/distill`** — Remove emoji decorative above onboarding heading; simplify feature list to prose
6. **[P0-P3] `/polish`** — Final pass after all fixes
