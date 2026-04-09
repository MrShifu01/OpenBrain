# User Concern Sprint Plan

Phases ordered by: user impact, implementation risk, and dependency chain.
Each phase is shippable independently.

---

## Phase 1 — Stop the Bleeding (Critical)
**Goal**: Make the app usable without friction or silent failure.

### 1A. Graceful AI Degradation
**Concerns**: #3
**Why**: Silent failures destroy trust. Users capture data expecting it to be parsed — nothing happens, no explanation. This is the #1 abandonment trigger for new users.
- Show clear "AI not configured" state in Capture, Refine, Chat, Nudges
- Store raw text when no AI key is present — don't discard
- Single banner/callout: "Add an AI key in Settings → Intelligence to unlock smart features"

### 1B. Onboarding Radical Simplification
**Concerns**: #2
**Why**: 30 structured questions before users see the app is a wall. Most users want to explore before committing. Every extra step pre-value = churn.
- Replace multi-step modal with: Name + use case (2 fields max), then straight to the app
- Move all "brain filling" questions into SuggestionsView — opt-in, not gating
- Kill `OnboardingChecklist.tsx` and `BrainTipCard.tsx` or defer post-value
- Remove SA-specific format assumptions (phone regex, tax/insurance fields)

### 1C. Consolidate Capture to One Entry Point
**Concerns**: #1, #14
**Why**: Three capture flows doing the same thing confuses users and bloats the codebase. Users don't know which to use; developers maintain three copies of the same logic.
- Merge QuickCapture + CaptureSheet (FAB) into one unified Capture flow
- SuggestionsView becomes a "discover what to capture" helper, not a capture mode
- Shared parse/voice/upload logic extracted into single service — already started in P1 refactor hooks

---

## Phase 2 — Surface the Good Stuff (High Impact)
**Goal**: Make powerful features discoverable and approachable.

### 2A. Cmd+K Omnisearch
**Concerns**: #8
**Why**: Search trapped in Grid means users in Chat or Todos can't find anything. Omnisearch is table-stakes UX for a knowledge app.
- Global keyboard shortcut + mobile tap target
- Search across all views; surface type/date/tag filters inline
- Expose `searchAllBrains` as a toggle in search UI, not hidden

### 2B. Refine → "Fix Issues" with Badge
**Concerns**: #7
**Why**: Refine is the AI's most useful background work — finding type mismatches, stale entries, split/merge candidates. Calling it "Refine" and hiding it means it's never used.
- Rename nav item to "Fix Issues" or "Review"
- Show badge/count when suggestions exist
- Proactive nudge: "3 entries need attention"

### 2C. Settings Reorder + Default Tab Fix
**Concerns**: #9
**Why**: Landing on "Intelligence" (BYO API keys) as the default tab is hostile to new users who haven't configured AI yet. Low-effort win.
- Default tab → "Account"
- Group tabs: **Personal** (Account, Brain) → **Features** (Intelligence, Notifications) → **Advanced** (Storage, Danger)
- Surface "Recommended setup" path in Intelligence tab

### 2D. AI Settings Simplification
**Concerns**: #4
**Why**: 5+ independent model selectors overwhelm users who just want the thing to work. Most users should never see model selection.
- Add "Simple mode": one provider, one key, one recommended model
- Hide per-task model selection behind "Advanced" toggle
- Highlight the recommended path (e.g., Anthropic Claude for best results)

---

## Phase 3 — Reduce Complexity (Medium)
**Goal**: Cut cognitive load from systems that are over-engineered for most users.

### 3A. Mobile Nav Restructure
**Concerns**: #10
**Why**: Core features buried 2–3 taps deep on mobile. Todos not in nav at all. Users shouldn't have to hunt for primary functionality.
- Bottom nav: Home / Capture / Fix Issues / Todos / More
- Vault and Settings stay in More
- Brain switcher moves into More or Account settings

### 3B. Entry Type Constraints
**Concerns**: #11
**Why**: Unbounded string types → "person" ≠ "Contact" → broken filters, missing icons, polluted search. Types should be a controlled vocabulary with AI guided to use it.
- Define canonical type list in `src/types.ts` (person, note, task, document, event, health, finance, other)
- Constrain AI prompt to output only canonical types
- Migration: normalize existing entries to canonical types

