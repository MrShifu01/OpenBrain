# Everion UI/UX Fix Plan
**Date**: 2026-04-08
**Sources**: `Audits/uiux-audit.md` (technical audit) + design critique session
**Total issues**: P0: 1 / P1: 8 / P2: 9 / P3: 4

---

## Combined Issue Registry

| ID | Sev | Source | Summary | Skill |
|----|-----|--------|---------|-------|
| A1 | P0 | Critique | Onboarding collects SSN/passport/medical/bank data — zero encryption assurance visible | `/harden` |
| A2 | P1 | Audit | No focus trap in any modal (`CaptureSheet`, `OnboardingModal`, `QuickCapture` PreviewModal) | `/harden` |
| A3 | P1 | Audit | `EntryCard` (`EntryList.tsx:31`) not keyboard-operable — no `tabIndex`, `role`, `onKeyDown` | `/harden` |
| A4 | P1 | Audit | `VirtualTimeline` rows (`EntryList.tsx:206`) not keyboard-operable | `/harden` |
| A5 | P1 | Audit | `PreviewModal` in `QuickCapture.tsx:35` missing `role="dialog"`, `aria-modal`, `aria-labelledby` | `/harden` |
| A6 | P1 | Audit | Close button `w-8 h-8` (32px) in `CaptureSheet.tsx:276` — too narrow despite global 44px rule | `/adapt` |
| A7 | P1 | Critique | Identical card grid — notes/secrets/people/documents all same `rounded-2xl p-5` structure | `/arrange` |
| A8 | P1 | Critique | 9 top-level nav destinations — exceeds working memory, Suggest/Refine/Timeline need grouping | `/distill` |
| B1 | P2 | Audit | Hard-coded `rgba(0,0,0,X)` backdrops in `CaptureSheet`, `QuickCapture`, `OnboardingModal` — harsh in light mode | `/colorize` |
| B2 | P2 | Audit | Timeline line `rgba(72,72,71,0.15)` (`EntryList.tsx:191`) — won't respond to light mode | `/colorize` |
| B3 | P2 | Audit | `VirtualGrid` column count stale on window resize (`EntryList.tsx:120–127`) | `/adapt` |
| B4 | P2 | Audit | `OnboardingModal` backdrop `blur(4px)` — glassmorphism trace, brand explicitly rejects this | `/normalize` |
| B5 | P2 | Audit | No `aria-live` region for chat messages (`ChatView.tsx:45`) — screen readers won't hear AI responses | `/harden` |
| B6 | P2 | Audit | `SettingsView` "Clear history" `minHeight: 36` overrides global 44px rule | `/adapt` |
| B7 | P2 | Critique | AI sparkle icon on chat avatar + nav (`ChatView`, `DesktopSidebar`) — most overused icon in AI products | `/clarify` |
| B8 | P2 | Critique | "Everion" brand name in `text-primary` (amber) — competes with "New Entry" CTA for accent color | `/bolder` |
| B9 | P2 | Critique | `text-[10px] font-semibold uppercase tracking-widest` used as visual tic across 5+ elements | `/typeset` |
| C1 | P3 | Audit | Large decorative emoji (`🚀`, `🧠` at `text-4xl`) above onboarding heading | `/distill` |
| C2 | P3 | Audit | Onboarding feature list uses icon+heading+desc grid pattern (`OnboardingModal.tsx:374–406`) | `/distill` |
| C3 | P3 | Audit | `OnboardingModal` step buttons: `role="checkbox"` on `<button>` — conflicting semantics, use `aria-pressed` | `/harden` |
| C4 | P3 | Critique | `✕` text char close buttons (some modals) vs SVG close buttons (others) — inconsistent pattern | `/polish` |

---

## Phase 1 — Harden
**Skill**: `/harden`
**Goal**: Fix all ship-blocking issues — trust gap, keyboard access, focus management, ARIA semantics.

No user should be asked to hand over their most sensitive personal data without visible security assurance, and no core interaction should be keyboard-inaccessible.

