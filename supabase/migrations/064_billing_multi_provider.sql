-- 064_billing_multi_provider.sql
-- Adds provider-agnostic billing columns to user_personas so the app can
-- track active subscriptions across LemonSqueezy (web), Apple App Store
-- (iOS in-app), and Google Play (Android in-app). The legacy stripe_*
-- columns are kept until any in-flight Stripe customers are migrated; new
-- code reads/writes the provider-neutral columns below.
--
-- Why three provider-specific id columns instead of one polymorphic field:
-- each provider exposes different lifecycle webhooks keyed on its own id.
-- Storing them side-by-side keeps webhook lookups O(1) without a JSON path.

ALTER TABLE public.user_personas
  ADD COLUMN IF NOT EXISTS billing_provider          text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id  text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id text,
  ADD COLUMN IF NOT EXISTS appstore_original_transaction_id text,
  ADD COLUMN IF NOT EXISTS playstore_purchase_token  text,
  ADD COLUMN IF NOT EXISTS playstore_product_id      text,
  ADD COLUMN IF NOT EXISTS current_period_end        timestamptz;

ALTER TABLE public.user_personas
  ADD CONSTRAINT user_personas_billing_provider_check
  CHECK (billing_provider IS NULL OR billing_provider IN ('lemonsqueezy', 'appstore', 'playstore', 'stripe'));

-- Webhook handlers look up users by provider-id (e.g. lemonsqueezy_subscription_id
-- on subscription_updated events). Partial indexes keep storage tiny while
-- still giving constant-time lookups for the active rows that matter.
CREATE INDEX IF NOT EXISTS user_personas_lemonsqueezy_subscription_id_idx
  ON public.user_personas (lemonsqueezy_subscription_id)
  WHERE lemonsqueezy_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_personas_appstore_original_transaction_id_idx
  ON public.user_personas (appstore_original_transaction_id)
  WHERE appstore_original_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_personas_playstore_purchase_token_idx
  ON public.user_personas (playstore_purchase_token)
  WHERE playstore_purchase_token IS NOT NULL;
