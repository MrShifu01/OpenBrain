# Gmail Sync Flow

End-to-end map of how an email becomes an entry. OAuth → cron-pulled inbox →
(classify or cluster) → stage → user review → accept/reject signals →
distillation feeds the next scan's prompt. The most active bug surface in
the codebase — staged-count, swipe-stale-state, category-prefs, and
daily-cron-failure-to-fire all happened in this one flow this week.

## TL;DR

- One module (`api/_lib/gmailScan.ts`, 2088 lines) does the whole pipeline.
  Three public entrypoints: `scanGmailForUser` (incremental, history API +
  polling fallback), `deepScanBatch` (cursor-paged historical back-fill),
  `runGmailScanAllUsers` (cron entry — concurrent across users).
- **Two scan modes**, selected by `prefs.fetchAll`:
  - `fetchAll: true` (**default**) — fetch everything in lookback window
    including Promotions/Social; **skip the LLM classifier**; cluster by
    ~95% semantic similarity; user reviews one card per cluster.
  - `fetchAll: false` (legacy / opt-out) — narrow the corpus via subject-
    keyword filter built from ticked categories, run Gemini/Anthropic
    classifier, persist matches.
- Entries land with `status='staged'`. Filtered out of the main entries
  view. User reviews via the staging inbox (Tinder-style swipe) — accept
  flips to `status='active'`, reject deletes. Both record a
  `gmail_decisions` row that feeds the next scan's prompt.
- Gmail dedup is multi-key: thread_id, message_id, and
  `(sender_email, normalized_subject)` — all checked AND reserved before
  any await so concurrent classified matches in `Promise.all` can't
  double-stage.

---

## File map

| File | Role |
|---|---|
| `api/_lib/gmailScan.ts` (2088) | Whole pipeline — query builders, fetch, thread group, bulk-skip, classify, cluster, persist, contacts, learnings |
| `api/_lib/distillGmail.ts` | LLM distillation of accept/reject decisions → `accepted_summary` / `rejected_summary` columns; loads recent 5 per side |
| `api/_lib/gmailCrypto.ts` (`encryptToken` / `decryptToken`) | At-rest encryption for `access_token` / `refresh_token` |
| `api/gmail.ts` (337) | OAuth flow + `?action=` dispatch (`integration` / `preferences` / `scan` / `deep-scan` / `delete-entries` / `ignore`) |
| `src/components/settings/GmailSyncTab.tsx` (895) | Settings UI — connect, prefs modal, scan triggers, deep-scan progress, staging badge |
| `src/components/settings/GmailSetupModal.tsx` (612) | First-run flow — OAuth handoff, category picks, lookback window |
| `src/components/settings/GmailStagingInbox.tsx` (669) | Tinder-style swipe review |
| `src/components/settings/GmailScanReviewModal.tsx` (659) | Legacy modal-based review (still wired for `gmail_review` notif type) |
| `src/hooks/useStagedCount.ts` | Polls `GET /api/entries?staged=true` for the bell badge |
| `api/user-data.ts:1320` (`runGmailScanAllUsers` call site) | Daily cron invocation |

---

## Database surface

| Table / column | Purpose |
|---|---|
| `gmail_integrations` | One row per user. Encrypted tokens, `preferences` JSONB, `last_scanned_at`, `history_id`, `accepted_summary`, `rejected_summary`, `scan_enabled` |
| `entries` (`status='staged'`) | Pre-review staged emails. Hidden from main views. Becomes `status='active'` on accept; deleted on reject |
| `entries.metadata.source = 'gmail'` | Marks gmail-derived rows |
| `entries.metadata.cluster` | Present in cluster-mode rows: `{size, sender_domain, subject_norm, members[]}` |
| `gmail_decisions` | Per-decision audit row — accept/reject + subject/from/snippet/reason. Source for distillation |
| `entries.brain_id` | Routed through `activeBrainId` parameter — defaults to user's personal brain via `getUserBrainId` |

---

## OAuth + integration setup

```
GET  /api/gmail?action=auth         → 302 to Google consent
GET  /api/gmail/auth/callback        → exchange code, encrypt tokens, INSERT/UPDATE gmail_integrations
GET  /api/gmail?action=integration   → check connection state for Settings UI
PUT  /api/gmail?action=preferences   → update prefs JSONB (categories, custom, lookbackDays, fetchAll)
DELETE /api/gmail                    → remove integration (revokes locally; user must also revoke in Google account)
```

