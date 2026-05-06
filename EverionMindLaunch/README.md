# EverionMindLaunch (EML)

The single source of truth for **pre-launch, launch, and post-launch** tasks, considerations, decisions, direction, research, strategy, architecture reference, ops, legal, support, brand, mobile, and analytics.

> **Start here**: `PLAYBOOK.md` — the launch hub. 7 phases, every link, in order.

## What lives here

```
EverionMindLaunch/
├── PLAYBOOK.md              ← THE HUB. Start here. 7-phase launch playbook.
├── LAUNCH_CHECKLIST.md      ← active to-do (P0/P1/P2 tiered)
├── ROADMAP.md               ← 21-day sprint + 12-month timeline
├── STRATEGY.md              ← positioning, moat, viral mechanics
├── RESEARCH.md              ← competitor matrix + market evidence + MVP principles
├── BRAINSTORM.md            ← priority-scored idea park
│
├── Roadmap/                 ← week-by-week sprint detail
│   ├── week-1.md            ← week-1 of public-launch sprint
│   ├── week-2.md
│   ├── week-3.md
│   ├── week-4.md
│   └── beta-phase.md        ← beta cohort operations
│
├── Specs/                   ← feature specs (active + shipped)
│   ├── imports-spec.md      ← mass + continuous import (Gmail / Drive / Notion / FS)
│   ├── brain-feed-v0.md     ← home brain feed
│   ├── streak-counter.md    ← habit loop
│   ├── android-qa-matrix.md ← device compat
│   ├── play-console-submission.md
│   └── archive/             ← shipped specs
│
├── Audits/                  ← adversarial reviews and quality reports
│   └── archive/             ← addressed audits
│
├── architecture/            ← reference docs for cross-cutting systems
│   ├── INDEX.md
│   ├── auth.md              ← withAuth, tier quotas, Upstash limiter
│   ├── bell.md              ← NotificationBell component
│   ├── capture.md           ← CaptureSheet + useCaptureSheetParse + api/capture
│   ├── cron.md              ← workflows + handleCronDaily/Hourly
│   ├── enrich.md            ← api/_lib/enrich + PICE chips
│   ├── gmail.md             ← gmailScan + staging inbox
│   ├── events.md            ← PostHog events
│   ├── security.md          ← trust model, encryption layers, RLS, threats
│   └── onboarding-flow.md   ← signup → first capture → first answer
│
├── Ops/                     ← operational runbooks
│   ├── env-vars.md          ← every env var, owner, rotation cadence
│   ├── feature-flags.md     ← every flag, default, removal trigger
│   ├── vendors.md           ← every external service, status, escape hatch
│   ├── crons.md             ← every scheduled job, schedule, disable command
│   ├── incident-response.md ← what to do when something breaks
│   └── disaster-recovery.md ← RPO/RTO + worst-case scenarios
│
├── Legal/                   ← legal & policy
│   ├── ai-disclosure.md     ← what we send to AI vendors
│   ├── pricing-billing.md   ← tiers, refund, dunning
│   ├── privacy-tos-launch.md ← privacy + ToS launch checklist
│   └── trademarks-domains.md ← TM + domain strategy
│
├── Support/                 ← support operations
│   ├── sop.md               ← triage SLA + reply template
│   ├── account-recovery.md  ← every "I can't get in" scenario
│   ├── faq.md               ← public FAQ
│   └── abuse-moderation.md  ← TOS violations + CSAM/NCII
│
├── Brand/                   ← brand assets + voice
│   ├── assets.md            ← logo, colors, fonts
│   ├── voice-tone.md        ← how we sound
│   ├── press-kit.md         ← what journalists get
│   └── outreach-list.md     ← who to talk to
│
├── Mobile/                  ← mobile-specific runbooks
│   ├── ios-submission.md    ← App Store Connect
│   └── capacitor-build.md   ← build & release flow
│
├── Analytics/               ← metrics + experiments
│   ├── event-taxonomy.md    ← every event we emit
│   ├── north-star.md        ← the one number
│   ├── beta-cohort.md       ← beta tracking
│   └── ab-tests.md          ← test queue
│
├── marketing/               ← marketing playbooks + paste-ready assets
│   ├── seo-marketing-playbook.md  ← canonical SEO + content + PR plan
│   └── ProductHunt/         ← PH launch assets
│
├── index.html               ← branded multi-doc dashboard
├── server.mjs               ← zero-dep Node HTTP server (~200 LOC)
├── build-static.mjs         ← static-site build for Vercel deploy
├── README.md                ← this file
└── preview*.png             ← reference screenshots
```

## Run the dashboard

```bash
node EverionMindLaunch/server.mjs
```

Open <http://localhost:5174>. Custom port: `PORT=8080 node EverionMindLaunch/server.mjs`.

