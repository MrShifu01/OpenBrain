-- ============================================================
-- Migration 002: Brain Types, Multi-Brain Assignment & Activity
-- ============================================================

-- ── 1. Expand brain type: personal | family | business ───────
ALTER TABLE brains DROP CONSTRAINT IF EXISTS brains_type_check;
ALTER TABLE brains ADD CONSTRAINT brains_type_check
  CHECK (type IN ('personal', 'family', 'business'));

-- Migrate existing 'shared' brains → 'family' as default
UPDATE brains SET type = 'family' WHERE type = 'shared';

-- ── 2. brain_activity table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS brain_activity (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brain_id   uuid REFERENCES brains(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES auth.users(id) NOT NULL,
  action     text NOT NULL, -- 'created' | 'updated' | 'deleted' | 'connected'
  entry_id   text,
  details    jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brain_activity_brain_id_idx ON brain_activity(brain_id);
CREATE INDEX IF NOT EXISTS brain_activity_created_at_idx ON brain_activity(brain_id, created_at DESC);

ALTER TABLE brain_activity ENABLE ROW LEVEL SECURITY;

-- Only brain owner can read activity
CREATE POLICY "Activity visible to brain owner" ON brain_activity
  FOR SELECT USING (
    brain_id IN (SELECT id FROM brains WHERE owner_id = auth.uid())
  );

-- Brain members can log activity
CREATE POLICY "Brain members can insert activity" ON brain_activity
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND brain_id IN (
      SELECT b.id FROM brains b WHERE b.owner_id = auth.uid()
      UNION
      SELECT bm.brain_id FROM brain_members bm WHERE bm.user_id = auth.uid()
    )
  );

-- ── 3. brain_settings table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS brain_settings (
  brain_id uuid REFERENCES brains(id) ON DELETE CASCADE PRIMARY KEY,
  settings jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE brain_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brain settings visible to members" ON brain_settings
  FOR SELECT USING (
    brain_id IN (
      SELECT b.id FROM brains b WHERE b.owner_id = auth.uid()
      UNION
      SELECT bm.brain_id FROM brain_members bm WHERE bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Brain owner can manage settings" ON brain_settings
  FOR ALL USING (
    brain_id IN (SELECT id FROM brains WHERE owner_id = auth.uid())
  );

-- ── 4. entry_brains junction (multi-brain assignment) ────────
-- Allows an entry to be visible in multiple brains beyond its primary brain_id
CREATE TABLE IF NOT EXISTS entry_brains (
  entry_id uuid REFERENCES entries(id) ON DELETE CASCADE NOT NULL,
  brain_id uuid REFERENCES brains(id) ON DELETE CASCADE NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  PRIMARY KEY (entry_id, brain_id)
);

CREATE INDEX IF NOT EXISTS entry_brains_brain_id_idx ON entry_brains(brain_id);

ALTER TABLE entry_brains ENABLE ROW LEVEL SECURITY;

-- Brain members can see which entries are shared into their brain
CREATE POLICY "entry_brains visible to brain members" ON entry_brains
  FOR SELECT USING (
    brain_id IN (
      SELECT b.id FROM brains b WHERE b.owner_id = auth.uid()
      UNION
      SELECT bm.brain_id FROM brain_members bm WHERE bm.user_id = auth.uid()
    )
  );

-- Entry owner can share their entries to brains they belong to
CREATE POLICY "entry owner can share to accessible brains" ON entry_brains
  FOR INSERT WITH CHECK (
    entry_id IN (SELECT id FROM entries WHERE user_id = auth.uid())
    AND brain_id IN (
      SELECT b.id FROM brains b WHERE b.owner_id = auth.uid()
      UNION
      SELECT bm.brain_id FROM brain_members bm WHERE bm.user_id = auth.uid()
    )
  );

-- Entry owner or brain owner can remove
CREATE POLICY "entry owner or brain owner can unshare" ON entry_brains
  FOR DELETE USING (
    entry_id IN (SELECT id FROM entries WHERE user_id = auth.uid())
    OR brain_id IN (SELECT id FROM brains WHERE owner_id = auth.uid())
  );

-- ── 5. RPC: get_entries_for_brain ────────────────────────────
-- Returns all entries visible in a brain:
--   (a) entries whose primary brain_id matches, OR
--   (b) entries shared into the brain via entry_brains
CREATE OR REPLACE FUNCTION get_entries_for_brain(p_brain_id uuid)
RETURNS TABLE (
  id          uuid,
  user_id     uuid,
  brain_id    uuid,
  title       text,
  content     text,
  type        text,
  metadata    jsonb,
  tags        text[],
  pinned      boolean,
  importance  integer,
  created_at  timestamptz,
  updated_at  timestamptz
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT DISTINCT ON (e.id)
    e.id, e.user_id, e.brain_id, e.title, e.content, e.type,
    e.metadata, e.tags, e.pinned, e.importance, e.created_at, e.updated_at
  FROM entries e
  WHERE e.brain_id = p_brain_id
  UNION
  SELECT DISTINCT ON (e.id)
    e.id, e.user_id, e.brain_id, e.title, e.content, e.type,
    e.metadata, e.tags, e.pinned, e.importance, e.created_at, e.updated_at
  FROM entries e
  INNER JOIN entry_brains eb ON eb.entry_id = e.id
  WHERE eb.brain_id = p_brain_id AND e.brain_id != p_brain_id
  ORDER BY created_at DESC
  LIMIT 500;
$$;
