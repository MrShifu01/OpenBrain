# Next Steps — 2026-04-03

## Immediate (do first)
1. **Resolve merge conflicts** — three files have git conflict markers and will not build:
   - `src/OpenBrain.jsx` — check if `src/config/prompts.js` exists; if yes, use `PROMPTS.*` constants and remove inline system strings; if not, keep inline strings and drop the `PROMPTS` import
   - `src/views/RefineView.jsx` — same: choose between `PROMPTS.ENTRY_AUDIT` / `PROMPTS.LINK_DISCOVERY` or inline `ENTRY_SYSTEM` / `LINK_SYSTEM`
   - `src/views/SuggestionsView.jsx` — choose between `PROMPTS.FILL_BRAIN` / `PROMPTS.QA_PARSE` or inline system strings
   - In all three files, the stashed changes also add `task: "questions"` / `task: "vision"` / `task: "capture"` / `task: "refine"` params to `callAI()` — keep those regardless of which branch wins
2. **Run migration 006** — Apply `supabase/migrations/006_user_ai_settings.sql` in the Supabase SQL editor (project `wfvoqpdfzkqnenzjxhui`). Creates `user_ai_settings` table.
3. **Add OPENROUTER_API_KEY secret** — Supabase dashboard → Project Settings → Edge Functions → Secrets → add `OPENROUTER_API_KEY` (the shared fallback key for users without their own)
4. **Deploy edge function** — `supabase functions deploy telegram-webhook`

## Soon (this milestone)
- **Implement AI-models.md Phase 1** — `supabase/migrations/007_task_models.sql` (add per-task model columns), `getModelForTask()` / `setModelForTask()` helpers in `src/lib/aiFetch.js`, `loadTaskModels()` on app startup
- **Implement AI-models.md Phase 2** — add `task` param to all `callAI()` call sites in `src/OpenBrain.jsx` (capture, chat, links, nudge) and update Telegram edge function to read `model_chat`
- **Implement AI-models.md Phase 3** — per-task model pickers in settings UI (collapsible, OpenRouter-only)
- **Apply migrations 001–005** — if not already applied; 001 must precede 002
- **Fix QuickCapture offline path** — `src/OpenBrain.jsx` QuickCapture offline branch missing `p_brain_id` in `enqueue()` body
- **Delete SupplierPanel dead code** — `src/OpenBrain.jsx` still has SupplierPanel component + `{view === "suppliers" && ...}` render with no nav tab

## Deferred
- AI-models.md Phase 4 (Voice/Whisper) — separate transcription API, new `/api/transcribe` route, needs OpenAI key, separate from OpenRouter
- Metadata editing in DetailModal (`metadata.due_date`, `metadata.day_of_week`) — `src/views/DetailModal.jsx`
- Wire GraphView + CalendarView to live entries — both still use `INITIAL_ENTRIES` static data
- TodoView DB sync — currently localStorage-only (`src/views/TodoView.jsx`)
- Activity log UI — `api/activity.js` exists, no frontend
- Invite-accept frontend flow (URL token handling)
- Replace in-memory rate limiter with Upstash Redis — `api/_lib/rateLimit.js`

## Warnings
- ⚠️ **Build is broken** — merge conflicts in 3 files must be resolved before anything works
- ⚠️ `src/config/prompts.js` — upstream branch references this file (`import { PROMPTS } from "../config/prompts"`). Check if it exists before resolving conflicts. If missing, the inline system strings in the stashed version are the correct source of truth.
- ⚠️ Migration 001 must be applied BEFORE 002 — 002 references tables from 001
- ⚠️ Migration 003 personal brain trigger — confirm it is applied in Supabase, not just in the repo
- ⚠️ `user_ai_settings` only stores `openrouter_key` and `openrouter_model` right now (migration 006). Per-task columns (`model_capture`, `model_questions` etc.) are in migration 007 but that migration is untracked and Phase 1 helpers are not written yet.
