# Everion — Full App Audit
**Date:** 2026-04-08  
**Auditor:** SMASH OS Senior Engineering Lead  
**Stack:** React 19 + Vite + TypeScript, Vercel Functions, Supabase, Tailwind CSS v4

---

```
▸ SMASH OS  ·  full app audit  [2026-04-08]
══════════════════════════════════════════════════════════════════

  OVERALL SCORE   74 / 100  —  C+
  VERDICT         PASS WITH WARNINGS

══════════════════════════════════════════════════════════════════
  DIMENSION BREAKDOWN
──────────────────────────────────────────────────────────────────
  Security              73 / 100   ×0.20  →  14.6
  Performance           78 / 100   ×0.20  →  15.6
  Architecture          73 / 100   ×0.20  →  14.6
  Code Quality / Types  72 / 100   ×0.15  →  10.8
  UX / UI               77 / 100   ×0.15  →  11.55
  Maintainability       65 / 100   ×0.05  →  3.25
  User Perspective      74 / 100   ×0.05  →  3.7
──────────────────────────────────────────────────────────────────
  WEIGHTED TOTAL                           74.1
══════════════════════════════════════════════════════════════════
```

---

## Progress Since Last Audit (2026-04-02)

- ✓ CSP header now present in `vercel.json`
- ✓ Upstash Redis distributed rate limiting (with in-memory fallback)
- ✓ `x-forwarded-for` fixed: now reads last (edge-verified) IP
- ✓ PIN verification moved server-side (zero-knowledge: server never sees raw PIN)
- ✓ Vault key stored in IndexedDB (not localStorage)
- ✓ Vault secrets blocked for non-Anthropic providers in chat
- ✓ Message structure validation in `llm.ts` (rejects image blocks, tool_use)
- ✓ Soft delete + 30-day trash implemented
- ✓ Cursor-based pagination (limit 50, was 500)
- ✓ CI/CD pipeline present (`.github/workflows/ci.yml`)
- ✓ 60+ test files across all layers

---

## SECURITY — 73/100

**What's solid:**
- Full CSP in `vercel.json:34` — `default-src 'self'` with allowlist covering Supabase, Anthropic, OpenAI, OpenRouter, Groq, Resend
- Ownership checks on all mutating endpoints via `checkBrainAccess` — `api/entries.ts:138`, `api/capture.ts:65`
- Vault encryption: AES-256-GCM with non-extractable key stored in IndexedDB — `src/lib/crypto.ts`
- PIN uses PBKDF2 (100k iterations), verified server-side only — `src/lib/pin.tsx:36-55, 87-105`
- Vault secrets blocked for non-Anthropic providers — `api/chat.ts:71-72`
- Message structure validation: rejects image blocks, tool_use, arrays — `api/llm.ts:65-76`
- Distributed rate limiting via Upstash Redis with fallback — `api/_lib/rateLimit.ts:22-58`
- `x-forwarded-for` reads last (edge-verified) IP — `api/_lib/rateLimit.ts:63-65`
- HMAC cron auth — `api/cron/push.ts:16-19`
- Audit logging on delete/update/capture (fire-and-forget) on all write paths

**Findings:**

