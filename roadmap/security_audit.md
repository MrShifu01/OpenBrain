---
name: Security Audit 2026-04-07
description: Full security audit covering secrets, input validation, dependencies, and data exposure
type: project
---

## Security Audit Report — OpenBrain (2026-04-07)

### Summary
**VERDICT: FAIL — CRITICAL issues require immediate remediation**

```
▸ SMASH OS  ·  security audit  [local]
─────────────────────────────────────
  CRITICAL  3
  HIGH      2
  MEDIUM    3
  LOW       1

  FINDINGS
    [CRITICAL] Vercel OIDC token exposed in committed .env.local — .env.local:1-2
    [CRITICAL] User API keys stored in unencrypted localStorage — src/lib/aiFetch.ts:46-97
    [CRITICAL] Secrets in localStorage accessible via DevTools — multiple locations
    [HIGH]     .env.local not properly gitignored despite being sensitive — .gitignore:25,29
    [HIGH]     API key headers passed without validation to user endpoints — src/lib/aiFetch.ts:188
    [MEDIUM]   CSV parser accepts user input with minimal validation — src/lib/fileParser.ts:62-155
    [MEDIUM]   IndexedDB quota exceeded falls back to unencrypted localStorage — src/lib/offlineQueue.ts:37-47
    [MEDIUM]   User learnings stored in localStorage without access control — src/lib/learningEngine.ts:46-81
    [LOW]      JSON.parse() error handling swallows exceptions — src/lib/aiFetch.ts:11, src/lib/offlineQueue.ts:81

  VERDICT
    FAIL — CRITICAL ISSUES PRESENT
─────────────────────────────────────
```

---

## Detailed Findings

### 1. SECRETS & HARDCODED CREDENTIALS

#### [CRITICAL] Vercel OIDC Token in .env.local
- **File**: `.env.local:1`
- **Issue**: Vercel OIDC token exposed (valid JWT with team_id, project_id, environment claims)
- **Impact**: Can be used to interact with Vercel API on behalf of the project
- **Status**: COMMITTED to git (visible in git status)
- **Action Required**: 
  - Immediately rotate the token via Vercel dashboard
  - Remove .env.local from git history (git filter-branch or BFG)
  - Ensure .env.local is in .gitignore BEFORE any new commits

