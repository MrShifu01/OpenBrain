# OpenBrain — UI Review

**Audited:** 2026-04-03
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md found)
**Screenshots:** Not captured — OpenBrain dev server not running (port 5173 serves a different app; no server detected on 3000, 3001, 4173, 5174, 5175, 8080). Audit based on full source code review.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Visual Hierarchy & Typography | 6/10 | Functional hierarchy but 7+ font sizes scattered across inline styles; no single authoritative type scale |
| 2. Colour System & Consistency | 7/10 | Theme tokens exist and are largely respected; RefineView breaks the system with raw hardcoded hex strings |
| 3. Spacing & Layout | 5/10 | No spacing scale — every component invents its own padding/gap values via inline styles; inconsistent card padding across views |
| 4. Component Quality & Reuse | 4/10 | Heavy copy-paste of button/card patterns across 5 files; no shared Button, Card, or Badge primitive |
| 5. Mobile / PWA Responsiveness | 6/10 | Horizontal scrolling nav works but nav items clip on narrow screens; grid COLS snap only at 640px with a static window.innerWidth call; chat view height calc breaks on iOS |
| 6. Accessibility & Interaction Feedback | 5/10 | Icon-only action buttons lack accessible labels in several places; delete action uses raw alert(); no focus-visible ring styles; loading states present but error recovery is weak |

**Overall: 33/60**

---

## Top 10 Issues Ranked by User Impact

1. **No shared Button primitive — disabled state is duplicated 14+ times across files**
   Impact: A disabled button in one view looks different to a disabled button in another, eroding trust in the UI's visual language. Users cannot form a consistent mental model of "inactive."
   Fix: Extract a `<Btn>` component that accepts `primary | ghost | danger` + `disabled` props and renders a consistent gradient/muted/opacity pattern.

2. **RefineView.jsx uses hardcoded raw hex colours throughout — bypasses theme entirely**
   Impact: RefineView will be broken in light mode. Colours like `#EAEAEA`, `#555`, `#666`, `#1a1a2e`, `#0f0f23`, `#2a2a4a`, `#252540`, `#bbb`, `#ccc`, `#ddd`, `#aaa` are hardcoded across ~30 style objects in `src/views/RefineView.jsx` (lines 228–465). A user who has switched to light mode will see near-invisible text on a near-white background.
   Fix: Replace every hardcoded hex with the appropriate `t.*` token from `useTheme()`. The component imports `TC` from constants but never calls `useTheme()` — add the hook and propagate `t`.

3. **Nav bar overflows and clips on sub-400px screens**
   Impact: Nine nav items at `minWidth: 72px` = 648px minimum, but the container is `overflowX: auto` with `scrollbarWidth: none`. On a 375px iPhone the last 4 nav items (Graph, Ask, Settings + any overflow) are not visible and there is no scroll affordance or indicator. Users may not know the nav is scrollable.
   Fix: Either reduce nav to 5 items with a "More" overflow menu, or add a visible fade-right gradient to signal horizontal scroll.

4. **`alert()` used for save failures (`OpenBrain.jsx:770`)**
   Impact: Native browser alert() blocks the UI thread, looks jarring on mobile, and has no styling consistency. On iOS it shows a dialog with a URL bar. Users encountering a save error get a jarring, brand-inconsistent experience.
   Fix: Replace with the existing `UndoToast` pattern or a purpose-built `ErrorBanner` component that renders inline.

5. **VirtualGrid COLS determined by `window.innerWidth` at render time — not reactive**
   Impact: `const COLS = typeof window !== "undefined" && window.innerWidth >= 640 ? 2 : 1` (`OpenBrain.jsx:561`) is evaluated once at component mount. If the user resizes the window or rotates their phone, the grid column count does not update until a full remount. On tablets this means a 1-column layout that never upgrades to 2 columns after orientation change.
   Fix: Replace with a `useWindowSize` hook or a `ResizeObserver` on the container ref, or use CSS `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` and remove the JS branch entirely.

6. **Chat view height `calc(100vh - 260px)` is a magic number that breaks on iOS Safari**
   Impact: iOS Safari's dynamic toolbar changes the viewport height as the user scrolls, causing the chat panel to either clip or leave a gap. The `260px` offset is not documented and will be wrong on any screen where the header + nav combination differs.
   Fix: Use `100dvh` (dynamic viewport height, well-supported in 2024+) or a flex layout with `flex: 1; min-height: 0` to let the chat area fill remaining space without a magic offset.

