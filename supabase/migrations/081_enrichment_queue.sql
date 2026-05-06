-- ─────────────────────────────────────────────────────────────────────────────
-- 081_enrichment_queue.sql
--
-- Phase 2A scale foundation for the enrichment pipeline. Adds three things:
--
--   1. enrichment_state text column on entries — top-level pipeline status
--      that the worker queries against (independent from per-step flags
--      like metadata.enrichment.parsed). Indexed partial so the worker
--      query is O(pending), not O(entries).
--
--   2. enrichment_locked_at timestamptz — claim timestamp for SELECT FOR
--      UPDATE SKIP LOCKED. Stale claims (>5 minutes) are recoverable so a
--      crashed worker doesn't strand entries forever.
--
--   3. user_enrich_quota table + consume_enrich_quota RPC — daily per-user
--      counter for tier-based cost control. Free=20/day, starter=200/day,
--      pro/max=unlimited (caller decides via a -1 sentinel).
--
-- Backfill: existing rows are stamped with the correct state based on their
-- current flags so the cron worker doesn't try to re-enrich already-done
-- rows on its first pass after deploy.
--
-- Backward compatibility: every existing entry-creation path keeps working.
-- The default state for new rows is 'pending', so capture/llm/mcp/v1 paths
-- that insert via PostgREST without setting state still get queued for
-- the worker. The awaited enrichInline call (post 9b403ca) updates state
-- to 'done' synchronously, so live UX is unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. enrichment_state column ───────────────────────────────────────────────

alter table public.entries
  add column if not exists enrichment_state text not null default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'entries_enrichment_state_check'
  ) then
    alter table public.entries
      add constraint entries_enrichment_state_check
      check (enrichment_state in ('pending','processing','done','failed','quota_exceeded'));
  end if;
end $$;

alter table public.entries
  add column if not exists enrichment_locked_at timestamptz;

-- Partial index for the worker — only the rows we actually need to find.
-- 'done' / 'failed' / 'quota_exceeded' rows shouldn't ever match the
-- worker's query so they don't belong in the index.
create index if not exists entries_enrichment_state_idx
  on public.entries (enrichment_state, created_at)
  where enrichment_state in ('pending','processing') and deleted_at is null;

-- ── 2. Backfill existing rows ────────────────────────────────────────────────
-- vault (type='secret'): enrichInline bails for these — mark 'done' so the
--   worker doesn't repeatedly hit the bail-out path.
-- persona (type='persona'): persona entries are themselves an enrichment
--   product; flagsOf treats all flags as satisfied. Mark 'done'.
-- deleted (deleted_at not null): never re-enrich. 'done'.
-- already-enriched: parsed + has_insight + concepts_extracted all true AND
--   embedding_status='done'. Mark 'done'.
-- everything else: 'pending' so the next sweep picks them up.

update public.entries
set enrichment_state = case
  when deleted_at is not null then 'done'
  when type = 'secret'        then 'done'
  when type = 'persona'       then 'done'
  when (metadata->'enrichment'->>'parsed')::boolean             is true
   and (metadata->'enrichment'->>'has_insight')::boolean        is true
   and (metadata->'enrichment'->>'concepts_extracted')::boolean is true
   and embedding_status = 'done'                                       then 'done'
  else 'pending'
end;

-- ── 3. Daily quota counter ──────────────────────────────────────────────────

create table if not exists public.user_enrich_quota (
  user_id uuid not null references auth.users(id) on delete cascade,
  date    date not null default current_date,
  count   integer not null default 0,
  primary key (user_id, date)
);

create index if not exists user_enrich_quota_user_idx
  on public.user_enrich_quota (user_id, date desc);

alter table public.user_enrich_quota enable row level security;

drop policy if exists user_enrich_quota_owner_read on public.user_enrich_quota;
create policy user_enrich_quota_owner_read
  on public.user_enrich_quota
  for select
  using (auth.uid() = user_id);

-- Service-role bypasses RLS so writes from the cron worker don't need a
-- separate write policy. Users see their own counts via the read policy
-- above (for any future "you've used N/M today" UI surface).

-- ── 4. consume_enrich_quota RPC ──────────────────────────────────────────────
--
-- Atomic-ish (within the same statement) check + increment. Two-phase:
--   a. Read current count for today.
--   b. If >= p_limit, deny.
--   c. Else upsert with +1, return the new count.
-- Concurrent calls can race past step (a) and both increment; in the worst
-- case a user gets one extra enrichment past the quota line, which is fine.
-- Atomicity-first would require SELECT FOR UPDATE + INSERT; the cost is
-- negligible at our scale and racing past by 1 is the better trade-off.

create or replace function public.consume_enrich_quota(
  p_user_id uuid,
  p_limit   int
)
returns table (allowed boolean, used int)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count int;
begin
  select coalesce(count, 0) into current_count
  from public.user_enrich_quota
  where user_id = p_user_id and date = current_date;

  if current_count >= p_limit then
    return query select false, current_count;
    return;
  end if;

  insert into public.user_enrich_quota (user_id, date, count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, date)
    do update set count = user_enrich_quota.count + 1
  returning user_enrich_quota.count into current_count;

  return query select true, current_count;
end;
$$;

grant execute on function public.consume_enrich_quota(uuid, int)
  to authenticated, service_role;

-- ── 5. claim_pending_enrichments RPC ─────────────────────────────────────────
--
-- Atomic claim of N pending entries for a (user, brain). SELECT FOR UPDATE
-- SKIP LOCKED prevents two workers fighting over the same rows; the
-- "stale processing" branch (locked_at > 5 min) reclaims rows from a worker
-- that crashed mid-flight.
-- Returns the locked entry IDs; caller passes them to enrichInline.

create or replace function public.claim_pending_enrichments(
  p_user_id  uuid,
  p_brain_id uuid,
  p_limit    int default 30
)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select id
    from public.entries
    where user_id = p_user_id
      and brain_id = p_brain_id
      and deleted_at is null
      and (
        enrichment_state = 'pending'
        or (enrichment_state = 'processing'
            and enrichment_locked_at < now() - interval '5 minutes')
      )
    order by created_at desc
    limit p_limit
    for update skip locked
  )
  update public.entries e
     set enrichment_state = 'processing',
         enrichment_locked_at = now()
    from claimed c
   where e.id = c.id
  returning e.id;
end;
$$;

grant execute on function public.claim_pending_enrichments(uuid, uuid, int)
  to authenticated, service_role;
