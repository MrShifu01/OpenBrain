# Decisions Log

---

## [FEATURE] Password Firewall — 2026-04-03

**Tags**: FEATURE, SECURITY, CHAT

### Implemented
- `containsSensitiveContent(text)` — regex detects password/credentials/wifi/bank/ID keywords in AI response text
- `PinGate` component — 4-digit PIN modal with create/confirm/enter flows + shake animation
- PIN stored as SHA-256 hash in `openbrain_${uid}_security_pin` (namespaced per user)
- `handleChat` intercepts sensitive AI responses before adding to `chatMsgs` — shows PinGate instead
- If no PIN set on first trigger: PinGate opens in setup mode (user creates PIN, then message is revealed)
- Settings → "Security PIN" section: Set / Change / Remove PIN
- `getUserId` exported from `aiFetch.js` for use in PIN key namespacing

### Key decisions
- Detection is on AI response text only (not user question) — avoids false positives when user types "password"
- Threat model is friction-based (over-shoulder / casual), not cryptographic — no lockout after wrong PIN
- "Change PIN" from Settings doesn't require verifying old PIN (by design for this friction tier)
- Cancel discards the pending message entirely — sensitive data never stored unprotected

---

## [FEATURE] Sprint 3 — Completion Pass — 2026-04-03

**Tags**: FEATURE, SPRINT3, BUG-FIX, UX

### Implemented

**Pre-Sprint Bug Fixes:**
- Fix 1 (Undo race condition): removed inline setTimeout delete from `handleDelete`; timer now calls `commitPendingDelete()` only if ref still holds same id (guard prevents stale timer firing on second delete). Single delete path through `commitPendingDelete`.
- Fix 2 (doSave wrong brain): added `primaryBrainId, extraBrainIds` to `doSave` useCallback deps
- Fix 3 (stale nudge entries): added `entries` to nudge effect deps at line ~756

