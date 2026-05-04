# Android QA matrix — week 3 device + flow coverage

**Goal:** every flow that ships to a closed-beta user works on every device tier the beta cohort plausibly owns. No P0 surprises after upload.

Day 15-16 (Fri-Sat of week 3). Two-day QA window with a hard cutoff Sat 18:00 — if more than 3 P0s remain by then, switch to PWA-only contingency.

---

## Device matrix

Three tiers cover ~95% of Android beta-user reality. If you only have access to two, tier 1 + tier 3 is the priority pair (Pixel exposes Google's reference behavior; budget exposes performance-floor behavior).

| Tier | Device | Android version | RAM | Coverage rationale |
| ---- | ------ | --------------- | --- | ------------------ |
| 1 — Reference | Pixel 8 (or Pixel 7) | Android 15 | 8 GB | Google's reference platform; if it breaks here, it breaks everywhere |
| 2 — Mainstream OEM | Samsung Galaxy A-series mid (A54 or similar) | Android 14 | 4-6 GB | Most-common beta-user device class. Samsung's WebView occasionally diverges from Pixel's |
| 3 — Performance floor | Any 2-3-year-old budget Android (< 4 GB RAM, Android 12-13) | Android 12-13 | 3 GB | Where service-worker bugs, IDB-quota bugs, and offline-cache bugs surface |

If you only have a Pixel: borrow a Samsung from someone for half a day. Tier 2 misses are the most common "shipped on day 30, broken in production" pattern.

---

## Test flows (run on every tier device)

Each flow has: **steps**, **expected**, **what to log if it fails**.

### Flow 1 — Cold install + magic-link auth

1. Uninstall any existing dev/staging build.
2. Install via internal testing link.
3. Open the app fresh.
4. Tap "Sign in".
5. Enter a real email address.
6. Receive magic-link email (check spam).
7. Tap the link in the email.
8. Confirm app re-opens to the signed-in shell.

**Expected:** signed-in shell with empty memory grid, OnboardingModal showing.

**Failure log:** which step failed, screenshot, Sentry trace ID if visible. P0.

### Flow 2 — Onboarding aha-in-60s

1. Tap an example chip in OnboardingModal step 1.
2. Tap "save & continue".
3. Wait for processing → ask step.
4. Tap "ask".
5. Wait for answer.
6. See cited entry chip.

**Expected:** all 3 steps land in < 90s end-to-end. Citation chip references the saved entry's title.

**Failure log:** total time, step that took longest, any errors. P0 if > 180s, P1 if > 90s.

### Flow 3 — Capture (text, voice, file)

1. Open CaptureSheet (FAB or Cmd+K-equivalent).
2. Type "test capture A". Save. Verify in entry grid.
3. Tap mic icon. Speak "test capture B". Stop. Verify text appears. Save. Verify in grid.
4. Tap upload. Pick a small PDF (< 1 MB). Save. Verify entry created.

**Expected:** all three save without error. Entry grid shows them within 2s of save.

**Failure log:** which type failed, file size if applicable, network state. P0 for text + voice; P1 for file (file uploads can be deferred-fix).

### Flow 4 — Chat with citation

1. Navigate to chat (or trigger first chat from onboarding step 3).
2. Type "what did I save about test capture A?".
3. Send.
4. Wait for streamed response.

**Expected:** answer references "test capture A" entry by title or content. Citation chip is tappable. Tapping opens DetailModal for that entry.

**Failure log:** answer text, whether citation was present, whether tap worked. P0.

### Flow 5 — Vault unlock + add secret

1. Settings → Security → Set up vault.
2. Enter passphrase + confirm.
3. Vault unlocked state shown.
4. Add an entry of type "secret" with title "test gate code" + content "1234".
5. Lock vault (manually or by closing app).
6. Re-open app.
7. Vault locked.
8. Unlock with passphrase.
9. Verify entry decrypts and renders correctly.

**Expected:** content "1234" appears after unlock, NOT before.

**Failure log:** which step failed; if content shows pre-unlock, this is a critical privacy bug. P0.

### Flow 6 — Offline capture + sync

1. Enable airplane mode.
2. Capture an entry "test offline 1".
3. Verify offline-pending indicator on the entry.
4. Disable airplane mode.
5. Wait up to 30s for sync.
6. Verify the offline indicator disappears and entry has a real ID.

**Expected:** entry survives the offline → online round-trip. No duplicates.

**Failure log:** whether entry was lost, whether duplicates were created, sync time. P0.

### Flow 7 — Streak chip (Wed onward)

Only run this once streak counter is shipped (post-week-2). If not yet shipped at QA time, skip.

1. Capture an entry today.
2. Confirm chip shows "🔥 1 day".
3. Manually set device clock forward 1 day.
4. Capture another entry.
5. Confirm chip shows "🔥 2 days".

**Expected:** counter increments correctly across the simulated day boundary.

**Failure log:** chip not appearing, wrong number, off-by-one. P1.

### Flow 8 — Brain Feed v0 surfaces (Wed onward)

Only run this once Brain Feed v0 is shipped. Skip if not yet.

1. Sign in to a test account with 5+ entries (use the `play-tester@` account).
2. Open home view (Memory).
3. Confirm capture bar at top.
4. Confirm resurface card visible (one entry from the test set).
5. Confirm gap row visible (or "your brain is fresh, keep capturing" empty state).
6. Tap each surface and verify the action.

**Expected:** all 3 surfaces render without layout breakage. Tap actions work.

**Failure log:** missing surface, layout broken, tap dead. P1.

### Flow 9 — Settings + sign-out

1. Settings → Account.
2. Verify tier shows correctly (Hobby for free, etc.).
3. Settings → Data → Export.
4. Verify export downloads a `.json` or similar.
5. Settings → Sign out.
6. Verify return to landing/login screen.

**Expected:** clean sign-out, no orphaned auth state, re-sign-in works.

**Failure log:** export failed, sign-out left stale state. P1.

### Flow 10 — Network failure paths

1. Sign in normally.
2. Enable airplane mode.
3. Try to chat → expect graceful "you're offline" message.
4. Try to capture → expect optimistic save with offline indicator.
5. Try to view a previously-loaded entry → expect cache hit, content visible.
6. Try to navigate to a not-yet-loaded view (e.g., Settings if you came from Memory) → expect graceful empty state, not crash.

**Expected:** no white-screen crashes. Messaging clear.

**Failure log:** crash, blank screen, confusing copy. P0 for crash, P1 for confusing copy.

---

## P0 / P1 / P2 definitions

| Tier | Definition | When to fix |
| ---- | ---------- | ----------- |
| **P0** | Data loss, security failure, app crash on common path, auth break | Same day. If > 3 outstanding by Sat 18:00, ship PWA-only |
| **P1** | Visual broken, perf > 3s perceived latency, important flow degraded but recoverable | Within week 3. Don't submit AAB if any P1 untriaged |
| **P2** | Cosmetic, non-blocking, low-frequency | After launch. Goes to `Audits/post-launch-followups.md` |

---

## Sign-off format

For each device, write a short audit doc:

```md
# Android QA — Tier {1|2|3} — {device name + Android version}

**Tester:** Christian
**Date:** YYYY-MM-DD
**Build:** AAB version {version code}

## Flow results

| Flow | Pass/Fail | Severity if fail | Notes |
| ---- | --------- | ---------------- | ----- |
| 1 — Cold install + magic-link | ✅ | — | — |
| 2 — Onboarding aha-in-60s | ❌ | P1 | Took 130s — Gemini round-trip slow on first call |
| 3 — Capture (text/voice/file) | ⚠️ | P1 | File upload >5MB times out |
| ... | ... | ... | ... |

## Performance notes

- Cold start: 1.4s
- First capture latency: 800ms
- Chat round-trip: 3.2s

## Sign-off

- [ ] All P0 fixed
- [ ] All P1 triaged
- [ ] Cleared for next QA tier OR cleared for AAB upload

— Christian, {date} {time}
```

Save as `Audits/{date}-android-qa-tier-{N}-{device}.md`. Auto-discovered by EML dashboard, drops into "Audits" group.

---

## Post-QA decision matrix

```
End of Sat 2026-05-16 (18:00):
│
├─ All flows green on all tiers (or only P2s outstanding)?
│       → Tue: sign + upload AAB. Stay on schedule.
│
├─ 1-2 P0s outstanding, fixable Sun?
│       → Sun morning: fix. Sun afternoon: re-run failed flows on the affected tier.
│       → Mon: continue with listing copy work in parallel.
│       → Tue: sign + upload AAB if P0s closed.
│
├─ 3+ P0s OR P0 in vault/auth path?
│       → Activate PWA-only contingency
│       → Day 30: closed beta = PWA only, with "Android coming soon" banner
│       → Android slips to whichever week the P0s clear (likely week 5-6)
│
└─ App crashes within 30s of cold start on Tier 3?
        → Memory issue. Profile with Android Studio Memory Profiler.
        → If unfixable in 1 day: drop Tier 3 support from MVP, document
          "Android 13+, 4GB+ RAM" in the listing requirements.
```

---

## What NOT to test (out of scope this week)

- iOS-specific paths (week 5-6)
- Web PWA paths (already manually tested daily)
- Email-forwarding capture (not yet shipped)
- Multi-brain switching (flag-gated off)
- Tier upgrade/downgrade in-app (web-only billing flow per Play Console contingency)
- Push notifications (post-launch feature)
- Integration with Gmail/Calendar (already covered in dev-time tests; no Android-specific surface)

If something is on this list and it's broken on Android, log it in `Audits/post-launch-followups.md` — don't let it block the AAB upload.
