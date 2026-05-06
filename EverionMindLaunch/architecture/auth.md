# Auth + Tier Gating + Rate Limits

The middleware stack every API call goes through. JWT verify, role checks,
brain access, rate limits, monthly tier quotas, BYOK provider resolution,
and the API-key path for external agents. Reflects state as of commit
`812ed56` (admin role refactor).

## TL;DR

- **Two wrappers**, one chain: `withAuth(opts, handler)` for browser-JWT
  endpoints (the 11 normal `api/*.ts` files), `withApiKey(opts, handler)`
  for `em_*` API-key endpoints (`/api/v1`, `/api/mcp`).
- **Auth chain order**: security headers → method check → rate limit →
  JWT verify (or API-key resolve) → handler. Handlers throw `ApiError`
  for typed responses; anything else surfaces as 500.
- **Admin = `auth.users.app_metadata.is_admin === true`**. Per-user
  boolean, server reads from JWT, client reads from session. Replaces
  the old single-email env-var gate. Multi-admin is now a one-line SQL.
- **Tier gating** lives in `usage.checkAndIncrement` — monthly counters
  in `user_usage` (RPC `increment_usage`). BYOK users short-circuit
  `allowed: true`. Free tier is **always** denied for managed AI calls.
- **Rate limiting** is sliding-window via Upstash Redis. In-memory
  fallback exists for dev; fail-closed in prod (Vercel env without
  Upstash → all requests blocked). Keyed on `(IP, path, optional suffix)`.

---

## File map

| File | Role |
|---|---|
| `api/_lib/withAuth.ts` | `withAuth` + `withApiKey` middleware wrappers. `ApiError` class. `requireBrainAccess` helper |
| `api/_lib/verifyAuth.ts` | JWT → `AuthedUser` via Supabase `/auth/v1/user` |
| `api/_lib/resolveApiKey.ts` | `em_*` key → `{userId, keyId, brainId}` via sha256 hash lookup |
| `api/_lib/rateLimit.ts` | Sliding-window limiter — Upstash REST + in-memory fallback |
| `api/_lib/usage.ts` | `checkAndIncrement(userId, action, tier, hasByok)` |
| `api/_lib/checkBrainAccess.ts` | Owner check — `(brain_id, user_id)` exists in `public.brains` |
| `api/_lib/resolveProvider.ts` | BYOK-or-tier → LLM + embed configs |
| `api/_lib/securityHeaders.ts` | CSP, HSTS, X-Frame-Options, etc. — applied first thing |
| `api/_lib/sbHeaders.ts` | Supabase REST headers helper (`apikey` + `Authorization` for service-role calls) |
| `api/_lib/cronAuth.ts` | `verifyCronBearer` for the two cron endpoints (separate path, see `cron.md`) |
| `api/entries.ts:766` | `isAdminUser` helper — used by 7 admin-gated handlers |
| `src/App.tsx` | Mirrors `app_metadata.is_admin` into localStorage on every auth change |
| `src/lib/userEmailCache.ts` | Sync admin/email cache for render-time consumers |

---

## The auth chain (`withAuth`)

```
incoming request
↓
applySecurityHeaders(res)            ← always, even on 4xx/5xx
↓
set Cache-Control if specified
↓
set x-request-id header
↓
method check                          → 405 if not in opts.methods
↓
rate limit                            → 429 if over budget
↓
verifyAuth(req)                       → 401 if no/invalid JWT
↓
handler({ req, res, user, log, req_id })
↓
business logic, throws ApiError for typed errors
↓
catch: ApiError → status + message, anything else → 500
```

`opts.methods` defaults to `["POST"]`. `opts.rateLimit` defaults to 30/min;
pass `false` to skip the outer limit (sub-handlers must call `rateLimit()`
themselves — pattern used in `api/gmail.ts` for the
5/min-scan / 3/min-deep-scan inner limits).

`opts.cacheControl` is the response header — most endpoints set
`"no-store"` because the bodies are user-specific. The few exceptions
(public `/api/feedback`) don't set it.

### `AuthedUser` shape

