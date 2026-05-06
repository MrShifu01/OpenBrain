-- ─────────────────────────────────────────────────────────────────────────────
-- 056_gmail_decisions.sql
--
-- Captures every accept / reject the user makes in the Gmail staging inbox so
-- the classifier learns over time which kinds of emails belong in the brain
-- and which are noise. Mirrors the persona pattern: keep the last N specific
-- decisions for concreteness, plus an LLM-distilled summary of the patterns.
--
-- Accept = "this email is the kind I want surfaced". Reject = "skip this and
-- anything like it next time". Both are equally important — without accept
-- examples the classifier doesn't know what your "yes" looks like either.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.gmail_decisions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  decision      text not null check (decision in ('accept','reject')),
  subject       text,
  from_email    text,
  from_name     text,
  snippet       text,
  reason        text,
  source_id     text,                              -- id of the Gmail-derived entry, useful for forensic
  created_at    timestamptz not null default now()
);

create index if not exists gmail_decisions_user_recent
  on public.gmail_decisions (user_id, created_at desc);

alter table public.gmail_decisions enable row level security;

drop policy if exists "gmail_decisions_owner_rw" on public.gmail_decisions;
create policy "gmail_decisions_owner_rw"
  on public.gmail_decisions
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Distilled summaries cached on the integration row so the classifier can
-- read both in a single round-trip. Refreshed weekly + on-demand.
alter table public.gmail_integrations
  add column if not exists accepted_summary text,
  add column if not exists rejected_summary text,
  add column if not exists summary_updated_at timestamptz;
