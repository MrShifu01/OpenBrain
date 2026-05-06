# Spec: Gmail Pattern Rules — scored accept/reject learning

**Status:** Phase 1+2+3 shipped 2026-05-06 (commits `c54edaf`, `0986412`).
**Owner:** Christian.
**Migration:** `080_gmail_pattern_rules.sql`.

A graduated learning system that turns the user's accept/reject decisions
in the Gmail staging inbox into scored pattern rules. Each rule records
how confident we are that emails of that "kind" should be auto-accepted
or hard-blocked.

## Problem

The pre-existing reject rules were soft hints — "consider these as
negative signals" — wrapped around a free-text blob in
`prefs.custom`. Even when the user rejected the same kind of email 30
times, the LLM still surfaced the next one if it judged it "important."
The user wanted rules to STRENGTHEN with each consistent decision until
they became absolute (hard-block / auto-accept), and to DEGRADE for
contested patterns where some are accepted and some rejected.

Plus: no UI to see what the system had learned, no way to edit a
mislearned pattern, no way to delete a pattern that was created by mistake.

## Decision matrix — Alt 1 (decoupled scores)

Two independent scores per pattern, both 0–10:

```
accept_score ≥ 8 AND reject_score ≤ 2 AND past probation → auto-accept (status='active')
accept_score ≥ 8 AND reject_score ≤ 2 AND in probation   → staged + probation badge
reject_score ≥ 8 AND accept_score ≤ 2                    → hard-block (skip embed/LLM)
both > 3                                                  → contested → always staging
otherwise                                                 → normal classifier path
```

**Why decoupled scores not a single net score?**

Net (accept − reject) hides volume. (5 accept, 0 reject) and (50 accept,
45 reject) both net to +5, yet the first is unanimous and the second is
contested. Keeping the dimensions separate means "contested" is a state
the user can see and reason about in Settings, and one stray reject
doesn't flip a +9 pattern to +8 (still auto-accepts).

**Probation window — 7 days.** When `accept_score` first crosses 8,
`auto_accept_eligible_at` is set to `now() + 7 days`. Until that
timestamp, matched emails still go to staging with an "auto-accept by
13 May" badge. Catches runaway classifiers before they flood the
brain. After 7 days of consistent acceptance, future matching emails
bypass staging entirely.

## Architecture

### Schema (migration 080)

```sql
create table gmail_pattern_rules (
  id, user_id,
  embedding vector(768),          -- centroid; gemini-embedding-001
  summary text,                   -- 1-line label for prompt + UI
  example_subject, example_from,  -- anchor for legibility
  accept_score smallint 0..10,
  reject_score smallint 0..10,
  accept_hits int, reject_hits int,
  last_accept_at, last_reject_at,
  auto_accept_eligible_at timestamptz,
  created_at
);

create index ... using hnsw (embedding vector_cosine_ops);
```

`match_gmail_pattern(user_id, query_embedding, threshold=0.82, limit=5)`
RPC returns nearest patterns above the cosine threshold.

### Decision-time (`api/_lib/gmailPatternScore.ts:recordPatternDecision`)

Triggered from `api/entries.ts:handleGmailDecision` after the
`gmail_decisions` insert lands.

```
embed (subject + from + snippet)  → vec
nearest = match_gmail_pattern(user_id, vec, 0.82)
if nearest:
  bump accept_score or reject_score (cap 10)
  if accept newly crosses 8: set auto_accept_eligible_at = now+7d
else:
  insert new pattern at score=1 (anchored to this email)
```

Cosine threshold 0.82 chosen empirically — loose enough to absorb
paraphrase drift ("Capitec credit card" / "Capitec credit-card") but
tight enough to keep distinct patterns distinct ("Capitec credit card"
vs "Capitec home loan").

### Scan-time (`api/_lib/gmailScan.ts`)

**Phase 2 pre-filter** (the cost-saving optimisation): before the
classifier or cluster step, embed every block and look up its verdict.
Hard-block matches drop pre-LLM — saves the embedding round (in cluster
mode) AND the classifier LLM call (in classifier mode).

Verdicts feed `applyPatternVerdict(verdict, entry, metadata)` which
mutates the entry being inserted:

