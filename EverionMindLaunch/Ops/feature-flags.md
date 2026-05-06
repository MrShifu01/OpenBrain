# Feature flag inventory

Every flag the app reads, who owns it, default state, and the removal target. Read by the build at compile time (`import.meta.env.VITE_FEATURE_*`) — flipping one means a redeploy.

> **Convention**: `VITE_FEATURE_*=1` enables, anything else disables. There is no per-user runtime flag system — flags are environment-wide. Per-user toggles live on `user_profiles` columns, not here.

## Active flags

| Flag | Default (prod) | Owner | Why it exists | Removal trigger |
|---|---|---|---|---|
| `VITE_FEATURE_VAULT` | ON | core | Encrypted secrets surface (the vault tab + crypto pipeline). | Permanent — feature is core. |
| `VITE_FEATURE_CHAT` | ON | core | Chat with retrieval over your memory. | Permanent — feature is core. |
| `VITE_FEATURE_TODOS` | ON | core | Schedule view (today/week/month) + reminder typing. | Permanent. |
| `VITE_FEATURE_GRAPH` | ON | core | Concept graph view. | Permanent. |
| `VITE_FEATURE_TIMELINE` | ON | core | Memory view's timeline mode. | Permanent. |
| `VITE_FEATURE_MULTI_BRAIN` | ON | core | Multiple brains + sharing. | Permanent. |
| `VITE_FEATURE_IMPORTANT_MEMORIES` | ON | core | Pin / star a memory so it floats in retrieval. | Permanent. |
| `VITE_FEATURE_VAULT_TEMPLATES` | ON | core | Template-shaped vault entries (api_key, card, etc.). | Permanent. |
| `VITE_FEATURE_VAULT_PIN_BIOMETRIC` | ON | core | PIN + biometric unlock for the vault. | Permanent. |
| `VITE_FEATURE_CONTACTS` | ON | core | Contact entry typing + Call/WhatsApp/Email actions. | Permanent. |
| `VITE_FEATURE_SOMEDAY` | ON | core | "Someday" tab on the Schedule view. | Permanent. |
| `VITE_FEATURE_APP_LOCK` | ON | core | OS-level lock screen on cold open (PIN/biometric). | Permanent. |
| `VITE_FEATURE_LISTS` | OFF | beta | Paste-driven checklists (`Specs/archive/lists-v1.md`). | Flip ON when post-launch user feedback validates the format. |
| `VITE_FEATURE_EXTRA_THEMES` | OFF | beta | Extra colour palettes beyond the default Ember + Ink set. | Flip ON if A/B test shows engagement lift. |
| `VITE_FEATURE_SHARED_BRAIN_REMINDERS` | OFF | beta | Shared-brain expiry-reminder fan-out: per-brain notification level pills surface in `Settings → Notifications`. See `Specs/shared-brain-notifications.md`. **Pair with the server-side `FEATURE_SHARED_BRAIN_REMINDERS` (no `VITE_` prefix) on Vercel.** | Flip ON for staging once cron tested; for production after 7 days of stable beta-cohort behavior. |
| `FEATURE_SHARED_BRAIN_REMINDERS` (server-only) | OFF | beta | Cron-side gate inside `handleCronHourly`. Without this set, the expiry fan-out block is skipped so the dormant feature cannot accidentally fire even if the UI flag is on. | Flip together with the VITE flag above. |

## Reading convention

```ts
import { isFeatureEnabled, getAdminFlags } from "./lib/featureFlags";

if (isFeatureEnabled("vaultPinBiometric", getAdminFlags())) { … }
```

`getAdminFlags()` reads localStorage overrides (admin-only) so a flag can be flipped on for one device without a redeploy. **Not a substitute for a real per-user flag system** — admin overrides leak across reloads but vanish on a different device.

## Adding a new flag — checklist

1. Add `VITE_FEATURE_<NAME>` to Vercel env (`production`, `preview`, `development`) with the desired default.
2. Add to `.env.example` with a comment explaining what it gates.
3. Add a row to the table above with owner + removal trigger.
4. Read via `isFeatureEnabled("<camelCaseName>", getAdminFlags())` at the call site.
5. **Do not** ship code that tests `import.meta.env.VITE_FEATURE_<NAME> === '1'` directly — the helper normalises and supports admin overrides.

## Removing a flag

1. Confirm the feature is shipped to 100% (flag flipped ON in prod ≥ 2 weeks, no support escalations).
2. Delete the `isFeatureEnabled` call site — keep only the enabled branch.
3. Drop the row from this table.
4. Drop `VITE_FEATURE_<NAME>` from Vercel + `.env.example`.
5. Open a follow-up grep: `git grep "<NAME>"` returns zero hits (besides this file's removal commit).

## Audit cadence

Walk the table monthly. Any flag stuck OFF for > 90 days is dead code — either ship it or delete it. Any flag stuck ON for > 60 days is invisible to operators — promote and remove.
