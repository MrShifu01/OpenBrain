# Offline-first audit + remediation

> **Started:** 2026-04-30 19:13 SAST
> **Phase 1 (audit) finished:** 2026-04-30 19:35 SAST
> **Status:** Phase 1 complete · Phase 2 ready to start
> **Goal:** make `Local-first, works offline` (`src/views/Landing.tsx:1370`) actually true across every visible surface, not just the app shell.
> **Why now:** the marketing claim is on the landing page; right now if Supabase or any read-path fetch fails the app feels broken instead of degrading gracefully. The boot watchdog shipped today (commit `539700e`) papers over the worst symptom but doesn't fix the underlying gap.

---

## Phase 1 findings (matrix)

Severity legend: 🔴 broken (user sees blank/error) · 🟡 partial (works but UX is wrong) · 🟢 OK

| # | Surface | Verdict | Evidence | Severity |
|---|---|---|---|---|
| 1 | App shell loads offline | 🟢 OK | `vite-plugin-pwa` precaches the bundle (`dist/sw.js`, 90 entries / 2141 KB). Boot shell + JS bundle hit cache. | — |
| 2 | Initial-load entry list (warm cache) | 🟢 OK | `useDataLayer` mount reads `entriesCache` (`src/hooks/useDataLayer.ts:50`). When `entryRepo.list` returns `[]` due to offline, it doesn't overwrite the cache (`useDataLayer.ts:113,123` guard `length > 0`). | — |
| 3 | Brain-switch entry list offline | 🔴 broken | `useDataLayer.ts:139` calls `setEntries([])` on brain change, then `entryRepo.list` returns `[]` offline → list stays blank until reconnect. | High |
| 4 | `entryRepo.list` offline error signal | 🟡 partial | `entryRepo.ts:87-89` swallows the throw and returns `[]` with no offline indicator — caller can't tell "no entries" from "offline failure". | Medium |
| 5 | Capture (offline create) | 🟢 OK | `useCaptureSheetParse.ts:250-268` branches to local NLP parsing, calls `doSave` which writes to `offlineQueue`. | — |
| 6 | Capture-queue UX | 🟡 partial | `useOfflineSync` exposes `pendingCount` but it's not surfaced anywhere visible (no header chip, no banner). User can't see queue state. | Medium |
| 7 | Capture-queue drain on reconnect | 🟢 OK | `useOfflineSync.drain` runs on `online` event + replays each op; max-retry → failed-store. Tests cover. | — |
| 8 | Entry edit (`handleUpdate`) offline | 🟡 partial | `useEntryActions.ts:104` hard-blocks with toast "You can't save while offline." No queue. Read-only experience until back online. | Medium |
| 9 | Entry delete offline | 🟡 partial | Optimistic update + cache write (`useEntryActions.ts:144`) but no queue — change vanishes on reconnect because the server never sees it. | High |
| 10 | Search (`OmniSearch`) offline | 🔴 broken | No `isOnline` check. Hits `/api/search` blindly → throws / shows nothing → user thinks search is broken. | High |
| 11 | Chat (`ChatView`) offline | 🔴 broken | No `isOnline` check, no offline copy. Submits prompt → `/api/llm` fails → generic error. Typed prompt may be lost. | High |
| 12 | Vault unlock offline | 🟡 partial | `/api/vault` existence check + `/api/vault-entries` fetch both fail offline (`useDataLayer.ts:59,70`). Vault key derivation is local but the encrypted blob isn't cached, so unlock has nothing to decrypt. | High |
| 13 | Calendar / Schedule offline | 🟢 OK | Reads from same `entries` array as Memory — inherits cache fallback. | — |
| 14 | Settings tabs (read-only) offline | 🟡 partial | Each tab fetches its own data on mount with no `isOnline` guard. Display stays empty without explanation. | Low |
| 15 | Settings mutations offline | 🔴 broken | Profile/AI/etc PATCH/POST throw on submit, generic error toasts. No "this needs internet" copy. | Medium |
| 16 | Auth refresh offline | 🟡 partial | Supabase token-refresh call hits `/auth/v1/token`. When offline a refresh attempt 5xxs; haven't reproduced a forced sign-out, but it's plausible if a user idles past TTL while offline. | Medium |
| 17 | Boot watchdog (12s) — offline gate | 🔴 broken | `index.html:298` watchdog fires regardless of `navigator.onLine` — an offline user gets reload-looped: every 12s tries reload, hits cache, fails to mount, repeat. (Mitigated by the once-per-session sessionStorage flag, but only after the first reload.) | High |
| 18 | `pageshow.persisted` reload (10s threshold) | 🟢 OK | Only triggers on resume, not initial offline load. | — |
| 19 | `NativeOfflineScreen` parity for web standalone PWA | 🟡 partial | Native-only. Web standalone PWA boot with no session + no network shows boot shell → blank app. | Medium |
| 20 | Persistent offline banner | 🔴 broken | `isOnline` is plumbed through `DesktopSidebar` + `MobileHeader` props (`isOnline: _isOnline,` — destructured-and-ignored). No `OfflineBanner` component exists. | Medium |