Tokens are encrypted at rest via `encryptToken` (see `api/_lib/gmailCrypto.ts`).
`refreshGmailToken` checks expiry with a 60s buffer and posts to
`oauth2.googleapis.com/token` with the refresh token. Failure returns
`null` → scan exits early with `tokenRefreshFailed: true` in debug.

---

## The two scan modes

Switched by `preferences.fetchAll` on the integration row.

### Cluster mode (`fetchAll: true`, default)

```
fetchMessageList (no subject filter)
  ↓ all primary + Promotions + Social in lookback window
hydrateThreadBlocks
  ↓ thread groups
isBulkThread filter (List-Unsubscribe, no-reply, Auto-Submitted)
  ↓ usable blocks
clusterThreadBlocks                   ← NO LLM CLASSIFIER
  ↓ ThreadCluster[] (signature pass + embedding pass)
persistClusters                        → entries with status='staged', metadata.cluster
  ↓ user reviews via staging inbox
gmail_scan notification                "Staged N clusters (M emails)"
```

**Why this is the default:** narrowing by subject keywords masked 60-80%
of most users' inboxes — they ticked 2 of 7 categories and saw nothing
because their actual emails (newsletters, vendor updates, family threads)
matched none of the keyword OR-lists. Cluster mode shows everything
collapsed to ~one card per kind so the user can reject 50 newsletters in
one swipe.

### Classifier mode (`fetchAll: false`)

```
buildSubjectFilter(prefs)              ← OR-list of CATEGORY_SUBJECT_KEYWORDS
fetchMessageList (with subject filter, exclude Promotions/Social)
  ↓ narrowed corpus
hydrateThreadBlocks → isBulkThread filter
  ↓
buildPrompt(blocks, prefs, learnings)  ← KEEP/SKIP rules + last 5 each
  ↓
classifyWithGemini OR classifyWithLLM  → JSON array of matches
  ↓
persistMatches                         → deep-extract for typed entries,
                                         contacts upsert, status='staged'
  ↓
gmail_scan + gmail_review notifications
```

`getEffectiveCategories` returns `prefs.categories` verbatim — does NOT
override on fetchAll. Empty selection means empty: `buildPrompt` adapts
the lead-in to drop the category bullet list and lean on learnings +
custom rules instead.

---

## Pipeline stages (shared by both modes)

### 1. Token refresh — `refreshGmailToken`

60-second expiry buffer. POST to `oauth2.googleapis.com/token` with
refresh token, encrypt + persist new access token. Failure → null →
scan bails early.

### 2. Resolve message list

Two paths inside `scanGmailForUser`:

| Trigger | Path | Why |
|---|---|---|
| Manual scan OR no `history_id` saved | Polling — `fetchMessageList` with `after:<sinceUnix>` query | Time-based, honours subject filter, lookback configurable |
| Cron-triggered AND `history_id` exists | History API — `fetchHistoryRefs(historyStart)` | Cheap delta — Gmail tells us only new messages since last checkpoint |
| History API returns 404 | Polling fallback | History window expired (~7 days max retention) |

Hard exclusions (always): `-in:spam -in:trash -from:calendar-notification@google.com -label:chats`.
`fetchAll: false` adds `-category:promotions -category:social` to the
exclusions.

After fetching, the integration row gets PATCHed with
`last_scanned_at = now()` and `history_id = current` for the next run's
delta.

### 3. Hydrate threads — `hydrateThreadBlocks` → `ThreadBlock`

For each fresh `threadId`, `fetchThread` pulls the full conversation,
`parseMessage` extracts headers + body (3000 char cap) + attachments
(name + size + mime, no body extraction yet). `groupByThread` collapses
back to `ThreadBlock { threadId, messages, primary, participants,
attachments, messageIds }`.

Cap: 80 threads on manual scans, 30 on cron, 40 on deep-scan. Stops the
function from chewing through wallclock on dense inboxes.

### 4. Bulk skip — `isBulkThread`

A thread is "bulk" if **every** message looks automated:
- `List-Unsubscribe` header set
- `Precedence: bulk`
- `Auto-Submitted` non-`no`
- `From:` contains `no-reply` / `noreply` / `do-not-reply`

Any human reply in a thread breaks the bulk verdict — mixed conversation
threads (newsletter where someone replied) get classified normally.

