# OpenBrain Sprint — Outstanding Issues

> Generated from GitHub Issues #6–#12 against the current codebase.
> Each section maps an issue to concrete implementation tasks, files to touch, and estimated complexity.

---

## Issue #9 — Adding Secrets (Bypass AI)

**Goal:** When adding secrets (passwords, bank numbers, etc.), allow the user to bypass AI classification entirely so sensitive data never leaves the browser.

### What exists today
- `QuickCapture.tsx` sends raw text to the AI via `callAI()` with `PROMPTS.CAPTURE` to classify entries.
- The `SENSITIVE_RE` regex in `OpenBrain.tsx:117` already detects sensitive keywords in *chat responses* — but there is **no bypass** during *capture*.
- Vault encryption (`lib/crypto.ts`) encrypts entries *after* AI classification, meaning the plaintext still hits the LLM API.

### Implementation plan
1. **Add a "Direct Entry" toggle to `QuickCapture.tsx`**
   - New state: `const [directMode, setDirectMode] = useState(false)`
   - Auto-enable when `SENSITIVE_RE` matches the input text (reuse the regex from OpenBrain.tsx or extract to a shared util).
   - When active, show a shield icon + "AI Bypass — data stays local" banner.

2. **Direct entry form (no AI call)**
   - Show manual fields: Title, Content (textarea), Type (pre-select "secret"), Tags.
   - On save, build the entry object locally:
     ```ts
     { title, content, type: "secret", tags, metadata: {} }
     ```
   - Encrypt via `encryptEntry()` before calling `/api/capture`.
   - Skip `findConnections()` and embedding — secret entries should never be embedded.

3. **Files to modify**
   - `src/components/QuickCapture.tsx` — add direct-mode UI + toggle logic
   - `src/config/prompts.ts` — no changes needed
   - `src/lib/crypto.ts` — no changes needed (already supports encrypt)

4. **Complexity:** Low-Medium (~2–3 hours)

---

## Issue #10 — Smart Updates (AI Deduplication)

**Goal:** When a new entry is added, AI should determine whether it should update an existing entry or create a new one.

### What exists today
- `lib/duplicateDetection.ts` has `scoreTitle()` and `findDuplicates()` — basic title similarity (word overlap).
- `QuickCapture.tsx` `PreviewModal` already shows "Similar entries found — update one instead?" when `scoreTitle > 50`.
- But this is purely title-based and only shown in the preview modal — the AI itself doesn't participate in the merge decision.

### Implementation plan
1. **Enhance the capture prompt (`PROMPTS.CAPTURE`) to include existing entry context**
   - When classifying, send the top 5 similar entries (by title score + embedding similarity if available) as context.
   - Add to the prompt: "If this information clearly updates or replaces an existing entry, return `{\"action\":\"update\",\"update_id\":\"<entry_id>\", ...}` instead of creating new."
   - New response schema adds optional `action` and `update_id` fields.

2. **Update `QuickCapture.tsx` capture flow**
   - After AI returns, check for `action === "update"`.
   - If update: pre-populate the PreviewModal with the merge suggestion, highlight what changed.
   - User confirms or overrides (always user choice, never auto-merge).

3. **Improve `duplicateDetection.ts`**
   - Add content-level similarity (not just title): compare tags, metadata fields, and content snippets.
   - Export a `findCandidates(newEntry, entries, limit)` function that returns the best matches with scores.

4. **Files to modify**
   - `src/config/prompts.ts` — extend `CAPTURE` prompt
   - `src/lib/duplicateDetection.ts` — add content-aware scoring
   - `src/components/QuickCapture.tsx` — handle `action:"update"` from AI, improve PreviewModal merge UX

5. **Complexity:** Medium (~4–6 hours)

---

## Issue #7 — Personal Finance Tracking

**Goal:** Upload bank statements (CSV/OFX), auto-categorize transactions via AI, query spending through chat, and visualize spending by category.

### What exists today
- `lib/fileParser.ts` + `lib/fileSplitter.ts` handle file uploads (text, PDF, DOCX) and split into entries.
- `QuickCapture.tsx` has file upload flow that parses documents into entries.
- No finance-specific types, views, or parsers exist.

### Implementation plan

