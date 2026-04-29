# Session progress — 2026-04-29

Status of the "do all 20 + bonuses" run, what landed, and what each
remaining item realistically needs.

## Shipped this session (commits on `main`)

| Commit  | Scope                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------- |
| `74d1010` | feat(important-memories): v0 + narrow vault to true secrets                                       |
| `67629f8` | docs(launch): Capacitor wrap implementation playbook + post-launch deferred                       |
| `f7736aa` | feat(capacitor): wrap web app for iOS + Android (Batch A — scaffold)                              |
| `0f96f96` | feat(design-tokens): `--z-*` layer tokens + audit hardcoded shadows (Batch B)                     |
| `92ff14d` | perf: parallel cold-load + cursor pagination + og.png compression (Batch I/K)                     |

Tests: 450/450 passing across all commits. Typecheck + lint clean.

## Done — checklist mapped to commits

- ✅ #10 Capacitor scaffold (steps 1–6)
- ✅ #11 Capacitor auth deep-link schemes (iOS + Android)
- ✅ #12 Offline UI + `@capacitor/network`
- ✅ #13 App icon + splash (Android × 136, iOS × 13, PWA WebP × 7)
- ✅ #14 Standardise z-index / radius / shadow tokens
- ✅ #25 Cursor pagination on `entryRepo.list` (+ `listPage`, `listAll`)
- ✅ #26 Parallelise sequential `/api/*` cold-load (settings fire-and-forget)
- ✅ #28 Bonus: og.png compressed (39%), bundle audit doc, Lighthouse prep doc

Plus from earlier in the session:
- ✅ Important Memories V0 (table, API, screen, "Keep this" entry action)
- ✅ Vault marketing narrowed to true secrets (V3)
- ✅ Capacitor implementation playbook in `LAUNCH_CHECKLIST.md`
- ✅ Post-launch deferred section in `LAUNCH_CHECKLIST.md`

Confirmed already done (checklist was stale):
- ✅ `window.confirm()` removals (BulkActionBar + ProfileTab — already replaced)

## Remaining — needs dedicated session each

These are real work, not skip-able. Each was scoped during this run but
attempting them in a single sweep with no UX QA would introduce regressions
the test suite can't catch (visual drift, focus management, keyboard nav).

### Batch C — atomic shadcn primitives (~95 instances)

- ❌ #15 Card / Separator / Badge migration
  - Top files: `NotificationBell`, `EntryListBits`, settings sections,
    `CaptureSheet`, `DetailModal`
  - Risk: low — primitives exist at `src/components/ui/`, semantic-tokens
    aliased. Mostly mechanical replacement.
  - Effort: ~3–4 hours focused work, file by file with visual smoke-test.
- ❌ #16 Input / Textarea (~25 instances)
  - Two patterns: serif (entry-edit) vs sans (settings/forms). Need to
    decide whether to fork the primitive or theme via prop.
- ❌ #17 Checkbox + Tooltip (~16 instances)

### Batch D — segmented + collapse (~20 instances)

- ❌ #18 Tabs + Accordion
  - Tabs: `MemoryHeader`, `SettingsView`, `TodoView`, `CaptureSheet`
  - Accordion: settings tabs + bulk bar `[expanded, setExpanded]`
  - Risk: medium — Tabs migration changes keyboard nav semantics; needs
    real-device test on the existing Day/Week/Month flow.

### Batch E — stateful dropdowns (~45 instances)

- ❌ #19 DropdownMenu / Select / Popover
  - `BrainSwitcher`, `OmniSearch`, recategorise picker, sort picker,
    model/tier/bucket pickers
  - Risk: medium-high — each dropdown has its own click-outside / escape /
    focus-trap shape. Keyboard nav comes free with Radix but visual width
    matching needs care.

### Batch F — heavy primitives (~7 critical migrations)

