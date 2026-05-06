-- ─────────────────────────────────────────────────────────────────────────────
-- 082_recompute_enrichment_state.sql
--
-- Companion to 081_enrichment_queue.sql. recompute_enrichment_state(uuid[])
-- inspects per-step flags (metadata.enrichment.* and embedding_status) for a
-- batch of entries and writes the matching top-level state.
--
-- Called by enrichInline at the end of each entry's run, and again by
-- enrichBrain after bulkEmbedBatch finishes (to flip skipEmbed=true entries
-- from 'pending' → 'done' once the bulk embed lands).
--
-- Restricted to entries in 'pending' or 'processing' so we don't accidentally
-- re-open 'done' / 'failed' / 'quota_exceeded' rows. Also clears
-- enrichment_locked_at on transition out of 'processing' so the lock isn't
-- left dangling.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.recompute_enrichment_state(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  update public.entries e
  set enrichment_state = case
    when e.deleted_at is not null then 'done'
    when e.type = 'secret'        then 'done'
    when e.type = 'persona'       then 'done'
    when (e.metadata->'enrichment'->>'parsed')::boolean             is true
     and (e.metadata->'enrichment'->>'has_insight')::boolean        is true
     and (e.metadata->'enrichment'->>'concepts_extracted')::boolean is true
     and e.embedding_status = 'done'                                       then 'done'
    when coalesce((e.metadata->'enrichment'->>'attempts')::int, 0) >= 5    then 'failed'
    else 'pending'
  end,
  enrichment_locked_at = null
  where e.id = any(p_ids)
    and e.enrichment_state in ('processing','pending');
  get diagnostics affected = row_count;
  return affected;
end;
$$;

grant execute on function public.recompute_enrichment_state(uuid[])
  to authenticated, service_role;