**New features:**
- Item 12 (Reminders in calendar): CalendarView filters `status === "done"` reminders; `importance >= 2` dots render orange (#FF6B35)
- Item 13 (Family brain): already handled — no code change needed; `useBrain` + `BrainSwitcher` + API are all type-agnostic
- Item 14 (QuickCapture brain destination): single-brain users now see an inactive label pill; save button tooltip shows destination brain
- Item 15 (Quick Capture as home + hamburger nav): default view changed to `"capture"`; hamburger (☰) in header; slide-in right-side panel replaces tab bar; capture view shows 4 quick-nav tiles
- Item 16 (Fill Brain + Refine brain selectors): SuggestionsView always shows brain label for single-brain users; RefineView accepts `brains`/`onSwitchBrain` props and renders chip selector for owners with multiple brains
- Item 18 (BYO API keys + model picker): `src/lib/aiFetch.js` — drop-in authFetch wrapper that adds `X-User-Api-Key` header when user key set in localStorage; `api/anthropic.js` uses user key over env key when present; `api/openai.js` added (normalises OpenAI response to Anthropic shape); SettingsView has AI Provider section with provider/key/model; all `authFetch("/api/anthropic")` calls replaced with `aiFetch`; `MODEL` constant calls replaced with `getUserModel()`

### Key decisions
- Item 17 (dark/light toggle) was already shipped in prior session — no change needed
- `aiFetch.js` reads Supabase userId by scanning localStorage keys (fragile but avoids circular import)
- BYO key stored as `openbrain_${uid}_api_key` (namespaced per user per spec)
- OpenAI proxy normalises response to Anthropic `content[0].text` shape — frontend unchanged
- Timer guard: `if (pendingDeleteRef.current?.id === id)` prevents stale timers from committing the wrong entry

---

## [FEATURE] Sprint 3 — Daily-Use Features — 2026-04-03

**Tags**: FEATURE, SPRINT3, UX

### Implemented (11 features)
- Pre-save preview modal with fuzzy duplicate detection (scoreTitle > 50)
- Supplier quick-access panel (🏪 tab) with Call / WhatsApp / Reorder / Cost Summary
- Proactive intelligence engine: Haiku nudge on load, sessionStorage cached, dismissable banner
- Quick actions in DetailModal: type-aware (supplier/person/reminder/idea/document)
- Undo system: optimistic delete (5s deferred commit), update + create undo, progress toast
- "Who do I call?" quick-ask chips in chat view (4 chips)
- Business / Personal workspace toggle — inferWorkspace() from tags, localStorage persisted
- Voice capture: Web Speech API, en-ZA, 2s silence auto-submit, green mic indicator
- Shareable entries: Web Share API (mobile) / clipboard fallback (desktop)
- Cost/price tracking: AI prompt extracts price+unit into metadata, shown on supplier cards
- Morning briefing: Notification API permission + time picker in Settings

### Key decisions
- Delta Distribution and Delta Gas are distinct companies — AI prompt explicitly guards against merging
- Phone extraction regex: `/(\+27|0)[6-8][0-9]{8}/` (SA mobile range)
- WhatsApp URL: strip leading 0, prepend 27 for SA numbers
- Workspace inference is client-side tag-matching only (no DB schema change)
- Renewal reminder creates 1-month-forward due_date; reorder creates 7-day-forward

### Remaining known limitations
- DetailModal connections still read from static INITIAL_ENTRIES (pre-existing)
- Morning briefing scheduled push requires service worker + push subscription endpoint (future)

---

## [SECURITY] Security Audit — 2026-04-02 (re-run)

**Tags**: SECURITY, AUDIT

### Summary — re-run after fixes

```
CRITICAL  0   (was 2 — both resolved)
HIGH      1   (was 5 — 4 resolved)
MEDIUM    3   (was 5 — 3 resolved, 1 new)
LOW       4   (was 4 — 1 resolved, 1 new)
VERDICT   PASS WITH WARNINGS
```

### Progress since first audit
- ✓ Ownership check on delete/update (user_id filter)
- ✓ Rate limiting on all endpoints
- ✓ Anthropic proxy: model allowlist, max_tokens, message count validation
- ✓ OWNER_ID removed from frontend
- ✓ Supabase URL moved to env vars
- ✓ Audit logging for delete/update ops
- ✓ Security headers via vercel.json
- ✓ .env never committed (prior claim was incorrect)

### Remaining / New Findings

**[HIGH]** `capture()` RPC uses hardcoded `v_owner_id` instead of authenticated user's ID. Latent auth bypass risk if multi-user ever added. — Supabase RPC `public.capture`

**[MEDIUM]** Rate limiter is in-memory per serverless instance — ineffective across parallel Vercel instances. Fix: Upstash Redis or Vercel KV. — `api/_lib/rateLimit.js`

**[MEDIUM]** `x-forwarded-for` taken at face value — spoofable, bypasses rate limiting. — `api/_lib/rateLimit.js:6`

**[MEDIUM]** `anthropic.js` proxies `messages` array without validating individual message structure (image blocks, tool_use = expensive). — `api/anthropic.js:33`

**[LOW]** No `Content-Security-Policy` header. X-XSS-Protection present but ignored by modern browsers. — `vercel.json`

**[LOW]** All entries cached plaintext in `localStorage` including sensitive personal data. — `src/OpenBrain.jsx:804,811`

**[LOW]** No CSRF protection on mutating endpoints (mitigated by JWT requirement). — all mutating API routes

**[LOW]** `suggestions.js` prompts for Wi-Fi passwords/credentials which are FTS-indexed in Supabase. — `src/data/suggestions.js:127,217`

---

## [SECURITY] Security Audit — 2026-04-02

**Tags**: SECURITY, AUDIT

### Summary

Full security audit of OpenBrain WebApp (React + Vercel Functions + Supabase).

```
CRITICAL  2
HIGH      5
MEDIUM    5
LOW       4
VERDICT   FAIL
```

### CRITICAL Findings

- **[CRITICAL] Active API keys & tokens in .env / .env.local** — `.env`, `.env.local`
  Files exist on disk with live Anthropic API key, Supabase service role key, anon key, and Vercel OIDC token. While .gitignore correctly excludes these files, keys were present in an early commit and all keys are currently active.
  **Action**: Rotate ALL secrets immediately (Anthropic, Supabase service_role + anon, Vercel OIDC).

### HIGH Findings

- **[HIGH] No ownership check on delete/update endpoints** — `api/delete-entry.js`, `api/update-entry.js`
  Auth is verified but no check that the requesting user owns the entry. Any authenticated user can delete/modify any entry by guessing an ID.
  **Action**: Add Supabase RLS policy; filter by `user_id = auth.uid()`.

- **[HIGH] Entries endpoint returns ALL rows, no per-user filtering** — `api/entries.js`
  Query is `select=*&limit=500` with no user_id filter. RLS not confirmed active.
  **Action**: Enable RLS on entries table; add SELECT policy; filter query by current user.

- **[HIGH] Anthropic proxy endpoint passes raw client body through** — `api/anthropic.js`
  No schema validation on model, messages, or max_tokens — clients can inject arbitrary messages or request different models.
  **Action**: Validate and whitelist allowed fields; enforce model choice server-side.

- **[HIGH] Hardcoded OWNER_ID placeholder in frontend** — `src/OpenBrain.jsx` line 51
  `const OWNER_ID = "00000000-0000-0000-0000-000000000001"` — auth model is incomplete.
  **Action**: Replace with proper Supabase auth session user ID.

- **[HIGH] Supabase project URL hardcoded across all API files** — `api/*.js`, `src/OpenBrain.jsx`
  URL is semi-public by design but should be an env var for consistency and rotation.
  **Action**: Move to `SUPABASE_URL` environment variable.

### MEDIUM Findings

- **[MEDIUM] No rate limiting on any API endpoint** — all `api/*.js` files
  Unlimited requests possible; risk of API quota exhaustion / unexpected bills.

- **[MEDIUM] JSON.parse without try-catch on AI responses** — `src/OpenBrain.jsx` lines 133, 307, 376
  Malformed AI output causes unhandled exception and app crash.

- **[MEDIUM] No CSRF protection on mutating endpoints** — `api/delete-entry.js`, `api/update-entry.js`, `api/capture.js`

- **[MEDIUM] localStorage caching of entries without sanitization** — `src/OpenBrain.jsx` line 806
  Risk of persistent XSS if XSS vector exists elsewhere.

- **[MEDIUM] Supabase anon key exposed in client bundle** (expected by design, but no rotation schedule)

### LOW Findings

- **[LOW] PII in INITIAL_ENTRIES hardcoded in source** — `src/OpenBrain.jsx` lines 10-33
  Phone numbers and ID numbers embedded in client code.

- **[LOW] No security headers** (CSP, X-Frame-Options, X-Content-Type-Options)

- **[LOW] No audit logging** for sensitive operations (delete, update)

- **[LOW] Generic error messages** (minor info disclosure risk)

### Positive Findings

- Auth enforced on all endpoints via `verifyAuth()`
- HTTPS used for all external calls
- HTTP method validation on all routes
- No eval/exec/spawn usage
- No file system access
- No SQL injection (Supabase query builder used)
- No dangerouslySetInnerHTML

### Immediate Action Plan

1. **Now**: Rotate Anthropic API key, Supabase service_role key, anon key, Vercel OIDC token
2. **Now**: Enable Supabase RLS on `entries` table; add user-scoped policies
3. **48h**: Add ownership verification to delete/update; fix OWNER_ID to use real auth session
4. **48h**: Add request schema validation to `api/anthropic.js`
5. **Sprint**: Rate limiting, CSRF protection, JSON.parse error handling

---