### 5a. Cluster (fetchAll mode) — `clusterThreadBlocks`

Two-pass clustering:

```
Pass 1 — signature buckets (no LLM, no embedding cost)
  key = senderDomain + normalizedSubject
  normalize: strip "Re:" / "Fwd:", remove [tickets], #refs, long numbers

Pass 2 — embedding-based merge (if Gemini key + ≥2 buckets)
  embed each bucket's REPRESENTATIVE only (not every member)
  greedy merge: cosine ≥ 0.92 → fold into existing cluster
```

`CLUSTER_COSINE_THRESHOLD = 0.92`. Higher than the persona-fact threshold
(0.85) — clusters represent "user-perceptible duplicates", facts
represent "semantically equivalent statements." A tighter threshold
keeps "Substack newsletter" and "Substack digest" as distinct clusters.

Representative is always the most-recent thread; members sorted by date desc.

### 5b. Classify (legacy mode) — `classifyWithGemini` / `classifyWithLLM`

Gemini path: `gemini-2.0-flash` (env-overridable), `maxOutputTokens:
65536`. Strips ```` ```json ```` fences, matches `[…]`, falls back to
greedy object regex if the array is malformed.

Anthropic path: `claude-haiku-4-5-20251001` (env-overridable),
`max_tokens: 8192`. Plain JSON array match — no fence stripping.

Anthropic is the fallback. If `GEMINI_API_KEY` is set, Gemini wins.

### 6. Persist — `persistClusters` or `persistMatches`

Both paths INSERT into `entries` with `status='staged'`, fire-forget
embedding via `generateEmbedding`, set `metadata.source='gmail'`.

`persistMatches` extra work for the LLM mode:
- `DEEP_EXTRACT_TYPES` (`invoices`, `subscription-renewal`, `appointment`,
  `signing-requests`, ...) → `deepExtractEntry` makes a second LLM call
  that reads body + attachments and pulls structured fields (amount,
  reference_number, account_number, due_date, contact_name + masked
  phone/address)
- `fetchAndExtractAttachments` → multimodal LLM read of PDFs (capped to
  6000 chars in `metadata.attachment_text`)
- `upsertGmailContact` → creates or updates a `type='contact'` entry per
  unique sender (cached per scan via `contactCache` map keyed on email)
- PII masking via `maskPii` — last 4 of phone, last segment of address,
  middle digits of ID number

Dedup keys reserved **synchronously before any await** so concurrent
matches in `Promise.all` can't slip through:

```ts
importedThreadIds.add(block.threadId);
for (const mid of block.messageIds) importedMessageIds.add(mid);
importedSubjectFromKeys.add(`${fromEmail}::${normalizeSubject(subject)}`);
```

Without that ordering, two parallel matches with the same `(sender,
subject)` pair both passed the dedup checks and both INSERTed.

### 7. Notify — `storeNotification`

Always fires `gmail_scan` (the dismissible "scan finished" card in the bell)
with `data.created`. LLM mode also fires `gmail_review` (legacy — review
modal triggered from the notification card, no longer wired by default).

See `Docs/Components/bell.md` for the card components and clearing logic.

---

## The user-review loop

`GmailStagingInbox.tsx` — Tinder-style card stack mounted from
`GmailSyncTab` or directly from the bell card's "Open inbox" action.

```ts
GET  /api/entries?staged=true        → array of staged entries (newest first)
PATCH /api/entries  {id, status:'active'}  ← swipe right (accept)
DELETE /api/entries  {id}                   ← swipe left (reject)
POST /api/entries?action=gmail-decision     ← always, regardless of accept/reject
```

After every swipe, `dispatchEvent("everion:staged-changed")` runs **after**
the PATCH/DELETE resolves so `useStagedCount` (powering the bell badge)
refetches against the new server state. Dispatching before the round-trip
landed kept the count stuck at the pre-accept value.

### Swipe gesture state

```ts
const [dragX, setDragX] = useState(0);   // drives transform
const dragXRef = useRef(0);              // mutable, read in onPointerUp
```

Both move in lockstep. The ref exists because React batches state updates
and `setDragX` may not flush before the user lifts their finger on a fast
swipe. Reading `dragXRef.current` in `onPointerUp` gets the live value —
without it, a quick flick read 0 and the swipe never triggered.

Threshold: |dx| > 100px (or ~30% of card width). Below that, snap back.
Above, advance with directional exit animation (700px slide).

### Cluster-aware decision recording

For cluster cards (size > 1), the decision row's subject/snippet get
augmented:

```
augmentedSubject = "[cluster ×21] Substack daily digest"
augmentedSnippet = "Cluster of 21 similar emails from substack.com.
                    Sample subjects: A | B | C | D | E"