**Issues in scope**:

### P0 — Trust gap in onboarding (A1)
- **Location**: `OnboardingModal.tsx` — question collection flow
- **Fix**: Add a persistent, calm security banner at the top of the onboarding data-collection step. "Your answers are encrypted end-to-end and stored only on your device. Everion never sees your data." — warm, declarative, not alarming. Use `var(--color-secondary-container)` background with a lock icon mark. This should appear before the first question is shown and remain visible throughout.

### P1 — No focus trap in any modal (A2)
- **Locations**: `CaptureSheet.tsx:249`, `OnboardingModal.tsx:232`, `QuickCapture.tsx:35`
- **Fix**: Implement `useFocusTrap` hook — `useEffect` that queries `[tabIndex], button, input, textarea, select, a[href]` inside the modal container, extracts first/last, and intercepts Tab/Shift+Tab to loop focus. `CaptureSheet` already has correct `role="dialog"` — use it as the template.

### P1 — `EntryCard` not keyboard-operable (A3)
- **Location**: `EntryList.tsx:31` — `<article onClick={...}>`
- **Fix**: Add `tabIndex={0}`, `role="button"`, `onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(entry)}`. Or convert `<article>` to `<button>` with appropriate reset styles.

### P1 — `VirtualTimeline` rows not keyboard-operable (A4)
- **Location**: `EntryList.tsx:206` — `<div onClick={...}>`
- **Fix**: Same pattern — `role="button"`, `tabIndex={0}`, `onKeyDown` handler.

### P1 — `PreviewModal` in `QuickCapture` missing dialog semantics (A5)
- **Location**: `QuickCapture.tsx:35`
- **Fix**: Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby="preview-modal-title"`. Add `id="preview-modal-title"` to the "Preview before saving" heading span.

### P2 — No `aria-live` for chat (B5)
- **Location**: `ChatView.tsx:45` — messages container
- **Fix**: Add `aria-live="polite"` and `aria-atomic="false"` to the messages scroll container. When `chatLoading` becomes false and a new message is appended, screen readers will announce it.

### P3 — Mixed ARIA semantics on onboarding step buttons (C3)
- **Location**: `OnboardingModal.tsx:287`
- **Fix**: Replace `role="checkbox" aria-checked={active}` with `aria-pressed={active}`. Keep `<button>` element — don't introduce `<input type="checkbox">` here as the visual is already a toggle button pattern.

---

## Phase 2 — Colorize + Normalize
**Skills**: `/colorize`, `/normalize`
**Goal**: Eliminate hard-coded values that break the warm token system in light mode; remove the lone glassmorphism trace.

### P2 — `rgba(0,0,0,X)` backdrops (B1)
- **Locations**: `CaptureSheet.tsx:242`, `QuickCapture.tsx:36`, `OnboardingModal.tsx:233`
- **Fix**: Add `--color-scrim` to `index.css` theme tokens:
  ```css
  --color-scrim: oklch(12% 0.009 60 / 0.65);
  ```
  With a light mode override:
  ```css
  html:not(.dark) {
    --color-scrim: oklch(20% 0.005 60 / 0.5);
  }
  ```
  Replace all three hard-coded backdrop values with `var(--color-scrim)`.

### P2 — Timeline line hard-coded color (B2)
- **Location**: `EntryList.tsx:191`
- **Fix**: Replace `background: "rgba(72,72,71,0.15)"` with `background: "var(--color-outline-variant)"`.

### P2 — OnboardingModal glassmorphism trace (B4)
- **Location**: `OnboardingModal.tsx:233`
- **Fix**: Remove `backdropFilter: "blur(4px)"` — the scrim opacity (0.7, now via `--color-scrim`) provides sufficient context separation without glass blur.

---

## Phase 3 — Adapt
**Skill**: `/adapt`
**Goal**: Fix all touch target failures and the stale responsive column count.

### P1 — Close button 32px (A6)
- **Location**: `CaptureSheet.tsx:276`
- **Fix**: Change `w-8 h-8` to `w-11 h-11`. Match the pattern from `DesktopSidebar.tsx:150` which correctly uses `w-11 h-11`. Also audit the `text-lg ✕` button in `CaptureSheet` PreviewModal for the same treatment.

### P2 — `VirtualGrid` stale column count (B3)
- **Location**: `EntryList.tsx:120–127`
- **Fix**: Replace the `window.innerWidth` snapshot with a `useState` + `useEffect` that listens to a `ResizeObserver` on the list container. Alternatively (simpler): remove `COLS` entirely and use `gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))"` — let CSS handle columns and remove the JS branching completely.

