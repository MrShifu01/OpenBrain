# Capture Pipeline

End-to-end map of the Capture sheet — the hero feature behind the `+` button
in the header. Six entry points, AI parse, three client save paths, server-side
idempotency + dedup + enrichment + merge detect, all triggered by one Save tap.

## TL;DR

- One sheet (`CaptureSheet.tsx`), one parse hook (`useCaptureSheetParse.ts`),
  one server endpoint (`api/capture.ts`). Everything that creates an `entries`
  row through the UI flows through this surface.
- Six entry points: free text, voice transcript, photo (camera/library),
  document (PDF/Word/Excel/VCF), vault (encrypted), someday (raw GTD inbox).
- Server-side: idempotency reserve → free-tier quota → source_url dedup →
  INSERT → audit log → **awaited** `enrichInline` → fire-forget
  `detectAndStoreMerge` → fire-forget `updateStreak`.
- Vault entries skip `/api/capture` entirely — they go to `/api/vault-entries`
  encrypted client-side. Background entries skip the endpoint too — the
  shell-level `onBackgroundSave` queue owns the POST + toast.

---

## File map

| File | Role |
|---|---|
| `src/components/CaptureSheet.tsx` (607 lines) | Sheet shell — drag-handle, FocusTrap, brain pill, tab switch (entry/secret), Escape handler, body scroll lock |
| `src/components/CaptureEntryBody.tsx` | Textarea + action bar (mic, camera, attach, vault, someday, save) |
| `src/components/CapturePreviewPanel.tsx` | Edit-and-save panel shown when AI fails to classify |
| `src/components/CaptureSecretPanel.tsx` | Title + content form for vault entries |
| `src/hooks/useCaptureSheetParse.ts` (793 lines) | `doSave`, `capture`, `confirmSave`, file extraction handlers |
| `src/hooks/useVoiceRecorder.ts` | MediaRecorder → transcribe via `/api/llm?action=transcribe` |
| `src/lib/fileExtract.ts` | PDF / Word / Excel / image text extraction |
| `src/lib/fileSplitter.ts` | Splits large docs into multiple AI-classified entries |
| `src/lib/vcfParser.ts` + `contactPipeline.ts` | VCF → categorize → save each contact as `type='person'` |
| `src/lib/learningEngine.ts` | Records user overrides (title/type/tag edits) for prompt-tuning |
| `api/capture.ts` (510 lines) | `handleCapture`, `handleSaveLinks`, `handleEmbed` — three actions on one function |
| `api/_lib/idempotency.ts` | `reserveIdempotency` / `finalizeIdempotency` / `releaseIdempotency` |
| `api/_lib/usage.ts` | `checkAndIncrement` for `captures` action — free-tier monthly cap |
| `api/_lib/completeness.ts` | Auto-stamps `metadata.completeness_score` |
| `api/_lib/enrich.ts:649` | `enrichInline` — five-step pipeline awaited at end of capture |
| `api/_lib/mergeDetect.ts:260` | `detectAndStoreMerge` — fire-forget after enrichment lands |

---

## Six entry points

All resolve to the same `capture(text)` or `doSave(parsed)` call inside the
hook. The handler dispatches based on `parsed.type`.

| Trigger | Source | Pre-processing | Reaches |
|---|---|---|---|
| Free text | `<textarea>` in `CaptureEntryBody` | Trim, append uploaded-file content | `capture()` → AI classify |
| Voice | `useVoiceRecorder.startVoice` | MediaRecorder → `/api/llm?action=transcribe` → text appended to textarea | `capture()` → AI classify |
| Photo (camera) | Hidden `<input capture="environment">` | `extractTextFromFile` (multimodal LLM read) → file chip | `capture()` with `[File: name]` block |
| Photo (library) | Hidden `<input accept="image/*">` | Same as camera | `capture()` |
| Document | Hidden `<input accept=".pdf,.docx,.xlsx,.vcf,…">` | `handleDocFiles` → text extract + chip; VCF takes a separate contact-pipeline path | `capture()` (multi-entry split if multiple files) |
| Vault | "Vault" button → tab swap to secret panel | `encryptEntry` (AES-GCM, vault key from `useVaultOps`) | `doSave({type:'secret'})` → `/api/vault-entries` |
| Someday | Power-user toggle in action bar (gated by `somedayEnabled` prop) | None — text saved verbatim | `doSave({type:'someday'})`, **skips AI parse** |

The "auto-classified" path is the default. Someday is the only "I know what
this is, don't think about it" escape hatch on the client. Vault is the only
encrypted path.

