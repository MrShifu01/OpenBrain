# Documentation Roadmap

Curated list of components, pipelines, and workflows worth documenting at
the depth of `bell.md`. Tiered by leverage — Tier 1 has the highest payoff
(cross-cutting hubs, recent bug magnets, footgun density). Each entry has
a one-line *why this is worth a writeup*.

**Done:**
- ✅ [Notification Bell](bell.md) — `src/components/NotificationBell.tsx`

---

## Tier 1 — Cross-cutting hubs (do these first)

### 1. Capture pipeline (end-to-end)
**Files:** `src/components/CaptureSheet.tsx` + `CaptureEntryBody` + `useCaptureSheetParse.ts` + `api/capture.ts` + `api/_lib/enrich.ts` + `api/_lib/mergeDetect.ts`
**Why:** One of three "hero" features per the redesign spec. Six entry points (text / voice / photo / file / vault / someday), inline enrichment, idempotency, merge detection, free-tier rate gating, brain selection. The brain-pill bug we just fixed lived inside this surface. ~2000 lines of code participate in a single "save" button press.

### 2. Enrichment pipeline
**Files:** `api/_lib/enrich.ts` + `api/_lib/enrichFlags.ts` + `src/lib/enrichFlags.ts` + `src/components/EntryListBits.tsx` + `src/components/settings/AITab.tsx` + cron paths
**Why:** Five-step pipeline (parse → insight → concepts → embed → persona) with two providers (Gemini + Anthropic), three triggers (capture-time inline / daily cron / Run-now in Settings), per-step error breadcrumbs, time-budget guard, and the four-letter PICE diagnostic UI. Just refactored — fresh in memory and the bug surface is dense.

### 3. Gmail sync flow
**Files:** `api/_lib/gmailScan.ts` (2088 lines!) + `api/gmail.ts` + `src/components/settings/GmailSyncTab.tsx` + `GmailStagingInbox.tsx` + `GmailSetupModal.tsx` + `GmailScanReviewModal.tsx`
**Why:** OAuth → cron-pulled inbox → categorize → cluster ~95% similar emails → stage → user review (swipe / cluster review) → accept-reject signals → distillation feeds the next scan's prompt. Staged-count bug, swipe-stale-state bug, category-prefs bug, and the daily-cron failure-to-fire all happened in this one flow this week alone.

### 4. Workflows / cron pipelines (full sweep)
**Files:** `.github/workflows/*.yml` (8 files: ci, cron-daily, cron-hourly, db-backup, e2e, lighthouse, test-push, weekly-roll-up) + the `/api/cron/*` handlers in `api/user-data.ts`
**Why:** All scheduled work runs from GitHub Actions (replacing Vercel Hobby cron). Each workflow has its own auth, retry, and failure model. The cron-daily 04:00 UTC schedule has only ever fired once manually — worth documenting what the schedules actually trigger, what the failure modes look like, and how to verify they ran.

### 5. Auth + tier gating + rate limits
**Files:** `api/_lib/withAuth.ts` + `verifyAuth.ts` + `rateLimit.ts` + `usage.ts` + `resolveProviderForUser` + Stripe tier sync
**Why:** Every API call goes through this stack. Tier limits, rate limits, RLS, BYOK provider resolution, and the user_usage 406 bug we know about all live here. Documenting it once means future endpoint authors don't reinvent the wheel.

### 6. Memory / retrieval
**Files:** `api/_lib/retrievalCore.ts` + `api/memory-api.ts` + `api/_lib/promptContext.ts` + `src/lib/conceptGraph.ts`
**Why:** Hybrid vector + keyword retrieval feeding Chat, MCP, and search. Persona-fact injection, recency boosting, brain scoping. The thing that makes Everion's chat feel "smart" — and the place where retrieval bugs surface as "why didn't it find X?".

---

## Tier 2 — Big components with state complexity

