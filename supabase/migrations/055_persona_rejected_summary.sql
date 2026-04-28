-- ─────────────────────────────────────────────────────────────────────────────
-- 055_persona_rejected_summary.sql
--
-- Adds a distilled summary of the user's rejected-fact pool to user_personas.
-- The full rejected list grows unbounded as the user marks more facts "Not me",
-- and stuffing all of them into the extractor prompt eats tokens fast. Instead
-- we keep ~5 most-recent specific rejections in the prompt for concreteness +
-- this distilled summary (5-10 short skip rules) for long-term pattern memory.
--
-- Refreshed weekly by runPersonaWeeklyPass + on-demand from the admin debug
-- panel. Plain text; the LLM produces a bulletted markdown list.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.user_personas
  add column if not exists rejected_summary text,
  add column if not exists rejected_summary_updated_at timestamptz;