### 3C. Detail Modal Cleanup
**Concerns**: #12
**Why**: One modal doing view + edit + delete + share + relationships + secret reveal = jank and cognitive overload. Async brain loading causes visible jank.
- Separate view and edit modes clearly
- Eager-load `entry_brains` or show skeleton — no layout shift
- Move "share to brain" into a dedicated sheet, not inline

### 3D. Nudge Persistence Fix
**Concerns**: #13
**Why**: Dismissing a nudge only to have it reappear on refresh is broken UX. Users learn to ignore it.
- Persist dismiss state in DB/localStorage keyed to nudge ID, not sessionStorage
- Surface as a persistent badge/indicator, not a dismissible banner

### 3E. Vault as Opt-In
**Concerns**: #6
**Why**: 3-layer auth for a feature most new users don't need. Vault setup early in the journey adds friction without value.
- Remove Vault from primary nav for new users
- Surface in Settings → Advanced after account is established
- PIN gate mid-chat: replace with session-level unlock (not per-query)

### 3F. Offline Noise Reduction
**Concerns**: #16
**Why**: Constant sync status creates visual anxiety. Sync should be invisible unless broken.
- Show sync status only on failure
- Replace ambient indicator with a subtle icon that turns red on error only

### 3G. Workspace Filter Exposure
**Concerns**: #15
**Why**: If workspace filter exists it should be usable. If it overlaps too heavily with brains, remove it — having both is confusing.
- Audit overlap with brain system; if redundant, deprecate workspace filter
- If kept, expose as a visible toggle in nav or header

---

## Phase 4 — Polish & Trust (Low)
**Goal**: Close gaps that signal "unfinished" to users.

### 4A. Data Export
**Concerns**: #17
**Why**: No export = lock-in perception. Users need to trust their data can leave. Also a legal/GDPR consideration.
- JSON export of all entries (full fidelity)
- CSV export for spreadsheet users
- vCard export for person-type entries
- Add to Settings → Storage

### 4B. Duplicate Detection Surfacing
**Concerns**: #18
**Why**: Logic is built but disconnected. Users unknowingly create duplicates; search pollutes.
- Wire `duplicateDetection.ts` into Capture flow — warn before saving
- Surface duplicates in Fix Issues view

### 4C. Learning Engine Transparency
**Concerns**: #19
**Why**: Hidden ML feedback loop = trust issue. Users should know their actions are training suggestions.
- Add "Learning" section to Intelligence tab
- Show: "You've accepted X suggestions, rejected Y. Your preferences shape future suggestions."
- Add reset button

### 4D. Todos to Primary Nav
**Concerns**: #21
**Why**: 420 lines of sophisticated deadline tracking hidden in "More". Todos are a core feature, not a buried extra.
- Add Todos to bottom nav (replace or merge with a nav slot)
- Surface deadline-inferred entries with explanation: "We found a deadline in this entry"

### 4E. Error Message Standardisation
**Concerns**: #22
**Why**: Inconsistent errors (toasts vs inline vs modal vs console) = unpredictable UX. Technical messages erode trust.
- Single error pattern: what went wrong + what to do next
- Translate HTTP errors to plain language
- Decide: toast for transient, inline for form, modal only for destructive confirm

### 4F. Notification Settings Completion
**Concerns**: #20
**Why**: Half-built settings tab signals abandonment. Either complete it or remove it.
- List all notification types with description + channel + on/off
- Add "Send test notification" button
- If not ready to ship: remove tab, add back when complete

### 4G. Cache Invalidation Fix
**Concerns**: #24
**Why**: Edits looking unsaved destroys confidence in the app. Stale data after brain switch is a bug, not a polish issue.
- Audit `entriesCache.ts`, `SearchIndex`, localStorage for stale-on-write scenarios
- Invalidate on mutation, not on timer
- Brain switch: flush stale state before rendering new brain

---

## Execution Order Summary

| Phase | Theme | Effort | Impact |
|-------|-------|--------|--------|
| 1 — Stop the Bleeding | Onboarding, AI fallback, capture consolidation | High | Critical |
| 2 — Surface the Good | Search, Refine, Settings, AI setup | Medium | High |
| 3 — Reduce Complexity | Nav, types, modal, nudge, vault, sync | Medium | Medium |
| 4 — Polish & Trust | Export, duplicates, learning, todos, errors, cache | Low-Medium | Low-Medium |

Ship Phase 1 before anything else. It unblocks user retention. Phases 2–4 can run in parallel across concerns if bandwidth allows.