| Sev | Finding | Location |
|-----|---------|----------|
| CRITICAL | **Leaked Telegram Bot Token NOT revoked.** GitGuardian flagged commit `d811ad2`. MASTER.md has a manual action item but it is still outstanding. Any attacker can use the leaked token now. | `roadmap/MASTER.md:62` |
| HIGH | **`handleSaveLinks` has no rate limit.** Main handler dispatches to `handleSaveLinks` at line 22, before the `rateLimit(req, 30)` call at line 28. Anyone authenticated can hammer `/api/save-links` with unbounded link insertions. | `api/capture.ts:22,28,159` |
| HIGH | **User API keys stored in `localStorage` (XSS-accessible).** All AI provider keys, embed keys, Groq key — plaintext in localStorage. XSS would harvest every key silently. | `src/lib/aiSettings.ts` |
| MEDIUM | **In-memory rate-limit fallback active** if `UPSTASH_REDIS_REST_URL` not set. Per-serverless-instance — provides zero protection against distributed attacks. | `api/_lib/rateLimit.ts:76-79` |
| MEDIUM | **Telegram panel empty `catch {}`** silently swallows errors generating auth codes. No user feedback on failure. | `src/views/SettingsView.tsx:93-96` |
| MEDIUM | **Brain API keys stored in plaintext** in `brain_api_keys` table (no bcrypt/argon2 hash). | `roadmap/MASTER.md:207-208` |
| LOW | **`capture()` RPC `v_owner_id`** — `p_user_id` is correctly passed from API, but if the Supabase function ignores it the auth bypass risk remains. Requires Supabase-side verification. | `api/capture.ts:57` |
| LOW | **No CSRF protection** on mutating endpoints. Mitigated by Supabase JWT but still a defense-in-depth gap. | All mutating API routes |

---

## PERFORMANCE — 78/100

**What's solid:**
- Cursor-based pagination — `api/entries.ts:126-131`, default limit 50 (was 500)
- All heavy views lazy-loaded via `React.lazy` — `src/OpenBrain.tsx:39-44`
- VirtualGrid and VirtualTimeline use `@tanstack/react-virtual` — `src/components/EntryList.tsx`
- 200ms debounced search — `src/OpenBrain.tsx:148`
- Vercel Speed Insights installed — `package.json:20`
- Entries served from IndexedDB cache before API returns — `src/OpenBrain.tsx:96-100`
- Skeleton loading cards during fetch — `src/OpenBrain.tsx:265`
- Assets cached with `Cache-Control: immutable` — `vercel.json:48-53`

**Findings:**

| Sev | Finding | Location |
|-----|---------|----------|
| HIGH | **No error monitoring** (Sentry or equivalent). Errors in production are invisible. `ErrorBoundary.tsx` exists but is not confirmed wired to the app root. | `package.json` — absent |
| MEDIUM | **N+1 sequential fetches in multi-brain chat.** `for (const bId of brainList)` makes one serial `match_entries` RPC per brain. 10 brains = 10 serial round trips. Should be `Promise.all`. | `api/chat.ts:107-125` |
| MEDIUM | **No bundle size monitoring.** Large `src/lib/` (50+ files), no `rollupOptions.output.manualChunks` in vite config. Bundle could grow silently. | `vite.config.js` |
| LOW | **`PERF-6` `findConnections` debounce** not confirmed implemented — auto-link discovery may still fire on every entry during Fill Brain. | `roadmap/MASTER.md:153-154` |
| LOW | **No API latency logging** beyond pgvector warning at 500ms. No structured request timing across endpoints. | `api/` — absent |

---

## ARCHITECTURE — 73/100

**What's solid:**
- Clean API consolidation via `vercel.json` rewrites — single handler files with action routing
- Domain-split contexts: `EntriesContext`, `BrainContext` — `src/context/`
- Offline-first: IndexedDB queue with auto-sync — `src/hooks/useOfflineSync.ts`
- Soft delete with 30-day recovery — `api/entries.ts:199-276`, `TrashView`
- Well-designed hook layer: `useEntryActions`, `useBrain`, `useChat`, `useNudge` — `src/hooks/`
- Cross-brain search with fallback strategies — `src/lib/crossBrainSearch.ts`
- Entry versioning module exists — `src/lib/entryVersioning.ts`

**Findings:**