### 7. CaptureSheet (the component, separate from the pipeline)
**Files:** `src/components/CaptureSheet.tsx` (607 lines) + `CaptureEntryBody`, `CapturePreviewPanel`, `CaptureSecretPanel`
**Why:** Tabs (entry / secret), drag-handle drag-to-dismiss, voice recording, image capture, file extraction, vault encryption, someday toggle, brain override, mobile vs desktop layouts, FocusTrap, save-shortcut. Component-level concerns separate from the pipeline doc.

### 8. Vault (encryption + lock + recovery + reveal)
**Files:** `src/components/VaultRevealModal.tsx` + `src/views/VaultView.tsx` + `src/lib/crypto.ts` + `src/hooks/useVaultOps.ts` + `vault_keys` table + secret entries
**Why:** Cryptographic surface. Argon2id key derivation, AES-GCM, lock countdown, recovery codes. Get this wrong and user data is unrecoverable. Worth a careful single doc that consolidates the full key lifecycle.

### 9. Schedule / Todo placement engine
**Files:** `src/views/TodoCalendarTab.tsx` (1679 lines) + `TodoView.tsx` + `TodoSomedayTab.tsx` + `src/views/todoUtils.ts` + the Schedule Inspector admin tool
**Why:** `explainPlacements` decides why entries appear (or don't) on My Day / Week / Calendar. Recurrence rules, exclusions, persona facts as calendar events. Recent migration 054 + cascade tests touched this. The Schedule Inspector exists *because* this logic is complex.

### 10. Persona pipeline (extraction + hygiene + dedup)
**Files:** `api/_lib/extractPersonaFacts.ts` + `personaTools.ts` + `personaHygiene.ts` + `buildProfilePreamble.ts`
**Why:** Auto-extracts short facts from entries, treats them as first-class entries with `type='persona'`, runs daily decay + weekly dedup + weekly digest. Powers the persona section of every chat preamble. ~1100 lines across the trio. Easy to mis-tune (over-extraction = noise, under = forgetting things).

### 11. EntryList / Memory grid
**Files:** `src/components/EntryList.tsx` (932 lines) + `EntryListBits.tsx` + `EntryQuickActions.tsx` + `BulkActionBar.tsx`
**Why:** The hero surface of the app. Sorting (recency / importance / pinned), filtering, hover preview, click-to-detail, multi-select bulk actions, drag-to-pin, swipe gestures on mobile. Where the rendering bugs land first when something upstream changes.

### 12. OmniSearch (`⌘K`)
**Files:** `src/components/OmniSearch.tsx` (560 lines)
**Why:** Three-segment palette (entries / concepts / commands), keyboard nav, fuzzy match, command registry. Touches the entire surface area of the app via shortcuts.

---

## Tier 3 — Subsystems / focused features

### 13. Push subscription lifecycle
**Files:** `src/components/NotificationSettings.tsx` (693 lines) + `useNotifications.ts` + Service Worker push handler + VAPID setup + cron-hourly send loop
**Why:** Browser permission → VAPID subscribe → store on `auth.users.user_metadata.push_subscription` → cron pulls and sends → 410/404 prunes. Three failure modes (permission denied, subscription expired, VAPID misconfig) all surface differently.

### 14. Brain switcher + multi-brain plumbing
**Files:** `src/components/BrainSwitcher.tsx` + `CreateBrainModal.tsx` + `MoveToBrainModal.tsx` + `BrainTab.tsx` + `useBrain.ts` + `multiBrain` feature flag + `brain_metadata` migration 060
**Why:** Recently-shipped feature behind a flag. Move-between-brains rules, ownership, RLS interaction. Per-capture brain pill. The plumbing isn't fully exposed yet — doc captures the design intent before it leaks.

### 15. Stripe / billing
**Files:** `src/components/settings/BillingTab.tsx` + `api/_lib/stripe.ts` + `stripeIdempotency.ts` + the four `stripe-*` user-data resources + tier sync
**Why:** Webhook signature verification, idempotency keys, plan / interval mapping, subscription state ↔ user_profiles.tier. Handles real money, deserves the diligence.

### 16. Service Worker + PWA + self-heal
**Files:** `src/sw.js` + `src/components/UpdatePrompt.tsx` + `main.tsx` self-heal + `ErrorBoundary.tsx`
**Why:** Just wrote the stale-bundle self-heal but the rest (cache strategy, precache manifest, controllerchange handling, push handler, update prompt) deserves the same once-over. Web push, install prompt, offline behavior all converge here.

### 17. Imports (Bear / Notion / Evernote / Keep / NotebookLM)
**Files:** `src/components/settings/{Bear,Notion,Evernote,GoogleKeep}ImportPanel.tsx` + `BulkImportPanel.tsx`
**Why:** Each format has its own parsing quirks (Bear's tag inheritance, Notion's nested blocks, Evernote's ENEX). One doc covering "how an import becomes entries" plus the per-source notes saves rediscovery.

### 18. Onboarding flow
**Files:** `src/components/OnboardingModal.tsx` (550 lines) + onboarding steps + brain seed + persona priming
**Why:** First-run experience. Determines retention. The 5-30 min walk-through worth understanding before A/B-testing changes.

### 19. MCP server
**Files:** `api/mcp.ts` (712 lines) + the `/.well-known` rewrites + OAuth dance + tool surface
**Why:** Lets external agents (including Claude itself) talk to a user's brain. OAuth flow, tool registration, resource exposure. Niche but high-impact for power users.

### 20. LLM router
**Files:** `api/llm.ts` (896 lines) + `aiProvider.ts` + `resolveProvider.ts` + `providers/`
**Why:** Multi-provider switching (Gemini / Anthropic / OpenAI / OpenRouter / Groq), BYOK resolution, transcribe + extract-file actions, model-name normalization, streaming. Where every LLM call lands.

### 21. Graph view
**Files:** `src/components/graph/*` + `useGraph.ts` + `build_similarity_graph` SQL RPC
**Why:** The "constellations" surface from the redesign spec. Force-directed layout disabled in favor of star metaphor. Concept extraction → similarity graph → render → interactive zoom.

### 22. Background ops + offline queue
**Files:** `src/hooks/useBackgroundOps.tsx` + `useOfflineSync.ts` + `backgroundTaskRegistry.ts` + `BackgroundOpsToast.tsx` + `BackgroundTaskToast.tsx`
**Why:** "Run-now enrichment is happening in the background" toast, offline-mode queueing, retry-on-reconnect. Ties into the offline-capture-queue someday item.

---

## Tier 4 — Worth a paragraph in a parent doc, not a standalone

- `useDataLayer.ts` — entry CRUD wrapper, fits inside the EntryList doc
- `useEntryRealtime.ts` — Supabase realtime subscription, fits inside EntryList
- `learningEngine.ts` — pattern detection, fits inside Persona pipeline
- `contactPipeline.ts` — phone-number extraction, fits inside Capture pipeline
- `aiSettings.ts` — BYOK + model selection, fits inside LLM router
- Settings tabs each (Account, Data, Danger, etc.) — UI-thin, low complexity per line

---

## Suggested order

If we work through this systematically, the highest-leverage path is:

1. **Capture pipeline** (Tier 1.1) — most code, most user-facing, just touched
2. **Enrichment pipeline** (Tier 1.2) — fresh refactor context
3. **Gmail sync flow** (Tier 1.3) — most active bug surface
4. **Workflows + cron** (Tier 1.4) — silent failure mode, worth pinning down
5. **Auth + tier + rate** (Tier 1.5) — every endpoint touches it
6. **Vault** (Tier 2.8) — security-critical, document while design intent is clear
7. **Schedule engine** (Tier 2.9) — already has an inspector tool because of complexity
8. **Persona pipeline** (Tier 2.10) — quietly powerful, easily mis-tuned

Each takes ~30 min to write at `bell.md` density. Eight of these = a
roughly-complete handbook that covers 80% of where bugs and feature
decisions actually happen.

---

## How to refresh this index

When a new component or pipeline lands that meets the criteria (multiple
writers, hidden state, cross-cutting), add it to the appropriate tier.
When one is documented, move it to the **Done** list at the top with a
link to the file.

Bell.md is a reference template — same headings (TL;DR, file map, data
shape, sources, lifecycle, clearing/teardown, server endpoint, recent
changes, known limitations) work for most of these.