```ts
interface AuthedUser {
  id: string;
  email?: string;
  aud?: string;
  role?: string;            // Supabase role (authenticated, etc.) — NOT app role
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;  // ← admin flag lives here
  [key: string]: unknown;
}
```

Two metadata fields, two different write models:
- **`user_metadata`**: user-writable via the auth API. We use it for
  push subscriptions, notification prefs, daily streak counters,
  onboarding steps. Never trust this for security gates.
- **`app_metadata`**: server-only — only `service_role` can write.
  Where the `is_admin` flag lives. Rides in the JWT automatically, so
  the API reads it from the verified token without a DB hit.

### `verifyAuth`

```ts
const token = authHeader.split(" ")[1];
const res = await fetch(`${SB_URL}/auth/v1/user`, {
  headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
});
return await res.json();    // AuthedUser, includes app_metadata
```

One round-trip per request. Supabase returns the user from the JWT
claims plus a fresh row read of `auth.users` (so app_metadata changes
made by SQL show up on the next request, not stuck in stale JWT
cache). Acceptable cost — every protected endpoint pays it once.

The token is **never** verified locally with the JWT secret. Letting
Supabase do the verify keeps the secret out of every Vercel function's
env and lets revocations (sign-out) take effect immediately.

---

## Admin role — `app_metadata.is_admin`

### How it works

Server-side helper at `api/entries.ts:766`:

```ts
function isAdminUser(user: { app_metadata?: Record<string, unknown> }): boolean {
  return user.app_metadata?.is_admin === true;
}
```

Used in 7 admin-gated handlers in `api/entries.ts` — enrich-debug, retry
embeddings, repair brain ids, clear backfill, and a few admin views.
All other endpoints don't gate on admin — they gate on user identity
(via `withAuth`) and brain ownership (via `requireBrainAccess`).

Client-side, the same flag is read from the session and cached:

| Site | Reads from |
|---|---|
| `src/App.tsx:isAdmin` | `session.user?.app_metadata?.is_admin === true` |
| `src/hooks/useAdminDevMode.ts` | `getSession()` then `app_metadata.is_admin` |
| `src/views/SettingsView.tsx` | `getUser()` then `app_metadata.is_admin` |
| `src/components/EntryList.tsx:isAdminSync` | `getCachedIsAdmin()` (localStorage) |

App.tsx mirrors the flag into localStorage (`everion_is_admin`) on every
session change so render-time sync consumers like `EntryList` (which
gates the PICE chip visibility on every card) don't pay an async lookup
per render. Cache is invalidated by sign-out (writes `false` → key
removed). Cache is purely a UI hint; **server check is authoritative**.

### Granting admin

One-line SQL via Supabase MCP / dashboard:

```sql
UPDATE auth.users
SET    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                           || jsonb_build_object('is_admin', true)
WHERE  email = '<user-email>';
```

Revoke:

```sql
UPDATE auth.users
SET    raw_app_meta_data = raw_app_meta_data - 'is_admin'
WHERE  email = '<user-email>';
```

### Propagation latency

The flag lives in the user's **JWT claims**. Existing access tokens
don't carry the new flag until they refresh. Three propagation paths:

| Path | Latency |
|---|---|
| User signs out + back in | Immediate |
| `supabase.auth.refreshSession()` | Immediate (JWT regenerated server-side) |
| Wait for auto-refresh | ≤ 1 hour (Supabase JS SDK refreshes on schedule) |

For the admin granting themselves: server reads `app_metadata` from a
fresh `/auth/v1/user` call on every request, so server-side checks
update immediately. Client-side gates wait for the next session refresh.

### Why not a `user_profiles.is_admin` column?

Considered. Decided against because:
1. **JWT-carried** — no extra DB hit per request to check role.
2. **Service-role-only writes** — RLS-level safety against client
   tampering. `user_metadata` (which we use for push subs) IS
   user-writable; `app_metadata` is the server-controlled twin.
3. **Standard Supabase pattern** for roles. Future migrations to
   `pgrls` policies that gate on `auth.jwt() ->> 'app_metadata'` work
   without schema changes.

### `ADMIN_EMAIL` env var (still used, narrowed scope)

