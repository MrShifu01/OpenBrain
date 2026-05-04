# Security architecture

End-to-end security model: what's encrypted, where keys live, what an attacker can see, and what they can't.

> **Scope**: this doc consolidates what was previously scattered across migration comments + `src/lib/crypto.ts` + `architecture/auth.md`. Follow the cross-references for deep-dives.

## Trust model

| Actor | Sees | Doesn't see |
|---|---|---|
| **The user** | Everything they own (after vault unlock for secrets) | Other users' data |
| **Other brain members** | Entries shared into a brain they belong to. Persona facts in that brain. Not the global persona core. | Anything outside that brain |
| **Server (Vercel functions)** | All non-vault data in plaintext. Vault content as ciphertext only. Cannot decrypt without the user's passphrase. | Vault plaintext under any circumstance |
| **Supabase / Postgres** | Same as server | Same as server |
| **AI providers** (Gemini, OpenAI, Anthropic) | Whatever the user sends in chat + entries during enrichment. **Never** vault content. | Vault content. Other users' data (unless explicitly shared in a brain we're chatting from). |
| **Network observer** | TLS-encrypted traffic only | Anything inside TLS |
| **Database snapshot leak** | Plaintext entries (regular memory). Encrypted vault rows. Encrypted OAuth tokens. | Vault plaintext. OAuth refresh tokens (encrypted with `OAUTH_TOKEN_ENCRYPTION_KEY`). |

## Three encryption layers

### Layer 1 — Transport (everywhere)
- HTTPS via Vercel + Supabase. No HTTP fallback.
- HSTS preload submission tracked in `LAUNCH_CHECKLIST.md`.

### Layer 2 — Application secrets at rest (server-side)
- `OAUTH_TOKEN_ENCRYPTION_KEY` — encrypts OAuth refresh tokens (Google sign-in, Microsoft) before insert into `oauth_tokens`. Server-side only. Rotation breaks every stored token; bump version (`*_v2`) instead.
- `GMAIL_TOKEN_ENCRYPTION_KEY` — same pattern, for Gmail-scope tokens.

### Layer 3 — Vault (client-side, end-to-end encrypted)

The vault is the only surface where the **server cannot see plaintext**. Two phases:

#### Phase 1 — master KEK (always)
- User picks a passphrase at vault setup.
- Client derives master KEK via PBKDF2(passphrase, 16-byte random salt, 310k iterations, SHA-256, 256-bit AES-GCM).
- Master KEK has usages `["encrypt", "decrypt", "wrapKey", "unwrapKey"]` — `wrapKey/unwrapKey` are required for phase 2 envelope.
- Server stores: `salt`, `verify_token` (a known plaintext encrypted with the KEK so we can detect a wrong passphrase), and `recovery_blob` (KEK encrypted with a one-time-shown 20-char recovery key).
- Server NEVER sees passphrase or KEK.
- Vault entries (`vault_entries.content`, `vault_entries.metadata`) are AES-256-GCM encrypted client-side with the KEK. Format: `v1:<iv-hex>:<base64-ciphertext>`.

#### Phase 2 — per-brain envelope encryption (shared brains)
- Each user has an RSA-OAEP-2048 keypair. Public key stored in clear (`vault_keys.public_key`). Private key wrapped with the master KEK (`vault_keys.wrapped_private_key`, format `rsapk:v1:...`).
- Each brain that has shared vault content has a random AES-256-GCM **DEK** (data-encryption-key).
- For each member, the DEK is wrapped with that member's public RSA key and stored in `brain_vault_grants.wrapped_dek` (format `dek:v1:...`).
- Owner unlocks → KEK → unwrap private RSA key → unwrap brain DEK → decrypt brain's vault entries.
- Personal-brain secrets stay master-KEK-encrypted (no DEK overhead).
- Source: `src/lib/crypto.ts` + `src/hooks/useVaultOps.ts` + `src/lib/vaultGrant.ts` + migrations 070/072.

> **2026-05-04 fix**: the master KEK was originally derived without `wrapKey/unwrapKey` usages, breaking phase-2 setup with "Wrapping CryptoKey doesn't support wrapKey operation." Fixed in commit `fd71cf4` — `MASTER_KEY_USAGES` constant now grants all four usages. Don't change without re-checking phase-2 setup tests.

## Row-level security (RLS)

Every user-data table has RLS enabled with `auth.uid() = user_id` as the base predicate. Brain-scoped tables (entries, vault_entries, brain_vault_grants, audit_log) layer in `is_brain_member(brain_id)` for shared access.

