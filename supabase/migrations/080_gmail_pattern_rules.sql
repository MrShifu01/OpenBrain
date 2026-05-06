-- ─────────────────────────────────────────────────────────────────────────────
-- 080_gmail_pattern_rules.sql
--
-- Scored accept/reject pattern rules for the Gmail classifier. Each pattern
-- represents a cluster of semantically-similar decisions (cosine ≥ 0.82 on the
-- 768-dim Gemini embedding of subject + from + snippet). On every accept/reject
-- the API embeds the email, finds the nearest pattern, and bumps either
-- accept_score or reject_score (capped at 10). New clusters start at 1.
--
-- Decision matrix (Alt 1 — decoupled scores, see chat):
--   accept_score ≥ 8 AND reject_score ≤ 2 → auto-accept (skip staging)
--   reject_score ≥ 8 AND accept_score ≤ 2 → hard-block (skip LLM call)
--   both > 3                              → contested → always staging
--   otherwise                             → normal classifier
--
-- Probation: when accept_score first crosses 8 we set auto_accept_eligible_at
-- = now() + 7 days. Until that timestamp we still route matched emails through
-- staging with a "auto-accepting <date>" badge so the user catches a runaway
-- pattern before it floods the brain.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists vector;

create table if not exists public.gmail_pattern_rules (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  embedding                vector(768) not null,
  summary                  text not null,                     -- one-line label for the prompt + UI
  example_subject          text,
  example_from             text,
  accept_score             smallint not null default 0,
  reject_score             smallint not null default 0,
  accept_hits              int not null default 0,
  reject_hits              int not null default 0,
  last_accept_at           timestamptz,
  last_reject_at           timestamptz,
  auto_accept_eligible_at  timestamptz,                       -- set when accept_score crosses 8 (probation start + 7d)
  created_at               timestamptz not null default now(),
  check (accept_score between 0 and 10),
  check (reject_score between 0 and 10)
);

create index if not exists gmail_pattern_rules_user_idx
  on public.gmail_pattern_rules (user_id);

-- HNSW matches the newer entries index style (074_entries_embedding_hnsw.sql)
-- and gives us O(log n) ANN at the volumes we care about (≤10k patterns/user).
create index if not exists gmail_pattern_rules_embedding_idx
  on public.gmail_pattern_rules using hnsw (embedding vector_cosine_ops);

alter table public.gmail_pattern_rules enable row level security;

drop policy if exists "gmail_pattern_rules_owner_rw" on public.gmail_pattern_rules;
create policy "gmail_pattern_rules_owner_rw"
  on public.gmail_pattern_rules
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Match helper ─────────────────────────────────────────────────────────────
-- PostgREST can't easily express `ORDER BY embedding <=> $query` with a bind
-- parameter, so we expose a SQL function. Returns nearest patterns above the
-- similarity threshold so the scan-time hot path can decide hard-block /
-- auto-accept / staging in a single round-trip.
create or replace function public.match_gmail_pattern(
  p_user_id      uuid,
  query_embedding vector(768),
  match_threshold double precision default 0.82,
  match_limit    int default 5
)
returns table (
  id                       uuid,
  summary                  text,
  example_subject          text,
  example_from             text,
  accept_score             smallint,
  reject_score             smallint,
  auto_accept_eligible_at  timestamptz,
  similarity               double precision
)
language sql
stable
security invoker
as $$
  select
    r.id,
    r.summary,
    r.example_subject,
    r.example_from,
    r.accept_score,
    r.reject_score,
    r.auto_accept_eligible_at,
    1 - (r.embedding <=> query_embedding) as similarity
  from public.gmail_pattern_rules r
  where r.user_id = p_user_id
    and 1 - (r.embedding <=> query_embedding) >= match_threshold
  order by r.embedding <=> query_embedding
  limit match_limit;
$$;

grant execute on function public.match_gmail_pattern(uuid, vector, double precision, int)
  to authenticated, service_role;
