-- ─────────────────────────────────────────────────────────────────────────
-- DB health check — paste into Supabase SQL editor when "DB unhealthy"
-- fires or DB CPU/IO is suspect. Each block is independent; run all or
-- whichever is relevant. No DDL — read-only.
-- ─────────────────────────────────────────────────────────────────────────
--
-- Background: 2026-05 incident showed Realtime accounted for ~65% of DB
-- exec time. Migration 072 dropped `entries` from supabase_realtime. Run
-- block 1 to confirm Realtime is no longer the dominant cost. If a new
-- offender shows up at the top of block 1, treat that as the smoking gun.

-- ── 1. Top 20 queries by total exec time ──
-- The bread and butter. Anything above ~5% deserves attention. Realtime
-- WAL parser (`SELECT wal->>$5 as type, ...`) at 48% was the 2026-05
-- incident — it should now be near-zero or absent.
SELECT
  substr(query, 1, 200) AS query_snippet,
  calls,
  round(total_exec_time::numeric, 0) AS total_ms,
  round(mean_exec_time::numeric, 1) AS mean_ms,
  round((100 * total_exec_time / NULLIF(SUM(total_exec_time) OVER (), 0))::numeric, 1) AS pct_total
FROM pg_stat_statements
WHERE query NOT ILIKE '%pg_stat_statements%'
  AND query NOT ILIKE '%pg_catalog%'
  AND query NOT ILIKE 'BEGIN%'
  AND query NOT ILIKE 'COMMIT%'
  AND query NOT ILIKE 'SET %'
  AND query NOT ILIKE 'DISCARD%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- ── 2. Realtime publication contents ──
-- Should be EMPTY post-072. If you see `entries` (or anything else) here,
-- some migration re-added it — that's the regression.
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY schemaname, tablename;

-- ── 3. Active Realtime subscriptions ──
-- Each row = one client channel. If this grows unbounded between
-- snapshots (and you haven't intentionally added a new realtime
-- consumer), suspect subscription churn — channels failing to clean up.
SELECT
  COUNT(*) AS subscription_rows,
  COUNT(DISTINCT subscription_id) AS distinct_subs,
  COUNT(DISTINCT entity) AS distinct_tables,
  MIN(created_at) AS oldest,
  MAX(created_at) AS newest
FROM realtime.subscription;

-- ── 4. Connections by application + state ──
-- Healthy ranges: postgrest idle ~5–20, realtime ~5–10, total <60 on
-- free tier (<200 on pro). If postgrest "active" is sustained > 5,
-- queries are queuing. If "idle in transaction" > 0, a server
-- function is leaking transactions.
SELECT
  application_name,
  state,
  COUNT(*) AS conn_count,
  MIN(backend_start) AS oldest_conn,
  MAX(backend_start) AS newest_conn
FROM pg_stat_activity
WHERE state IS NOT NULL
GROUP BY application_name, state
ORDER BY conn_count DESC;

-- ── 5. Currently running queries (snapshot) ──
-- If a single query is blocking everything, it shows here. Anything
-- with state='active' and query_start older than ~5s is a candidate
-- to investigate (and possibly pg_cancel_backend).
SELECT
  pid,
  application_name,
  state,
  now() - query_start AS running_for,
  substr(query, 1, 200) AS query_snippet
FROM pg_stat_activity
WHERE state = 'active'
  AND pid <> pg_backend_pid()
ORDER BY query_start ASC
LIMIT 20;

-- ── 6. Slowest mean queries (latency, not volume) ──
-- High-mean queries with low call count are the latency tail — chat
-- vector searches, large bulk operations, RLS recompute on huge sets.
-- Different signal from block 1 (which weights by total).
SELECT
  substr(query, 1, 200) AS query_snippet,
  calls,
  round(mean_exec_time::numeric, 1) AS mean_ms,
  round(max_exec_time::numeric, 1) AS max_ms
FROM pg_stat_statements
WHERE calls > 5
  AND query NOT ILIKE '%pg_stat_statements%'
  AND query NOT ILIKE '%pg_catalog%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- ── 7. Reset pg_stat_statements (use sparingly) ──
-- Wipes accumulated stats so the next snapshot reflects a clean window.
-- Run this AFTER deploying a perf fix to measure the post-fix delta.
-- Commented out — uncomment to actually run.
-- SELECT pg_stat_statements_reset();