#### Phase 1: CSV/OFX Parser
1. **New file: `src/lib/financeParser.ts`**
   - Parse CSV bank statements (detect common formats: date, description, amount, balance).
   - Parse OFX/QFX files (XML-based, extract `<STMTTRN>` records).
   - Return normalized array: `{ date, description, amount, balance?, raw }[]`

2. **New entry type: `"transaction"`**
   - Add to `EntryType` in `src/types.ts`.
   - Add to `TC` in `src/data/constants.ts` (icon: "💳", color: green).
   - Add to `ALLOWED_TYPES` in `api/capture.ts`.
   - `EntryMetadata` additions: `amount?: string`, `transaction_date?: string`, `category?: string`, `account?: string`.

#### Phase 2: AI Categorization
3. **New prompt: `PROMPTS.FINANCE_CATEGORIZE` in `src/config/prompts.ts`**
   - Takes batch of transactions, returns categories (groceries, dining, transport, entertainment, utilities, etc.).
   - Maps each transaction to a category.

4. **Batch capture flow in `QuickCapture.tsx`**
   - Detect `.csv` / `.ofx` / `.qfx` files in `handleFileUpload`.
   - Parse → AI categorize → create entries in bulk via `/api/capture`.

#### Phase 3: Finance View
5. **New view: `src/views/FinanceView.tsx`**
   - Filter entries by `type === "transaction"`.
   - Summary cards: total spent, top categories, monthly trend.
   - Simple bar/pie chart using canvas or inline SVG (no new dependency).
   - Category breakdown with drill-down.

6. **Add "Finance" to navigation**
   - `src/components/BottomNav.tsx` — add to More menu or as a nav item.
   - `src/OpenBrain.tsx` — add `FinanceView` lazy import and routing.

7. **Chat integration**
   - Spending queries already work via the chat context (entries include transaction data).
   - Enhance `PROMPTS.CHAT` with a note: "For transactions, summarize spending by category when asked."

#### Files to create/modify
- **Create:** `src/lib/financeParser.ts`, `src/views/FinanceView.tsx`
- **Modify:** `src/types.ts`, `src/data/constants.ts`, `src/config/prompts.ts`, `src/components/QuickCapture.tsx`, `src/OpenBrain.tsx`, `src/components/BottomNav.tsx`, `api/capture.ts`

#### Complexity: High (~10–16 hours)

---

## Issue #8 — Mass Search / Bulk Import

**Goal:** Access folders, repos, databases, Gmail, Chrome bookmarks, calendars, etc. to bulk-sort entries and speed up onboarding.

### What exists today
- File upload (single file at a time) in `QuickCapture.tsx`.
- File parsing for `.txt`, `.csv`, `.json`, `.md`, `.pdf`, `.docx` in `lib/fileParser.ts`.
- `lib/fileSplitter.ts` splits large documents into multiple entries via AI.
- No multi-file or external service integration exists.

### Implementation plan

#### Phase 1: Bulk File Import (most feasible now)
1. **Multi-file upload in `QuickCapture.tsx`**
   - Change file input to `multiple` attribute.
   - Process files in sequence, showing progress (e.g., "File 3 of 12...").
   - Each file goes through the existing parse → split → capture pipeline.

2. **Folder drop zone**
   - Add drag-and-drop area that accepts folders (via `webkitdirectory` attribute).
   - Recursively read files, filter to supported types, batch process.

3. **New view: `src/views/ImportView.tsx`**
   - Dedicated bulk import interface with progress tracking.
   - Preview all parsed entries before bulk save.
   - Category/type distribution summary.

#### Phase 2: External Integrations (future — requires OAuth)
4. **Google integration (Gmail, Calendar, Drive)**
   - Requires Google OAuth consent screen + API credentials.
   - New API endpoint: `api/integrations/google.ts`.
   - Scope: read-only access to Gmail labels, Calendar events, Drive files.
   - Each imported item becomes an entry via the existing capture pipeline.

5. **Chrome bookmarks**
   - Can be exported as HTML — parse via the existing file upload.
   - Document this as a manual workflow in the onboarding.

6. **GitHub repos**
   - README/docs import via GitHub API (public repos only without auth).
   - Could parse repo structure into entries.

#### Phase 1 Files to create/modify
- **Modify:** `src/components/QuickCapture.tsx` (multi-file + folder support)
- **Create:** `src/views/ImportView.tsx`
- **Modify:** `src/OpenBrain.tsx` (add ImportView routing)

