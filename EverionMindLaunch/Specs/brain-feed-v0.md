# Brain Feed v0 — fast version for day 11

**Goal:** the home view (`MemoryView`) renders three personalized rows above the entry grid for any user with ≥3 entries. Empty / new-user state is preserved. Day 11 ship target. Total budget: 1.5 dev days. Anything beyond that defers to v1 (week 4).

This is **not** the full ROADMAP Brain Feed (which includes weekly digests, AI-summarised "what changed" panels, and a recommendations engine). v0 is the cheapest defensible version that makes the home view feel alive instead of dead.

---

## What renders

```
┌────────────────────────────────────────────────────────┐
│  what's on your mind?                       [chip: 🎤] │  ← Capture bar (always visible)
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│  Picking up where you left off                         │
│  ─────────────────────                                 │
│  Northwind discovery call                              │  ← Resurfaced memory (1 card)
│  the head of ops kept saying 'we just need it not…    │
│  · 47 days ago · Discovery                             │
└────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────┐
│  Where your brain is thin                              │
│  ─────────────────                                     │
│  → "Northwind onboarding plan"                         │  ← Top gap from gap-analyst
│  You haven't captured anything about this in 21 days   │
└────────────────────────────────────────────────────────┘
                                                            ← Below this: existing entry grid
```

All three rows are scrollable into view; the entry grid sits underneath as today.

If user has < 3 entries, render a single "build your brain" empty-state card and skip the feed entirely.

---

## Data sources

### 1. Capture bar (always visible)

No backend. Pure client component. Tapping or focusing it opens `CaptureSheet` with the typed text pre-filled (use `appShell.openCapture(initialText)`).

### 2. Resurfaced memory

**Endpoint:** `GET /api/entries?resource=resurface`

Returns one entry JSON or `null`.

**Selection logic (server-side):**

```sql
select id, title, content, type, metadata, created_at
from entries
where user_id = $1
  and brain_id = $2
  and created_at < now() - interval '30 days'
  and created_at > now() - interval '365 days'
  and (
    metadata->>'last_resurfaced_at' is null
    or (metadata->>'last_resurfaced_at')::timestamptz < now() - interval '14 days'
  )
order by importance desc, random()
limit 1;
```

Why these constraints:
- `> 30 days old`: anything fresher feels like spam ("you just saw this yesterday")
- `< 365 days`: older than a year stops being relevant for most working memory
- `last_resurfaced_at < 14 days ago`: don't resurface the same memory in back-to-back weeks
- `importance desc, random()`: weight toward important entries, fall back to chance for tie-breaking

After serving, write back `metadata.last_resurfaced_at = now()` so we don't pick it again next week.

**Performance:** the index on `(user_id, brain_id, created_at)` already exists. Add a partial index on `(user_id, brain_id) where importance > 0` if explain shows table scans.

**Empty case:** if no candidate, return `null`. Client hides the row.

### 3. Top gap from gap-analyst

**Endpoint:** `GET /api/entries?resource=recent_gaps`

Returns 0–3 gap JSON items.

**Source:** the existing gap-analyst job. Check `api/_lib/enrich.ts` for where gaps are persisted today. If they're stored on the entry's metadata (likely), we need a flat `recent_gaps` view that pulls the top 3 across all entries for this user, deduplicated by gap-concept.

If gap-analyst output doesn't exist yet for this user (job hasn't run), return `[]`. Client hides the row.

**Tap action:** opens CaptureSheet with the gap concept pre-filled as a prompt: `"Add what you know about: $gap_concept"`.

---

## Rendering layer

New file: `src/components/BrainFeed.tsx`. Imported into `src/views/MemoryView.tsx`, rendered above the entry grid.

```tsx
// Sketch (do not implement from this — see actual file paths during exec)
function BrainFeed({ entryCount, onOpenCapture, onOpenEntry, onOpenGap }) {
  if (entryCount < 3) return <EmptyBrainCallout />;

  const resurfaced = useResurfacedMemory();   // SWR, 5min cache
  const gaps = useRecentGaps();                // SWR, 5min cache

  return (
    <section className="brain-feed">
      <CaptureBar onSubmit={onOpenCapture} />
      {resurfaced && <ResurfacedRow entry={resurfaced} onOpen={onOpenEntry} />}
      {gaps.length > 0 && <GapRow gap={gaps[0]} onOpen={onOpenGap} />}
    </section>
  );
}
```

Hooks `useResurfacedMemory` and `useRecentGaps` use `swr` (already a dep) with `dedupingInterval: 300_000`. Both share a key prefix so a refresh after a capture invalidates both.

**Refresh cadence:** SWR revalidates on focus (default). After every capture, mutate both keys so the gap surface updates if the user just filled a gap.

**Loading state:** thin skeleton row, ember-coloured pulse. No spinner.

**Error state:** silent. If either fetch fails, hide that row. Don't show a "couldn't load feed" banner — the entry grid below is the fallback content.

---

## Style budget

Stick to existing tokens: `--ember`, `--ink`, `--ink-soft`, `--surface`, `--line-soft`, `--moss`. Cards use the existing `EntryCard` style; capture bar reuses the input style from the OnboardingModal step 1 textarea.

No new SVG assets. No new fonts. No motion beyond a 180ms fade-in on first render.

Mobile width: 375px target. Each row sits in a horizontal scroll container only if content overflows; v0 renders one card per row so no horizontal scroll needed.

---

## Out of scope (defer to v1)

- AI-summarised "what changed since you last opened the app"
- Multi-card carousels (resurface 3 memories instead of 1)
- Personalized greeting ("good morning, Christian")
- Sparkline of weekly capture rate
- "People you mentioned" — surfaces from the contact pipeline
- Time-of-day adaptation (morning vs evening surfaces)
- Server-driven feed ordering (let v0 ship with hardcoded order; A/B order in v1 once we have funnel data)

---

## Verification

End-to-end test (manual):
1. Sign up, capture 3 entries via OnboardingModal sample data. Reload home.
2. Should see capture bar + resurface row (one of the sample entries) + gap row (gap-analyst will produce one for the sparse new brain).
3. Tap capture bar → opens CaptureSheet with focus in textarea.
4. Tap resurface card → opens DetailModal for that entry.
5. Tap gap → opens CaptureSheet with the gap concept pre-filled.

Automated test (write at end of day 2):
- `tests/api/entries.resurface.spec.ts` — POSTs 3 entries with mocked `created_at` 60 days ago, asserts the endpoint returns one of them.
- `tests/components/BrainFeed.test.tsx` — renders empty state for `entryCount=2`, renders all 3 rows for `entryCount=10` with mocked SWR.

---

## Commit pattern

- Day 1: `feat(brain-feed): backend — resurface + recent_gaps endpoints`
- Day 2: `feat(brain-feed): v0 render — capture bar + resurfaced + gap`

---

## Why this is the right v0

The bar to clear is "home screen feels personal in <2s". The three surfaces here cover three distinct user intents:

1. **Capture bar** — "I came to add something" (primary action, must be one tap away)
2. **Resurfaced memory** — "show me something I forgot" (the AI-second-brain promise)
3. **Gap surface** — "tell me what to capture next" (the agentic angle, light-touch)

Anything else (digests, recommendations, sparklines) is a v1 elaboration. If the v0 surfaces don't get tapped per PostHog data after 2 weeks of beta, kill them rather than building v1.
