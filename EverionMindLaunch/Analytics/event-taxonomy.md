# Event taxonomy

Every PostHog / Sentry event the app emits, what it means, and where it fires from. Source of truth for funnel queries.

> Append-only when adding new events. Don't repurpose old event names — past dashboards will silently break.

## Naming convention

`<surface>_<action>_<state?>`

- `surface` — `signup`, `capture`, `chat`, `vault`, `brain`, `share`, `billing`, `onboarding`, `settings`
- `action` — verb in past tense (`viewed`, `started`, `completed`, `failed`, `clicked`)
- `state` — optional qualifier (`first`, `with_source`, `from_email`)

Snake-case. No spaces. No camelCase.

## Identity

```ts
posthog.identify(user.id, {
  email: user.email,
  tier: profile.tier,
  is_admin: !!user.app_metadata?.is_admin,
  signup_at: profile.created_at,
})
```

Re-run on every session start so cohort filters get fresh `tier`.

## Activation funnel (the one that matters)

| Event | Where it fires | Properties |
|---|---|---|
| `landing_page_view` | `src/views/LandingScreen.tsx` mount | `referrer`, `utm_source`, `utm_campaign` |
| `signup_started` | First click on "Sign up" button | `method` (google/email) |
| `signup_completed` | After Supabase session lands | `method`, `is_invite` (came via invite link) |
| `first_memory_created` | After first row inserted in `entries` | `type`, `source` (typed/paste/email/ocr), `byte_size` |
| `first_ai_question_asked` | First send in ChatView | `query_length`, `brain_id`, `brain_type` |
| `first_ai_answer_viewed` | LLM stream ends + response visible >2s | `latency_ms`, `source_count`, `model` |

North-star query: `first_ai_answer_viewed.uniques / signup_completed.uniques` over 7-day window.

## Capture surface

| Event | Properties |
|---|---|
| `capture_opened` | `entrypoint` (cmdk/fab/share-target/quickadd/voice) |
| `capture_classified` | `predicted_type`, `confidence`, `forced_type` (if user overrode) |
| `capture_secret_detected` | `pattern` (e.g. `aws_key`/`stripe_sk`/`generic_high_entropy`) |
| `capture_committed` | `type`, `byte_size`, `tag_count`, `has_due_date` |
| `capture_failed` | `reason` (network/auth/validation), `retry_count` |
| `enrichment_step_succeeded` | `step` (parse/insight/concepts/persona/embed), `latency_ms` |
| `enrichment_step_failed` | `step`, `error_class`, `provider` |

## Chat surface

| Event | Properties |
|---|---|
| `chat_question_sent` | `brain_id`, `brain_type`, `query_length`, `model`, `byok` (bool) |
| `chat_answer_streamed` | `first_token_ms`, `total_ms`, `token_count` |
| `chat_answer_with_sources` | `source_count`, `had_useful_source` (heuristic) |
| `chat_followup_sent` | `prior_question_count_in_session` |
| `chat_no_results` | `query`, `brain_count_searched` |

## Vault surface

| Event | Properties |
|---|---|
| `vault_setup_started` | `entrypoint` |
| `vault_setup_completed` | `time_to_complete_ms` |
| `vault_unlocked` | `method` (passphrase/recovery/pin/biometric), `latency_ms` |
| `vault_unlock_failed` | `method`, `attempt_count` |
| `vault_secret_added` | `byte_size`, `has_url` |
| `vault_backup_downloaded` | — |
| `vault_pin_enabled` | `biometric_available` |
| `vault_recovery_used` | (rare event — flag for admin review) |

## Brain surface

| Event | Properties |
|---|---|
| `brain_created` | `name_length`, `from_template` (if any) |
| `brain_invite_sent` | `brain_id`, `role` (viewer/editor/admin) |
| `brain_invite_clicked` | `was_signed_in` (vs new signup) |
| `brain_invite_accepted` | `time_to_accept_ms`, `inviter_id` (for K-factor calc) |
| `brain_left` | `brain_id`, `was_member_count` (size when left) |
| `brain_archived` | `entry_count_at_archive` |

K-factor query: `(brain_invite_accepted by inviter X / signup_completed by X) over 30d`.

## Share surface (public sharing — TBD)

| Event | Properties |
|---|---|
| `share_link_created` | `entry_id`, `expires_in_days` |
| `share_link_viewed` | `share_id`, `visitor_is_member` |
| `share_link_revoked` | `share_id`, `was_views_count` |

## Billing surface

| Event | Properties |
|---|---|
| `pricing_page_viewed` | `referrer_surface` (chat/settings/limit-banner) |
| `tier_upgrade_started` | `from_tier`, `to_tier`, `provider` (lemon/revcat) |
| `tier_upgrade_completed` | `from_tier`, `to_tier`, `mrr_delta` |
| `tier_downgrade_completed` | `from_tier`, `to_tier`, `reason` (if surveyed) |
| `payment_failed` | `provider`, `error_code` |
| `subscription_canceled` | `mrr_lost`, `at_period_end` (bool) |

## Onboarding surface

| Event | Properties |
|---|---|
| `onboarding_modal_shown` | `step` |
| `onboarding_step_completed` | `step`, `time_spent_ms` |
| `onboarding_skipped` | `at_step` |
| `onboarding_completed` | `total_time_ms` |

## Settings surface

| Event | Properties |
|---|---|
| `settings_tab_opened` | `tab` (account/ai/connections/notifications/vault/admin) |
| `ai_provider_changed` | `from`, `to`, `byok` |
| `connection_added` | `provider` (gmail/google_calendar/microsoft_calendar) |
| `connection_removed` | `provider`, `had_active_jobs` |
| `notification_pref_changed` | `key`, `from`, `to` |
| `account_delete_requested` | — |

## Errors & telemetry

Error events go to Sentry (full stack trace, breadcrumbs). PostHog only sees a marker:

| Event | Properties |
|---|---|
| `error_boundary_caught` | `surface`, `error_class` (no PII in payload) |
| `api_request_failed` | `endpoint`, `status_code`, `retry_count` |
| `gemini_quota_hit` | `endpoint`, `model` |

## Custom dashboards (PostHog Insights)

Pre-built insights worth keeping:

1. **Activation funnel** — `landing_page_view` → ... → `first_ai_answer_viewed`
2. **D1/D7/D30 retention** — anchor: `signup_completed`; return: any `*_committed` or `chat_question_sent`
3. **Capture entrypoint mix** — pie chart of `capture_opened.entrypoint`
4. **K-factor** — accepted-invite-rate, by inviter cohort
5. **Tier conversion** — `pricing_page_viewed` → `tier_upgrade_completed`, by surface
6. **Vault adoption** — % of `signup_completed` who fire `vault_setup_completed`

## What we DON'T track

- Entry content. Ever. Not in PostHog, not in Sentry breadcrumbs.
- Vault content. Not even bytes (encrypted before leaving the browser).
- Chat questions or answers (just metadata: length, latency, source count).
- Other users' data — we don't follow people across the app to their friends/family brains for analytics.

If a metric needs entry content, query Supabase directly (server-side, RLS-bypassed via service role) and aggregate. Never let raw content leave the system.

## References

- `marketing/seo-marketing-playbook.md` § 16 (onboarding strategy → activation events)
- `architecture/onboarding-flow.md` (funnel definition)
- `Analytics/north-star.md` (the one number)
- PostHog project: <https://app.posthog.com/project/X> (TODO: paste real ID)
