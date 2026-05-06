# Account recovery procedures

Step-by-step for every "I can't get in" scenario. The exact admin / support steps with referenced code paths.

## Lost password (email auth)

**User says**: "I forgot my password."

1. Direct user to <https://everion.smashburgerbar.co.za/login> → "Forgot password?" link.
2. Supabase Auth handles the flow: emails a magic link to the user's email.
3. User clicks the link, sets a new password.
4. **Nothing for support to do** unless the user reports the email never arrived (see § Email deliverability).

## Lost passphrase (vault)

**User says**: "I forgot my vault passphrase."

Mathematical reality: vault entries are encrypted with a key derived from the passphrase. We have **no copy of the key**. Without the passphrase or the recovery key, the vault content is unrecoverable.

### Path A — they have the recovery key

1. Direct user to: Vault tab → "forgot your passphrase? use recovery key."
2. They paste the 20-char `XXXX-XXXX-XXXX-XXXX-XXXX` recovery key.
3. Client decrypts the recovery blob → master KEK → vault unlocks.
4. **Strongly suggest they immediately set a new passphrase** (TODO — flow not yet shipped; add to LAUNCH_CHECKLIST).
5. **Done.**

### Path B — they have neither passphrase nor recovery key

Their existing vault content is gone. Confirm in writing before wiping.

1. Reply to the user (template):
   > "I'm sorry — vault content is encrypted with a key derived from your passphrase, and we genuinely have no way to recover it without either the passphrase or the recovery key. Reply to confirm you'd like me to wipe your vault setup so you can start over with a new passphrase. Anything currently encrypted will be lost. Outside-the-vault entries (regular memory) are unaffected."

2. Get explicit reply: "yes, wipe it."

3. Find their user_id in Supabase → `auth.users` by email.

4. Wipe SQL:
   ```sql
   DELETE FROM public.brain_vault_grants WHERE user_id = '<uuid>';
   DELETE FROM public.vault_entries      WHERE user_id = '<uuid>';
   DELETE FROM public.vault_keys         WHERE user_id = '<uuid>';
   DELETE FROM public.entries
     WHERE user_id = '<uuid>' AND type = 'secret';  -- legacy secrets, if any
   ```

5. Reply: "Done. Open the Vault tab — you'll be prompted to set up a new passphrase. Please **download a backup** (Vault → ↓ Backup) once a month going forward so this never happens again."

6. Log the wipe in `audit_log` with `action='admin_vault_wipe'`, `actor_id=<your admin uuid>`, metadata=`{ target_user_id, reason: "user lost passphrase + recovery key" }`.

## Hijacked account

**User says**: "Someone got into my account."

1. **Force sign-out** — invalidate all sessions for that user:
   ```sql
   DELETE FROM auth.refresh_tokens WHERE user_id = '<uuid>';
   ```
2. **Force password reset** — Supabase Dashboard → Auth → User → "Send password reset."
3. **Audit `audit_log`** for the past 30 days for that user_id. Look for: tier changes, brain shares to unfamiliar emails, vault grant additions.
4. **Reply with the audit summary** and a list of every brain they've shared into. Let them revoke any they don't recognise.
5. **Recommend** they enable PIN + biometric (`VITE_FEATURE_VAULT_PIN_BIOMETRIC` is on by default) so future device compromise has a higher bar.

## Lost MFA / biometric device

**User says**: "I lost my phone, I can't unlock the vault."

PIN + biometric are device-local — losing the device means losing the *quick* unlock, not the *only* unlock.

1. They unlock via passphrase as normal.
2. Settings → Vault → "Remove PIN + biometric" wipes the local PIN/biometric record.
3. They re-enroll on the new device after vault unlock.

## Account deletion request

**User says**: "Delete my account and all my data" (GDPR / POPIA).

1. Confirm the request comes from the email address registered to the account. If unclear, send a confirmation link.
2. Use the existing delete-cascade endpoint:
   ```bash
   curl -X DELETE "https://everion.smashburgerbar.co.za/api/user-data?resource=delete-account" \
     -H "Authorization: Bearer <user-jwt>"
   ```
   That triggers migration 054's cascade: every user-owned table is purged.
3. Manually delete the auth.users row via Supabase dashboard (the cascade hits public.* tables; the auth row itself needs the dashboard).
4. Reply confirming deletion with the timestamp.
5. **Log to `audit_log`** with `action='user_self_delete'`, metadata=`{ requested_at, completed_at }`.

> **POPIA / GDPR note**: by law, we have to complete this within 30 days of the request. Aim for same-day.

## Email never arrived (deliverability)

**User says**: "I never got the password reset / invite / welcome email."

1. Check `audit_log` for the email_send event for that user_id within the relevant window.
2. Open Resend dashboard → Logs → search by recipient email.
3. If Resend reports `delivered`: the user's spam folder is the most likely culprit. Tell them to check spam, mark as not-spam.
4. If Resend reports `bounced`: their email is rejecting our domain. Possibly because of SPF/DKIM/DMARC misconfig (see `LAUNCH_CHECKLIST.md` § "Invite emails inbox-not-spam").
5. If Resend reports `pending` for >5 minutes: vendor outage; check <https://resend-status.com>.

## Support CRM access

The Admin tab in Settings has a Support CRM section that searches users by email or UUID prefix. Use this **first** for any support ticket — pulls profile + tier + this-month usage + last 50 audit events in one click.

Path: Settings → Admin → Support CRM (admin-only; gated by `app_metadata.is_admin`).

Source: `src/components/settings/AdminCRMSection.tsx`.

## Communication templates

### Password reset never received
> Hi <name>,
>
> The reset email is sent immediately when you click the link, but it can take a few minutes to land — and Gmail / Outlook sometimes route it to spam. Could you check your spam folder, and if it's not there, reply with the email address you used to sign up so I can confirm we have the right one?
>
> — Christian

### Lost passphrase + recovery key (the hard email)
> Hi <name>,
>
> I'm sorry — vault content is encrypted with a key derived from your passphrase, and we genuinely don't store any copy of it. Without the passphrase or the recovery key, the encrypted entries are mathematically unrecoverable.
>
> What I can do: wipe your vault setup so you can start over with a new passphrase. **Anything currently encrypted will be lost.** Your regular (non-vault) memory entries are unaffected.
>
> Reply with "yes, wipe it" if you'd like me to proceed. Going forward, please download a backup (Vault tab → ↓ Backup) once a month — that's a one-click insurance policy against losing the recovery key again.
>
> — Christian

### Hijacked account
> Hi <name>,
>
> I've signed out every device on your account and triggered a password reset email. Please use that to set a new password.
>
> Here's what's happened on your account in the past 30 days: <paste audit summary>. Let me know if any of that looks unfamiliar — I can revoke any unwanted brain shares from this side.
>
> Also please consider enabling PIN + biometric in Settings → Vault. It adds a per-device unlock step that someone with just your password can't bypass.
>
> — Christian
