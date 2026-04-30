# EverionMindLaunch

The single source of truth for **pre-launch, launch, and post-launch** tasks, considerations, decisions, direction, research, strategy, and architecture reference.

## What lives here

```
EverionMindLaunch/
├── LAUNCH_CHECKLIST.md     ← canonical action list (the to-do)
├── ROADMAP.md              ← 21-day sprint + 12-month timeline
├── STRATEGY.md             ← positioning, moat, viral mechanics, the page you read every morning
├── RESEARCH.md             ← competitor matrix + market principles + capture-design research
├── BRAINSTORM.md           ← priority-scored idea park (with parking lot for wild swings)
├── IMPORTS_SPEC.md         ← architecture for mass + continuous imports (Gmail / Drive / Notion / Obsidian / FS)
├── architecture/           ← reference docs for cross-cutting components
│   ├── INDEX.md
│   ├── auth.md             ← withAuth, tier quotas, Upstash limiter
│   ├── bell.md             ← NotificationBell component
│   ├── capture.md          ← CaptureSheet + useCaptureSheetParse + api/capture
│   ├── cron.md             ← workflows + handleCronDaily/Hourly
│   ├── enrich.md           ← api/_lib/enrich + PICE chips
│   └── gmail.md            ← gmailScan + staging inbox
├── index.html              ← branded multi-doc dashboard
├── server.mjs              ← zero-dep Node HTTP server (~150 LOC)
├── README.md               ← this file
├── preview.png             ← reference screenshot
├── preview-brainstorm.png  ← reference screenshot
└── preview-checklist.png   ← reference screenshot
```

## Run the dashboard

```bash
node EverionMindLaunch/server.mjs
```

Open <http://localhost:5174>. Custom port: `PORT=8080 node EverionMindLaunch/server.mjs`.

The dashboard has a **top tab bar** for every doc. Two render modes:

- **Checklist tab** — scorecard tiles (Done / Partial / Missing / Open), animated progress bar, status filter chips, category filter chips (auto-derived sub-categories: Infrastructure, Security, Mobile, Marketing, App Store Submission, Performance, Code Quality, Stability, Owner Tasks, Post-Launch, ...), search across titles/descriptions, sticky sidebar nav grouped by category.
- **Doc tabs** (Roadmap / Strategy / Research / Brainstorm / Imports / Architecture sub-docs) — branded markdown render with TOC sidebar (H2 + H3 anchors), tables, code blocks, blockquotes. Any `[ ]` line in any doc is also toggleable — clicking writes back to the source `.md`.

## Bidirectional live sync

- Dashboard polls every 2.5 s. Edit any `.md` file in your editor → dashboard refreshes automatically.
- Tick a checkbox in the dashboard → server rewrites that line in the source `.md` (`[ ]` ↔ `[x]`).

**Heads-up:** If you have a `.md` file open in your editor with unsaved changes when the dashboard writes a toggle, your unsaved edits get overwritten. Save first, or edit one place at a time. The server reads the file fresh on every write, so saved edits are always preserved.

## Convention

- `[x]` → Done
- `[ ]` plus `🟡` → Partial
- `[ ]` plus `❌` → Missing
- `[ ]` plain → Open

The dashboard reads these directly. Status pills + filter chips + scorecard reflect them.

## How the docs fit together

- **`LAUNCH_CHECKLIST.md`** is the **active to-do.** P0/P1/P2 tiers. What's blocking launch RIGHT NOW.
- **`ROADMAP.md`** is the **forward plan.** Everything from week 1 through year 1, organized by horizon. When a roadmap milestone becomes the next thing to ship, lift its bullets into the checklist.
- **`STRATEGY.md`** is the **strategic spine.** Positioning, moat, viral mechanics, what NOT to build. When in doubt about a feature decision, return here.
- **`RESEARCH.md`** is the **market evidence.** Competitor matrix, what users praise + complain about, MVP principles, capture-design patterns.
- **`BRAINSTORM.md`** is the **idea park.** Priority-scored ideas (Usefulness + Wow + Unique − Scope Creep). Killed ideas stay (with reason) so we don't re-propose them.
- **`IMPORTS_SPEC.md`** is a **feature spec.** Mass + continuous import architecture (Gmail, Drive, Notion, Obsidian, local FS). Slot: Month 6–12.
- **`architecture/*.md`** are **reference docs.** How existing systems work — auth, capture pipeline, cron, enrichment, Gmail sync, notification bell. These are stable; new ones get added when a complex component lands.

## Why a tiny custom server instead of Vite or Express?

Browsers can't write to disk. The dashboard needs a write endpoint to flip `[ ]` ↔ `[x]` in source markdown. The whole server is < 200 lines, no `node_modules`, no `package.json` of its own, no build step. Run with stock Node 18+.

## Backed by git

Every `.md` here is checked in. Every change is versioned. To see history of a doc:

```bash
git log --follow EverionMindLaunch/LAUNCH_CHECKLIST.md
git log --follow EverionMindLaunch/ROADMAP.md
```

## Maintenance

- **New launch task?** Add to `LAUNCH_CHECKLIST.md` under the right priority tier.
- **New post-launch milestone?** Add to `ROADMAP.md` at the right time horizon.
- **New idea?** Score it in `BRAINSTORM.md` master table; describe it below; tag a target window.
- **New competitor or market signal?** Add to `RESEARCH.md`.
- **Killed an idea?** Move to `BRAINSTORM.md` "explicitly killed" with date + reason. Don't delete — institutional memory.
- **New cross-cutting component?** Document at `bell.md` density and add to `architecture/INDEX.md`.
- **Promoted an idea to roadmap?** Update its `Status / target window` in `BRAINSTORM.md` to point at the roadmap horizon.
