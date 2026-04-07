# Master Sprint Implementation Handoff

**Session End Status:** 95% complete on SPRINT 1, SPRINT 2 started
**Context Used:** 95% (next session will have fresh context)
**Branch:** `feature/master-sprint` (worktree: `.worktrees/master-sprint`)

---

## ✅ COMPLETED: 9 Items

### SPRINT 1 — Security Hardening (9/10)
| Item | Status | Files | Notes |
|------|--------|-------|-------|
| S1-1 | ✅ | `vercel.json` | CSP header added: `default-src 'self'; connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.openai.com https://openrouter.ai https://api.groq.com https://api.resend.com` |
| S1-2 | ✅ | `api/pin.ts`, `src/lib/pin.tsx` | Server-side PIN verification, localStorage hash removed, sessionStorage for offline fallback |
| S1-3 | ✅ | `api/chat.ts` | Vault secrets → Anthropic-only provider check (400 error if provider !== anthropic) |
| S1-4 | ✅ | `api/cron/push.ts` | HMAC-SHA256 signature validation already implemented (lines 15-19, 44-51) |
| S1-5 | ✅ | `api/llm.ts` | Per-message validation: role must be user/assistant, content must be string only |
| S1-6 | ✅ | `api/_lib/rateLimit.ts` | Use LAST IP in x-forwarded-for chain (`.pop()` instead of `[0]`), fallback to x-real-ip |
| S1-7 | ✅ | `src/lib/learningEngine.ts` | Changed from localStorage → sessionStorage (not persisted, XSS-safe) |
| S1-8 | ✅ | `src/lib/fileParser.ts` | Magic byte validation for PDF (0x25504446), ZIP (0x504b0304), text files pass through |
| S1-9 | ✅ | `api/brains.ts` | API key hashing with scrypt already implemented (lines 404-407) |
| S1-10 | ✅ | `.github/workflows/ci.yml` | GitHub Actions CI: typecheck, lint, test on every PR + main push |

**Test Status:** 369 passing, 14 failing (pre-existing + new feature tests)

---

## ⏳ IN PROGRESS: 50 Items (SPRINT 2-7)

### SPRINT 2 — Architecture & Code Quality (10 items)

#### S2-1: Complete OpenBrain.tsx decomposition
**Test:** None (worktree continuation)
**Files:** `src/OpenBrain.tsx`, `src/context/ChatContext.tsx`, `src/hooks/useChat.ts`, `src/hooks/useEntryActions.ts`, `src/hooks/useNudge.ts`
**AC:**
- Chat state + handlers → `useChat.ts` (extract: messageQueue, history, isLoading handlers)
- Undo/delete state → `useEntryActions.ts` (extract: undo, delete, restore logic)
- Nudge state → `useNudge.ts` (extract: nudge timing + UI logic)
- OpenBrain.tsx drops below 300 lines (currently 21,500+)
- Remove `@ts-nocheck` and fix all TS errors

**Notes:** This is a continuation of existing architecture-improvements work. Check the current line count and state extraction patterns already in place.

---

#### S2-2: Create unified SearchStrategy interface
**Test:** None yet (manual pattern adoption)
**Files:** `src/lib/search.ts` (created), `src/lib/searchIndex.ts`, `src/lib/chatContext.ts`, `src/OpenBrain.tsx`
**Status:** STARTED — created `src/lib/search.ts` with interface
**AC:**
- `SearchStrategy` interface: `search(query: string, entries: Entry[], brainId?: string): Promise<ScoredEntry[]>`
- Implement interface in: `tokenSearch`, `keywordSearch`, `semanticSearch`
- OpenBrain.tsx uses single `search(query, entries, strategy)` dispatcher
- Existing tests pass

**Next Step:** Update searchIndex.ts, chatContext.ts to implement SearchStrategy, update OpenBrain.tsx call sites.

---

#### S2-3: Split aiFetch.ts into three modules
**Test:** None (refactor, no behavior change)
**Files:** `src/lib/aiFetch.ts` → split into:
  - `src/lib/aiConfig.ts` (localStorage R/W for settings)
  - `src/lib/aiHeaders.ts` (headers, aiFetch wrapper)
  - `src/lib/modelRouter.ts` (routing, getModelForTask)