| verdict | result |
|---|---|
| `hard-block` | Drop the entry entirely. Increment `debug.skippedHardBlock`. |
| `auto-accept` (past probation) | `entry.status = 'active'` + `metadata.auto_accept_via_pattern = true`. Skips staging entirely. |
| `auto-accept-probation` (in probation) | `entry.status = 'staged'` + `metadata.auto_accept_pending = true` + `metadata.auto_accept_eligible_at` so UI shows badge. |
| `normal` | No-op. Existing path runs. |

### Prompt-time (`api/_lib/gmailPatternScore.ts:loadScoredRules`)

Patterns scored 4-9 surface to the classifier as labelled bullets:

```
SCORED RULES (curated from your accept/reject history; integer = strength 1-10):
  • [accept 7/10] Capitec credit card promotional offers
  • [reject 6/10] LinkedIn weekly newsletter digests
```

Patterns at 10 are already enforced in code; patterns at 1-3 are noise
(too few decisions to trust); only the middle band where the LLM should
weigh them as judgment hits the prompt.

### UI (`src/components/settings/GmailPatternRules.tsx`)

Settings → Gmail → Learned patterns. Each pattern card shows:

- State pill: `learning` / `contested` / `probation → 13 May` / `auto-accept` / `hard-block`
- Score bars for accept (moss) + reject (danger) with `N/10` numeric readout
- Hit counts + last-fired-at relative timestamp
- Inline edit (textarea + dual sliders + Save / Cancel)
- Delete button

Backed by three `/api/gmail` endpoints:

- `GET ?action=patterns-list` — sorted by `greatest(accept_score, reject_score)` desc
- `DELETE ?action=patterns-delete&id=…` — UUID-validated, user-scoped
- `PATCH ?action=patterns-update` — body: `{id, summary?, accept_score?, reject_score?, auto_accept_eligible_at?}`

## File map

| File | Role |
|---|---|
| `supabase/migrations/080_gmail_pattern_rules.sql` | Schema, HNSW index, match_gmail_pattern RPC |
| `api/_lib/gmailPatternScore.ts` | recordPatternDecision, evaluatePatternsForBlocks, applyPatternVerdict, loadScoredRules, renderScoredRulesBlock |
| `api/_lib/gmailScan.ts` | persistMatches + persistClusters integrated; pre-filter in scanGmailForUser/deepScanBatch; verdict-driven status writes |
| `api/entries.ts` | handleGmailDecision now fires recordPatternDecision after gmail_decisions insert |
| `api/gmail.ts` | patterns-list / patterns-delete / patterns-update handlers |
| `src/components/settings/GmailPatternRules.tsx` | Settings UI — list, edit, delete patterns |
| `src/components/settings/GmailStagingInbox.tsx` | Probation badge on staged-with-auto-accept-pending rows |

## Future work

### Smarter scoring (Phase 4)

The current model (`min(score+1, 10)` per decision) is adequate but loses
information about volume. Two alternatives discussed but deferred:

- **Wilson lower bound** (Bayesian confidence). Score = lower bound of
  95% CI on `accepts/(accepts+rejects)`. Auto-accept when `lower_bound ≥ 0.85`.
  Robust to early noise — 1/1 has lower bound 0.05, won't trigger anything.
  Battle-tested at Reddit/Steam. Con: harder to explain in UI.
- **EWMA temporal decay** (orthogonal — stack with current model). Recent
  decisions weighted heavier; 90-day half-life means a 6-month-old reject
  burst doesn't haunt forever. Cheap to add: store decision timestamps,
  weight by `exp(-age_days / 90)`.

Trigger: when users complain about "I rejected this 3 months ago, why is
it back?" or "this should be hard-blocked but isn't."

### Centroid drift (Phase 4)

Currently each pattern is anchored to its first decision's embedding.
Drift accumulates as users reject paraphrases. Fix: on each accept/reject
hit, blend the new embedding into the centroid via EMA (`centroid = 0.9
* centroid + 0.1 * new_emb`). Needs a SQL function — pgvector arithmetic
isn't expressible via PostgREST.

### "Test pattern" tool

Settings UI could add: paste an email subject/from/snippet, see which
pattern (if any) matches and what score. Useful for diagnosing "why did
this auto-accept" / "why didn't this hard-block."

### Pattern merging / splitting

If two patterns have very similar embeddings (cosine > 0.95), offer to
merge them. If a single pattern has both high accept AND high reject (the
"contested" state), offer to split it into two more-specific patterns.
Both UI surfaces — backed by the same `match_gmail_pattern` RPC.
