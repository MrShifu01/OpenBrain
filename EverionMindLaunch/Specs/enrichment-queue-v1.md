# Spec: Enrichment Queue v1 (Phase 2A)

**Status:** Shipped 2026-05-06 (commit `beecc65`).
**Owner:** Christian.
**Migrations:** `081_enrichment_queue.sql`, `082_recompute_enrichment_state.sql`.

The scale-readiness foundation that lets the enrichment pipeline survive
hundreds-of-RPS bursts and 10k+ users without burning Gemini quota or
melting Vercel function concurrency.

## Problem

The enrichment pipeline (parse → insight → concepts → embed → persona)
worked fine at one user but four ceilings would bite hard at 10k:

1. **Vercel concurrency.** Awaited enrichment held a function open for
   3-5s per entry. Burst capture would saturate the 1000-concurrent ceiling
   on Pro within seconds and start 503ing.
2. **Gemini rate limits.** No per-user throttle. One user importing 1000
   emails could empty the project's per-minute quota and freeze enrichment
   for everyone else.
3. **One bad user starves all.** `enrichBrain` iterated brains FIFO with a
   hard time budget. A user with 500 pending entries would consume the whole
   sweep, leaving every other user's enrichment to wait 24h for the next
   daily cron.
4. **No cost ceiling.** A free-tier user could capture 1000 entries/day at
   $0.001 each — roughly $30/mo per abusive account. Multiplied across
   sign-ups this gets ugly fast.

Plus: zero observability. "How many entries are stuck enriching?" was
unanswerable without scanning every row's metadata.

## Decisions

### Decision 1 — Top-level state column, not derive-from-flags

Added `enrichment_state text` to `entries`:

```
'pending'        → needs work
'processing'     → claimed by a worker (with enrichment_locked_at)
'done'           → fully enriched OR doesn't need enrichment (vault/persona/deleted)
'failed'         → attempts >= 5; admin must clear via enrich-retry-failed
'quota_exceeded' → user hit their tier's daily cap; resets next day
```

**Why a column instead of a SQL view over `metadata.enrichment.*` flags:**
the worker needs `SELECT FOR UPDATE SKIP LOCKED` against an indexable
column. Flag-based queries can't be partial-indexed cleanly across the
five state-transitions, and JSON path expressions perform worse than a
text equality check at scale.

The metadata flags are still authoritative for individual steps (P/I/C/E
chips read from them); the state column is a roll-up.
`recompute_enrichment_state(uuid[])` keeps the column convergent with the
flags after every batch run.

### Decision 2 — FOR UPDATE SKIP LOCKED claim, not a separate queue table

`claim_pending_enrichments(user_id, brain_id, limit) → setof uuid`

Atomically:
1. Find rows where `state='pending'` OR (`state='processing'` AND
   `locked_at < now() - 5min`).
2. `FOR UPDATE SKIP LOCKED` — concurrent workers don't fight.
3. UPDATE state='processing', locked_at=now.
4. Return the IDs.

**Why not a separate jobs table:** entries IS the queue. Adding a `jobs`
table with foreign keys to entries would double the write amplification on
every capture (insert entry + insert job) for zero benefit at our scale.
Postgres `FOR UPDATE SKIP LOCKED` has been the gold-standard "queue
pattern" since 9.5 (2016) — it's simpler, has fewer moving parts, and
makes admin debugging trivial (`SELECT * WHERE state='pending'`).

**Stale claim recovery (5min):** if a worker crashes mid-flight, the
'processing' row would otherwise be stranded. The 5-minute window means
the next sweep automatically re-claims it. Tuned to be longer than the
worst-case enrichInline runtime (~20s currently) and shorter than the
hourly cron interval.

### Decision 3 — Daily quota, not monthly

`user_enrich_quota(user_id, date, count)` + `consume_enrich_quota(user_id, limit) → (allowed, used)`.

Tier mapping (`api/_lib/enrichQuota.ts:TIER_DAILY_QUOTA`):

| Tier | Daily limit | Notes |
|---|---|---|
| free | 20 | Honest free-tier ceiling — covers normal personal use, blocks abuse |
| starter | 200 | Heavy personal user, light prosumer |
| pro | -1 (unlimited) | Sentinel checked client-side before the RPC call |
| max | -1 (unlimited) | Same |

