# A/B test queue

> **Stub** — fill in as tests are designed and shipped. Don't run more than 1–2 simultaneously while traffic is small (statistical power is too low).

## Active tests

(none yet)

## Backlog (in priority order)

### 1. Landing-page hero copy
- **Hypothesis**: "Your private AI memory for real life" outperforms "Remember everything you've ever forgotten."
- **Surface**: `/` hero h1
- **Metric**: `signup_started` rate from `landing_page_view`
- **Sample size needed**: ~3,000 visitors per variant (assumes 5% baseline → 6% target, 80% power)
- **Status**: queued

### 2. Onboarding modal: 6 quick-pick options vs free text
- **Hypothesis**: Pre-filled "what do you forget?" categories activate more users than a blank text box.
- **Surface**: `OnboardingModal`
- **Metric**: `first_memory_created` within 5 min of `signup_completed`
- **Sample size**: ~500 signups per variant
- **Status**: queued

### 3. Pricing tier order
- **Hypothesis**: Putting Pro in the middle (anchored) outperforms putting Starter on the left.
- **Surface**: pricing page card layout
- **Metric**: `tier_upgrade_started` rate from `pricing_page_viewed`
- **Sample size**: ~2,000 pricing-page views per variant
- **Status**: queued, blocked on getting paid traffic

### 4. Chat empty state: prefilled examples vs blank
- **Hypothesis**: Showing 3 examples (drawn from the user's actual entries) doubles the rate of `first_ai_question_asked`.
- **Surface**: `ChatView` empty state
- **Metric**: `first_ai_question_asked` within 60s of `signup_completed`
- **Sample size**: ~300 first-time-chat users per variant
- **Status**: queued

## How to run a test

1. Frame the hypothesis (above format).
2. Wire variants behind a PostHog Feature Flag. Roll out 50/50.
3. Set a calendar reminder for the sample-size threshold.
4. Don't peek before threshold — it inflates false positives.
5. At threshold: read result, document outcome, ship the winner, kill the flag.

## Lessons learned

(append after each test)

- _(none yet)_

## References

- `Analytics/event-taxonomy.md`
- `Analytics/north-star.md`
- PostHog Feature Flags docs
