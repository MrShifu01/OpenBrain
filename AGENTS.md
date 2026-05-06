# Repository Guidelines

## Project Structure & Module Organization

Everion is a React 19 + TypeScript + Vite PWA with Vercel Functions and Supabase.

- `src/` contains the frontend: `components/`, `views/`, `hooks/`, `lib/`, `context/`, and `src/design/`.
- `api/` contains Vercel serverless functions. Keep shared backend helpers in `api/_lib/`.
- `tests/` contains Vitest tests; `e2e/` contains Playwright specs.
- `public/`, `assets/`, and `icons/` hold static assets.
- `supabase/` holds database migrations and related SQL.
- `EverionMindLaunch/` (`EML`) is the launch knowledge base and source of truth for launch work.

## EverionMindLaunch Operating Rules

Treat `EverionMindLaunch/` as canonical for pre-launch, launch, and post-launch planning. Its core docs are `LAUNCH_CHECKLIST.md`, `ROADMAP.md`, `STRATEGY.md`, `RESEARCH.md`, `BRAINSTORM.md`, `IMPORTS_SPEC.md`, and `architecture/*.md`.

- New launch tasks go into `LAUNCH_CHECKLIST.md`.
- Future milestones go into `ROADMAP.md`.
- Ideas go into `BRAINSTORM.md`.
- Architecture references go into `architecture/`.
- Audits go into `Audits/`; any `.md` there is auto-discovered by the dashboard from its first `# H1`.

Run the dashboard with `npm run eml`, then open `http://localhost:5174`.

## Build, Test, and Development Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Production build + PWA service worker
npm run preview      # Preview dist locally
npm run eml          # Launch EverionMindLaunch dashboard
npm run typecheck    # TypeScript check
npm run lint         # ESLint, max 73 warnings
npm run test         # Vitest suite
npm run test:e2e     # Playwright suite
npm run knip         # Unused file/export scan
npm run lighthouse   # Mobile + desktop Lighthouse audit
```

Use `.env.example` for required local variables.

## Coding Style & Naming Conventions

Use TypeScript, React function components, and existing local patterns before adding abstractions. Keep changes surgical. Prettier is configured via `.prettierrc`; run `npm run format`. Components and views use PascalCase filenames, hooks use `useSomething.ts`, and utilities in `src/lib/` use camelCase.

Never add a new top-level `api/*.ts` casually: the project is at the Vercel Hobby 12-function limit. Route new API behavior through existing handlers using `?resource=` or `?action=`.

Never use native browser UI (`alert`, `confirm`, `prompt`, unstyled selects/date/file inputs). Build inline custom UI with existing components and design tokens such as `--ember`, `--ink`, `--surface`, `--line-soft`, `--moss`, and `--danger`.

## Testing Guidelines

Vitest is the unit/integration runner with jsdom. Playwright covers browser regressions and accessibility-sensitive flows. Name tests after the behavior being protected. Before release-facing changes, run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Run `npm run test:e2e` for UI, auth, PWA, dialog, or routing changes.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commits: `feat(EML): ...`, `fix(a11y): ...`, `test(e2e): ...`, and `docs(launch): ...`. Keep subjects imperative and scoped.

PRs should include a short summary, verification commands run, linked issue or launch checklist item when relevant, and screenshots/videos for visible UI changes. Note any skipped checks with a reason.

## Security & Configuration Tips

Never commit `.env.local` or secrets. Browser code must only use `VITE_*` public values. Service-role Supabase keys belong server-side only.

This project currently runs on Gemini. `GEMINI_API_KEY` is the active provider key for embeddings, enrichment, chat, and classification. Do not assume `ANTHROPIC_API_KEY` is configured; if an Anthropic gate blocks behavior, switch that gate to Gemini rather than asking for Anthropic setup.

## Debugging & Platform Notes

Supabase project: `wfvoqpdfzkqnenzjxhui`. Use Supabase logs/schema checks before guessing at data or auth failures. Key facts: service-role calls bypass RLS, `entry_brains` does not exist, `audit_log` is live from migration `057`, and new billing periods may have no `user_usage` row, so prefer `.maybeSingle()` over `.single()` where absence is valid.

Vercel rewrites in `vercel.json` map many public routes to consolidated handlers, for example `/api/brains` to `/api/user-data?resource=brains`. Respect the 12-function limit.

GitHub checks can be inspected with `gh run list`, `gh run view <id>`, `gh pr list`, and `gh pr view`.

## Agent-Specific Instructions

Before architecture or codebase analysis, read `graphify-out/GRAPH_REPORT.md`; if `graphify-out/wiki/index.md` exists, prefer it over raw file browsing. After modifying code files, rebuild graphify with:

```bash
python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

When addressing an audit, read it fully, fix what is in scope, lift deferred findings into `EML/LAUNCH_CHECKLIST.md` with traceability, prepend a resolution section, then archive it under `EML/Audits/archive/`.