7. **OnboardingModal step 2 runs all 30 questions inside a fixed-height modal — no escape until "Skip all"**
   Impact: At step 2 the modal shows one question at a time with no "exit to app" button. The only way out is to answer all 30 or click the underlined "Skip all" at the bottom. This skip link (`font-size: 11px`, `color: t.textFaint`) has extremely low visibility. Users who do not see it may feel trapped. (`src/components/OnboardingModal.jsx:335–345`)
   Fix: Add a visible "Exit setup" or "Do this later" button at the top-right of the modal card. The skip-all text should be styled as a secondary button, not a faint underlined link.

8. **Icon-only buttons missing accessible labels for screen readers and keyboard users**
   Impact: The voice button (`🎤`) at `OpenBrain.jsx:448` has `title="Voice capture"` — acceptable for pointer users, but `title` is not reliably surfaced by screen readers. The camera button at line 449 has no `aria-label`. The `✕` close button in `NudgeBanner` (`OpenBrain.jsx:125`) has no label. The delete button in `BrainItem` (`BrainSwitcher.jsx:178`) has `title="Delete brain"` only.
   Fix: Add `aria-label` to all icon-only interactive elements. The `title` attribute alone does not satisfy WCAG 2.1 SC 4.1.2.

9. **No focus-visible ring styles anywhere in the application**
   Impact: The entire app uses inline styles and there is no global CSS that provides a `:focus-visible` outline. Keyboard-only users (and users navigating after a mouse click that triggers focus) have no visual indicator of which element is focused. This fails WCAG 2.1 SC 2.4.7 (Focus Visible).
   Fix: Add a global stylesheet rule: `*:focus-visible { outline: 2px solid #4ECDC4; outline-offset: 2px; }`. This should be in `index.css` or equivalent, not in inline styles.

10. **Spacing is invented per-component with no shared scale — padding ranges from 4px to 36px with no pattern**
    Impact: The visual rhythm between components is inconsistent: `OnboardingModal` uses 32px card padding, `SettingsView` uses `20px 24px`, `EntryCard` uses `16px 20px`, `UndoToast` uses `12px 20px`, filter chips use `5px 12px`, stat cards use `14px 12px`. This creates a visually "wobbly" feel across views even though each individual component looks reasonable.
    Fix: Define a spacing scale (e.g. 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48) and document it in `ThemeContext.jsx` as `t.space.*` tokens or a separate constants file. Align all component padding/gap values to the nearest step.

---

## Detailed Findings

### Pillar 1: Visual Hierarchy & Typography (6/10)

**Strengths:**
- Clear primary/secondary/tertiary hierarchy within individual components: large stat numbers (18–26px, `fontWeight: 800`), section labels (10–11px, uppercase, `letterSpacing: 1–1.5`), body text (13–15px), and captions (9–12px).
- `fontFamily: "'Söhne', system-ui, -apple-system, sans-serif"` is declared at the root, giving the app a quality typographic base.
- `fontWeight: 800` used sparingly (stats, headings), `fontWeight: 700` for primary CTAs — a reasonable weight scale.

**Issues:**
- Font sizes in use span: 9px, 10px, 11px, 12px, 13px, 14px, 15px, 16px, 18px, 20px, 22px, 24px, 26px, 32px, 36px, 52px — that is 16 distinct sizes across the app. A well-constrained type scale should use 4–6 sizes.
- The `h1` on `LoginScreen.jsx:44` is `fontSize: 36`, the `h1` in `OpenBrain.jsx:856` is `fontSize: 20`, and the `h2` in `RefineView.jsx:249` is `fontSize: 16`. Page-level headings have no consistent size relationship.
- The onboarding question text (`OnboardingModal.jsx:290`) is `fontSize: 15, fontWeight: 500` while the equivalent in `SuggestionsView.jsx:327` is `fontSize: 18, fontWeight: 500` — the same content pattern is sized differently across the two views.
- Section labels (e.g., "Entry fixes (N)", "Missing relationships (N)" in `RefineView.jsx:319, 341`) use `fontSize: 10` with `letterSpacing: 1.2`. At 10px this is below the recommended 12px minimum for body or label text, particularly on non-Retina displays.

