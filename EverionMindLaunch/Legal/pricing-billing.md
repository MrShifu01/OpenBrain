# Pricing & billing

The tiers, what they include, what each costs, and how billing actually flows. Source of truth for the pricing page + the limit-enforcement code.

## Tiers

| Tier | Price (ZAR/mo) | Captures/mo | Brains | Members per shared brain | Vault items | BYOK | Family sharing | Business sharing | Priority support |
|---|---|---|---|---|---|---|---|---|---|
| **Free** | R0 | 100 | 1 (personal) | — | 10 | ❌ | ❌ | ❌ | ❌ |
| **Pro** | R49 | 1,000 | 3 (1 personal + 2 shared) | 5 | 100 | ✅ | ✅ | ❌ | ❌ |
| **Max** | R199 | 10,000 | unlimited | 25 | unlimited | ✅ | ✅ | ✅ | ✅ |

> Numbers above are working-baseline. Validate against actual cost-of-AI math (gemini cost per capture × 100 vs free tier feasibility) before launch. See the playbook for unit-economics worksheet.

## USD pricing (App Store / Play Store / international web)

| Tier | USD/mo | Reason |
|---|---|---|
| Free | $0 | — |
| Pro | $3.99 | Apple tier 4. Roughly equivalent purchasing power to R49 in SA. |
| Max | $14.99 | Apple tier 15. |

(Apple tiers are global. Don't fight them — pick the closest match.)

## What each limit means

### Captures per month
A "capture" = one row in `entries` you (or an automated source like Gmail) created in the calendar month. Counts:
- typed/pasted entries
- voice-transcribed entries
- imported entries (Gmail, calendar)
- vault entries

Doesn't count:
- enrichment artifacts (parse / insight / concepts)
- chat messages (separate quota)
- entries created by other members in shared brains (counted on the creator)

Reset: 1st of each calendar month UTC.

### Chat messages per month
Soft cap; not in tier table because we don't count yet. Becomes a tier dimension if any user goes wild and racks up real cost.

### Brains
- Personal brain (`is_personal=true`) is always 1 and free.
- Additional brains count toward the tier limit.
- Archived brains don't count.

### Members per shared brain
Hard cap. If a Pro user invites a 6th member to a 5-member brain, the invite errors out with "Pro tier supports up to 5 members per brain."

### Vault items
Counts rows in `vault_entries`. Free tier 10 is meaningful — it's "store your most sensitive 10 things."

## BYOK (bring your own key)

Pro and Max can paste an OpenAI / Anthropic / Gemini / OpenRouter API key. From that point:
- Their chat + enrichment routes through their key.
- Their managed-AI usage (against tier captures) doesn't count.
- They're billed by the provider directly. We don't see the bill.

Free tier doesn't get BYOK — we want them on managed Gemini so we control quality + cost.

## Billing providers

### Web — LemonSqueezy (Merchant of Record)
- Handles VAT/GST per region, card processing, dunning emails.
- Webhook endpoint: `api/v1?action=lemon-webhook` (TODO: confirm).
- Subscription state mirrored in `user_profiles.tier` + `user_profiles.subscription_status`.

### iOS / Android — RevenueCat
- Wraps Apple StoreKit + Google Play Billing.
- Server-side receipt validation via `REVENUECAT_SECRET_API_KEY`.
- Webhook endpoint: TODO.
- Same `user_profiles.tier` mirror.

When the same user pays on both web AND mobile, the higher tier wins. (TODO: confirm in code; this is an edge case worth handling explicitly.)

## Trial

- **Pro** — 14-day trial, no card required. Card collected when trial ends (LemonSqueezy supports this; RevenueCat does too).
- **Max** — no trial; come from Pro.

## Refund policy

- **Web (LemonSqueezy)**: 7-day money-back guarantee. Any reason. Self-serve via the LemonSqueezy customer portal.
- **iOS**: Apple's standard refund process (we don't control it; user requests refund through Apple).
- **Android**: 48-hour auto-refund + Play's standard process beyond that.

