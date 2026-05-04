# DB IO Budget Incident — 2026-05-04

Status: **active — waiting on Supabase IO budget to regenerate**.

The Supabase project `wfvoqpdfzkqnenzjxhui` is unhealthy because we
exhausted the daily Disk IO budget. Pooler is rejecting connections;
both the Supabase MCP and the Dashboard SQL editor return
"Connection terminated due to connection timeout" until budget recovers.

This document is the recovery runbook + the permanent fix list. Steps
are ordered so the database stops bleeding first, comes back to green,
then gets the indexes that prevent a repeat.

---

## 1. Stop the bleeding (DONE 2026-05-04)

Disabled every IO-heavy GitHub Actions cron via `gh`:

```bash
gh workflow disable "Daily Cron"
gh workflow disable "Hourly Cron"
gh workflow disable "DB Backup"
gh workflow disable "Weekly roll-up"
```

These four were burning IO on every firing — they fan out into
embedding sweeps, Gmail scans, audit-log writes, and a `pg_dump`-style
backup against the live DB. With them off the project can recover
without us re-filling the bucket from under it.

Left enabled: **CI**, **E2E**, **Lighthouse**, **Test Push**,
**Dependabot Updates**. None of those run on a schedule — they only
fire on push / PR / manual dispatch, so they're under your control.

---

## 2. Wait for budget to regenerate

- Supabase free / hobby plans refill the IO budget on a daily window.
  Pro is uncapped on IO.
- Watch **Dashboard → Settings → Usage** for "Disk IO Budget" climbing
  back above ~10–20%. Once it does, the project flips from unhealthy
  to healthy and the pooler accepts connections again.
- If you're on Hobby and this keeps recurring, the only knobs are
  upgrade to Pro or aggressively reduce per-query IO (section 4).

While the project is unhealthy: **don't deploy** (build hooks probe
the DB), **don't re-enable any cron**, **don't run migrations**.

---

## 3. Diagnose with `pg_stat_statements`

Once Supabase is healthy again, run these three queries in the
Dashboard SQL editor and capture the output. Match each `queryid`
back to the source path so we know what to index.

### 3a. Top shared reads (the biggest disk-burner queries)

```sql
SELECT
  queryid,
  left(query, 500) AS query_sample,
  calls,
  mean_exec_time,
  total_exec_time,
  shared_blks_read,
  shared_blks_hit,
  shared_blks_written,
  temp_blks_written,
  blk_read_time,
  blk_write_time,
  rows
FROM pg_stat_statements
WHERE query NOT ILIKE '%pg_stat_statements%'
ORDER BY shared_blks_read DESC
LIMIT 15;
```

### 3b. Top shared writes

```sql
SELECT
  queryid, left(query, 500) AS query_sample,
  calls, mean_exec_time, total_exec_time,
  shared_blks_read, shared_blks_hit, shared_blks_written,
  temp_blks_written, blk_read_time, blk_write_time, rows
FROM pg_stat_statements
WHERE query NOT ILIKE '%pg_stat_statements%'
ORDER BY shared_blks_written DESC
LIMIT 15;
```

### 3c. Top temp writes (work_mem spills — sorting / hashing on disk)

```sql
SELECT
  queryid, left(query, 500) AS query_sample,
  calls, rows, temp_blks_written,
  shared_blks_read, shared_blks_written, blk_write_time
FROM pg_stat_statements
WHERE query NOT ILIKE '%pg_stat_statements%'
ORDER BY temp_blks_written DESC
LIMIT 15;
```

---

## 4. Likely culprits (and the indexes that fix them)

Educated guess based on this codebase's hot paths. Once the diagnostics
above name names, only ship the indexes that match the `queryid`s — not
this whole list blind.

### a) `match_entries` / `match_entries_for_user` (vector retrieval)

Every chat tool call. If `entries.embedding` doesn't have an HNSW
index, each call does a SeqScan reading every row's 768-dim float
vector. Suspect #1 for read I/O.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS entries_embedding_hnsw_idx
  ON public.entries USING hnsw (embedding vector_cosine_ops);
```

### b) `fetchImportedIdentifiers` in Gmail scan

Selects up to 10,000 rows of `metadata` JSONB on every scan to dedupe
imports. Without a partial index it's a full JSONB SeqScan.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS entries_gmail_source_idx
  ON public.entries (user_id, created_at DESC)
  WHERE metadata->>'source' = 'gmail' AND deleted_at IS NULL;
```

### c) Memory list — brain-scoped GET

`/api/entries?brain_id=X` is the most common GET, fires on every brain
switch + page load. The composite filter is `brain_id = X AND
deleted_at IS NULL AND status = 'active'`.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS entries_brain_active_recent_idx
  ON public.entries (brain_id, created_at DESC)
  WHERE deleted_at IS NULL AND status = 'active';
```

### d) Embedding-pending sweep (cron)

The Hourly Cron sweeps unembedded entries via
`embedding_status = 'pending'`. Without a partial index it scans the
whole table.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS entries_pending_embed_idx
  ON public.entries (created_at DESC)
  WHERE embedding_status = 'pending' AND deleted_at IS NULL;
```

### e) `audit_log` retention

Every entry op writes one row. Read cost is low, but WAL churn can
spike write IOPS. If the table has grown past ~100k rows, retention
matters more than indexes.

```sql
DELETE FROM public.audit_log WHERE timestamp < now() - interval '90 days';
```

Run as a one-shot for now; if it has to be repeated, schedule via
`pg_cron` (already available on Supabase).

---

## 5. Re-enable crons (only after green + indexes shipped)

Sequencing matters: indexes first, then turn the crons back on. If you
re-enable before indexing, the crons will burn the budget right back
down.

```bash
gh workflow enable "Daily Cron"
gh workflow enable "Hourly Cron"
gh workflow enable "DB Backup"
gh workflow enable "Weekly roll-up"
```

After the first scheduled firing of each, watch IO Budget for the next
hour — it should stay flat or climb. If it dips, the offending cron's
hot query still isn't covered by an index. Re-disable that one
specifically and chase the `queryid`.

---

## 6. Prevention — a circuit breaker for next time

The cron handlers should short-circuit if the project is unhealthy
instead of piling onto the burn rate. Sketch:

```ts
// api/_lib/dbHealth.ts
async function isDbHealthy(): Promise<boolean> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/?select=1`, {
      headers: SB_HEADERS,
      signal: AbortSignal.timeout(2000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// At the top of each cron handler:
if (!(await isDbHealthy())) {
  console.warn("[cron] skip — DB unhealthy");
  return;
}
```

Costs ~one extra request per cron fire to add the guard; saves the
fan-out cost when the DB is the bottleneck.

---

## Resolution log

- 2026-05-04 — Disabled four IO-heavy crons via `gh workflow disable`.
- 2026-05-04 — *(pending — Supabase project unhealthy, MCP timing out)*.