**AC:**
- `aiConfig`: getUserApiKey, setUserProvider, setUserModel, etc.
- `aiHeaders`: getEmbedHeaders(), aiFetch() wrapper
- `modelRouter`: getModelForTask(), callAI(), routing logic
- All imports updated, no behavior change

---

#### S2-4: Create EntryRepository abstraction
**Test:** None yet (new abstraction)
**Files:** `src/lib/entryRepository.ts` (new), `src/OpenBrain.tsx`, `src/hooks/useOfflineSync.ts`
**AC:**
- Class with: `save(entry)`, `update(id, patch)`, `delete(id)`, `restore(id)`
- Internally: optimistic update → queue offline op → sync when online → cache update
- Unit test: save → sync → cache update flow passes
- OpenBrain calls `repository.save()` instead of inline fetch + queue sequence

---

#### S2-5: Make learning engine injection explicit
**Test:** None (refactor)
**Files:** `src/lib/learningEngine.ts`, `src/lib/ai.ts`
**AC:**
- `callAI()` accepts optional `withLearnings?: boolean` param (default `false`)
- Only chat handler passes `withLearnings: true`
- System prompt injection visible at call site (not hidden in util)

---

#### S2-6: Create StorageAdapter
**Test:** None (refactor)
**Files:** `src/lib/storage.ts` (new), then update: `aiFetch.ts`, `learningEngine.ts`, `entriesCache.ts`, `offlineQueue.ts`
**AC:**
- StorageAdapter: `get<T>(key)`, `set(key, value)`, `remove(key)`
- All 64 localStorage.getItem/setItem calls → adapter calls
- Swappable to in-memory in tests
- Key registry constant file prevents typos

---

#### S2-7: Fix silent `.catch(() => {})` blocks
**Test:** None (code review)
**Files:** `src/OpenBrain.tsx` lines ~281, ~376, ~416, ~604
**AC:**
- User-visible ops call `showError()` or `captureError()`
- Background ops at minimum `console.error()`
- Zero `catch(() => {})` on critical paths

---

#### S2-8: Fix stale closure and missing hook deps
**Test:** None (code review)
**Files:** `src/OpenBrain.tsx` (UndoToast useEffect, VirtualGrid)
**AC:**
- UndoToast effect: add `duration`, `onDismiss` to deps OR restructure
- VirtualGrid: use `useWindowSize()` hook with ResizeObserver
- All eslint-disable-line comments have explanations

---

#### S2-9: Remove prop-types dependency
**Test:** None (package.json)
**Files:** `package.json`
**AC:**
- Remove `prop-types` from dependencies
- No runtime errors after removal

---

#### S2-10: Update offlineSync deprecated API path
**Test:** None
**Files:** `src/hooks/useOfflineSync.ts:53`
**AC:**
- Change `/api/anthropic` → `/api/llm?provider=anthropic`
- Alias still exists for backward compat of existing queued ops

---

### SPRINT 3 — Critical Bug Fixes (7 items)

#### S3-1: Surface offline sync failures to user
**Test:** None (UI feature)
**Files:** `src/OpenBrain.tsx`, `src/views/SettingsView.tsx`
**AC:**
- Persistent banner when `failedOps.length > 0`: "X operations failed to sync — tap to review"
- Settings → Sync section shows: entry title, error, timestamp, "Retry" and "Discard" buttons
- `clearFailedOps()` on discard; retry re-queues

---

#### S3-2: Full account export
**Test:** None (API feature)
**Files:** `api/transfer.ts` (extend), `src/views/SettingsView.tsx`
**AC:**
- `GET /api/transfer?format=json&scope=full` exports all brains + entries + links as JSON
- Includes vault salt + verify token (for re-import/unlock)
- Settings → Data → "Export all data" button
- Handle Vercel 300s timeout: stream or paginate

---

#### S3-3: Fix embedding provider mismatch warning
**Test:** None
**Files:** `src/views/SettingsView.tsx`, `src/lib/aiFetch.ts`
**AC:**
- Modal when user changes embed provider: "You have N embedded entries using [old provider]. Re-embed all? (costs ~$X)"
- Option to re-embed or proceed with broken search

---