`process.env.ADMIN_EMAIL` (and the `VITE_ADMIN_EMAIL` mirror) survive
in two narrow non-permission roles:

- **Cron summary recipient** — `api/user-data.ts:1353` looks up the admin
  user by email to send the daily-cron push + bell row to.
- **Test push diagnostic** — `scripts/test-push.mjs` uses it as the
  default target user when no `TEST_PUSH_EMAIL` is provided.

Both are "who do I send this to," not "is this user allowed to do X."
Worth renaming to `PRIMARY_ADMIN_EMAIL` for clarity, but not load-bearing.

---

## Brain access — `requireBrainAccess`

```ts
async function requireBrainAccess(userId, brainId): Promise<void> {
  if (!brainId || typeof brainId !== "string" || brainId.length > 100) {
    throw new ApiError(400, "Invalid brain_id");
  }
  if (!await checkBrainAccess(userId, brainId)) {
    throw new ApiError(403, "Forbidden");
  }
}
```

`checkBrainAccess` is a 1-row SELECT on `public.brains` filtered by
`(id, owner_id)`. Returns `{role: "owner"}` or `null`. No collaborator
role yet — the schema supports multi-owner via `brain_members` (see
the shared-brains design doc) but this helper only validates ownership.

**Called from every handler that takes `brain_id`** — capture, gmail
scan, transfer import, MCP tool exposure, llm router. The pattern is:

```ts
if (p_brain_id) await requireBrainAccess(user.id, p_brain_id);
```

Server-side. RLS on the `entries` table also enforces this — the
helper is the cheaper-and-clearer-error fast-path so the request fails
at 403 before any INSERT attempts.

---

## Rate limiting

### Strategy

Sliding window via Upstash Redis REST API. Each request adds an entry
to a sorted set keyed `rl:<ip>:<path>:<suffix>`, trims entries older
than `windowMs`, counts the size, sets a TTL. The pipeline is one HTTP
round-trip:

```
ZREMRANGEBYSCORE rl:<key> -inf <windowStart>
ZADD             rl:<key> <now> <unique-member>
ZCARD            rl:<key>                       ← used for the limit check
PEXPIRE          rl:<key> <windowMs>
```

Latency: ~30-80ms to Upstash from Vercel EU region. Acceptable —
better than per-request DB locks.

### Keying

```
key = `${ip}:${path}:${suffix?}`
```

- **IP**: last hop in `x-forwarded-for` (`_getIp`). Deliberately the
  *last* — first hop is user-controlled and spoofable; last is Vercel
  edge. `x-real-ip` and `socket.remoteAddress` are fallbacks for
  non-Vercel environments.
- **Path**: clipped to first 50 chars (after stripping query string).
  So `/api/feed?cursor=x` and `/api/feed?cursor=y` share a counter,
  but `/api/feed` and `/api/llm` don't.
- **Suffix**: optional. Used by handlers that want sub-action limits
  (Gmail scan: `gmail-scan:<userId>`).

### Fail-closed in prod

```ts
if (!hasUpstash && _onVercel) return false; // fail closed
```

Vercel-deployed without `UPSTASH_REDIS_REST_URL` → every request hits
the limiter → returns false → 429. Loud but safe. Dev (no `VERCEL`
env) falls through to the in-memory map with a warn log.

The 500-key cap on the in-memory map prevents the dev-only path from
blowing up RAM during long sessions.

---

## Tier gating — monthly quotas

Lives in `api/_lib/usage.ts`:

```ts
export async function checkAndIncrement(
  userId: string,
  action: "captures" | "chats" | "voice" | "improve",
  tier: string,
  hasByok: boolean,
): Promise<{ allowed: boolean; remaining: number; pct: number }>
```

### Decision matrix

| `hasByok` | `tier` | Result |
|---|---|---|
| true | * | `{ allowed: true, remaining: Infinity, pct: 0 }` — BYOK pays for itself |
| false | `free` | `{ allowed: false, ... }` — free tier denied managed AI |
| false | `starter` | counted vs `LIMITS.starter[action]` |
| false | `pro` | counted vs `LIMITS.pro[action]` (improve = Infinity) |
| false | unknown | denied |