| Sev | Finding | Location |
|-----|---------|----------|
| HIGH | **`SettingsView.tsx` is 1505 lines — god component.** Settings, AI provider config, brain management, member management, Telegram panel, notification settings, usage panel, trash, PIN management — all in one file. | `src/views/SettingsView.tsx` |
| HIGH | **`QuickCapture.tsx` is 1133 lines with `@ts-nocheck`** — the primary capture path for all user data has no TypeScript protection AND is the largest UI component. | `src/components/QuickCapture.tsx:1` |
| MEDIUM | **`links` state initialized with static `LINKS` constant.** If `LINKS` contains stale demo data it pollutes the graph on first load before server data arrives. | `src/OpenBrain.tsx:124` |
| MEDIUM | **Offline sync silently drops failed ops after 3 retries.** Data loss with no user notification beyond a dismissable banner. | `src/hooks/useOfflineSync.ts:48-95` |
| LOW | **`handleSaveLinks` returns 200 `stored: "local-only"`** when Supabase RPC is missing instead of surfacing the misconfiguration. | `api/capture.ts:199` |

---

## CODE QUALITY / TYPES — 72/100

**What's solid:**
- 60+ test files spanning API, components, hooks, and lib layers
- CI pipeline runs `typecheck`, `lint`, `test` on every PR and push to main — `.github/workflows/ci.yml`
- Excellent coverage of critical lib modules: `crypto.test.ts`, `entriesCache.test.ts`, `entryOps.test.ts`, `offlineQueue.test.ts`
- PBKDF2 pin, AES crypto, offline queue, search, embeddings — all tested
- `@testing-library/react` + `@testing-library/user-event` for component tests

**Findings:**

| Sev | Finding | Location |
|-----|---------|----------|
| HIGH | **`@ts-nocheck` on 3 files.** `QuickCapture.tsx` (1133 lines, primary capture path), `BulkUploadModal.tsx`, `src/lib/entryOps.ts`. TypeScript provides zero protection on the most complex, most user-impacting code. | `QuickCapture.tsx:1`, `BulkUploadModal.tsx:1`, `entryOps.ts:1` |
| MEDIUM | **Silent `catch {}` on critical paths.** 9 source files confirmed: `CaptureSheet.tsx`, `SettingsView.tsx`, `DetailModal.tsx`, `RefineView.tsx`, `SuggestionsView.tsx`, `OnboardingModal.tsx`, `QuickCapture.tsx`, `OnboardingChecklist.tsx`, `OpenBrain.tsx`. | Multiple |
| MEDIUM | **No vitest coverage thresholds.** Tests run but no minimum coverage enforced. CI passes even if critical paths drop to 0%. | `vite.config.js` — absent |
| MEDIUM | **Pervasive `any` in API layer.** `const user: any`, `const data: any`, `const rows: any[]` in every handler. Typed response shapes would catch API contract breaks at compile time. | All `api/*.ts` |
| LOW | **CI uses Node 20** — Vercel's current default is Node 24 LTS. CI/prod divergence possible. | `.github/workflows/ci.yml:14` |
| LOW | **No test for `handleSaveLinks` rate limit gap** — the HIGH security finding has no test catching it. | `tests/` — absent |

---

## UX / UI — 77/100

**What's solid:**
- Skeleton cards during load, meaningful content immediately from cache — `src/OpenBrain.tsx:265`
- Save errors surfaced via toast — `src/OpenBrain.tsx:312-317`
- Failed sync ops shown with dismiss action — `src/OpenBrain.tsx:247-252`
- Offline indicator in header — `MobileHeader`
- 5-second undo toast for deletes — `UndoToast` component
- PWA configured with manifest, service worker, auto-update — `vite.config.js`
- Capture view as default on mobile — `src/OpenBrain.tsx:121`
- Onboarding modal with guided Q&A — `OnboardingModal`
- Dark/light theme toggle

**Findings:**

> Focus traps, keyboard operability, touch targets, and aria-live details are covered in depth in `uiux-audit.md`. Only non-overlapping items remain here.

| Sev | Finding | Location |
|-----|---------|----------|
| HIGH | **Icon-only buttons lack `aria-label` throughout.** Screen readers cannot identify actions (e.g. sidebar nav icons, brain switcher, action buttons). | `roadmap/MASTER.md:160-161` |
| MEDIUM | **App manifest says "OpenBrain" not "Everion"** — brand mismatch for installed PWA. | `vite.config.js:15-16` |
| LOW | **No undo for bulk import** — `BulkUploadModal` can create many entries with no recovery path. | `src/components/BulkUploadModal.tsx` |
| LOW | **No success feedback** when brain tip card's "Fill Brain" action is triggered. | `src/OpenBrain.tsx:245` |