If a user disputes a charge, refund first, ask later. Cost of a dispute > cost of refund + investigation.

## Failed payments / dunning

LemonSqueezy retries failed cards 3× over 14 days, then suspends the subscription. We mirror the suspension to `user_profiles.subscription_status='past_due'` and:
- Show a banner in-app: "Your card was declined. Update payment to keep Pro features."
- After 14 days: downgrade to Free tier. Tier-locked features become read-only (existing data preserved).

For RevenueCat: same flow, dunning is platform-mediated.

## Tier downgrade (mid-cycle)

If user downgrades mid-cycle:
- Pro → Free on day 5 of a 30-day cycle: keep Pro features for the rest of the cycle, downgrade at period end.
- Pro → Max same cycle: prorate immediately.

## Tier limit enforcement

Hard limits (block action with a polite limit-banner):
- Captures per month exceeded → "You've used 100/100 captures this month. Upgrade to Pro for 1,000 → [Pricing]"
- Brains exceeded → "Free tier is one personal brain. Pro lets you create shared brains for family or work."
- Members per brain exceeded → enforced at invite time.
- Vault items exceeded → "Vault is at 10/10. Upgrade to Pro for 100 vault items."

Soft limits (warn but allow):
- Approaching capture quota (≥ 80%): show a non-blocking banner.

Source of enforcement: TODO — currently in `api/_lib/quota.ts` (verify path).

## Legal entity (for billing)

- **South African operator**: Christian Stander, sole proprietor (TBD: register a (Pty) Ltd before scaling)
- **Tax**: VAT-registered if turnover > R1m/year (won't be true at launch); register voluntarily if it helps with EU VAT compliance (probably overkill — LemonSqueezy is the merchant of record so they handle EU VAT).
- **Apple**: Registered Developer Account ($99/year). Tax forms (W-8BEN if non-US) on Apple side.
- **Google**: Play Console Merchant Account; SA-domiciled.
- **RevenueCat**: SaaS layer; no legal entity implications.

## Common scenarios for support

### "I was charged twice"
- Check LemonSqueezy + RevenueCat for duplicate subscriptions on same email.
- If genuine duplicate: refund one immediately, apologize, add the user to a watch-list to ensure no re-occurrence (some cases are app vs web double-pay).

### "I want to keep my data after canceling"
- Cancellation downgrades to Free; data is preserved. Only tier-gated features become read-only. Data export remains available.

### "I'm unhappy, refund please"
- Within 7 days, web: yes, no questions, do it. After: depends; explain we usually only refund within 7 days but escalate to Christian if there's a real reason.

### "I bought on iOS and want web access"
- If they're paying via App Store, their tier is reflected via RevenueCat → applied to their account → web also uses that tier.

## TODO before launch

- [ ] Lock tier limits (captures, brains, members, vault items)
- [ ] Lock pricing (ZAR + USD; check competitor benchmarks)
- [ ] Wire LemonSqueezy live mode (test mode currently)
- [ ] Wire RevenueCat live mode for both platforms
- [ ] Test prorate on Pro → Max upgrade
- [ ] Test downgrade → period-end transition
- [ ] Test failed-card dunning end-to-end
- [ ] Build pricing page (`everion.smashburgerbar.co.za/pricing`)
- [ ] Customer portal link (LemonSqueezy provides; integrate into Settings → Billing)
- [ ] Tax registration check with accountant

## References

- `Support/sop.md` — billing-related ticket flow
- `architecture/security.md` — service-role / RLS that gates what billing data the user can see
- `Ops/env-vars.md` — `LEMONSQUEEZY_*`, `REVENUECAT_*` keys
- LemonSqueezy docs: <https://docs.lemonsqueezy.com>
- RevenueCat docs: <https://docs.revenuecat.com>
- Apple Pricing Tiers: <https://appstoreconnect.apple.com/apps/.../pricing>
