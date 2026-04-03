# Active Context — 2026-04-03
**Branch:** main | **Enhancement:** — | **Project:** OpenBrain

## Session Summary
Designed and implemented brain onboarding improvements: a Supabase trigger that auto-creates a personal brain for every new user on signup, and a post-creation tip card that appears after creating a family or business brain. Also fixed a silent double-create bug in BrainSwitcher where the brain object was being passed as `name` to `useBrain.createBrain()`.

## Built This Session
- `supabase/migrations/003_personal_brain_trigger.sql` — trigger + function to auto-create "My Brain" on auth.users insert
- `src/components/BrainTipCard.jsx` — new tip card with family/business-specific first-fill suggestions
- `api/brains.js` — added "personal" to validTypes (line 73)
- `src/components/BrainSwitcher.jsx` — fixed onCreate to correctly receive (brain, brainType), added onBrainTip prop
- `src/OpenBrain.jsx` — added showBrainTip state, destructured refresh from useBrain, wired BrainTipCard render
- `docs/superpowers/specs/2026-04-03-brain-onboarding-design.md` — design spec committed

## Current State
- Session work committed and clean (2 commits ahead of origin/main, not yet pushed)
- Uncommitted changes exist from PRIOR sessions: `api/update-entry.js`, `future-plans.md`, `src/components/OnboardingModal.jsx`, `src/views/SuggestionsView.jsx`, `supabase/migrations/001_brains.sql`
- Untracked from prior sessions: `.smashOS/audits/`, `openbrain-fill-your-brain.md`, `openbrain-onboarding-30.md`
- Migration 003 written but NOT yet applied to Supabase

## In-Flight Work
- Migration 003 must be applied in Supabase SQL editor before personal brain trigger is live
- Prior session uncommitted files need review before staging (do not blindly stage)

## Known Issues
- ⚠️ Verify `"suggest"` is the correct view ID for Fill Brain in `src/OpenBrain.jsx` navViews — BrainTipCard "Start filling →" calls `setView("suggest")`
- Prior sessions' uncommitted files (OnboardingModal.jsx, SuggestionsView.jsx, update-entry.js) need review

## Pipeline State
- **Last pipeline:** feature — 2026-04-03
- **Last scores:** composite 90/100 (Security 92, Architecture 90, Correctness 88, Maintainability 88)
- **Open incidents:** none