---

### Pillar 2: Colour System & Consistency (7/10)

**Strengths:**
- `ThemeContext.jsx` defines a clean two-theme token system (`DARK` / `LIGHT`) with 10 semantic tokens: `bg`, `surface`, `surface2`, `border`, `text`, `textSoft`, `textMid`, `textMuted`, `textDim`, `textFaint`.
- Primary accent `#4ECDC4` (teal) is used consistently for CTAs, active states, and progress indicators.
- Secondary accents are purposeful: `#FF6B35` (orange) = destructive/skip, `#A29BFE` (purple) = AI-related, `#FFD700` (gold) = pinned/warnings.
- Light mode appears thoughtfully designed in `ThemeContext.jsx` with appropriate contrast ratios for text tokens.

**Issues:**
- `RefineView.jsx` never calls `useTheme()` and hardcodes all colours directly. The component uses approximately 30 hardcoded hex values (`#EAEAEA`, `#555`, `#666`, `#1a1a2e`, `#0f0f23`, `#2a2a4a`, `#252540`, `#bbb`, `#ccc`, `#ddd`, `#aaa`, `#444`, `#888`, `#777`, `#ccc`, `#ddd`). In light mode this renders white text on a white background.
- `BrainSwitcher.jsx` uses hardcoded values: `background: "#1e1e2e"` (dropdown, line 68), `color: "#e8e8e8"` (trigger button, line 44), `color: "#7c8ff0"` (new brain link, line 121), `background: "rgba(124,143,240,0.15)"` (active item, line 159), `color: "#a5b4fc"` (active text, line 167). These are unrelated to the app's accent system and will mismatch in light mode.
- `LoginScreen.jsx:47` uses a hardcoded `color: "#4ECDC4"` inline rather than an accent token. Acceptable since the login screen uses the same dark background, but if the theme ever changes this becomes a maintenance issue.
- The `#25D366` WhatsApp green in `SupplierPanel` (`OpenBrain.jsx:221`) is a one-off colour that does not belong to the design system. It is appropriate contextually (brand colour) but worth noting.
- Opacity-based colour variants (`#4ECDC440`, `#4ECDC415`, `#4ECDC408`, `#A29BFE18`, `#FF6B3510`) are used directly as hex strings. These work visually but mean the accent colours are hardcoded at 10+ different opacity levels rather than being generated from a central token.

---

### Pillar 3: Spacing & Layout (5/10)

**Strengths:**
- Consistent use of `borderRadius: 12–14` for cards and `borderRadius: 8–10` for inputs/chips creates a recognisable visual language.
- `gap: 8–12` is the dominant gap value for flex/grid children, which gives reasonable density.
- `maxWidth: 540–600` content containers on login/modals prevent line-length issues on desktop.

**Issues:**
- No documented spacing scale. Padding values in use across the app: 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 40 — effectively no constraint.
- Card padding is inconsistent: `OnboardingModal` card = `padding: 32` (`OnboardingModal.jsx:164`), `SettingsView` cards = `padding: "20px 24px"` (`OpenBrain.jsx:499`), `EntryCard` = `padding: "16px 20px"` (`OpenBrain.jsx:537`), `UndoToast` = `padding: "12px 20px"` (`OpenBrain.jsx:105`), `SuggestionsView` question card = `padding: "20px 18px"` (`SuggestionsView.jsx:285`). All visually similar card shapes have different internal spacing.
- The stats row in `SuggestionsView.jsx` uses `padding: "8px 10px"` (`line 277`) while the stats row in `OpenBrain.jsx` (main grid) uses `padding: "14px 12px"` (`line 933`), and `RefineView.jsx` stats use `padding: "10px 6px"` (`line 291`). Identical component patterns, three different padding values.
- `QuickCapture` (`OpenBrain.jsx:425`) uses `padding: "0 24px 16px"` — the bottom padding of 16px creates a misalignment with the `padding: 20` of the main content area below it.
- No `max-width` on the main app container. On a 1440px desktop the content stretches to full width, making the grid uncomfortable to read at that span.

---

### Pillar 4: Component Quality & Reuse (4/10)