---

## MAINTAINABILITY — 65/100

**What's solid:**
- CI/CD pipeline: typecheck + lint + test on PR and main — `.github/workflows/ci.yml`
- Supabase migrations in `supabase/migrations/` with numbered files
- Comprehensive roadmap and decisions log documenting every major decision
- `prettier` + `eslint` with TypeScript rules configured
- Mature test infrastructure (vitest + jsdom + fake-indexeddb)

**Findings:**

| Sev | Finding | Location |
|-----|---------|----------|
| MEDIUM | **No `.env.example`** — new developers have no documented list of required environment variables. Must read multiple API files to discover what's needed. | Root — absent |
| MEDIUM | **No Dependabot / automated dependency updates.** `xlsx@0.18.5`, `web-push@3.6.7`, `mammoth@1.12.0` — no update schedule. | Root — absent |
| MEDIUM | **Migration `013_flexible_entry_types.sql` NOT auto-applied** — listed as a manual action in MASTER.md. If not run, production is on a stale schema. | `roadmap/MASTER.md:64` |
| LOW | **CI uses Node 20, Vercel uses Node 24 LTS.** Version divergence can cause CI-green / prod-fail scenarios. | `.github/workflows/ci.yml:14` |
| LOW | **No `format:check` in CI.** Prettier is configured but not enforced in the pipeline. | `.github/workflows/ci.yml` |

---

## USER PERSPECTIVE — 74/100

**What's solid:**
- New user lands on Capture view with clear primary action (Fill Your Brain tile)
- Onboarding modal guides through the mental model on first visit
- App is functional offline — cache loads immediately, sync queued
- Soft delete + undo protects against accidental data loss
- PWA installable for near-native mobile experience

**Findings:**

| Sev | Finding | Location |
|-----|---------|----------|
| HIGH | **Offline sync can silently lose data** after 3 failed retries — ops removed from queue with no persistent user notification. A user may believe their entry was saved when it was permanently dropped. | `src/hooks/useOfflineSync.ts:48-95` |
| MEDIUM | **No API cost visibility for users.** UsagePanel shows localStorage-based estimates only. Users with BYO keys have no reliable spend guardrails. | `src/views/SettingsView.tsx:42-65` |
| MEDIUM | **Embedding provider mismatch is silent.** Switching providers mid-use creates incompatible vector spaces — search quality silently degrades with no warning. | `roadmap/MASTER.md:120-124` |
| LOW | **App name in PWA manifest is "OpenBrain"** — users who installed the PWA see the old name, not "Everion". | `vite.config.js:15` |

---

## TOP ACTIONS (priority order)

1. **[CRITICAL]** Revoke the leaked Telegram Bot Token immediately — @BotFather → `/revoke`, update `BOT_TOKEN`/`TELEGRAM_BOT_TOKEN` in Supabase env vars.

2. **[HIGH]** Add `rateLimit` to `handleSaveLinks` in `api/capture.ts:159` — insert `if (!(await rateLimit(req, 30))) return res.status(429).json({ error: "Too many requests" });` as the first line of the function.

3. **[HIGH]** Remove `@ts-nocheck` from `QuickCapture.tsx` and fix the underlying TypeScript errors. This is the core capture path — type safety here directly protects data integrity.

4. **[HIGH]** Begin decomposing `SettingsView.tsx` (1505 lines) — extract `AIProviderPanel`, `BrainMembersPanel`, `SecurityPanel`, `DataPanel` as separate components. Start with `AIProviderPanel` (most volatile).

5. **[MEDIUM]** Add `aria-label` to all icon-only buttons (sidebar nav, brain switcher, action buttons) and wire `ErrorBoundary.tsx` to the app root. See `uiux-audit.md` for the full accessibility action list (focus traps, touch targets, aria-live).