**Why daily, not monthly:** monthly resets concentrate abuse risk into
end-of-month sprints (a free user could capture nothing for 28 days then
import 600 entries on day 30). Daily resets distribute risk evenly and
match how users actually use the app.

**Why per-tier hardcoded constants, not DB column:** the limits are policy,
not user data. Living in code means changing them is a code review, not a
production data update. Add a `user_profiles.enrich_quota_override` column
in v2 if specific users need bespoke limits.

**Fail-OPEN on infra error.** If `consume_enrich_quota` errors (Supabase
500, network blip), the helper logs and lets enrichment proceed. Cost of
one misbilled enrichment is far smaller than freezing the pipeline for
every user when Supabase is having a bad minute.

### Decision 4 — Backward compatible, additive

ZERO behavior change for existing call sites. Capture, llm, mcp, v1, and
the entries PATCH path all still call `enrichInline(id, userId)` exactly
as they did. The new state column / quota / claim RPC are invisible
plumbing. The only user-facing impact is quota enforcement, which only
kicks in when a free-tier user exceeds 20/day (currently zero such users).

This means Phase 2B (async capture, fire-fast pattern) can land
incrementally without re-architecting; the queue infrastructure is
already there to consume from.

## Architecture

```
┌──────────────────────────┐
│ entry-creation door      │  capture / llm / mcp / v1 / entries-PATCH
└──────────────┬───────────┘
               │ awaits
               ▼
┌──────────────────────────┐
│ enrichInline(id, userId) │  api/_lib/enrich.ts
│  ──────────────────────  │
│  early exit:             │
│   secret → state=done    │
│   all flags green → done │
│  quota gate:             │
│   over → state=quota_x   │
│  stamp processing+locked │
│  parse / insight / concepts / persona
│  embed (if !skipEmbed)   │
│  recompute state         │
└──────────────────────────┘

                 ── failure / cold start / kill ──
                                  │
                                  ▼
┌────────────────────────────────────────┐
│ Cron sweep (hourly + daily)            │  api/user-data.ts
│  ────────────────────────────────────  │
│  enrichAllBrains({mode})               │
│   for each brain:                      │
│     ids = claim_pending_enrichments    │
│     for each id: enrichInline (skipEmbed=true)
│     bulkEmbedBatch(remaining)          │
│     recompute_enrichment_state(ids)    │
└────────────────────────────────────────┘
```

## File map

| File | Role |
|---|---|
| `supabase/migrations/081_enrichment_queue.sql` | Schema: enrichment_state column, partial index, user_enrich_quota table, claim_pending_enrichments RPC, consume_enrich_quota RPC |
| `supabase/migrations/082_recompute_enrichment_state.sql` | recompute RPC — converges state column with metadata flags |
| `api/_lib/enrichQuota.ts` (new) | TIER_DAILY_QUOTA, fetchUserTier, checkAndConsumeQuota, readQuotaUsage |
| `api/_lib/enrich.ts` | enrichInline gains state stamps + quota gate; enrichBrain switched from PostgREST query to claim RPC |

## State machine

```
                         ┌─────────────┐
                         │   pending   │
                         └──────┬──────┘
                                │  enrichInline starts
                                ▼
                         ┌─────────────┐
                ┌────────│ processing  │────────┐
                │        └──────┬──────┘        │
   all flags    │               │ stale >5min   │ flags incomplete
   green        │               ▼               │ (LLM 429 etc.)
                │        ┌─────────────┐        │
                │        │ reclaimable │ ──┐    │
                │        └─────────────┘   │    │
                │                          │    │
                ▼                          ▼    ▼
         ┌─────────────┐          ┌─────────────┐
         │    done     │          │   pending   │   (back to top, attempts+=1)
         └─────────────┘          └─────────────┘

           ┌─────────────────┐         ┌─────────────────┐
           │ quota_exceeded  │         │     failed      │
           └─────────────────┘         └─────────────────┘
            (quota gate)                (attempts >= 5)
            resets next day             admin clears via /api/entries
                                        ?action=enrich-retry-failed
```