---

## Client lifecycle — `useCaptureSheetParse`

### Inputs

```ts
interface UseCaptureSheetParseOptions {
  brainId?: string;          // active brain or per-capture override
  isOnline: boolean;          // toggles offline NLP-only path
  cryptoKey?: CryptoKey | null; // vault key, required for type='secret'
  onCreated: (entry: Entry) => void;
  onClose: () => void;
  onBackgroundSave?: (entry) => void; // shell-level background queue
}
```

`brainId` resolves at the sheet level: per-capture override (`captureBrain`,
set via the brain pill) wins over the prop (active brain). The hook sees only
the resolved id.

### Three save paths inside `doSave(parsed, rawContent?)`

```ts
if (parsed.type === "secret") {
  // Vault path — encrypts client-side, posts to /api/vault-entries.
  // Never touches /api/capture, never enriches, never embeds.
}
else if (onBackgroundSave) {
  // Background path — calls the parent's queue. Sheet closes immediately,
  // a toast tracks progress. Used when the shell is mounted; bypasses the
  // hook's own POST so re-tries / offline buffering live in one place.
}
else {
  // Normal path — POST /api/capture, await response, fire onCreated()
  // with optimistic enrichment.embedded flag, close sheet on success.
}
```

The hook's response handler stamps `enrichment: { embedded, concepts_count: 0,
has_insight: false }` on the optimistic entry — these are *placeholder* values.
The real enrichment fires server-side and writes to the DB in the same request
(see "Server flow"); the next refresh / realtime push delivers the truth.

### `capture(text, clearText)` — AI parse

The orchestrator that takes raw text + uploaded files and decides whether to:

1. **Save offline** — `!isOnline`, calls `parseTask` (local NLP) and goes
   straight to `doSave` with no AI round-trip.
2. **Save single** — JSON has a `title` → `doSave(parsed, raw)`.
3. **Show preview** — JSON has no title or parse failed → mount
   `CapturePreviewPanel` so the user can edit and confirm. The toast tells
   them their override will train future prompts.
4. **Save multiple** — array result (multiple files in one capture) → loop
   `POST /api/capture` per entry, `onCreated` per success, summary toast at
   the end. Failures don't roll back successes.
5. **Fall back to /api/llm?action=split** — only when the primary AI call
   returns a non-OK status. Gives a second chance at a structured response.

The first AI call goes to `callAI` with `json: true` and either
`PROMPTS.FILE_SPLIT` (multiple files) or `PROMPTS.CAPTURE` (single). The
system prompt has today's date injected centrally by `buildSystemPrompt` —
**don't add another date prefix here**, it duplicates.

### `confirmSave(restoreText?)` — preview path

Fires when the user accepts the preview panel. Records three kinds of decision
in `learningEngine` if anything changed vs the AI's original suggestion:

| `recordDecision` type | Fires when | Feeds |
|---|---|---|
| `TITLE_EDIT` | `previewTitle.trim() !== preview.title` | Per-brain title prompt-tuning |
| `TYPE_MISMATCH` | `previewType !== preview.type` | Type-classifier override stats |
| `TAG_EDIT` | sorted-tags string differs | Tag suggestion training |

Only fires when `brainId` is set — global captures (no brain) skip the
learning loop because there's nowhere to write the decisions.

### File handlers

| Handler | Accepts | Pipeline |
|---|---|---|
| `handleImageFile(file)` | image/* up to 5 MB | `extractTextFromFile` → adds to `uploadedFiles` chip list |
| `handleDocFiles(files[])` | mixed list | Per-file dispatch: VCF → `handleVcfFile`; image/* → `handleImageFile`; else → text extract chip |
| `handleVcfFile(file)` | text/vcard | `parseVCF` → `runContactPipeline` (AI categorize) → loop `POST /api/capture` per contact, `onCreated` per success |
| `retryLastFile()` | none (uses `failedFileRef`) | Re-runs whichever path matches the last failure |

VCF gets its own path because the contact list is conceptually one capture but
needs to land as N rows with `type='person'`. Going through the standard
multi-entry split would lose phone normalization and category tagging.

`FILE_CONTENT_LIMIT = 150_000` chars (~40 K tokens, ~75 dense PDF pages) is the
per-file slice cap. Older 6 K cap was clipping after three pages and dropping
the rest of the document silently.

### State model

```
loading        — Save in flight (blocks textarea + Save button)
extracting     — File being read in background (blocks Save only;
                 textarea stays editable so the user can type instructions)
