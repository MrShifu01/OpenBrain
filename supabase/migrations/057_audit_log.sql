-- 057: audit_log table
--
-- Records security-relevant user actions for forensics, abuse investigation,
-- and "did the user really do X?" support questions. Until now the writes
-- have been firing in api/capture.ts, api/entries.ts, api/llm.ts but the
-- table didn't exist — every insert silently failed (the writes are
-- fire-and-forget with .catch(() => {})). Creating the table now wires
-- those existing writes up.
--
-- Schema mirrors the writes verbatim:
--   user_id, action, resource_id (nullable), request_id (nullable),
--   metadata (jsonb, used by chat tool calls), timestamp.
--
-- "timestamp" as a column name is awkward (it's a type name) but matches the
-- existing payloads — renaming would break those writes. PostgREST handles
-- it fine because it quotes column names internally.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action       text NOT NULL,
  resource_id  uuid,
  request_id   text,
  metadata     jsonb,
  "timestamp"  timestamptz NOT NULL DEFAULT now()
);

-- Per-user lookup for "show me my activity" queries — order by latest first.
CREATE INDEX IF NOT EXISTS audit_log_user_id_timestamp_idx
  ON public.audit_log (user_id, "timestamp" DESC);

-- Action-type lookup for admin abuse investigation ("show all empty_trash
-- across all users in the last 24h").
CREATE INDEX IF NOT EXISTS audit_log_action_idx
  ON public.audit_log (action);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit rows. Useful for letting users view their
-- own action history later if we add a UI for it.
DROP POLICY IF EXISTS "users read own audit log" ON public.audit_log;
CREATE POLICY "users read own audit log"
  ON public.audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE policies — only the service role (used by
-- Vercel functions) writes here, and service role bypasses RLS by default.
-- Users cannot mutate their own audit history; that's the point.

COMMENT ON TABLE public.audit_log IS
  'Security-relevant user actions. Written by api/capture.ts, api/entries.ts, api/llm.ts. Service-role insert only; users can read their own rows.';