#### [CRITICAL] User API Keys in Unencrypted localStorage
- **File**: `src/lib/aiFetch.ts:46-97`
- **Issue**: The following secrets stored as plaintext in localStorage:
  - `openbrain_api_key` (user's AI provider key)
  - `openbrain_gemini_key` (Google Gemini key)
  - `openbrain_embed_openai_key` (OpenAI embedding key)
  - `openbrain_openrouter_key` (OpenRouter key)
  - `openbrain_groq_key` (Groq key)
- **Impact**: Any malicious script or XSS can read these keys; user devices are at risk
- **Recommendation**: 
  - Store keys server-side only, never in browser storage
  - Pass credentials via secure HTTP-only cookies if needed
  - If browser-side storage unavoidable, encrypt with user's password
- **Current Risk**: HIGH — keys are transmitted in headers (src/lib/aiFetch.ts:188)

#### [CRITICAL] Secrets Accessible Via DevTools
- **File**: Multiple (localStorage keys across application)
- **Issue**: Any user can open DevTools → Application → Local Storage and view all API keys
- **Impact**: Keys exposed to the user themselves AND any script running in the page
- **Risk**: XSS vulnerability anywhere in the app exposes all user keys

### 2. INPUT VALIDATION & INJECTION

#### [HIGH] API Key Headers Passed Without Validation
- **File**: `src/lib/aiFetch.ts:188`
- **Code**: `"X-User-Api-Key": userKey` passed directly from localStorage
- **Issue**: No validation that userKey is a valid API key format before transmission
- **Risk**: Malformed keys could cause API errors; keys not sanitized
- **Fix**: Validate key format before adding to headers

#### [MEDIUM] CSV Parser Minimal Validation
- **File**: `src/lib/fileParser.ts:62-155`
- **Issue**: CSV parsing uses regex heuristics without strict format validation:
  - Accepts any file as long as it looks roughly like dates/amounts
  - No validation that parsed data matches expected types
  - `amount.replace(/[^\d.,-]/g, "")` strips non-numeric chars but doesn't validate
- **Risk**: Malformed CSV could generate invalid transaction data
- **Recommendation**: Add strict schema validation for parsed transactions

#### [MEDIUM] File Extension Validation Only
- **File**: `src/lib/fileParser.ts:6-22`
- **Issue**: Only checks file extension, not actual file type
- **Risk**: User could upload .txt file claiming to be .pdf
- **Fix**: Add MIME type validation or file signature checking

### 3. DEPENDENCY SECURITY

#### No known critical vulnerabilities in package.json
- `@supabase/supabase-js` ^2.101.1 — stable, no known issues
- `web-push` ^3.6.7 — check for updates
- All dev dependencies are current as of February 2025
- **Recommendation**: Run `npm audit` regularly

### 4. CLI SECURITY (N/A)
This is a React frontend application with no CLI components.

### 5. DATA EXPOSURE

#### [MEDIUM] IndexedDB Quota Fallback to localStorage
- **File**: `src/lib/offlineQueue.ts:37-47`
- **Issue**: When IndexedDB quota exceeded, falls back to unencrypted localStorage:
  ```ts
  localStorage.setItem("openbrain_queue", JSON.stringify(existing));
  ```
- **Risk**: Failed operations (containing entry data) stored in plaintext
- **Impact**: Users' data visible in DevTools if storage fails
- **Recommendation**: 
  - Don't fall back to localStorage; show user error instead
  - Or implement encryption layer for fallback storage

#### [MEDIUM] User Learnings Stored Unencrypted
- **File**: `src/lib/learningEngine.ts:46-81`
- **Issue**: Learning decisions stored in localStorage with keys like `openbrain_learning_decisions:brainId`
- **Risk**: User behavior patterns visible to any script
- **Data**: Contains decision metadata, original values, user edits — reveals user preferences
- **Recommendation**: Use encrypted storage or server-side persistence

#### [LOW] JSON.parse() Exception Swallowing
- **File**: `src/lib/aiFetch.ts:11` (getUserId), `src/lib/offlineQueue.ts:81`, multiple locations
- **Code**: `catch { /* ignore */ }`
- **Issue**: Errors silently ignored; could mask data corruption or tampering
- **Risk**: If localStorage is modified by malicious script, corruption goes undetected
- **Recommendation**: Log errors for debugging, don't silently ignore all exceptions

---

## Action Items (Priority Order)

### Immediate (Today)
1. **Rotate Vercel OIDC token** — go to Vercel dashboard, rotate token
2. **Remove .env.local from git history** — use `git filter-branch` or `git-filter-repo`
3. **Verify .env.local is in .gitignore** — add pattern if missing
4. **Notify users** — if deployed, users' stored API keys may be exposed

### High Priority (This Sprint)
1. Migrate API keys from browser storage to server-side:
   - Store keys in secure backend database (encrypted at rest)
   - Browser sends user ID + gets temporary auth token
   - Backend forwards AI requests on behalf of user
2. Add input validation to CSV parser
3. Remove localStorage fallback in IndexedDB quota handling

### Medium Priority (Next Sprint)
1. Encrypt sensitive data in localStorage (keys, learnings) if client-side storage required
2. Add MIME type validation to file uploads
3. Add error logging instead of silent catch blocks
4. Implement Content Security Policy (CSP) to reduce XSS impact

---

## Notes for Future Audits

- **Browser Storage Risk**: localStorage is fundamentally insecure; treat all data there as exposed
- **Next Audit Focus**: Check for XSS vulnerabilities (DOMPurify usage in chat/rendering)
- **Dependency Updates**: Run `npm audit` before each release