```

Distillation then learns the cluster shape ("user rejects newsletter
roundups from substack-style senders") rather than 21 separate rows for
the same kind of email.

---

## Learnings + distillation

The classifier/cluster decisions feed back into the next scan via two
columns on `gmail_integrations`:

| Column | Source | Used in `buildPrompt` as |
|---|---|---|
| `accepted_summary` | LLM-distilled rules from accept rows in `gmail_decisions` (≥ MIN_FOR_DISTILL recent decisions) | "KEEP RULES" block |
| `rejected_summary` | Same, but reject rows | "SKIP RULES" block |

Plus the last 5 raw accepts and 5 raw rejects per scan are loaded fresh
via `loadRecentGmailDecisions(userId, 5)` and rendered as concrete
examples ("RECENT KEPT EMAILS", "RECENT SKIPPED EMAILS"). Anchors the
distilled rules to actual cases the LLM can compare against.

The distillation pass itself runs on a separate cadence (typically the
weekly cron, see `Docs/Components/cron.md` once written). Both summary
columns can be NULL — `buildPrompt` simply omits those blocks and the
classifier falls back to category logic + custom rules.

---

## Public exports + their callers

### `scanGmailForUser(integration, manual?, activeBrainId?)`

The workhorse. Used by:
- `api/gmail.ts:252` — `POST /api/gmail?action=scan` from Settings → Scan now (manual=true)
- `api/_lib/gmailScan.ts:2078` — `runGmailScanAllUsers` (manual=false, in cron)

Returns `{ created, debug, entries }`. `debug` is the structured trace
with `syncMode`, `totalGmailCount`, `emailsFetched`, `threadsScanned`,
`skippedBulk`, `skippedDuplicates`, `classifierUsed`, `classifierError`,
`created` — surfaced in `GmailSyncTab` for "Last scan" display.

After accept enrichment fires: `enrichBrain(user.id, brainId, 10)` —
batches 10 entries through the inline pipeline so newly-active staged
emails get embedded + concept-extracted before they show up in search.

### `deepScanBatch(integration, {cursor?, sinceMs, activeBrainId?})`

Cursor-paged historical back-fill. UI calls this in a loop with
`nextCursor` chained from the previous response until `done: true`.
Polling-only (history API doesn't go back arbitrarily). Used by Settings
→ Deep scan with a year-long lookback default
(`Date.now() - 365 * 86400_000`).

Rate limit: 3/min/user (vs scan's 5/min) — heavier wallclock cost.

### `runGmailScanAllUsers()` (cron entry)

`SELECT * FROM gmail_integrations WHERE scan_enabled = true`, then
`Promise.all` over every integration. Per-user errors are caught and
counted as `summary.errors` — one user's broken token doesn't block the
others. Returns `{ users, created, errors }`.

Called from `api/user-data.ts:1320` (`handleCronDaily`) — see the
recent-changes section there about the daily-cron-failure-to-fire bug.

---

## `clusterThreadBlocks` + `persistClusters` (cluster-mode pair)

Exported separately so the deep-scan path could in principle reuse them
(it currently doesn't — deep-scan is classifier-only). Useful to know:

- `clusterThreadBlocks(blocks, geminiKey)` — pure pipeline step. Returns
  `ThreadCluster[]`. Falls back to signature-only clustering if the
  embedding batch fails (still useful — same-sender-same-subject is the
  90% case).
- `persistClusters(integration, brainId, clusters, importedSets,
  geminiKey, debug)` — INSERTs one entry per cluster with
  `metadata.cluster`. Cluster summary content shows the representative
  body + a list of up to 5 other member subjects so the reviewer can
  verify the grouping is sane before accepting.

---

## OAuth + endpoints (`api/gmail.ts`)

Single function, action-dispatched. All mutating actions require auth +
rate limit (60/min general, 5/min scan, 3/min deep-scan).

| Method + action | Behavior |
|---|---|
| `GET ?action=auth` | OAuth bounce — userId + prefs encoded in `state` param |
| `GET /auth/callback` | Token exchange, encrypt, insert/update `gmail_integrations` |
| `GET ?action=integration` | Returns `{id, gmail_email, scan_enabled, last_scanned_at, preferences}` for the connected account, or `null` |
| `PUT ?action=preferences` | PATCH `preferences` JSONB |
| `POST ?action=scan` | Trigger `scanGmailForUser(int, true, brain_id)` — rate-limited 5/min |
| `POST ?action=delete-entries` | Bulk DELETE staged entries by id (UUID-validated, capped at 200) |
| `POST ?action=deep-scan` | Trigger `deepScanBatch` with cursor + `sinceMs` — rate-limited 3/min |
| `POST ?action=ignore` | Calls `generateIgnoreRule` (LLM) to translate "this email is noise" feedback into a one-line rule, appends to `preferences.custom` |
| `DELETE` | Removes integration row entirely |

Brain-id IDOR guard on every action that takes `brain_id` —
`requireBrainAccess(user.id, brain_id)` runs before the scan dispatches.

---

## Recent changes worth knowing

- **2026-04-29**: `getEffectiveCategories` no longer overrides on
  fetchAll. Untickeing all categories now actually means "no category
  filter" — prompt drops the bullet list and leans on learnings.
- **2026-04-29**: `everion:staged-changed` event dispatched **after**
  PATCH/DELETE resolves, not before. Bell badge no longer stuck on
  pre-accept count.
- **2026-04-29**: Swipe gesture `dragXRef` ref pattern. Fast flicks no
  longer read stale 0 and refuse to fire.
- **2026-04-29**: Bell badge now lights on `stagedCount > 0` too —
  user with staged-but-unread emails sees a badge even with zero
  notifications.
- **`fetchAll: true` is now the default** for new users. Promotions/Social
  no longer hard-excluded — those tabs are the bulk of most inboxes and
  cluster mode handles them well.
- **Cluster cosine threshold lowered from 0.95 → 0.92** after observing
  near-duplicates ("Substack daily" vs "Substack daily digest") slipping
  through.
- **Decision recording is cluster-aware** — the decision row's
  subject/snippet get the `[cluster ×N]` prefix + sample subjects so the
  distiller learns at the right generality.

---

## Known limitations / future work

- **Daily-cron schedule** has only ever fired manually since being added
  2026-04-28. The `workflow_dispatch` trigger works; the `schedule:`
  trigger has yet to actually run on the real 04:00 UTC slot. Worth
  pinning down in the cron doc.
- **History API gives ≤ ~7 day window** — users whose last scan was a
  while back fall through to polling on every run. Not a bug, but it
  means cron-twice-a-day vs cron-daily makes a real cost difference for
  history-API hits.
- **No incremental cluster updates** — cluster mode re-clusters from
  scratch every scan. A user who accepted "Substack newsletter" yesterday
  still sees the same cluster today (with new members) instead of a
  smaller "since last review" view. Cluster history isn't tracked.
- **`gmail_review` is dead** as a notif type — `persistMatches` still
  emits it for back-compat, but the modal-driven review flow is no longer
  the default UI. Could be removed in a cleanup pass once any in-flight
  notification rows have aged out.
- **Attachments-text is one-shot** — `fetchAndExtractAttachments` runs
  during persist, caches the result in `metadata.attachment_text` (6 KB
  cap). No re-extraction if the user later wants the full content; they'd
  need to re-fetch from Gmail.
- **PII masking is permanent** — `maskPii` runs on insert. The unmasked
  values are never stored. If a user's contact has a real phone number in
  an email and they want to capture it in full, they need to manually edit
  the entry after staging.
- **Contact dedup is per-scan-only** — `contactCache` is local to one
  `persistMatches` call. Cross-scan contact dedup relies on
  `upsertGmailContact`'s server-side check on `(user_id, email)`.
- **`isBulkThread` is conservative** — needs ALL messages to look
  automated. A single human in-reply makes the whole thread classifiable.
  In practice that's the right call but it does pull in long
  customer-support threads where the only "real" message is automated.
- **Manual scan from the bell** isn't wired — the bell card's "Open
  inbox" event opens the staging modal but doesn't trigger a fresh scan.
  User has to navigate to Settings → Gmail Sync → Scan now.
