# Beta cohort tracking

> **Stub** — fill in once beta cohort goes live (target: 2026-04-27).

The first 50–100 users are the beta cohort. They get hand-held onboarding, weekly check-ins, and a feedback channel. Their retention/activation curves are the single most predictive signal for public launch readiness.

## Cohort definition

- **Beta-1**: first 25 users (closest friends/family, can DM the founder directly)
- **Beta-2**: next 75 users (extended network + early waitlist)
- **Public launch cohort**: anyone who signs up after launch day

Each cohort is tagged in PostHog via a `cohort_label` user property set at signup.

## What to track per cohort

(See `Analytics/event-taxonomy.md` for the event list. The fields below are the cohort-specific summary.)

| Cohort | Size | Activation % | D7 retention | D30 retention | Avg. weekly captures | NPS | Support tickets |
|---|---|---|---|---|---|---|---|
| Beta-1 | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Beta-2 | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| Public-W1 | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

Update weekly. Diff vs prior week — direction matters more than absolute number this early.

## NPS survey

Send at D14 from signup. Single question:

> "How likely are you to recommend Evara to a friend who'd benefit from a private AI memory? (0–10)"
>
> Optional follow-up: "What's the one thing that would make you more likely to recommend it?"

Sources of NPS:
- Email via Resend (link to a 1-click form on `/feedback?cohort=beta-1`)
- In-app banner after D14 (one-shot, dismissable)

## Feedback channel

Beta cohort gets:
- A dedicated email (`christian@…` direct, or `beta@everion…`)
- Optionally a Slack/Discord/Telegram group
- Founder-direct DM access

All ad-hoc feedback gets logged in `EML/BRAINSTORM.md` as raw notes; promoted to checklist or roadmap when patterns emerge.

## Open questions

- Do we exit-survey people who churn out of beta? (Probably yes, even if just a one-question "what made you stop?")
- Who runs the cohort spreadsheet? (Probably Christian on launch; needs a process when team grows.)
- When does a cohort "graduate" out of beta-cohort tracking? (Probably 90 days from signup.)

## References

- `Analytics/north-star.md`
- `Analytics/event-taxonomy.md`
- `Roadmap/beta-phase.md`
- `marketing/seo-marketing-playbook.md` § 7 (beta phase strategy)
