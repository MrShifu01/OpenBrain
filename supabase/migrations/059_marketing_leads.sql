-- Migration 059: Marketing leads (anonymous email capture)
-- Used by the exit-intent slide-in on the landing page.
-- Public/anon role can INSERT only; reads are service-role only.

CREATE TABLE IF NOT EXISTS marketing_leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'exit_slide_in',
  ua          TEXT,
  referrer    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS marketing_leads_email_source_uniq
  ON marketing_leads (lower(email), source);

ALTER TABLE marketing_leads ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can insert. No spam control beyond this; if
-- abuse happens we can add a captcha or rate-limit at PostgREST level.
CREATE POLICY "marketing_leads_anon_insert"
  ON marketing_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Reads only via service role (no policy granted to anon/authenticated).
COMMENT ON TABLE marketing_leads IS
  'Anonymous email capture from marketing surfaces (exit-intent slide-in, etc).';
