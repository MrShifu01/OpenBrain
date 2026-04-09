# Clean Code Audit — Progress Tracker

Pipeline: SmashOS quick-wins (P3 + P2 + P5 + P4)
Started: 2026-04-09
Completed: 2026-04-09

## P3 — Delete console.log in production
- [x] **Already clean** — zero `console.log` calls remain. Only legitimate
      `console.error`/`console.warn` for error paths survive.

## P2 — Fix silent error swallowing
Expanded scope: audit listed 11 `.catch(() => {})` sites; we also swept
26 `} catch {}` siblings (same principle).

- [x] App.tsx — 3 signOut / loadSettings catches now log
- [x] OpenBrain.tsx — 3 `.catch(() => {})` + 4 `} catch {}` now log
- [x] BulkUploadModal.tsx — embed enqueue logs failure
- [x] lib/ai.ts — recordUsage (llm + embedding) log failure
- [x] CreateBrainModal.tsx — pending invite failures log
- [x] CaptureSheet.tsx — transcription usage + 2 try/catch log failure
- [x] lib/authFetch.ts — background refresh + try/catch log
- [x] DetailModal.tsx — 2 entry-brains add/remove + 1 try/catch log
- [x] QuickCapture.tsx — 2 transcription/embed + 1 try/catch log
- [x] SuggestionsView.tsx — transcription + 4 try/catch log
- [x] BrainTab.tsx — pending invites + clipboard log
- [x] lib/pin.tsx — server pin delete logs
- [x] RefineView.tsx — 8 try/catch log
- [x] OnboardingChecklist.tsx — 2 try/catch log
- [x] OnboardingModal.tsx — 1 try/catch log
- [x] StorageTab.tsx — 1 try/catch log

Parse-fallback pattern `.json().catch(() => null)` preserved — correct idiom.

## P5 — Magic numbers → named constants
- [x] UndoToast.tsx — `UNDO_TOAST_CREATE_MS`, `UNDO_TOAST_MUTATE_MS`
- [x] CaptureSheet.tsx — `MIN_VOICE_BLOB_BYTES`, `VOICE_RECORDER_CHUNK_MS`
- [x] NotificationSettings.tsx — `STATUS_FLASH_MS`, `ERROR_FLASH_MS`
- [x] DangerTab.tsx — `DELETE_BRAIN_CONFIRM_WINDOW_MS`

## P4 — Type AI response boundary
- [x] Created `src/lib/ai.types.ts` with `AIResponseBody`, `AIContentBlock`,
      `AIUsageBlock`, `VaultData`, `DecryptedSecret`
- [x] useChat.ts — eliminated all 11 semantic `any` uses (1 narrow
      `[key: string]: unknown` cast remains at the crypto boundary)
- [ ] SuggestionsView.tsx — deferred to P1 god-component refactor (`any`
      usage is tangled with internal state shape)
- [ ] RefineView.tsx — deferred to P1 god-component refactor
- [ ] feedbackLearning.ts — deferred

## Verification
- [x] `tsc --noEmit` — clean
- [x] `vitest run` — 106 files, 671 tests, all passing

## Not in this pipeline (need scoping)
- **P1** God-component refactors (QuickCapture, VaultView, LoginScreen,
      SuggestionsView, DetailModal, RefineView, CaptureSheet) — each is its
      own PR with hooks extraction + tests
- **P6** Feature-folder migration — repo-wide import rewrite
- **P7** `useEntryMutation` hook extraction — depends on P1 shape