**Strengths:**
- `ThemeContext.jsx` is a well-implemented design token system and is used correctly in most components.
- The `btn()` style factory function in `OnboardingModal.jsx` (`lines 167–180`) is an attempt at button pattern reuse within that file.
- Lazy loading with `React.lazy` and `Suspense` for all view components is good practice.
- `UndoToast`, `NudgeBanner`, `PreviewModal`, `EntryCard` are extracted as named components within `OpenBrain.jsx`, showing some awareness of component boundaries.

**Issues:**
- The button pattern is independently reinvented in every file:
  - `OnboardingModal.jsx` has `btn(primary, danger)` factory function (line 167)
  - `SuggestionsView.jsx` has its own inline button styles (lines 301–343)
  - `RefineView.jsx` has its own inline button styles (lines 394–464)
  - `OpenBrain.jsx` has multiple local button style patterns in `QuickCapture`, `SettingsView`, `EntryCard`, and the main chat area
  - `LoginScreen.jsx` has its own button styles (lines 57–69, 93–113)
  - No shared `<Button>` component exists
- Image upload logic (FileReader → base64 → Anthropic API) is copy-pasted identically in three locations: `OnboardingModal.jsx:85–112`, `SuggestionsView.jsx:130–159`, and `QuickCapture` in `OpenBrain.jsx:297–310`. This is 60+ lines of identical async logic triplicated.
- The stats row pattern (array of `{l, v, c}` mapped to small stat cards) appears four times: `SuggestionsView.jsx:288`, `RefineView.jsx:285`, and twice in `OpenBrain.jsx:932`. All four render differently (different padding, border, font sizes).
- The "empty state" pattern (`No memories match.` at `OpenBrain.jsx:936`, `No suppliers yet…` at `OpenBrain.jsx:198`) is an ad hoc `<p>` tag with `color: "#555"` each time, not a shared `EmptyState` component.
- The `BRAIN_META` lookup object is defined twice: once as `BRAIN_META` in `SuggestionsView.jsx:15–19` and again as `BRAIN_META_QC` in `OpenBrain.jsx:264–268` with identical structure.

---

### Pillar 5: Mobile / PWA Responsiveness (6/10)

**Strengths:**
- The `overflowX: auto; scrollbarWidth: none` pattern on the nav and filter chip rows prevents layout break on narrow screens.
- `boxSizing: "border-box"` is consistently applied to inputs and textareas, preventing overflow issues.
- The `maxWidth: 440` constraint on `OnboardingModal` card is appropriate and will centre nicely on tablets.
- `flexWrap: "wrap"` on tag rows and brain selector chips prevents overflow.
- Voice capture (`SpeechRecognition`) and camera upload are implemented, enhancing the mobile experience.
- The app appears to be a functional PWA (entries are cached in localStorage, offline queue implemented).

**Issues:**
- Nav overflow has no scroll affordance. Nine items at `minWidth: 72px` requires 648px. On 375px iPhone the last ~4 items are invisible with no visual cue that the bar scrolls. (`OpenBrain.jsx:906–913`)
- `VirtualGrid` COLS: `window.innerWidth >= 640 ? 2 : 1` is evaluated once at render. Orientation change from portrait to landscape (e.g., 375px → 812px) will not trigger re-evaluation. (`OpenBrain.jsx:561`)
- Chat height `calc(100vh - 260px)` (`OpenBrain.jsx:948`) is fragile. On iOS with dynamic toolbar the viewport changes as the user scrolls, causing the chat to resize unexpectedly. `100dvh` should be used instead.
- The `PreviewModal` renders as a bottom sheet on mobile (correct pattern: `alignItems: "flex-end"`, `borderRadius: "20px 20px 0 0"`), but the QuickCapture bar sits above it and the keyboard will push the bottom sheet up unpredictably on iOS without a `env(safe-area-inset-bottom)` padding applied.
- `LoginScreen` hero padding is `padding: "60px 24px 0"` (`LoginScreen.jsx:40`). On very small screens (320px width, SE-class devices) the 2-column feature grid (`gridTemplateColumns: "1fr 1fr"`) at `LoginScreen.jsx:133` will compress card content to ~136px per column, making the 12px description text very tight.
- No `viewport` meta tag check was possible (no access to `index.html`), but the app should include `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` for safe-area support.

---

### Pillar 6: Accessibility & Interaction Feedback (5/10)

