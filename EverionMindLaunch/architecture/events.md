# PostHog event taxonomy — the funnel

The launch dashboard is built around 8 events. They land in PostHog under the exact wire-format names below — renaming or reordering them silently breaks the dashboard's funnel math.

Source of truth: `src/lib/events.ts`. Test pin: `src/lib/__tests__/events.test.ts`.

| # | Wire name | Type | Fires from | Once-per-device? |
| - | --------- | ---- | ---------- | ---------------- |
| 1 | `signup_completed` | one-shot | `App.tsx` `onAuthStateChange` after first SIGNED_IN | yes |
| 2 | `first_capture` | one-shot | `useCaptureSheetParse.capture` before save | yes |
| 3 | `first_chat` | one-shot | `useChat.send` before send (skips tool-call retries) | yes |
| 4 | `first_insight_viewed` | one-shot | `DetailModal` when entry has insight or concepts | yes |
| 5 | `day_7_return` | one-shot | `App.tsx` `onAuthStateChange` if `user.created_at` ≥ 7d ago | yes |
| 6 | `tier_upgraded` | repeating | `useSubscription` on tier diff (rank up) | no |
| 7 | `tier_downgraded` | repeating | `useSubscription` on tier diff (rank down) | no |
| 8 | `capture_method` | repeating | `useCaptureSheetParse.capture` every save | no |
| 9 | `nav_view_active` | repeating | `Everion.tsx` view-change effect | no |

> The schedule lists 8 events; this file documents 9 because `capture_method` and `nav_view_active` are both repeating telemetry that the funnel report consumes. Five of these (signup, first_capture, first_chat, day_7_return, tier_upgraded) form the canonical launch funnel.

## Properties

```text
signup_completed       { email?: string }
first_capture          { method: "text" | "voice" | "file" | "link" | "share-target" | "import" }
first_chat             —
first_insight_viewed   { entry_id?: string }
day_7_return           { age_days: number }
tier_upgraded          { from: "free"|"starter"|"pro"|"max", to: same }
tier_downgraded        { from, to }   // same shape as upgraded
capture_method         { method: same as first_capture.method }
nav_view_active        { view: string, from?: string }
```

## How "once-per-device" is enforced

`src/lib/events.ts:firstOnce(key)` writes `everion_event_fired:<key>=1` to localStorage. Subsequent calls return false and the event is skipped. Re-installing the PWA or clearing browser data resets the counter — that's intentional, since PostHog's per-user funnel math handles dedup at the user-id level.

## Consent gate

Nothing fires until the user accepts the analytics consent banner — `track()` no-ops when posthog-js hasn't loaded (`getConsentDecision() !== "accepted"`). Tests don't trip events; the playwright `storageState` has no consent recorded.

## Adding a new event

1. Add the name to `EVENT` in `src/lib/events.ts`.
2. Add a typed wrapper helper (`trackXyz`).
3. Update the table above + `events.test.ts` taxonomy assertion.
4. Wire the call site.

Keep wire-format names `snake_case`. Don't reuse names with new shapes — bump to `xyz_v2` instead so historical funnels stay readable.

## Dashboard funnel (PostHog UI)

```
signup_completed → first_capture → first_chat → day_7_return → tier_upgraded
```

Day 7 cohort retention is the load-bearing metric. Pin this funnel to the workspace; check it Monday mornings during the beta phase.