## Observability

```sql
-- Queue depth, by state
select enrichment_state, count(*) from entries
where deleted_at is null group by 1;

-- Per-user quota usage today
select u.email, q.count, q.date
from user_enrich_quota q
join auth.users u on u.id = q.user_id
where q.date = current_date order by q.count desc limit 20;

-- Stuck rows (claimed >5min ago, will be reclaimed next sweep)
select id, title, enrichment_locked_at,
  extract(epoch from (now() - enrichment_locked_at)) as held_seconds
from entries where enrichment_state = 'processing'
  and enrichment_locked_at < now() - interval '5 minutes';

-- Failed entries needing admin attention
select id, title, metadata->'enrichment'->>'last_error' as last_error,
  metadata->'enrichment'->>'attempts' as attempts
from entries where enrichment_state = 'failed' and deleted_at is null;
```

## Capacity model (back-of-envelope)

At paid Gemini tier (~1000 RPM), each entry consumes ~5 LLM calls. Steady
state ceiling: ~12k entries/hour or ~280k/day. Cost: ~$280/day at full
ceiling, but realistic load is 5-10% of that.

Vercel function concurrency is the second ceiling. With 3-5s awaited
enrichment per entry on the hot path, the project's Pro 1000-concurrent
limit caps inbound capture RPS to ~200-300 sustained. Phase 2B (Decision 5
below) raises that ceiling by another 10x.

Worker throughput is the third ceiling. Hourly cron runs `enrichAllBrains`
with 90s budget across all brains. At 30 entries/brain × N brains, the
per-pass throughput is bounded by Gemini latency × concurrency. Today
realistic max is ~50-100 entries per hourly sweep — fine until ~5k
active users; past that, the cron becomes the bottleneck.

## What this gets us

- Comfortable runway to ~5k active users on the current Vercel/Gemini
  stack.
- Cost predictable per tier — abuse caps at quota_exceeded.
- Observable: admin SELECT can answer "how's the pipeline doing?"
  instantly.
- Foundation for Phase 2B (async capture / fire-fast) — switch
  individual call sites to write `state='pending'` and return immediately,
  worker drains within a minute. UI uses Supabase realtime to flip chips
  green when work completes. Drops capture latency to <200ms while keeping
  the same backend.

## Future work

### Phase 2B — async capture (decision deferred, infrastructure ready)

Switch capture/llm/mcp/v1 from `await enrichInline(id, userId)` to:

```ts
// Skip awaiting — entry returns 'pending', worker drains within ~1min.
// Optional: kick the worker explicitly via a queue-poke endpoint.
```

Tradeoffs:
- ✅ Capture latency drops from 3-5s to <200ms (mobile feel)
- ✅ Vercel function concurrency ceiling 10x'd (no more held-open
  connections)
- ❌ UX shows red P/I/C chips for ~30-60s after capture (until next
  worker pass)
- ❌ Need Supabase realtime subscriptions to flip chips when worker
  completes

Trigger: when capture latency or function concurrency limits become
user-visible. Probably ~3000-5000 active users.

### Phase 3 — Vercel Queues / Inngest migration

When the cron worker can't keep up (~10k+ active users):

- Move from cron-driven sweep to event-driven worker
- Per-user round-robin scheduling (no one user can starve the queue)
- Step-level durability + retry with exponential backoff
- Dashboards built-in (queue depth, per-tenant throughput, p95 latency)
- Cost: ~$50-200/month at expected scale

Vercel Queues (Beta) is the lowest-friction option since it's native
to the platform; Inngest is best-in-class for workflow durability if
the pipeline grows multi-step.

### Smaller follow-ups

- Per-user round-robin in `enrichAllBrains` (today: per-brain budget,
  one user with 5 brains can dominate). Phase 3 makes this irrelevant
  but a pre-Phase-3 patch would help.
- `user_profiles.enrich_quota_override` column for bespoke limits
  (paying customers who need more than starter/pro defaults).
- "You've used 14/20 today" UI surface using `readQuotaUsage`. Hidden
  for unlimited tiers.
- Periodic stuck-row alarm (cron-daily): if any row has
  `enrichment_state='processing'` for >1h, page the admin.