**Strengths:**
- Buttons have `cursor: "pointer"` when active and `cursor: "default"` when disabled — correct cursor feedback.
- Disabled states are implemented on all primary CTAs (gradient removed, colour faded, `cursor: default`).
- Loading states are present throughout: `"Sending…"`, `"Saving..."`, `"Reading photo…"`, `"Analyzing…"`.
- `autoFocus` on text inputs when forms expand (`LoginScreen.jsx:84`, `OnboardingModal.jsx:319`) reduces friction.
- The undo toast system with a progress bar is excellent UX for destructive operations.
- `aria-label` is present on the theme toggle button (`title` attribute, `OpenBrain.jsx:874`).
- Outside-click close on `BrainSwitcher` dropdown is correctly implemented (`BrainSwitcher.jsx:14–19`).

**Issues:**
- No `focus-visible` ring anywhere in the application. There is no global CSS file visible in the source tree that would add `:focus-visible` styles. Keyboard-only navigation is effectively unusable.
- `alert()` for save errors at `OpenBrain.jsx:770`: `alert(\`Save failed: ${e.message}\`)`. This is a jarring, inaccessible pattern. Screen readers announce it differently across platforms; it cannot be styled; it blocks page interaction.
- Icon-only buttons without `aria-label`:
  - Camera button `📷` in `QuickCapture` (`OpenBrain.jsx:449`): has no `aria-label`
  - Camera button `📷` in `SuggestionsView.jsx:343`: has `title="Upload photo"` only
  - Camera button `📷` in `OnboardingModal.jsx:324`: has `title="Take photo or upload"` only
  - Close `✕` in `NudgeBanner` (`OpenBrain.jsx:125`): no `aria-label`
  - Close `✕` in `PreviewModal` (`OpenBrain.jsx:148`): no `aria-label`
  - Delete `×` in `BrainItem` (`BrainSwitcher.jsx:178–186`): has `title="Delete brain"` only
- The onboarding "Skip all" affordance is styled as a faint underlined link (`fontSize: 11, color: t.textFaint, textDecoration: "underline"`) at `OnboardingModal.jsx:337–341`. It is a `<button>` element, which is correct semantically, but its visual presentation makes it nearly invisible — contrast ratio of `t.textFaint` (#555 on #1a1a2e) is approximately 3.5:1, below the WCAG AA 4.5:1 requirement for small text.
- Error states in `RefineView.jsx`: `applyEntry` and `applyLink` both have empty `catch {}` blocks (`lines 177, 200`). If an API call fails, nothing is shown to the user. The suggestion card disappears (it is added to `dismissed`) but without any confirmation that the operation succeeded or failed.
- The `Loader` component at `OpenBrain.jsx:19–22` (`"Loading…"` text in a `<div>`) has no accessible role or `aria-live` region. Screen readers will not announce it when it appears dynamically.
- `chatInput` submit button in `OpenBrain.jsx` (not shown in the excerpt but implied by the chat UI) and the Enter key handler at `OpenBrain.jsx:443` (`onKeyDown={e => e.key === "Enter" && !e.shiftKey && capture()}`) — no notification to screen readers that a message was sent or a response received. The chat messages list should have `aria-live="polite"`.

---

## Files Audited

| File | Lines Read |
|------|-----------|
| `src/ThemeContext.jsx` | 1–55 (complete) |
| `src/LoginScreen.jsx` | 1–157 (complete) |
| `src/OpenBrain.jsx` | 1–120, 120–320, 320–520, 520–770, 770–970 |
| `src/components/OnboardingModal.jsx` | 1–397 (complete) |
| `src/components/BrainSwitcher.jsx` | 1–192 (complete) |
| `src/views/SuggestionsView.jsx` | 1–372 (complete) |
| `src/views/RefineView.jsx` | 1–474 (complete) |

**Files not audited (not available / not found):**
- `src/views/CalendarView.jsx`
- `src/views/TodoView.jsx`
- `src/views/GraphView.jsx`
- `src/views/DetailModal.jsx`
- `src/data/constants.js` / `src/data/suggestions.js`
- `index.html` (viewport meta, PWA manifest)
- `src/lib/authFetch.js`, `src/lib/offlineQueue.js`
- `src/hooks/useBrain.js`, `src/hooks/useOfflineSync.js`