### Helpers (SECURITY DEFINER)
- `is_brain_owner(brain_id)` — defined in migration 069 (no-recursion variant)
- `is_brain_member(brain_id)` — same
- `is_entry_shared_to_user(entry_id)` — migration 070, for the share-overlay model

The cron path uses the **service role key** which bypasses RLS. Every other code path uses the user's JWT and stays inside RLS.

### Audit log
- `audit_log` (migration 057) records security-relevant mutations: tier changes, brain shares, vault grants, entry deletes.
- Service-role insert only; users can read their own rows via RLS.
- Rotated quarterly (90-day retention) — see `Ops/crons.md`.

## Threat surface

### What we explicitly defend against
1. **Passphrase brute-force** → 310k PBKDF2 iterations + 16-byte random salt per user makes offline brute-force expensive even for a leaked DB row.
2. **Server-side compromise reading vault content** → impossible without the user's passphrase. Server stores ciphertext only.
3. **Cross-user data leakage** → RLS enforced on every table. SECURITY DEFINER helpers explicitly check brain membership.
4. **JWT replay** → Supabase auth handles short-lived JWTs; refresh tokens rotate. `app_metadata` claims (`is_admin`) refreshed via `refreshSession()` (see `SettingsView.tsx` 2026-05-04 fix).
5. **Webhook spoofing** (LemonSqueezy, RevenueCat) → HMAC verification with shared secret on every inbound webhook.
6. **CSRF on state-changing endpoints** → `Authorization: Bearer <jwt>` required, no cookie auth.
7. **Persona context leak across brains** → `buildProfilePreamble.ts` strips identity (family, habits, About-Me) when active brain is not the user's own personal brain. Only `preferred_name` + `pronouns` survive. Fail-closed on lookup error.

### What we explicitly do NOT defend against
1. **Compromised user device** → if the user's machine is owned, attacker can read the cached vault key from sessionStorage. Out of scope.
2. **Compromised AI provider** → we trust Gemini / OpenAI / Anthropic to not retain inputs. Per their ToS, this is the agreement; no technical enforcement.
3. **Side-channel timing attacks on PBKDF2** → standard Web Crypto implementation; nothing custom.
4. **Quantum-resistant crypto** → AES-256-GCM and RSA-OAEP-2048 are not post-quantum. Migration path documented if needed in 5-10 years.

## Key rotation rules

| Key | Rotation impact | Strategy |
|---|---|---|
| User passphrase | Re-derives KEK. Re-wrap private RSA key. Re-encrypt all `verify_token` + `recovery_blob`. Vault entries unchanged (encrypted with the same KEK). | Implemented via Vault Settings → Change Passphrase (TODO — not yet shipped). |
| User RSA keypair | Old DEK grants unreadable. Owner must re-wrap every brain's DEK for the user with the new pubkey. | Not implemented. Trigger if private key is suspected compromised. |
| Brain DEK | Re-encrypt every `vault_entries.content` in that brain. Re-wrap for every member. | Not implemented. Trigger if a brain member's device is suspected compromised. |
| `OAUTH_TOKEN_ENCRYPTION_KEY` / `GMAIL_TOKEN_ENCRYPTION_KEY` | Breaks every stored OAuth/Gmail token. | Bump key version (`*_v2`) — old tokens fail to decrypt and trigger user re-auth on next use. |
| `LEMONSQUEEZY_WEBHOOK_SECRET` / `REVENUECAT_WEBHOOK_AUTH` | Inbound webhooks verified with new secret. | Rotate in vendor dashboard, then update Vercel env. <60s exposure window. |
| Master KEK derivation params (PBKDF2 iterations, hash) | Existing vaults still verifiable; new vaults use new params. | Versioned via the `v1:` prefix on every ciphertext. Bump to `v2:` if iteration count changes. |

## Recovery

Lost passphrase scenarios:
1. **User has recovery key** → they paste it into the unlock flow; client uses it to decrypt the recovery blob → KEK → vault unlocks. Recovery key is shown ONCE at setup.
2. **User has neither** → entries are mathematically unrecoverable. Wipe + re-setup. See `Support/account-recovery.md`.

## References
- `src/lib/crypto.ts` — every primitive
- `src/hooks/useVaultOps.ts` — orchestration of unlock / setup / phase-2 backfill
- `architecture/auth.md` — sign-in / OAuth / session
- `migrations/008_pgvector.sql` → vault columns added
- `migrations/070_entry_shares.sql` → cross-brain sharing
- `migrations/072_brain_vault_envelope.sql` → phase-2 envelope encryption
- `Ops/incident-response.md` § "Vault / encryption incident"
- `Ops/disaster-recovery.md` § "S4 — User reports vault wipe / lost passphrase"