status         — null | "thinking" | "saving" | "saved" | "reading" |
                 "transcribing" | "splitting" | "Saving N entries…" |
                 "Categorising N contacts…" | "Saving N contacts…"
errorDetail    — last error string, surfaces in the panel
fileParseError — last file that failed, drives the retry button
preview        — non-null shows CapturePreviewPanel instead of CaptureEntryBody
uploadedFiles  — array of {name, content} chips
```

---

## Server flow — `handleCapture` (`api/capture.ts:71`)

Single function, called via `withAuth` wrapper which handles JWT verify, rate
limit (30/min for default action, 120/min for embed), and the `cacheControl:
no-store` header.

### Validation gate

| Check | Failure mode |
|---|---|
| `p_title` non-empty string | 400 `Missing or invalid title` |
| `p_extra_brain_ids` array of valid UUIDs ≤ 5 | 400 |
| `requireBrainAccess(user, p_brain_id)` | 403 — user not on brain |
| `requireBrainAccess` for each extra brain | 403 |
| `metadata` ≤ 64 KB serialized | 400 `metadata too large` |
| `source_url` http/https only | 400 (SSRF guard) |

`safeBody` clamps strings: title ≤ 500, content ≤ 200 K, type ≤ 50 chars
lowercased, tags ≤ 50 items.

### Idempotency (atomic reserve)

```ts
idempotencyKey = normalizeIdempotencyKey(req.headers["idempotency-key"]);
```

Three outcomes from `reserveIdempotency`:

| `kind` | Meaning | Response |
|---|---|---|
| `replay` | Same key already finalized → return prior entry id | `200 { id, idempotent_replay: true }` |
| `in_flight` | Same key currently reserving — concurrent request | `409 { error: "duplicate_in_flight" }` |
| `reserved` | New slot owned by this request | proceed |

Any throw inside `runCapture()` triggers `releaseIdempotency` so a transient
failure doesn't permanently block the key. Successful insert calls
`finalizeIdempotency(user.id, key, entry.id)` — fire-forget; if it loses, the
slot expires by TTL.

### Usage gate (free-tier only)

Only when `GEMINI_API_KEY` is set on the server (i.e. platform AI is on).

1. Read `user_ai_settings` — `plan` + whether user has any BYOK key.
2. `checkAndIncrement(user, "captures", plan, hasKey)`:
   - BYOK users short-circuit `allowed: true`.
   - Free users hit the monthly cap → `429 monthly_limit_reached` with
     `upgrade_url: /settings?tab=billing`.

`quota_unavailable` (503) is the soft-fail when the usage table is unreachable
— surfaced to the client so it can retry rather than show "limit reached"
falsely.

### Source-URL dedup

Cheap fast-path before INSERT: if `metadata.source_url` (or `metadata.url`) is
set, point-query `entries_user_source_url` index. Match → PATCH the existing
row's `metadata.sources[]` to track the new ingest, return `{ id, merged: true
}`. Never inserts a new row.

The unique index is also enforced server-side, so the actual INSERT can still
return `409` even if the dedup miss. The 409 path then re-resolves the existing
id from `metadata->>source_url` (filtering by `user_id` alone returns a random
entry for that user — the `source_url` filter is required).

### INSERT → audit → enrich → merge

```
INSERT entries (...)                         → response.ok, data.id
↓
finalizeIdempotency(user, key, id)           fire-forget
audit_log INSERT { action: 'entry_capture' } fire-forget
↓
await enrichInline(id, user)                 ⚠ awaited — this is the slow path
↓
detectAndStoreMerge(id, user)                fire-forget (notification only)
updateStreak(user)                           fire-forget (auth.users.user_metadata)
```

`enrichInline` is **awaited** because Vercel kills the function as soon as the
response goes out. A fire-and-forget Promise here would never resolve. Capture
has `maxDuration: 30` in `vercel.json` which is the budget for the entire
request including the LLM round-trips.

`detectAndStoreMerge` runs *after* `enrichInline` so the source entry has its
full fingerprint (embedding + concepts + parsed metadata) before scoring. See
`api/_lib/mergeDetect.ts:1-31` for the scoring matrix.

### Inline enrichment — what runs in those 30 seconds

`enrichInline` (`api/_lib/enrich.ts:649`) loops the steps the entry hasn't
already done. For a fresh capture that's all of them:

1. **parse** — extracts due_date / day_of_month / priority / energy from the
   text (cheap LLM call with structured output)
2. **insight** — one-line "what this is for" annotation
3. **concepts** — 0..N concept rows attached to `metadata.concepts[]`
4. **persona** — pulls 0..N short facts and writes new `type='persona'` rows
   linked back via `metadata.derived_from`
5. **embed** — Google embeddings, 768-dim, written to the `embedding` column

Each step is wrapped in a `runStep` helper that accumulates errors. Failure on
any step is non-fatal: the entry still saves, errors stamp
`metadata.enrichment.{last_error, attempts, last_attempt_at}` so the
diagnostic UI (PICE bubble in `EntryListBits`) can show "tried but crashed"
instead of "haven't tried yet."

Successful runs clear `last_error` so an entry that recovered isn't tagged
with stale failure context.

---

## Multi-entry capture flow

When the user uploads multiple files (or a single doc that splits), the AI
returns an array. Two code paths handle this:

| Path | When | Loop |
|---|---|---|
| Hook-side multi-save | AI returned `[…]` directly | `for entry of parsedRaw: POST /api/capture; onCreated(...)` |
| Split fallback | First AI call returned non-OK and `/api/llm?action=split` succeeded | Same loop, different source |

Each iteration is its own POST, its own enrichInline, its own merge-detect.
Failures collect in `failedTitles[]` — the summary toast says
`3 of 5 saved. Failed: A, B`. No transactional rollback; partial success is
the contract.

---

## Brain selection

Two layers:

1. **Active brain** (`useBrain` context) — app-wide, persists across sessions.
2. **Per-capture override** — the brain pill in the sheet's top strip. Only
   shown when `multiBrain` flag is on **and** there's more than one brain.
   Resets when the sheet closes (`setCaptureBrain(null)` in the unmount
   effect).

`effectiveBrainId = captureBrain?.id ?? brainId` is what flows through to
`/api/capture`'s `p_brain_id`. The server validates access via
`requireBrainAccess` before insert.

`p_extra_brain_ids` (array, max 5) lets a single entry land in multiple
brains. Currently no UI sets this — it's reserved for the cross-brain pin
feature designed but not yet shipped.

---

## Recent changes worth knowing

- **2026-04-29**: Brain pill compressed into the drag-handle row instead of
  a separate banner. Earlier the "Capture into <brain> ▾" label sat below the
  handle eating ~36px of vertical space.
- **2026-04-29**: `enrichInline` rewritten with `runStep` wrapper. Before this,
  any single step throwing dropped the rest silently — `metadata.enrichment`
  stayed `null` even after partial work. Now per-run breadcrumbs always
  stamp.
- **2026-04-28**: `enrichBrain` (the cron path, separate from inline)
  batchSize 3 → 50 + 240s time-budget guard. The 3-batch cap meant free-tier
  brains were chewing through their daily window 3 entries at a time and
  never fully catching up.
- **2026-04-27**: `audit_log` migration 057 went live. Every capture now
  writes a row with `action='entry_capture'` (service-role insert; users can
  read their own via RLS).
- Idempotency reserve/finalize/release pattern (replaces the older
  check-then-act race that could double-insert under concurrent retries).

---

## Known limitations / future work

- **30s function budget** is the hard ceiling for the whole capture path
  including all five enrichment steps. Slow Gemini days can cause one or two
  steps to skip — they re-run on the daily cron. The user sees the entry
  immediately; the PICE bubble fills in over the next 24 h.
- **No offline INSERT queue** for normal entries — offline path (`!isOnline`)
  uses local NLP only and writes via the same online endpoint, so a hard
  offline still fails the POST. The someday page lists "offline capture
  queue" as a future-work item.
- **Multi-entry partial success** has no rollback. If 3/5 entries save and 2
  fail, the user has 3 new rows + an error toast. They can re-paste the
  failed ones, but the AI parse cost on the 3 successes is sunk.
- **Source-URL dedup is exact-match only**. `https://example.com/x` and
  `https://example.com/x?utm=…` are different URLs → two rows. No
  query-string normalisation.
- **`onBackgroundSave` path** doesn't surface enrichment errors to the user
  — the toast says "saved" once the row lands. The error breadcrumbs are
  only visible by opening the entry detail and reading the PICE bubble.
- **VCF contacts** don't run merge-detect. Phone match is one of the
  strongest dedup signals (50pts), but contact pipeline saves bypass the
  awaited path. A user re-importing a VCF gets duplicates.
- **`captureBrain` per-capture override is not persisted** — closing and
  re-opening the sheet resets to active brain. This is intentional (it's an
  "into THIS brain just this once" gesture) but means a user who wants 3
  captures into a side brain has to re-pick three times.
