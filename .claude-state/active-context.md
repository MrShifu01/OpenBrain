# Active Context — 2026-04-03
**Branch:** main | **Enhancement:** Phase 1+2 | **Project:** OpenBrain

## Session Summary
Built Phase 1 (Business Shared Brain) and Phase 2 (Platform Onboarding). Added brain types (family/business), multi-brain entry assignment via entry_brains junction table, brain-specific Fill Brain questions, Refine owner gate for shared brain members, 3-step onboarding wizard, and enhanced landing page.

## Built This Session
- `supabase/migrations/002_brain_types.sql` — type expansion to family/business, entry_brains junction, brain_activity, brain_settings, get_entries_for_brain RPC
- `api/brains.js` — POST accepts {type: "family"|"business"}
- `api/capture.js` — p_extra_brain_ids[] multi-brain capture → inserts entry_brains rows
- `api/entries.js` — uses get_entries_for_brain RPC with direct-query fallback
- `api/activity.js` — new activity log endpoint
- `src/components/CreateBrainModal.jsx` — type selector cards (Family 🏠 / Business 🏪)
- `src/components/BrainSwitcher.jsx` — type-aware icons 🧠/🏠/🏪
- `src/components/OnboardingModal.jsx` — new 3-step first-login wizard
- `src/views/SuggestionsView.jsx` — brain selector chips, per-brain question sets, per-brain localStorage keys
- `src/views/RefineView.jsx` — owner gate: non-owners see locked message
- `src/data/suggestions.js` — FAMILY_SUGGESTIONS + BUSINESS_SUGGESTIONS added
- `src/hooks/useBrain.js` — createBrain(name, type)
- `src/LoginScreen.jsx` — hero landing page with feature grid
- `src/OpenBrain.jsx` — OnboardingModal, multi-brain QuickCapture chips, props wired to views

## Current State
- All code written and staged but NOT committed
- migration 002 NOT yet applied to Supabase
- migration 001 status still unknown — may not be applied

## In-Flight Work
- Commit pending for all session changes
- migration 002 needs applying before brain type features work in production

## Known Issues
- ⚠️ get_entries_for_brain uses DISTINCT ON in UNION — test in Supabase SQL editor; may need CTE rewrite
- ⚠️ QuickCapture offline path omits p_brain_id (minor — stores locally)
- ⚠️ migration 001 + 002 both need applying

## Pipeline State
- **Last pipeline:** feature — 2026-04-03
- **Last scores:** composite 90/100 (Security 92, Architecture 90, Correctness 88, Maintainability 88)
- **Open incidents:** none
