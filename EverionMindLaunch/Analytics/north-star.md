# North-star metric

The one number that goes on the wall. Everything else is a tributary.

## The number

> **% of `signup_completed` users who reach `first_ai_answer_viewed` within 7 days.**

**Target**: ≥ 40%.

This is the activation rate. If it's below 40%, the product isn't proving its value fast enough — every other metric (retention, MRR, K-factor) is downstream of it.

## Why this metric

- **Captures the core promise**: "private AI memory for life admin." A user has experienced the promise once they've stored a memory AND retrieved it via AI. Less than that, they haven't really seen what we do.
- **Time-bound (7 days)**: prevents counting stragglers who eventually stumble into activation. We want activation in the first week, ideally the first session.
- **Not a vanity metric**: requires both a creation event AND an answer-viewed event. Bots, accidental signups, and "just checking it out" users don't ship false positives.
- **Drives the right work**: lifting it requires fixing onboarding friction, capture latency, retrieval relevance, chat UI clarity. All things that move the broader product forward.

## Secondary metrics (the supporting cast)

These get tracked but don't run the show.

| Metric | Definition | Target |
|---|---|---|
| **D1 retention** | % of activated users back the next day | ≥ 35% |
| **D7 retention** | % back within 7 days | ≥ 25% |
| **D30 retention** | % back within 30 days | ≥ 15% |
| **K-factor** | invites accepted ÷ signups (per inviting user, 30d) | ≥ 0.3 |
| **Tier conversion** | % of activated users who upgrade to Pro/Max | ≥ 5% by D30, ≥ 10% by D90 |
| **MRR per active user** | total MRR ÷ MAU | ≥ R20 by D90 |
| **Support ticket rate** | tickets per 100 MAU per week | ≤ 5 |

## Anti-metrics (don't optimize these)

These look like positive signals but reward the wrong behavior:

- **Total signups** — easy to inflate via paid ads or invite spam; says nothing about value delivered.
- **DAU** — can be padded with notification spam or addiction patterns; we want healthy memory usage, not compulsive checking.
- **Time spent in app** — a memory app should be FAST. More time spent often means more friction.
- **Total entries created** — easy to inflate by importing junk; we want quality memories, not quantity.

## Cohort segmentation

When the north-star metric moves, slice by:

1. **Acquisition source** — `utm_source` from `signup_completed`. (Organic search vs Product Hunt vs invite link.)
2. **Signup method** — Google OAuth vs email. Friction differs.
3. **Onboarding completion** — completed-modal vs skipped. Tells us whether the modal earns its place.
4. **First-capture entrypoint** — typed vs paste vs share-target vs voice. Tells us which capture flow is most onboarding-friendly.
5. **Brain count at first chat** — 1 (just personal) vs 2+ (joined a shared brain immediately). Shared-brain joiners may be a stronger cohort.

## Reporting cadence

- **Daily** (first 30 days): activation rate, D1 retention, signup count. One Slack post or email — keeps it visible.
- **Weekly**: full secondary metrics dashboard.
- **Monthly**: cohort retention curves, MRR breakdown, K-factor.

## Operational dashboard

PostHog Insights:
1. **Activation funnel** — landing → signup → first_memory → first_ai_answer
2. **Retention curves** — anchored on `signup_completed`, return on any meaningful event
3. **K-factor scatter** — accepted_invites per inviter

Custom Supabase view (server-side):
```sql
CREATE OR REPLACE VIEW v_north_star_daily AS
SELECT
  date_trunc('day', s.created_at) AS day,
  COUNT(DISTINCT s.user_id) AS signups,
  COUNT(DISTINCT a.user_id) FILTER (WHERE a.created_at <= s.created_at + interval '7 days') AS activated,
  ROUND(
    COUNT(DISTINCT a.user_id) FILTER (WHERE a.created_at <= s.created_at + interval '7 days')::numeric
    / NULLIF(COUNT(DISTINCT s.user_id), 0) * 100,
    1
  ) AS activation_pct
FROM (SELECT user_id, MIN(created_at) AS created_at FROM auth.users GROUP BY user_id) s
LEFT JOIN (
  SELECT user_id, MIN(created_at) AS created_at
  FROM analytics_first_ai_answer
  GROUP BY user_id
) a USING (user_id)
WHERE s.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY 1
ORDER BY 1 DESC;
```

(`analytics_first_ai_answer` table is TODO — currently this lives only in PostHog. Materialize when we want SQL access.)

## When to revise this metric

The north-star should change when one of the following is true:
- Activation rate consistently > 60% (the metric is no longer the binding constraint — pick the next one, probably retention or MRR per user)
- Product positioning shifts (e.g. we pivot from personal AI memory to a different value prop)
- The current metric becomes gameable in ways we didn't predict

Revision is a deliberate event, not a slow drift. Document the change in this file with a date.

## References

- `Analytics/event-taxonomy.md` (what events feed this metric)
- `architecture/onboarding-flow.md` (where the funnel breaks today)
- `marketing/seo-marketing-playbook.md` § 17 (acquisition channels feeding signups)
