# OpenBrain Sprint Plan

> Ruthlessly prioritized. Only work that makes the app genuinely better for users.

---

## Sprint 1 — Secrets AI Bypass (#9)

**Why this matters:** Right now, when a user types "my WiFi password is hunter2", that plaintext gets sent to an external LLM API for classification *before* it gets encrypted. That's a real privacy hole. Users storing passwords and bank details need to trust that sensitive data never leaves their device.

**What to build:**
- A "Direct Entry" mode in QuickCapture that skips the AI call entirely
- Auto-detect sensitive input using the existing `SENSITIVE_RE` regex (already in `OpenBrain.tsx:117`) and suggest switching to direct mode
- Manual form: Title, Content (textarea), Type (pre-select "secret"), Tags
- Encrypt locally via `encryptEntry()` then save to `/api/capture` — no AI, no embedding, no connection finding
- Clear visual indicator: "Data stays on your device" so users feel safe

**Files:** `src/components/QuickCapture.tsx`

**What NOT to do:** Don't over-design this. No new components, no new routes. It's a mode toggle inside the existing capture flow.

---

## Sprint 2 — Smart Updates (#10)

**Why this matters:** Users add entries over time. "John the plumber" gets added in January, then in June the user types "John the plumber's new number is 082..." — that should update the existing entry, not create a duplicate.

**What already exists:** The `PreviewModal` in QuickCapture already detects similar titles via `scoreTitle()` and shows "Similar entries found — update one instead?" with an "Update this" button. This works. The issue is that it's easy to miss and only matches on titles.

**What to build:**
- Make dupe detection more aggressive: also match on content overlap and shared tags, not just title words
- When duplicates are found, make the merge suggestion more prominent — show it *before* the save button, not tucked away as a subtle warning
- Show what will change: "Title: John the plumber → (same), Phone: (none) → 082..."
- Let the AI include candidate match IDs in its classification response so it can flag "this looks like an update to entry X" — but the **user always decides**, never auto-merge

**Files:** `src/lib/duplicateDetection.ts`, `src/components/QuickCapture.tsx`, `src/config/prompts.ts`

**What NOT to do:** Don't build a complex "content-aware scoring engine" or separate `findCandidates` abstraction. Improve `scoreTitle` to also check content/tags, make the UI more prominent, done. The AI suggestion is a hint, not a decision.

---

## Sprint 3 — Multi-File Upload (#8, descoped)

**Why this matters:** Onboarding friction. Getting your first 50 entries into OpenBrain is tedious one file at a time. Users want to dump a folder of documents and have the app sort it out.

**What to build:**
- Add `multiple` attribute to the existing file input in QuickCapture
- Process files sequentially through the existing parse → split → capture pipeline
- Show progress: "Processing file 3 of 12..."
- Add a drag-and-drop zone that accepts multiple files

**Files:** `src/components/QuickCapture.tsx`

**What NOT to do:**
- ~~New ImportView~~ — unnecessary. The capture flow already handles files. Just make it accept more than one.
- ~~Folder upload via webkitdirectory~~ — inconsistent browser support, confusing UX.
- ~~Gmail/Google/GitHub integrations~~ — this is months of OAuth infrastructure for something users can solve by exporting files manually. Not worth it now.
- ~~Dedicated bulk import view with category distribution summary~~ — over-engineered. Users just want to drag files in.

---

## Sprint 4 — Finance Tracking (#7, descoped)

**Honest take:** This is scope creep. OpenBrain is a personal knowledge/memory app, not a finance app. Building CSV parsers, OFX parsers, transaction categorization, and spending charts is building a second app inside the first one. Users who want finance tracking use YNAB, 22seven, or their bank's app.

**What's actually useful:** The ability to upload a CSV bank statement and have it turned into searchable entries so you can later ask "how much did I spend at Woolworths last month?" via chat.

**What to build (minimal):**
- Detect CSV files in the existing file upload flow
- Parse CSV rows into individual entries (use the existing `fileSplitter` AI prompt — it already handles splitting documents into entries)
- AI categorizes each row using the existing `PROMPTS.CAPTURE` — no new prompt needed
- Each transaction becomes a `note` entry with `metadata.amount`, `metadata.transaction_date`, and relevant tags

**Files:** `src/lib/fileParser.ts` (add CSV detection), `src/components/QuickCapture.tsx`

**What NOT to do:**
- ~~New "transaction" entry type~~ — adds complexity across the entire stack (types, constants, API allowlist, views) for minimal benefit. A note with financial tags works fine.
- ~~OFX/QFX parser~~ — obscure format, most banks export CSV. Build when someone actually asks for it.
- ~~FinanceView with charts~~ — you're building a second app. The chat already answers spending questions from entry data.
- ~~New navigation item~~ — the app already has 10 views in the nav. Adding more makes it harder to use, not easier.

---

## Not Sprints — Reference Material

### #12, #11, #6 — Research & Documentation

These three issues are not implementation work. They're research notes, vision documents, and reference links that the developer captured as issues. Writing manifesto docs, 5-phase roadmap files, AI trend reports, and OB1 comparison tables doesn't ship features or fix problems.

**What to do instead:** Close these as issues. Move the content into a `docs/notes/` folder as simple reference files if you want to keep them. Don't sprint on documentation that no user will ever see.

The roadmap already lives in the issues themselves. The architecture is the code.

---

## Summary

| Sprint | Issue | What | Real Impact |
|--------|-------|------|-------------|
| **1** | #9 | Secrets bypass AI | Users can trust the app with passwords |
| **2** | #10 | Better duplicate detection + merge UX | Fewer duplicate entries, cleaner brain |
| **3** | #8 | Multi-file upload | Onboarding goes from 2 hours to 10 minutes |
| **4** | #7 | CSV upload as entries | Financial data becomes searchable via chat |
| — | #12,11,6 | Move to docs/notes, close issues | Keep the issue tracker clean |

### Principles applied
- **If users won't notice it, don't build it.** Architecture docs, research reports, and empty placeholder directories are invisible to users.
- **Extend what exists before building new.** The file upload flow, dupe detection, and capture pipeline already work. Improve them, don't replace them.
- **Every new view/type/route has a maintenance cost.** FinanceView, ImportView, and transaction types all add permanent complexity. Only add them when the simpler approach proves insufficient.
- **The AI is a helper, not a decision-maker.** For smart updates, the AI can suggest — the user decides. For secrets, the AI should get out of the way entirely.
