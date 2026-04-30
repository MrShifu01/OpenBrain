-- 065_billing_relocate_to_user_profiles.sql
--
-- 064 added LemonSqueezy + Apple + Play columns to user_personas — wrong table.
-- user_personas is the chat-persona record (PK: user_id). user_profiles is the
-- canonical billing record (PK: id). Per 051's own header note, billing must
-- not commingle with persona context. 064's columns were never written to
-- (LemonSqueezy never went live, the API code wrote to user_profiles via id=eq),
-- so the drop is purely cosmetic — no data loss possible.
--
-- This migration also folds Apple/Play into one provider slot ("revenuecat")
-- since RevenueCat abstracts both stores. Apple/Play raw IDs stay as audit
-- columns — populated from the RevenueCat webhook payload's `store` field.

-- ── 1. Strip billing residue from user_personas ─────────────────────────────
ALTER TABLE public.user_personas
  DROP CONSTRAINT IF EXISTS user_personas_billing_provider_check;

DROP INDEX IF EXISTS user_personas_lemonsqueezy_subscription_id_idx;
DROP INDEX IF EXISTS user_personas_appstore_original_transaction_id_idx;
DROP INDEX IF EXISTS user_personas_playstore_purchase_token_idx;

ALTER TABLE public.user_personas
  DROP COLUMN IF EXISTS billing_provider,
  DROP COLUMN IF EXISTS lemonsqueezy_customer_id,
  DROP COLUMN IF EXISTS lemonsqueezy_subscription_id,
  DROP COLUMN IF EXISTS appstore_original_transaction_id,
  DROP COLUMN IF EXISTS playstore_purchase_token,
  DROP COLUMN IF EXISTS playstore_product_id,
  DROP COLUMN IF EXISTS current_period_end;

-- ── 2. Add the same columns to user_profiles ────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS billing_provider                 text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id         text,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id     text,
  ADD COLUMN IF NOT EXISTS appstore_original_transaction_id text,
  ADD COLUMN IF NOT EXISTS playstore_purchase_token         text,
  ADD COLUMN IF NOT EXISTS playstore_product_id             text,
  ADD COLUMN IF NOT EXISTS current_period_end               timestamptz;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_billing_provider_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_billing_provider_check
  CHECK (
    billing_provider IS NULL
    OR billing_provider IN ('lemonsqueezy', 'revenuecat', 'stripe')
  );

CREATE INDEX IF NOT EXISTS user_profiles_lemonsqueezy_subscription_id_idx
  ON public.user_profiles (lemonsqueezy_subscription_id)
  WHERE lemonsqueezy_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_profiles_appstore_otx_idx
  ON public.user_profiles (appstore_original_transaction_id)
  WHERE appstore_original_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_profiles_playstore_token_idx
  ON public.user_profiles (playstore_purchase_token)
  WHERE playstore_purchase_token IS NOT NULL;

-- ── 3. Extend lock-billing trigger to cover the new columns ─────────────────
-- Service-role API still bypasses; authenticated callers can never touch
-- billing state directly. Webhook handlers run with the service-role key.
CREATE OR REPLACE FUNCTION _lock_billing_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;

  IF (NEW.tier IS DISTINCT FROM OLD.tier)
     OR (NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id)
     OR (NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id)
     OR (NEW.tier_expires_at IS DISTINCT FROM OLD.tier_expires_at)
     OR (NEW.billing_provider IS DISTINCT FROM OLD.billing_provider)
     OR (NEW.lemonsqueezy_customer_id IS DISTINCT FROM OLD.lemonsqueezy_customer_id)
     OR (NEW.lemonsqueezy_subscription_id IS DISTINCT FROM OLD.lemonsqueezy_subscription_id)
     OR (NEW.appstore_original_transaction_id IS DISTINCT FROM OLD.appstore_original_transaction_id)
     OR (NEW.playstore_purchase_token IS DISTINCT FROM OLD.playstore_purchase_token)
     OR (NEW.playstore_product_id IS DISTINCT FROM OLD.playstore_product_id)
     OR (NEW.current_period_end IS DISTINCT FROM OLD.current_period_end)
  THEN
    RAISE EXCEPTION 'Billing columns can only be updated by the system';
  END IF;

  RETURN NEW;
END;
$$;
