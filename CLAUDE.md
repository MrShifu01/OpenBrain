# CLAUDE.md

> **❌ NEVER USE SUPERPOWERS SKILLS.**
> Do not invoke the `superpowers:*` skill family — no `superpowers:brainstorming`, no `superpowers:writing-plans`, no `superpowers:code-reviewer`, no design-doc spec gates, no "let me ask one clarifying question at a time" loops.
> When the user asks to tackle a feature, propose a concise design inline (multiple-choice or short bullets), confirm decisions in the same turn or two, then implement. No `docs/superpowers/specs/` writes. No HARD-GATE language. Just build.
> The only exception is if the user explicitly types `/superpowers` or names a superpowers skill — then it's user-invoked and fine.

> **🚀 SINGLE SOURCE OF TRUTH — `EverionMindLaunch/` (shorthand: `EML`)**
> The canonical, be-all-end-all knowledge base for **pre-launch, launch, and post-launch** tasks, considerations, decisions, direction, research, strategy, and architecture reference. When the user says "EML" they mean this folder — treat it as `EverionMindLaunch/` everywhere. Six core docs:
> - **`LAUNCH_CHECKLIST.md`** — active to-do (P0/P1/P2 tiered)
> - **`ROADMAP.md`** — 21-day sprint + 12-month timeline
> - **`STRATEGY.md`** — positioning, moat, viral mechanics
> - **`RESEARCH.md`** — competitor matrix, market evidence, MVP principles
> - **`BRAINSTORM.md`** — priority-scored idea park
> - **`IMPORTS_SPEC.md`** — mass + continuous import architecture
> - **`architecture/*.md`** — reference docs for cross-cutting components (auth, capture, cron, enrich, gmail, bell)
>
> Always:
> - **Add** new items to the right doc (checklist for now, roadmap for next, brainstorm for someday)
> - **Edit** existing items when scope or status changes
> - **Audit** here when verifying status (`git log` / file checks must reconcile against these files)
> - **Confirm** decisions here — once locked, they land as a `[x]` item or a "Decided YYYY-MM-DD:" block
>
> Browse at `http://localhost:5174` via `node EverionMindLaunch/server.mjs` (live-syncs both directions: edit a `.md`, dashboard updates; tick a checkbox, `.md` updates). README in the same folder explains how the docs fit together.
> If a launch-related task isn't here, it doesn't exist. Move it in before working on it.
>
> **Audit drop-in:** any `.md` in `EML/Audits/` is auto-discovered by the dashboard (no server edit needed). Title comes from the file's first `# H1`; sort is mtime-desc.
>
> **Audit address-and-archive workflow** (when the user asks to address an audit):
> 1. Read the audit file end-to-end.
> 2. Address each finding — code changes, commits, follow-up specs.
> 3. For findings you do NOT address in this pass, lift them into `EML/LAUNCH_CHECKLIST.md` under the right priority tier with a traceability tag like `(from EML/Audits/<file>, finding #N)`.
> 4. Prepend a `## Resolution — YYYY-MM-DD` section to the audit summarizing: addressed (with commit SHAs), deferred (with checklist links), wontfix (with reason).
> 5. `git mv EML/Audits/<file>.md EML/Audits/archive/<file>.md`
> 6. Commit: `chore(EML): archive Audits/<file> — addressed in <commits>, deferred N items to checklist`.
>
> The dashboard then drops the audit out of the active "Audits" group into "Audit Archive" (muted, bottom of library) on the next 2.5s poll. Nothing is deleted; the file + git history stay intact for future reference.

> **DEFAULT RESPONSE STYLE: caveman skill, full intensity.**
> All user-facing prose in this project follows the `caveman` skill (full mode by default). Drop articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/of course/happy to), and hedging. Fragments OK. Short synonyms (fix not "implement a solution for"). **Code blocks, file paths, and exact error strings stay verbatim — never compress those.** Switch to lite only if user asks; switch off only on explicit request.
> Skill lives at `~/.claude/plugins/cache/caveman/.../skills/caveman/SKILL.md`. Invoke `/caveman lite|full|ultra` to change intensity mid-session.

> **HARD LIMIT — Vercel Hobby plan: max 12 serverless functions.**
> The project is at exactly 12 `api/*.ts` files — the maximum allowed.
> **Never create a new top-level file in `api/` without first consolidating an existing endpoint.**
> Route new actions through an existing handler using `?resource=` or `?action=` query params instead.
> Current functions (12): calendar, capture, entries, feedback, gmail, llm, mcp, memory-api, search, transfer, user-data, v1

> **DESIGN PHILOSOPHY — never use OS-native UI. Ever.**
> No `window.confirm`, `window.alert`, `window.prompt`. No native browser/OS toast or notification dialogs. No native `<select>` chevron (kill it with `appearance:none` and add a custom SVG). No default browser date/file pickers visible — wrap or restyle. No raw `alert()`, `confirm()`, `prompt()` anywhere. Build inline custom UI using the project's design tokens (`--ember`, `--ink`, `--ink-soft`, `--surface`, `--line-soft`, `--moss`, `--danger`) and existing components (`Chip`, `SmallBtn`, inline panels like `ScheduleInline`). Pill-shaped (radius 999), 28px height, 12px font, 600 weight, `press` class for tap feedback. Match the look of what already ships in the file. **If you need a confirm, build an inline panel inside the existing menu/sheet — never reach for `window.confirm`.**

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Self-Debugging Access

When the user reports an error or asks to investigate a problem, use these resources directly before asking for more details.

### Supabase (project: `wfvoqpdfzkqnenzjxhui`)

Use `mcp__claude_ai_Supabase__*` tools:

- **SQL queries**: `execute_sql` — check schema, row counts, RLS policies, missing columns
- **API logs** (last 24h): `get_logs` with `service: "api"` — see all HTTP calls including failed PostgREST queries, auth failures, 4xx/5xx errors
- **Auth logs**: `get_logs` with `service: "auth"`
- **Postgres logs**: `get_logs` with `service: "postgres"`
- **Apply migrations**: `apply_migration` for DDL changes

Key facts:

- Service role key bypasses RLS; Vercel functions use it (node user-agent in logs)
- Browser SDK calls show as iPhone/Chrome Safari user-agents
- `entry_brains` table does NOT exist — errors from it are expected/silent
- `audit_log` is live as of migration 057 (2026-04-28) — security-relevant actions persist. Service-role insert only; users can read their own rows via RLS.
- `user_usage` has no row for new billing periods → 406 on `.single()` (fixed with `.maybeSingle()`)

## AI provider in use

**This project runs on Gemini, not Anthropic.** `GEMINI_API_KEY` is the active provider key (used for embeddings, enrichment, chat, classification). The Anthropic key is not yet valid — do not assume `ANTHROPIC_API_KEY` is configured, do not recommend setting it, and do not gate features on it. If a code path checks `ANTHROPIC_API_KEY` and it's blocking behaviour the user reports as broken, the fix is to switch the gate to Gemini, not to ask the user to add an Anthropic key.

### Vercel

Use `mcp__plugin_vercel_vercel__authenticate` to start OAuth if not already authenticated.

- Function logs show errors from serverless functions
- 12-function hard limit — never add a new `api/*.ts` file
- Rewrites in `vercel.json` map `/api/brains` → `/api/user-data?resource=brains`, etc.

### GitHub

Use `Bash` with `gh` CLI:

- `gh run list` — recent CI runs
- `gh run view <id>` — check failed steps
- `gh pr list` / `gh pr view` — PRs

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:

- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