### P2 — Settings "Clear history" touch target (B6)
- **Location**: `SettingsView.tsx:57`
- **Fix**: Remove the `style={{ minHeight: 36 }}` inline override. The global `button { min-height: 44px }` rule in `index.css:259` will then apply correctly.

---

## Phase 4 — Distill
**Skill**: `/distill`
**Goal**: Reduce top-level navigation cognitive load; remove anti-pattern templates from onboarding.

### P1 — Nav overload (A8)
- **Location**: `DesktopSidebar.tsx` nav items; equivalent mobile bottom nav
- **Current**: Home, Grid, Suggest, Refine, Todos, Timeline, Vault, Chat, Settings = 9 items
- **Fix**: Group secondary destinations:
  - Merge **Suggest + Refine** → single "AI" destination (the two features are both AI-powered; users can be presented a choice once inside)
  - Move **Timeline** → accessible from within the Grid view as a view-toggle (grid vs. timeline), not a separate nav destination
  - This reduces top-level nav to: Home, Grid, AI, Todos, Vault, Chat, Settings = 7 (or 6 if Todos moves under AI)
- **Note**: This requires agreement on how Suggest and Refine are presented inside the merged AI view. The navigation change is a structural decision — the internal UI can be a tab or segmented control inside the AI view.

### P3 — Onboarding emoji decorative (C1)
- **Location**: `OnboardingModal.tsx:261`
- **Fix**: Remove the `text-4xl` emoji div (`🚀` / `🧠`). Let the Lora headline carry the opening moment — it's strong enough. An optional small brand mark (non-emoji) could replace it, but absence is better than the current emoji.

### P3 — Onboarding feature list (C2)
- **Location**: `OnboardingModal.tsx:374–406`
- **Fix**: Replace the four `w-8 h-8 icon + label + desc` rows with a prose list. Use Lora for feature names (`font-serif font-semibold`) and DM Sans for descriptions. Remove the icon containers entirely — they add visual noise without functional value.

---

## Phase 5 — Arrange + Clarify + Bolder
**Skills**: `/arrange`, `/clarify`, `/bolder`
**Goal**: Make the card grid leverage its type taxonomy; replace the generic AI icon; fix the brand color collision.

### P1 — Identical card grid (A7)
- **Location**: `EntryList.tsx` — `EntryCard` component
- **Fix**: Differentiate card treatment by entry type:
  - **secret**: Dim the card surface (`var(--color-surface-container-lowest)`), show a lock icon treatment, remove the content preview line (replace with the existing "🔒 Encrypted" text but styled as a subdued banner across the card body rather than inline text)
  - **person**: Show a circular initials avatar (first+last initial from title) instead of the type icon container, using `var(--color-primary-container)` background
  - **document**: Add a subtle top-left accent strip in `var(--color-secondary-container)` (2px wide colored left border using border-left instead of the outline) — differentiates from note at a glance
  - **reminder**: Add a small date/time badge in the top-right area if `metadata.due` exists; use `var(--color-error-container)` for overdue items
  - **note** (default): Current treatment is fine — it becomes the baseline to contrast against
- The goal is that a user scanning the grid can identify content type before reading the label — currently they can't.