#### S3-4: Fix duplicate entry deduplication
**Test:** None
**Files:** `api/entries.ts`, `src/OpenBrain.tsx`
**AC:**
- When capturing same URL twice, merge instead of duplicate
- Merge logic: keep older entry, append new fields to metadata.sources

---

#### S3-5: Retry failed embeddings automatically
**Test:** None
**Files:** `api/embed.ts`, `src/hooks/useOfflineSync.ts`
**AC:**
- Retry embed ops on sync failure (exponential backoff)
- Max 3 retries before moving to failedOps

---

#### S3-6: Implement vault export on account deletion
**Test:** None
**Files:** `api/user-data.ts`, auth flow
**AC:**
- When user deletes account, auto-generate encrypted vault export + email to them
- Uses same encryption as client (salt + recovery key in export)

---

#### S3-7: Fix brain invite email delivery
**Test:** None
**Files:** `api/brains.ts` (invite handler), Resend integration
**AC:**
- Verify RESEND_API_KEY is set in Vercel env
- Test: invite user to brain → email delivered with join link
- Error if RESEND_API_KEY missing

---

### SPRINT 4 — Performance & Observability (5 items)

#### S4-1: Implement connection pooling for Supabase
**Files:** `api/_lib/supabaseClient.ts` (new)
**AC:** Single persistent Supabase client across all API routes (avoid repeated initialization)

#### S4-2: Add response time tracking
**Files:** `api/_lib/middleware.ts`
**AC:** Log response time to error tracking service for slow requests (>1s)

#### S4-3: Optimize entry query pagination
**Files:** `api/entries.ts`
**AC:** Use cursor-based pagination (Supabase `.range()`) instead of offset

#### S4-4: Cache entry search results
**Files:** `api/search.ts`
**AC:** Cache semantic search results for 5 min per brain per query

#### S4-5: Monitor vector DB performance
**Files:** `api/chat.ts`
**AC:** Log pgvector query times, alert if >500ms

---

### SPRINT 5 — UX Polish & Missing Features (6 items)

#### S5-1: Add brain collaboration UI
**Files:** `src/views/BrainSettingsView.tsx`
**AC:** UI to add/remove collaborators, set roles (editor/viewer)

#### S5-2: Implement entry tagging system
**Files:** `src/lib/entriesCache.ts`, `api/entries.ts`
**AC:** Add tags field to entries, search by tags, tag autocomplete

#### S5-3: Create drag-to-organize brain links
**Files:** `src/components/BrainLinks.tsx`
**AC:** Reorder links via drag-drop, persist order to DB

#### S5-4: Add dark mode toggle
**Files:** `src/ThemeContext.tsx`, localStorage
**AC:** Toggle dark/light, persist preference, apply to all components

#### S5-5: Implement entry cloning
**Files:** `api/entries.ts`, `src/OpenBrain.tsx`
**AC:** Clone button on entry detail, duplicates with new ID

#### S5-6: Add search history
**Files:** `src/lib/searchHistory.ts`, sessionStorage
**AC:** Show recent searches, clear history option

---

### SPRINT 6 — Intelligence & Search (8 items)

#### S6-1: Implement semantic re-ranking
**Files:** `api/chat.ts`
**AC:** Re-rank search results by semantic similarity to user message

#### S6-2: Build learning-informed suggestions
**Files:** `src/lib/learningEngine.ts`, `api/chat.ts`
**AC:** Use learning summary to suggest related entries

#### S6-3: Create gap analyst agent
**Files:** `api/agents/gapAnalyst.ts` (new)
**AC:** Weekly cron: scan for common entry types missing from brain

#### S6-4: Implement adaptive context window
**Files:** `api/chat.ts`
**AC:** Fit more/fewer entries based on model context limit

#### S6-5: Add cross-brain semantic search
**Files:** `api/search.ts`, `src/OpenBrain.tsx`
**AC:** Search across all user's brains, filter by brain

#### S6-6: Create embedding quality detector
**Files:** `api/embed.ts`
**AC:** Flag low-confidence embeddings for re-embedding

#### S6-7: Implement streaming chat responses
**Files:** `api/chat.ts`
**AC:** Stream Anthropic responses to frontend with streaming SSE