- ❌ #20 Calendar + Drawer (vaul) + Command (cmdk)
  - Calendar: 3 native `<input type="date">` in `TodoCalendarTab` +
    `ScheduleInline`
  - Drawer: `CaptureSheet` drag-to-close — port the existing 80px
    threshold + 200px rubber-band tuning
  - Command: `OmniSearch` custom popover → typeahead palette
  - Risk: high — `CaptureSheet` is in the user's daily critical path. Any
    regression on drag-dismiss is high-pain.

### Batch G — Dialog migration (7 modals)

- ❌ #21 `Dialog` migration removes `focus-trap-react` dep
  - `CaptureSheet`, `OnboardingModal`, `MoveToBrainModal`,
    `CreateBrainModal`, `VaultRevealModal`, `DetailModal`,
    `settings/ProfileTab`
  - Risk: medium — focus-trap-react's behaviour is subtly different from
    Radix Dialog; need to verify scroll-lock + escape + return-focus on
    each modal.

### Batch H — Sonner toast migration (6 files)

- ❌ #22 Kill `UpdatePrompt`, `BackgroundTaskToast`, `BackgroundOpsToast`,
  `UndoToast`, `NudgeBanner`, `ConsentBanner`
  - Sonner already mounted (Toaster in `Everion.tsx`); files need to be
    ported to use `toast()` calls.
  - Risk: low — the Toaster hosts the queue; existing toasts already use
    `sonner` in places (saveError, etc.).

### Batch I — code-quality cleanup (multi-session)

- ❌ #23 Cut `as any` 59 → 0 + ESLint ratchet
  - Each cast is its own typing decision; can't be safely batch-replaced.
  - Effort: ~2–3 sessions of careful per-cast work.
- ❌ #24 Split 3 god-components >1000 lines (DetailModal, TodoView, Landing)
  - Need test-pinning before each split. Can't be done blind.
  - Effort: 1 session per component minimum.

### Batch J — e2e specs (3 specs)

- ❌ #27 vault unlock + delete cascade + persona-facts
  - Playwright auth fixture exists. Each spec is ~50–100 lines + fixture
    work. Can be done in one focused session.

### Batch K bonuses partially done

- ✅ og.png compressed
- ✅ Bundle audit doc (no chunk exceeds 500 KB gzipped target)
- ✅ Lighthouse prep doc (real run needs production URL + Chrome)
- ❌ CSP nonce migration first pass — needs server-side nonce injection in
  every Vercel function response + careful scan of inline `style=` usage.
  Multi-session work; deferred to post-launch per existing checklist note.

## Why the shadcn block was paused

Each shadcn migration touches 25–95 instances across many files. Doing
them as one sweep risks:

1. Visual regressions invisible to the test suite (subtle padding /
   border-radius / focus-ring drift).
2. Focus-trap behaviour changes that break keyboard-only flows.
3. Breaking the "press" tap feedback class which is custom-tuned per
   component.

The right mode for these is one batch per session, with a short visual
QA pass before merging. Spent here would have been blind code generation
without a way to verify the result.

## Suggested next session ordering

Short to long:

1. **Batch H (Sonner, ~1 hour)** — already mostly there; just port the
   six toast files to call `toast()` and delete the components.
2. **Batch C — Card/Separator/Badge (~2 hours)** — atomic, low-risk,
   gives the rest of the migration cleaner ground to stand on.
3. **Batch C — Input/Textarea (~2 hours)** — same shape.
4. **Batch G — Dialog (~3 hours)** — pays off `focus-trap-react`
   removal + ~200 lines.
5. **Batch E — Dropdown/Select/Popover (~3 hours)** — biggest UX win
   (proper keyboard nav).
6. **Batch F — Drawer / Calendar / Command (~3 hours)**.
7. **Batch D — Tabs / Accordion (~1 hour)**.
8. **Batch J — e2e specs (~2 hours)**.
9. **Batch I — `as any` ratchet + god-component split (multi-session)**.