### P2 — AI sparkle icon (B7)
- **Locations**: `ChatView.tsx:64–72` (assistant avatar), `DesktopSidebar.tsx` (chat nav icon)
- **Fix**: The assistant avatar should be a stable brand mark, not the sparkle. Options:
  - A filled circle in `var(--color-primary-container)` with the letter "E" in Lora italic — ties the AI to Everion's identity
  - A simple two-node connection mark (two small dots connected by a line) referencing the "knowledge connection" metaphor
  - Whatever is chosen: replace in both locations for consistency. Keep the SVG for the nav item as a meaningful icon (the chat bubble icon would be more appropriate than sparkle for the nav).

### P2 — Brand name in accent color (B8)
- **Location**: `DesktopSidebar.tsx:138`
- **Fix**: Change `className="... text-primary"` on the `h1` to `className="... text-on-surface"`. Increase `font-weight` to compensate — `font-extrabold` or `font-black` in Lora still reads as brand without needing color. The amber accent is then unambiguously reserved for interactive actions.

---

## Phase 6 — Typeset
**Skill**: `/typeset`
**Goal**: Audit and rationalize the `text-[10px] uppercase tracking-widest` label treatment that appears as a visual tic.

### P2 — Over-applied label style (B9)
- **Locations**: EntryCard type badge, form labels (QuickCapture, CaptureSheet PreviewModal, CaptureSheet), sidebar status text, tag chips
- **Audit**: Count how many times `text-[10px] font-semibold uppercase tracking-[0.1em–0.2em]` appears. It's used for: type badges, form labels, status indicators, tag pills, nav subtext. These are conceptually different — form labels should be slightly more readable (consider `text-[11px]`), tag pills warrant their treatment, form labels don't.
- **Fix**: Reserve the `10px uppercase tracking-widest` treatment specifically for metadata badges (type tags, importance badges, status dots). Form labels should step up to `text-xs` (12px) for readability. Sidebar status text can remain at 10px as it's intentionally de-emphasized.

---

## Phase 7 — Polish
**Skill**: `/polish`
**Goal**: Final sweep after all preceding fixes are applied.

**Checklist**:
- [ ] Close button pattern: normalize all modals to use the same SVG close icon (ref: `DesktopSidebar.tsx:150` theme toggle button as size standard)
- [ ] Modal backdrop: verify no remaining `rgba(0,0,0,X)` values after Phase 2 (grep for `rgba(0,0,0`)
- [ ] Verify `--color-scrim` token applied and working in both light and dark mode
- [ ] Review all `w-8 h-8` occurrences for any remaining touch target violations
- [ ] Spot-check focus trap behavior in all three modals after Phase 1
- [ ] Verify `aria-live` is firing correctly in chat — test with macOS VoiceOver or Chrome accessibility inspector
- [ ] Confirm "Everion" brand mark reads correctly in both modes at the new neutral color
- [ ] Confirm card type differentiation is legible at 1x, 2x, and on mobile (1 column)
- [ ] Verify `VirtualGrid` column count updates correctly on resize after Phase 3

---

## Execution Summary

| Phase | Skills | Severity | Estimated Scope |
|-------|--------|----------|-----------------|
| 1 — Harden | `/harden` | P0 + P1 + P2 + P3 | 7 issues, 5 files |
| 2 — Colorize + Normalize | `/colorize`, `/normalize` | P2 | 3 issues, 4 files |
| 3 — Adapt | `/adapt` | P1 + P2 | 3 issues, 3 files |
| 4 — Distill | `/distill` | P1 + P3 | 3 issues, 2 files |
| 5 — Arrange + Clarify + Bolder | `/arrange`, `/clarify`, `/bolder` | P1 + P2 | 3 issues, 3 files |
| 6 — Typeset | `/typeset` | P2 | 1 systemic issue, 5+ files |
| 7 — Polish | `/polish` | P3 | Sweep |

Run phases 1–3 before any release. Phases 4–5 are high-value design improvements. Phases 6–7 are refinement.

Re-run `/critique` after Phase 5 to verify the score improvement.