**Counts:** 6 🔴 broken · 9 🟡 partial · 5 🟢 OK / no-op

---

## Phase 2 priority order (driven by Phase 1)

Rebuilt from the findings. P0 ships before launch, P1 before native, P2 after.

**P0 — broken surfaces that contradict the landing-page claim:**
1. Watchdog `navigator.onLine` gate — finding #17 — 5 min fix.
2. `entryRepo.list` cache-fallback when fetch fails — fixes #3 and stops the brain-switch blank-list.
3. `OfflineBanner` driven by `useOfflineSync.isOnline` + a `pendingCount` chip — fixes #6, #20 in one component.
4. Network-aware error UX in chat (#11) and search (#10) — calm copy + preserve typed prompt.

**P1 — partials worth tightening:**
5. Entry edit + delete offline-queue (#8, #9) — promote them through the same `offlineQueue` machinery as create.
6. Vault encrypted-blob cache (#12) — store the last `/api/vault-entries` result in IDB so unlock works offline.
7. Auth refresh offline (#16) — add a "deferred refresh" mode in `authFetch` that holds on `!navigator.onLine` and resumes on `online` event.
8. Web `OfflineScreen` parity (#19) — extract `NativeOfflineScreen` copy into a shared component, mount on web when `!isOnline && !cachedSession`.
9. Settings mutations offline UX (#15) — disable submit + show "needs internet" inline copy.

**P2 — polish:**
10. Settings tabs read-only offline copy (#14).
11. Playwright `e2e/specs/offline.spec.ts` covering the matrix.

---

## Live log

Each working session appends a one-line entry below — most recent at top.

- 2026-04-30 19:35 — Phase 1 audit complete. 6 broken / 9 partial / 5 OK across 20 surfaces. Top fixes: watchdog network gate, entryRepo cache-fallback, OfflineBanner, chat/search offline UX.
- 2026-04-30 19:13 — Document opened. Pre-flight survey shows `entriesCache.ts` exists (good), `offlineQueue.ts` exists (good), `OfflineBanner` does NOT exist, `entryRepo` cache fallback unverified, watchdog ungated for offline. Phase 1 matrix queued.

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

## Phase 1 — Audit matrix (DONE 2026-04-30)

- [x] **Trace entry read path** — `entryRepo.list` returns `[]` on fetch failure; `useDataLayer` mount reads `entriesCache` and refresh guards on `length > 0` so cache survives offline (initial load). Brain switch is the regression.
- [x] **Trace capture / queue path** — `useCaptureSheetParse:250-268` branches to local NLP + `offlineQueue`. `useOfflineSync.drain` handles reconnect.
- [x] **Trace chat / search / LLM** — neither `ChatView` nor `OmniSearch` checks `isOnline`. Both will throw generic errors.
- [x] **Trace vault / settings / calendar** — vault read-path uncached. Settings tabs each fire fetches without offline guards. Calendar reuses `entries` so it's OK.
- [x] **Auth refresh + watchdog + indicators** — watchdog isn't gated on `navigator.onLine` (will reload-loop offline). `OfflineBanner` doesn't exist; `isOnline` is destructured-and-ignored in headers/sidebar.
- [x] **Findings written above** — 20-row matrix, severity-tagged, P0/P1/P2 ordered.

---

## Phase 2 — Remediation (driven by Phase 1)

Order = priority above. Each item links to its finding number for traceability.

**P0 — broken (4 items, ≤ half-day):**
- [ ] **#17 — watchdog network gate** — `index.html` skips reload if `!navigator.onLine`.
- [ ] **#3, #4 — `entryRepo` cache fallback** — on fetch failure, read `entriesCache` and surface as the result. Caller-visible `offline: true` flag so views can render an "offline — showing cached" hint.
- [ ] **#6, #20 — `OfflineBanner.tsx`** — top-of-app chip driven by `useOfflineSync.isOnline + pendingCount`. Wires `_isOnline` props that are currently destructured-ignored.
- [ ] **#10, #11 — chat + search offline UX** — `isOnline` check before fire; calm "needs internet" inline message; preserve typed prompt across reconnect.

**P1 — partials (5 items, ~1 day):**
- [ ] **#8, #9 — entry edit + delete offline queue** — promote through same `offlineQueue` mechanism as create.
- [ ] **#12 — vault blob cache** — IDB cache for `/api/vault-entries` last response so unlock decrypts offline.
- [ ] **#16 — auth refresh deferred-while-offline** — short-circuit refresh in `authFetch` if `!navigator.onLine`.
- [ ] **#19 — web `OfflineScreen` parity** — extract `NativeOfflineScreen` into a shared component, mount on web standalone PWA when `!cachedSession && !navigator.onLine`.
- [ ] **#15 — settings mutation offline UX** — disable submit + inline "needs internet" copy.

**P2 — polish:**
- [ ] **#14 — settings read-only offline copy** — small banner per tab when current data is from cache.

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