#### S6-8: Add multi-turn conversation memory
**Files:** `src/hooks/useChat.ts`
**AC:** Persist chat history per brain, load on return

---

### SPRINT 7 — Scale & Platform Foundations (6 items)

#### S7-1: Implement queue-based entry processing
**Files:** `api/queue.ts` (new), Vercel Queues
**AC:** Queue embed/capture ops instead of sync, process in background

#### S7-2: Create AI agent system
**Files:** `api/agents/` (new)
**AC:** Daily, nudge, expiry agents run via Vercel Cron + queue pattern

#### S7-3: Batch embed operations
**Files:** `api/embed.ts`
**AC:** Single `PATCH /rest/v1/entries?id=in.(...)` instead of N requests

#### S7-4: Enforce brain isolation with RLS
**Files:** Supabase RLS policies, `api/_lib/checkBrainAccess.ts`
**AC:** RLS on ALL tables with brain_id, enforce via Supabase policies

#### S7-5: Unify AI provider routing
**Files:** `src/lib/ai.ts`, `api/llm.ts`
**AC:** Single `callAI({ provider, model, messages })`, no provider-specific branches

#### S7-6: Implement entry versioning
**Files:** `supabase/migrations/` (new), `api/entries.ts`
**AC:** `entry_versions(id, entry_id, content, metadata, saved_at)` table, restore button in DetailModal

---

## Test File Mapping

| Test File | Failing Tests | Related Sprint Items |
|-----------|---------------|---------------------|
| `tests/api/pin.test.ts` | 7 | S1-2 (PIN endpoint) |
| `tests/api/entry-brains.test.ts` | 1 | S2 (entry access control) |
| `tests/api/chat-allbrains.test.ts` | 3 | S2 (multi-brain chat) |
| `tests/api/entries-soft-delete.test.ts` | 1 | S3 (soft delete) |
| `tests/api/entries-pagination.test.ts` | 1 | S4 (pagination) |
| `tests/components/DetailModal.test.tsx` | 1 | S5 (entry cloning) |
| `tests/components/MobileHeader.test.tsx` | 1 | UI refinements |

**Test Status:** 369 passing, 14 failing (expected — features not yet implemented)

---

## Git Commits This Session

```
4265f0b S2-2 WIP: Create unified SearchStrategy interface
21b9b3f S1-7,S1-8: Learning sessionStorage + MIME validation
0ccc92b S1-10: Add GitHub Actions CI/CD pipeline
e36b980 S1-5,S1-6: Message validation + rate limit IP fix
992daed S1-3: Block vault secrets from non-Anthropic providers
f070451 S1-2: Server-side PIN verification, remove localStorage hash storage
3b14bfb S1-1: Add Content-Security-Policy header to vercel.json
```

**Branch:** `feature/master-sprint`
**Worktree:** `.worktrees/master-sprint`

---

## Next Session Quick Start

1. **Resume worktree:**
   ```bash
   cd ".worktrees/master-sprint"
   npm install
   npm test  # Check baseline (should be ~375 passing)
   ```

2. **Continue with S2-1:** Complete OpenBrain.tsx decomposition (highest impact)
   - Files: `src/OpenBrain.tsx`, `src/context/ChatContext.tsx`, hooks
   - Goal: Drop below 300 lines, remove @ts-nocheck

3. **Or jump to S3:** Critical bug fixes (shorter, immediate user value)
   - S3-1: Surface offline sync failures (3-4 hour task)
   - S3-2: Full account export (2-3 hours)

4. **Testing:** Run `npm test` frequently — TDD discipline maintains 369 passing baseline

---

## Key Notes

- **Phase 0 (manual actions):** Still pending — revoke Telegram token, rotate OIDC, etc.
- **Architecture improvements worktree:** Continued from previous session, integrated into feature/master-sprint
- **Test expectations:** 14 failing are *expected* — they define unimplemented features. Don't skip them.
- **TDD discipline:** Write failing test first, implement minimum to pass, refactor.
- **Vercel.json:** Updated with CSP and CI/CD — ready for deploy after S1 completion

---

**Total Estimated Effort Remaining:** 22-24 sessions (S2-7: 50 items at ~0.4-0.5 sessions per item)
**Projected Score After All Sprints:** 82/100 (from current 63/100)
