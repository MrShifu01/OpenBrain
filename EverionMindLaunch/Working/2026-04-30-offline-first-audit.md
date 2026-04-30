# Offline-first audit + remediation

> **Started:** 2026-04-30 19:13 SAST
> **Status:** in progress
> **Goal:** make `Local-first, works offline` (`src/views/Landing.tsx:1370`) actually true across every visible surface, not just the app shell.
> **Why now:** the marketing claim is on the landing page; right now if Supabase or any read-path fetch fails the app feels broken instead of degrading gracefully. The boot watchdog shipped today (commit `539700e`) papers over the worst symptom but doesn't fix the underlying gap.

This doc lives at `EML/Working/` and refreshes in the dashboard every 2.5s. Tick boxes here as the sprint progresses; entries fed back into `LAUNCH_CHECKLIST.md` once the matrix turns green.

---

## Cross-refs to LAUNCH_CHECKLIST.md

- `:231` — _"Offline mode tested 🟡"_ — currently aspirational ("at least the app shell should load offline"). This sprint promotes it to a tested baseline.
- `:566` — _"Add offline / no-connection state ✅"_ — `NativeOfflineScreen` only covers the cold-start path. Web standalone PWA + warm-resume offline paths aren't covered.
- `:581` — _"Offline / no-internet screen — calm copy, no infinite spinner"_ — feeds the `OfflineBanner` work in Phase 2.
- `:633` — _"Show calm offline UI"_ — shared with the native shell; web should use the same pattern.
- `:635` — _"Preserve unsaved capture text if connection drops mid-write"_ — already covered by `useOfflineSync` + `offlineQueue`; verify in the matrix.
- `:680` — _"App has an offline / no-connection state"_ — Apple/Play store listing requirement.
- `:931` — _"Vault export — offline decryption tool"_ — out of scope for this sprint; tracked separately.

---

## Phase 1 — Audit matrix (today)

Walk every surface in DevTools-Offline mode + a real iOS PWA in airplane mode. Each row gets PASS / FAIL / N/A + the failing fetch path if any.

- [ ] **Setup** — bring up local prod build (`npm run build && npx vite preview --port 5174`), seed an account with ≥10 entries, ≥1 vault row, ≥1 important memory.
- [ ] **App shell loads offline** — kill network, hard reload. Boot shell → React mount → no white screen.
- [ ] **Existing entries readable offline** — open Memory, scroll list, open detail view. Should serve from `entriesCache` when Supabase fetch fails.
- [ ] **New capture queues offline** — type → save. Should land in `offlineQueue` with a "queued · will sync" UX, not throw.
- [ ] **Capture queue drains on reconnect** — flip network back on, watch queue → 0 + entry appears in list.
- [ ] **Search behaviour offline** — type query. Server-side embedding search will fail; UI must show a calm "Search needs internet" message, not a stack trace.
- [ ] **Chat behaviour offline** — submit prompt. LLM proxy will fail; UI must surface "Chat needs internet" + persist the typed prompt.
- [ ] **Vault unlock offline** — derive key, decrypt rows. If encrypted blobs are cached locally this works; if they're fetched live it won't.
- [ ] **Calendar / Schedule views offline** — currently read entries via `useEntries`; should reuse the same cache fallback as Memory.
- [ ] **Settings panels offline** — Profile/Account/Brain/etc. Read-only from cache OK, mutation surfaces should disable + explain.
- [ ] **Auth refresh offline** — token expires while offline → app must NOT bounce to login. Reconnect must transparently refresh.
- [ ] **Boot watchdog gate on `navigator.onLine`** — the 12s watchdog in `index.html` shouldn't reload-loop a user who's just offline. Verify + gate if needed.
- [ ] **`NativeOfflineScreen` parity for web standalone** — same calm screen if web PWA boots with no session + no network.
- [ ] **Persistent offline banner** — wire `useOfflineSync.isOnline` into a top-of-app `OfflineBanner` component so the user always knows the state.
- [ ] **Capture queue badge** — show `pendingCount` somewhere visible (header chip or capture sheet).

Output of Phase 1: `EML/Audits/2026-04-30-offline-first-audit.md` with the matrix + findings, sorted by severity.

---

## Phase 2 — Remediation (next 1–2 days, gated on Phase 1 findings)

Tentative — concrete shape decided by what Phase 1 finds.

- [ ] **Read-path cache fallback** — wrap `entryRepo.list` (and any other GET path the views depend on) so a fetch failure transparently serves from `entriesCache`. Cache-first when offline, network-then-cache when online.
- [ ] **`OfflineBanner.tsx`** — slim chip at the top of the app driven by `useOfflineSync.isOnline`. Auto-dismiss on reconnect. Honour design tokens.
- [ ] **Network-aware error UX** — chat / search / LLM / capture-AI surfaces detect offline and show consistent calm copy instead of generic error toasts.
- [ ] **Watchdog network-gate** — in `index.html`, skip the 12s reload watchdog if `!navigator.onLine` (a user who's offline shouldn't be reload-looped).
- [ ] **Web `OfflineScreen`** — when the app boots with no session + no network, mirror `NativeOfflineScreen` with the same copy + retry button.
- [ ] **Auth refresh offline-tolerant** — Supabase token refresh on a known offline state should defer instead of throwing 5xx → fix in the auth layer.
- [ ] **Vault offline path** — confirm the encrypted blob is included in the read-path cache; if not, add it.

---

## Phase 3 — Tests + audit close-out

- [ ] **Playwright e2e — offline matrix** — new `e2e/specs/offline.spec.ts` that flips `context.setOffline(true)` and asserts each surface (entries / capture / search / chat / vault) renders the right state.
- [ ] **Manual real-device pass** — iOS PWA in airplane mode, Android Chrome standalone in airplane mode. Cold start + warm resume.
- [ ] **EML reconciliation** — flip the relevant `LAUNCH_CHECKLIST.md` rows green with traceability (`from EML/Working/2026-04-30-offline-first-audit.md`).
- [ ] **Archive** — `git mv EML/Working/2026-04-30-offline-first-audit.md EML/Working/archive/`. Dashboard demotes it to "Working Archive".

---

## Live log

Each working session appends a one-line entry below — most recent at top.

- 2026-04-30 19:13 — Document opened. Pre-flight survey shows `entriesCache.ts` exists (good), `offlineQueue.ts` exists (good), `OfflineBanner` does NOT exist, `entryRepo` cache fallback unverified, watchdog ungated for offline. Phase 1 matrix queued.
