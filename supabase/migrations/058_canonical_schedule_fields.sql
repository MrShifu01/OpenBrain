-- ─────────────────────────────────────────────────────────────────────────
-- 058_canonical_schedule_fields.sql
--
-- Phase 2 of the schedule-engine refactor (see RUNBOOK / TodoView fix plan).
--
-- Backfills two canonical metadata keys on entries that don't have them yet:
--
--   metadata.scheduled_for : ISO date — single source of truth for "this
--                            entry appears on this calendar day". Mirrors
--                            the first available legacy date key.
--
--   metadata.recurrence    : { freq: "weekly"|"monthly", dow?: int[],
--                            dom?: int[] } — explicit, structured recurrence.
--                            Mirrored from legacy day_of_week / day_of_month.
--
-- Idempotent: only writes the canonical key when it's missing, so re-running
-- the migration is a no-op. Legacy keys are NOT removed — Phase 1's engine
-- still falls back to them so existing data remains discoverable while the
-- backfill runs in production.
-- ─────────────────────────────────────────────────────────────────────────

-- ── scheduled_for backfill ────────────────────────────────────────────────
-- Source preference, in order: due_date > deadline > event_date >
-- scheduled_date > appointment_date > date. First match wins. Skip if
-- scheduled_for already set.

UPDATE public.entries
SET metadata = metadata || jsonb_build_object(
  'scheduled_for',
  COALESCE(
    metadata->>'due_date',
    metadata->>'deadline',
    metadata->>'event_date',
    metadata->>'scheduled_date',
    metadata->>'appointment_date',
    metadata->>'date'
  )
)
WHERE deleted_at IS NULL
  AND metadata->>'scheduled_for' IS NULL
  AND (
    metadata->>'due_date'         ~ '^\d{4}-\d{2}-\d{2}'
    OR metadata->>'deadline'      ~ '^\d{4}-\d{2}-\d{2}'
    OR metadata->>'event_date'    ~ '^\d{4}-\d{2}-\d{2}'
    OR metadata->>'scheduled_date'   ~ '^\d{4}-\d{2}-\d{2}'
    OR metadata->>'appointment_date' ~ '^\d{4}-\d{2}-\d{2}'
    OR metadata->>'date'          ~ '^\d{4}-\d{2}-\d{2}'
  );


-- ── recurrence backfill (weekly via day_of_week) ──────────────────────────
-- Map day_of_week strings to ISO 0-6 (0 = Sunday). Skip rows that already
-- have a recurrence object.

UPDATE public.entries
SET metadata = metadata || jsonb_build_object(
  'recurrence',
  jsonb_build_object(
    'freq', 'weekly',
    'dow', jsonb_build_array(
      CASE LOWER(TRIM(metadata->>'day_of_week'))
        WHEN 'sunday'    THEN 0 WHEN 'sun' THEN 0
        WHEN 'monday'    THEN 1 WHEN 'mon' THEN 1
        WHEN 'tuesday'   THEN 2 WHEN 'tue' THEN 2
        WHEN 'wednesday' THEN 3 WHEN 'wed' THEN 3
        WHEN 'thursday'  THEN 4 WHEN 'thu' THEN 4
        WHEN 'friday'    THEN 5 WHEN 'fri' THEN 5
        WHEN 'saturday'  THEN 6 WHEN 'sat' THEN 6
      END
    )
  )
)
WHERE deleted_at IS NULL
  AND (metadata->'recurrence') IS NULL
  AND LOWER(TRIM(metadata->>'day_of_week')) IN (
    'sunday','sun','monday','mon','tuesday','tue','wednesday','wed',
    'thursday','thu','friday','fri','saturday','sat'
  );


-- ── recurrence backfill (monthly via day_of_month) ────────────────────────
-- Skip rows that already have a recurrence object (e.g. weekly was just set).

UPDATE public.entries
SET metadata = metadata || jsonb_build_object(
  'recurrence',
  jsonb_build_object(
    'freq', 'monthly',
    'dom',  jsonb_build_array((metadata->>'day_of_month')::int)
  )
)
WHERE deleted_at IS NULL
  AND (metadata->'recurrence') IS NULL
  AND metadata->>'day_of_month' ~ '^[1-9]$|^[12][0-9]$|^3[01]$';


-- ── Sanity check ──────────────────────────────────────────────────────────
-- Quick "did the backfill make sense" probe — counts only, no row dump.
-- Drop these into a notice so anyone running the migration locally sees
-- the impact without needing a follow-up query.

DO $$
DECLARE
  scheduled_count INT;
  recurrence_count INT;
  legacy_due INT;
  legacy_dow INT;
  legacy_dom INT;
BEGIN
  SELECT COUNT(*) INTO scheduled_count
    FROM public.entries
    WHERE deleted_at IS NULL AND metadata->>'scheduled_for' IS NOT NULL;
  SELECT COUNT(*) INTO recurrence_count
    FROM public.entries
    WHERE deleted_at IS NULL AND metadata->'recurrence' IS NOT NULL;
  SELECT COUNT(*) INTO legacy_due
    FROM public.entries
    WHERE deleted_at IS NULL AND metadata->>'due_date' IS NOT NULL;
  SELECT COUNT(*) INTO legacy_dow
    FROM public.entries
    WHERE deleted_at IS NULL AND metadata->>'day_of_week' IS NOT NULL;
  SELECT COUNT(*) INTO legacy_dom
    FROM public.entries
    WHERE deleted_at IS NULL AND metadata->>'day_of_month' IS NOT NULL;
  RAISE NOTICE 'After 058 backfill: scheduled_for=%, recurrence=%, legacy due_date=%, day_of_week=%, day_of_month=%',
    scheduled_count, recurrence_count, legacy_due, legacy_dow, legacy_dom;
END $$;
