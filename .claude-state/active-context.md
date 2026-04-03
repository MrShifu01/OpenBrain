# Active Context — 2026-04-03
**Branch:** main | **Enhancement:** Level 4 (post-audit) | **Project:** OpenBrain

## Session Summary
Extended the Telegram bot integration to call OpenRouter for AI-powered brain queries, with full multi-tenant support — each user's own OpenRouter key and model is used when available. Also made all AI features (Fill Brain, Refine, image upload) respect the user's provider/model settings instead of hardcoding Anthropic. Created an AI-models.md roadmap for per-task model selection.

## Built This Session
- `supabase/functions/telegram-webhook/index.ts` — rewrote: uses BOT_TOKEN env correctly, queries `messaging_connections` to find linked user, fetches brain entries + user_memory as context, calls OpenRouter, sends AI reply
- `supabase/functions/telegram-webhook/deno.json` — added `@supabase/supabase-js` import
- `supabase/migrations/006_user_ai_settings.sql` — new table: `user_ai_settings(user_id, openrouter_key, openrouter_model)`
- `src/OpenBrain.jsx` — `saveOrKey`/`saveOrModel` upsert to `user_ai_settings` DB; `TelegramPanel` rewritten with step-by-step instructions
- `src/lib/ai.js` — added `normalizeMessages()` for Anthropic→OpenAI image block conversion; wired into `callAI()`
- `src/views/RefineView.jsx` — replaced hardcoded `/api/anthropic` calls with `callAI()`
- `src/views/SuggestionsView.jsx` — all three AI calls replaced with `callAI()`
- `AI-models.md` — 4-phase roadmap for per-task model selection

## Current State
- **Build is broken** — merge conflicts in 3 files: `src/OpenBrain.jsx`, `src/views/RefineView.jsx`, `src/views/SuggestionsView.jsx`
- `src/lib/ai.js` and `src/lib/aiFetch.js` are cleanly staged
- Migrations 006 and 007 exist as untracked files (007 added outside this session)
- `supabase/config.toml` and `supabase/functions/` are untracked

## In-Flight Work
- Merge conflicts in 3 files must be resolved — upstream uses `src/config/prompts.js` (`PROMPTS.*`), stash uses inline strings; stash also adds `task:` params to `callAI()` which must be kept
- Check if `src/config/prompts.js` exists before resolving

## Known Issues
- ⚠️ Merge conflicts — app will not build until resolved
- ⚠️ Migration 007 exists untracked but Phase 1 AI-models helpers not written yet
- ⚠️ BOT_TOKEN was hardcoded in old edge function URL — now fixed, but secret must be set in Supabase

## Pipeline State
- **Last pipeline:** feature — 2026-04-03
- **Last scores:** security: 133 issues addressed (b64a699)
- **Open incidents:** none