#### Complexity
- Phase 1 (bulk file): Medium (~4–6 hours)
- Phase 2 (external integrations): Very High (~40+ hours, requires OAuth infra)

---

## Issue #12 — NateB OpenBrain Analysis (Master Roadmap)

**Goal:** Create the foundational documentation and architecture for OpenBrain as a "Personal Intelligence Environment."

### What exists today
- `README.md` — basic project readme.
- Various planning docs: `future-plans.md`, `GAPS.md`, `AI-models.md`, `openbrain-fill-your-brain.md`, `openbrain-onboarding-30.md`.
- `roadmap/` directory exists.

### Implementation plan
1. **Create `docs/manifesto.md`**
   - Codify the 5 strategic principles from the issue.
   - Vision statement: "Intelligence compounds over time."

2. **Create `docs/architecture.md`**
   - Document the current layered architecture: Interface → Cognitive Engine → Memory System → Identity Layer → Model Abstraction.
   - Map to existing code: React views → AI prompts/callAI → Supabase/entries → Brain context → provider abstraction.

3. **Create `docs/schemas/README.md`**
   - Document the existing schemas: Entry, Brain, Link, EntryMetadata.
   - Reference `src/types.ts` as the source of truth.

4. **Update `roadmap/` directory**
   - Create `roadmap/phase1-foundation.md` through `roadmap/phase5-frontier.md` based on the 5-phase plan.
   - Cross-reference with existing issues.

5. **Restructure folder for extensibility**
   - Create placeholder directories: `docs/skills/`, `docs/recipes/`, `docs/extensions/`.

#### Complexity: Low (~2–3 hours, documentation only)

---

## Issue #11 — NotebookLM Research

**Goal:** Document AI trends research and produce a tailored report on 2026 SaaS/AI trends relevant to OpenBrain.

### What exists today
- `AI-models.md` — model configuration docs.
- No dedicated research/reports directory.

### Implementation plan
1. **Create `docs/research/ai-trends-2026.md`**
   - Synthesize the 5 trends from the issue into a structured report.
   - Map each trend to OpenBrain's architecture and roadmap.

2. **Create `docs/research/openbrain-positioning.md`**
   - How OpenBrain addresses each trend:
     - User-owned memory → Supabase + MCP architecture
     - Production-ready infra → Vercel + offline-first PWA
     - Agent web → Structured entries + embeddings
     - MCP interoperability → Model-agnostic provider abstraction
     - Trust barriers → Vault encryption + AI bypass mode (Issue #9)

#### Complexity: Low (~1–2 hours, documentation only)

---

## Issue #6 — NateB OpenBrain (What to Learn)

**Goal:** Study the reference implementation at `github.com/NateBJones-Projects/OB1` and document learnings.

### Implementation plan
1. **Create `docs/research/nateb-ob1-analysis.md`**
   - Document key architectural patterns from the OB1 project.
   - Identify features/patterns that could be adopted.
   - Note differences in approach.

2. **Create comparison table**
   - Feature parity matrix: what OB1 has vs what OpenBrain has.
   - Priority items to adopt.

#### Complexity: Low (~1–2 hours, research + documentation)

---

## Summary & Prioritization

| Priority | Issue | Title | Type | Complexity | Impact |
|----------|-------|-------|------|------------|--------|
| **P0** | #9 | Secrets AI Bypass | Feature | Low-Med | High (security) |
| **P0** | #10 | Smart Updates | Feature | Medium | High (UX) |
| **P1** | #8 (Phase 1) | Bulk File Import | Feature | Medium | High (onboarding) |
| **P1** | #7 | Finance Tracking | Feature | High | Medium (new module) |
| **P2** | #12 | Master Roadmap Docs | Docs | Low | Medium (foundation) |
| **P2** | #11 | AI Trends Research | Docs | Low | Low (internal) |
| **P2** | #6 | OB1 Analysis | Research | Low | Low (learning) |

### Recommended Sprint Order
1. **#9** (Secrets bypass) — Quick win, high security value, unblocks trust
2. **#10** (Smart updates) — Core UX improvement, builds on existing dupe detection
3. **#8 Phase 1** (Bulk import) — Speeds up onboarding significantly
4. **#7** (Finance) — New module, self-contained, can be built in parallel
5. **#12, #11, #6** (Docs/Research) — Can be done anytime, no code dependencies