### Limits

| Action | starter | pro |
|---|---|---|
| captures | 500 | 2000 |
| chats | 200 | 1000 |
| voice | 20 | 100 |
| improve | 20 | ∞ |

`improve` (Improve Brain — bulk re-enrichment) is uncapped on pro
because pro users running it on a 5000-entry brain shouldn't hit a wall.

### How counts are tracked

`/rest/v1/rpc/increment_usage` — server-side RPC that takes `(user_id,
period, action)` and returns the new count after increment. Period is
`YYYY-MM` so quotas reset monthly. Atomic; no read-then-increment race.

```ts
try {
  count = await rpc('increment_usage', ...);
} catch {
  throw new Error("quota_check_failed", { status: 503 });
}
```

A 503 from the RPC bubbles up — handlers translate to a `quota_unavailable`
response so the client can retry. **Critical**: this is `.maybeSingle()`-
shaped on the SQL side now (was `.single()`, which 406'd on the first
request of a new billing period — see CLAUDE.md note about `user_usage`
406 bug).

---

## Provider resolution — `resolveProviderForUser`

```ts
1. Read user_ai_settings (BYOK keys + per-user model overrides)
2. Read user_profiles.tier (synced from LemonSqueezy webhook for web subs and the RevenueCat webhook for native subs)
3. BYOK priority: anthropic > openai > gemini > openrouter
   → return that provider's config immediately (BYOK wins over tier)
4. No BYOK → managed provider by tier:
   - tier=pro|max     → managed Anthropic   (env ANTHROPIC_API_KEY)
   - tier=starter     → managed Gemini      (env GEMINI_API_KEY)
   - tier=free        → null (no enrichment)
```

`resolveEmbedProviderForUser` is separate — embedding is always
Gemini (or BYOK OpenAI). Anthropic doesn't offer first-class
embeddings, so the tier mapping doesn't apply here.

Note: per CLAUDE.md, `ANTHROPIC_API_KEY` isn't yet provisioned in this
project — code paths that gate on it will fall through to Gemini or
deny. Don't add Anthropic-key checks anywhere new.

---

## API key path — `withApiKey`

For `em_*` personal API keys (used by `/api/v1` and `/api/mcp`).
Same middleware chain as `withAuth`, but identity comes from
`resolveApiKey`:

```
Authorization: Bearer em_<key>
↓
sha256 hash → user_api_keys lookup (revoked_at IS NULL)
↓
parallel: PATCH last_used_at + SELECT user's first brain
↓
{ userId, keyId, brainId }
```

Identity is `(userId, keyId, brainId)` — every API-key call is scoped
to one brain. Multi-brain via API key isn't yet wired.

