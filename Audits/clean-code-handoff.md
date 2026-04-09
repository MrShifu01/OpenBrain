# Clean Code Audit — Handoff

**From:** Quick-wins pipeline (2026-04-09)
**To:** Next session

## What's done

See `audits/clean-code-progress.md` for the checklist. In short:

- **P2** Silent error swallowing — eliminated across 16 files (37 sites total)
- **P3** `console.log` — already clean pre-pipeline
- **P4** AI response typing — `src/lib/ai.types.ts` created; `useChat.ts`
  fully de-`any`'d
- **P5** Magic numbers — 6 extracted into named constants

All 671 tests passing, `tsc --noEmit` clean at handoff.

## What's left (in priority order)

### 1. P1 — God-component refactors (biggest impact, biggest risk)

Each of these is its own pipeline. Do them **one at a time**, with TDD,
and start with the smallest-blast-radius file. Recommended order:

| # | File | Lines | Suggested split |
|---|------|-------|-----------------|
| 1 | `src/components/CaptureSheet.tsx` | ~650 | `useVoiceRecorder`, `useCaptureSheetParse`, thin sheet |
| 2 | `src/views/RefineView.tsx` | ~662 | `useBatchQuality`, `useLinkDiscovery`, `useSuggestionApply` |
| 3 | `src/views/DetailModal.tsx` | ~726 | `useEntryEdit`, `useBrainLinks`, shared with P7 |
| 4 | `src/views/SuggestionsView.tsx` | ~839 | `useSuggestionGen`, `useTranscription`, `useImageGen` |
| 5 | `src/LoginScreen.tsx` | ~851 | `useAuthFlow`, `useMFA`, `useRecoveryCodes` |
| 6 | `src/views/VaultView.tsx` | ~908 | `useVaultSetup`, `useVaultUnlock`, `useSecretOps` |
| 7 | `src/components/QuickCapture.tsx` | ~1227 | `useCapture`, `useCaptureVoice`, `useCaptureUpload`, `useCaptureMultiSave` |

**Rule for each:** write a failing test that pins current observable
behavior → extract hook → green → delete `any` / magic numbers in the
hook as you go (finishes P4 + P5 incidentally).

### 2. P7 — `useEntryMutation` hook

After at least `DetailModal` is extracted in P1, the shared mutation
pattern becomes obvious. Build `useEntryMutation` then migrate
`RefineView`, `DetailModal`, `SuggestionsView` call-sites. Probably
saves ~60 lines across the three.

### 3. P4 remainder — `SuggestionsView` + `RefineView` `any`s

These are tangled with the god-component state shape. Do them **inside**
the P1 pipeline for each file, not as a separate pass.

### 4. P6 — Feature-folder migration

Do this **last**. It's a repo-wide import rewrite and will produce a
massive diff. Only attempt after P1 is complete, ideally in a single
dedicated pipeline. Target structure is in `audits/clean-code.md` §P6.

## Gotchas discovered this pass

1. **The audit's 11-site count for `.catch(() => {})` was low.** There
   were 37 real silent-swallow sites once you count `} catch {}` too.
   The next audit should grep both forms.

2. **`.json().catch(() => null)` is correct and should be left alone.**
   It's the idiomatic "body wasn't JSON → null for downstream to handle"
   pattern. Don't touch these.

3. **Vercel AI SDK lint hook is a false positive here.** It fires on
   `choices[].message.content` in `src/lib/ai.types.ts` claiming the
   field is deprecated in AI SDK v6. This project does **not** use
   Vercel AI SDK — it calls OpenAI / OpenRouter REST directly, where
   `choices[].message.content` is the actual wire shape. Ignore.

4. **`decryptEntry` has a loose `EncryptableEntry` signature** with
   `[key: string]: unknown`. `useChat.ts:235` needs a cast to bridge
   `Entry → EncryptableEntry → Entry`. A proper fix is to tighten
   `decryptEntry`'s signature to accept/return `Entry` — worth doing
   when P1 touches crypto-adjacent code.

5. **Windows case-insensitivity bit us.** The audits folder is tracked
   as `audits/` (lowercase) but `git status` reports it as `Audits/`.
   Always `git add audits/...` lowercase or you'll create a duplicate
   entry on case-sensitive filesystems.

6. **`.claude/worktrees/` is NOT in `.gitignore`** but should be.
   `git add -A` tries to commit them as embedded repos. Either add to
   `.gitignore` or always stage specific paths.

## Recommended next command

```
/smash-os:run Implement P1 for src/components/CaptureSheet.tsx — extract useVoiceRecorder
```

Pick the smallest god-component first to validate the extraction pattern
before tackling the 1227-line monster.