The dashboard renders a grouped **Document Library** in this order:
- **Currently Working** — in-flight sprint files
- **Launch Control** — Playbook, Checklist, Roadmap, Strategy, Research, Brainstorm
- **Roadmap** — week-by-week sprint
- **Specs** — feature specs
- **Marketing** — playbooks + Product Hunt assets
- **Audits** — adversarial reviews
- **Architecture** — implementation reference
- **Ops / Legal / Support / Brand / Mobile / Analytics** — cross-cutting reference
- **Archives** (muted, bottom)

Use the document search field to jump straight to a file by title, folder, or path.

Two render modes:
- **Checklist tab** — scorecard tiles (Done / Partial / Missing / Open), animated progress bar, status filter chips, category filter chips, search across titles/descriptions, sticky sidebar nav grouped by category.
- **Doc pages** — branded markdown render with TOC sidebar (H2 + H3 anchors), tables, code blocks, blockquotes. Any `[ ]` line in any doc is also toggleable — clicking writes back to the source `.md`.

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

The **PLAYBOOK** is the entry point — it walks through the 7 launch phases and points to the relevant doc for each. Other docs:

- **`LAUNCH_CHECKLIST.md`** — the **active to-do.** P0/P1/P2 tiers.
- **`ROADMAP.md`** — the **forward plan.** Everything from week 1 through year 1.
- **`STRATEGY.md`** — the **strategic spine.** Positioning, moat, viral mechanics.
- **`RESEARCH.md`** — the **market evidence.** Competitor matrix, MVP principles.
- **`BRAINSTORM.md`** — the **idea park.** Priority-scored ideas + killed ideas (with reasons).
- **`Roadmap/`** — sprint-level detail (week-1, week-2, beta-phase).
- **`Specs/*.md`** — feature specs. Active in `Specs/`, shipped in `Specs/archive/`.
- **`Audits/*.md`** — full adversarial audits + quality findings. Newest first.
- **`architecture/*.md`** — how existing systems work. Stable reference.
- **`Ops/`** — operational runbooks (env vars, vendors, incidents, DR).
- **`Legal/`** — pricing, privacy, ToS, AI disclosure, trademarks.
- **`Support/`** — SOP, account recovery, FAQ, moderation.
- **`Brand/`** — assets, voice, press kit, outreach.
- **`Mobile/`** — iOS/Android submission + Capacitor build flow.
- **`Analytics/`** — event taxonomy, north-star metric, beta cohort, A/B tests.
- **`marketing/`** — SEO playbook + paste-ready Product Hunt copy.

## Audit address-and-archive workflow

When addressing an audit:
1. Read end-to-end.
2. Address each finding — code changes, commits, follow-up specs.
3. For findings NOT addressed in this pass, lift them into `LAUNCH_CHECKLIST.md` under the right tier with a tag like `(from EML/Audits/<file>, finding #N)`.
4. Prepend a `## Resolution — YYYY-MM-DD` section to the audit summarizing addressed / deferred / wontfix.
5. `git mv EML/Audits/<file>.md EML/Audits/archive/<file>.md`
6. Commit: `chore(EML): archive Audits/<file> — addressed in <commits>, deferred N items to checklist`.

Dashboard auto-discovers Audits drops; archived audits move to "Audit Archive" group (muted, bottom).

## Why a tiny custom server instead of Vite or Express?

Browsers can't write to disk. The dashboard needs a write endpoint to flip `[ ]` ↔ `[x]` in source markdown. The whole server is < 250 lines, no `node_modules`, no `package.json` of its own, no build step. Run with stock Node 18+.

## Static deploy

`node EverionMindLaunch/build-static.mjs` produces a read-only `dist/` for Vercel deploy. Same DOCS list, same auto-discovery, but the toggle endpoint becomes a "edit locally" toast.

## Backed by git

Every `.md` here is checked in. Every change is versioned.

```bash
git log --follow EverionMindLaunch/LAUNCH_CHECKLIST.md
git log --follow EverionMindLaunch/ROADMAP.md
```

## Maintenance rules

- **New launch task?** Add to `LAUNCH_CHECKLIST.md` under the right priority tier.
- **New post-launch milestone?** Add to `ROADMAP.md` at the right time horizon.
- **New idea?** Score it in `BRAINSTORM.md`; describe it below; tag a target window.
- **New competitor or market signal?** Add to `RESEARCH.md`.
- **Killed an idea?** Move to `BRAINSTORM.md` "explicitly killed" with date + reason. Don't delete.
- **New cross-cutting component?** Document at `architecture/bell.md` density and link from `architecture/INDEX.md`.
- **Promoted an idea to roadmap?** Update `Status / target window` in `BRAINSTORM.md` to point at the roadmap horizon.
- **Spec shipped?** `git mv Specs/<spec>.md Specs/archive/<spec>.md`.
- **Audit addressed?** Follow the address-and-archive workflow above.
- **New feature flag, vendor, env var, or cron?** Update the relevant `Ops/*.md` file.
- **Phase milestone hit?** Tick it in `PLAYBOOK.md`.

If a launch-related task isn't in EML, it doesn't exist. Move it in before working on it.