`resolveApiKey` writes `last_used_at` fire-and-forget (no await on the
PATCH — losing the timestamp doesn't break the request). The brain
SELECT must succeed though; without a brain the key is unusable.

### Key issuance / revocation

Lives in `api/user-data.ts` (`?resource=api-keys`). On creation, the
plain key is shown once; the hash is what's stored. Revoke = set
`revoked_at = now()` — the hash lookup filters those out.

---

## Cron auth (separate path)

The two cron endpoints (`/api/cron/daily`, `/api/cron/hourly`) bypass
`withAuth` because there's no JWT — they receive `Authorization: Bearer
${CRON_SECRET}` from GitHub Actions instead. Verified by
`verifyCronBearer` in `api/_lib/cronAuth.ts`. Constant-time compare to
prevent timing oracle attacks. Full details in `Docs/Components/cron.md`.

---

## Tier sync — LemonSqueezy + RevenueCat

User → tier mapping sits in `user_profiles.tier`. Two webhook paths
write it; whichever fires last wins.

**Web — LemonSqueezy** at `POST /api/user-data?resource=lemon-webhook`:

```
subscription_created    → set tier from variant_id mapping
                          + grantEntitlement on RevenueCat (bridge)
subscription_updated    → re-derive tier (renewal extends RC entitlement)
subscription_resumed    → re-grant
subscription_cancelled  → tier = 'free'
                          + revoke_promotionals on RevenueCat
subscription_expired    → tier = 'free' + revoke
subscription_paused     → tier = 'free' + revoke
```

Auth via HMAC-SHA256 signature in `X-Signature` header
(`api/_lib/lemonsqueezy.ts` `verifyWebhookSignature`,
`crypto.timingSafeEqual`). Idempotency via Upstash SET-NX in
`webhookIdempotency.ts` keyed `lemon:event:<webhook_id>`.

**Native — RevenueCat** at `POST /api/user-data?resource=revenuecat-webhook`:

```
INITIAL_PURCHASE        → set tier from product_id mapping
RENEWAL                 → re-derive tier (renewal extends period)
PRODUCT_CHANGE          → re-derive tier
UNCANCELLATION          → re-derive tier
CANCELLATION            → tier = 'free'
EXPIRATION              → tier = 'free'
BILLING_ISSUE           → tier = 'free' (RC will fire RENEWAL on recovery)
```

Auth via shared bearer secret in the `Authorization` header
(`revenuecat.ts` `verifyWebhookAuth`). Idempotency keyed
`revenuecat:event:<event.id>`. PROMOTIONAL-store events are dropped
because the LS bridge already wrote the tier — re-handling would
echo-loop the entitlement back into the DB.

Tier is the source of truth. The Apple original-transaction-id and
Google purchase-token columns on `user_profiles` are audit trail only —
RC owns that state.

`user_ai_settings.plan` is a denormalised mirror updated alongside —
some queries in the BYOK paths read it instead of joining
`user_profiles`. The two should agree; if they drift,
`user_profiles.tier` wins.

---

## Recent changes worth knowing

- **2026-04-29**: Admin gate moved from `email === ADMIN_EMAIL` to
  `app_metadata.is_admin === true`. Multi-admin, no env redeploy. See
  Migration / Granting admin sections above.
- **`user_usage` 406 bug fixed** — `.single()` → `.maybeSingle()` on
  the read after RPC. New billing periods no longer 406.
- **Audit log** (migration 057) — every capture, share, secret access
  writes a row to `audit_log`. Read via RLS by the user; insert via
  service role only.
- **Rate-limit IP source** — switched from first-hop to last-hop in
  `x-forwarded-for`. First hop is spoofable; last is Vercel edge.

---

## Known limitations / future work

- **Brain access doesn't yet support collaborator roles.** `checkBrainAccess`
  returns `owner | null`. The `brain_members` table exists (see shared-
  brains design doc) but no handler uses it yet. Sharing is currently
  invite-driven copy, not live join.
- **`AuthedUser.role` is the Supabase role** (`authenticated`,
  `service_role`), not the app role. Don't use `user.role` for admin
  checks — it'll always be `authenticated` for browser-JWT requests
  and confuse readers. Use `isAdminUser(user)` exclusively.
- **No rate-limit per-user** — limiter keys on IP. A user behind a
  shared IP (corporate NAT, mobile carrier-grade NAT) shares a budget
  with their neighbors. For most actions the per-user monthly quota is
  the real cap; for hot endpoints (Gmail scan: 5/min) the IP limit is
  the only protection. Worth adding `userId` to the suffix once it
  matters.
- **JWT cache is server-side only** — the client SDK refreshes once an
  hour, so `is_admin` propagation can lag up to 60 minutes for the
  granted user. Acceptable for now (admin grants are rare); a
  programmatic `supabase.auth.refreshSession()` after grant would
  short-cut it.
- **Upstash failure → in-memory fallback in dev only**. Prod fails
  closed. If Upstash has a regional outage, every request 429s. No
  circuit breaker; consider a temporary `RATE_LIMIT_BYPASS_SECRET` env
  for emergency unblock if it becomes a real concern.
- **API-key brain scoping is single-brain-only**. The key resolves to
  the user's first brain (`limit=1`). Multi-brain users can't switch
  the active brain via API key today; they'd need separate keys per
  brain or upgrade to the JWT path.
- **No revoke-all on password change**. Supabase keeps existing
  sessions valid through password updates. Sign-out everywhere
  requires the user to manually invoke it on each device. Acceptable
  for the threat model (single user, no shared accounts) but not for
  multi-user.
