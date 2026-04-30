# EverionMindLaunch

The single source of truth for **pre-launch, launch, and post-launch** tasks, considerations, decisions, and direction.

## Files

- **`LAUNCH_CHECKLIST.md`** — the canonical document. Everything ships through this file. All other launch-related notes consolidate here. **Edit this directly OR check items off via the dashboard — both stay in sync.**
- **`index.html`** — branded dashboard view of the checklist with status filters, category sub-filters, search, and progress bars. Items are categorized (Infrastructure, Security, Mobile, Marketing, etc.) and filterable by state (Done / Partial / Missing / Open).
- **`server.mjs`** — zero-dep Node HTTP server (~100 LOC) that serves the dashboard and writes checkbox toggles back to `LAUNCH_CHECKLIST.md`.

## Run the dashboard

```bash
node EverionMindLaunch/server.mjs
```

Then open <http://localhost:5174>.

**Live updates:** the dashboard polls the `.md` file every 2.5 s and re-renders on change — edit the markdown in your editor and the dashboard updates automatically. Conversely, ticking a checkbox in the dashboard rewrites the corresponding line in the markdown.

**Custom port:** `PORT=8080 node EverionMindLaunch/server.mjs`

## Why a tiny custom server instead of Vite or Express?

Browsers can't write to disk. The dashboard needs a write endpoint to flip `[ ]` ↔ `[x]` in the source markdown. The whole server is < 100 lines, no `node_modules`, no `package.json` of its own, no build step. Run with stock Node 18+.

## Heads-up: editor conflicts

If you have `LAUNCH_CHECKLIST.md` open in your editor with **unsaved changes** while the dashboard writes a toggle, your unsaved edits will be overwritten. Either save before clicking the dashboard, or edit one place at a time. The server reads the file fresh on every write, so saved edits are always preserved.

## Categories

Items are sub-categorized by the heading they live under (see `CATEGORY_MAP` in `index.html`). Current buckets:

- **Infrastructure** · Vercel/Supabase upgrades, DNS, SSL
- **Security** · keys, RLS, CSP, rate limits
- **Compliance** · Privacy, ToS, GDPR, consent
- **Telemetry** · Sentry, PostHog, Lighthouse, weekly roll-up
- **Billing** · Stripe products, tax, cancellation
- **Quality / UX** · Lighthouse pass, real-device QA, onboarding test, empty states
- **Communications** · transactional email, support
- **Design System** · shadcn migration phases
- **PWA** · service worker, offline
- **Performance** · bundle, cold-start, og.png
- **Multi-Brain (P2)** · phase 2/3/4 sharing
- **Owner Tasks** · everything that requires Christian (clicks/payments/decisions)
- **Stability** · idempotency, error boundaries, retries
- **Code Quality** · `as any` cleanup, god-component splits
- **Operations** · staging, bus-factor, backups
- **Mobile** · Capacitor wrap, real-device testing, native plugins
- **App Store Submission** · Apple/Google blockers, manifests, metadata
- **Marketing / Store Copy** · App Store + Play listing copy
- **Visual Assets** · screenshots, icons, splash
- **Post-Launch** · Important Memories beyond v0, vault export, etc.

To add or rename a category, edit `CATEGORY_MAP` in `index.html`.

## Convention

- `[x]` → Done
- `[ ]` plus `🟡` → Partial
- `[ ]` plus `❌` → Missing
- `[ ]` plain → Open

The dashboard reads these directly. Status pills + filter chips reflect them.

## Backed by git

The checklist is checked into the repo. Every change is versioned. To see the history:

```bash
git log --follow EverionMindLaunch/LAUNCH_CHECKLIST.md
```
