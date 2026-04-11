# Future Plans — Community Brain & Finance Section

Two separate features, each shipped in versioned increments so nothing has to be built big-bang.

---

## Feature 1 — Community Brain

A public/shared brain that many users can read (and optionally contribute to). Think "Wikipedia for knowledge types Everion already handles" — suppliers, recipes, SOPs, local services, etc. Uses the same entry/link/RAG machinery as private brains.

### Why it exists

- Users with similar contexts (same city, same industry, same household type) duplicate the same entries — "good plumber in Cape Town", "load-shedding schedule", "best nappy brand". Community brains let one person capture once and everyone else reuse.
- Discoverability: new users land on an empty Everion and don't know what to capture. Community brain = instant content to browse and ask questions against.
- Network effect: the more people contribute, the more valuable each person's Everion becomes.

### Data model deltas

- `brains.visibility` — add `"community"` alongside existing `"private" | "family" | "business"`.
- `brains.join_mode` — `"open"` (anyone can join) / `"invite"` (token required) / `"approval"` (mod approves).
- `brain_members.role` — existing `owner | admin | member` + new `contributor` (can add entries, can't edit others') and `reader` (read-only).
- `entries.community_score` — upvotes minus downvotes. Drives ranking in community browse.
- New table `entry_votes {user_id, entry_id, vote: -1 | 1}` — idempotent upsert.
- New table `entry_flags {user_id, entry_id, reason, created_at}` — for moderation.

### Versions

#### v0.1 — Read-only community brain (1 sprint)

- One hard-coded "Everion Community" brain that every user auto-joins as reader.
- Seed it manually with ~200 example entries across types.
- Shows up in brain switcher with a globe icon.
- User can browse, search, ask it questions via existing `api/chat.ts` — no new backend work, just RLS change to allow `visibility = 'community'` reads for any authenticated user.
- Capture is disabled — entries are added server-side only.

**Scope:** RLS policy change, seed data, brain-switcher UI badge. Nothing else.

#### v0.2 — User-created community brains (1 sprint)

- Settings → Brains → "Create community brain" option (alongside family/business).
- Creator is owner, gets `join_mode = "open"` by default.
- Invite-by-link already exists for private brains — reuse that flow, no changes needed.
- Community brains listed in a new "Discover" tab showing `visibility = 'community' AND join_mode = 'open'`.

#### v0.3 — Contributions + voting (1 sprint)

- Members with `contributor` role can add entries to a community brain.
- Up/down vote buttons on community entries → drive `community_score`.
- Sort community brain by `community_score DESC` for browsing.
- User's own entry still editable; others' entries read-only unless moderator.

#### v0.4 — Moderation (1 sprint)

- Report button on every community entry → writes `entry_flags`.
- Owner/admin moderation view: queue of flagged entries, accept/reject, auto-hide at N flags.
- Rate-limit contributions per user per day to stop spam.
- Block list per brain (owner-controlled).

#### v0.5 — Forks + local overlays (nice-to-have)

- "Fork to my brain" button on community entries → copies into user's private brain, edits don't propagate back.
- Local overlay: user can "hide" community entries they don't want cluttering their search results.

### Privacy & security

- Vault entries are **never** allowed in community brains. DB constraint: `CHECK (NOT (encrypted AND visibility = 'community'))`.
- PII scrubbing before publish: reuse existing `PHONE_FOUND` / `EMAIL_FOUND` detectors — warn user on publish if matches found.
- Per-user mute: community entries that contain blocked keywords don't appear in that user's searches.

---

## Feature 2 — Finance Section

A dedicated space for budgets, salaries, expenses, subscriptions, debts, and goals — fully searchable and chattable via the existing RAG pipeline. Everion already handles receipts and bank-related entries; this turns loose entries into a real personal finance brain.

### Why it exists

- Users already capture receipts / invoices / subscription reminders as ad-hoc entries. There's no structure, no totals, no budget view.
- "How much did I spend on groceries last month?" is exactly the kind of question RAG+semantic search can answer perfectly once data is structured.
- Biggest unlock for daily-active usage: money is emotional and people check it often.

### Data model

New canonical type **`finance`** joins the existing `CANONICAL_TYPES`. Entries of type `finance` have richer structured metadata:

```ts
interface FinanceMeta {
  kind: "income" | "expense" | "subscription" | "debt" | "asset" | "goal" | "budget";
  amount: number;            // always positive; sign derived from kind
  currency: string;          // ISO 4217, e.g. "ZAR"
  date: string;              // ISO date
  recurrence?: "once" | "weekly" | "monthly" | "yearly";
  category?: string;         // groceries, rent, salary, subscriptions, etc.
  account?: string;          // e.g. "FNB cheque"
  counterparty?: string;     // who paid / was paid
  budget_id?: string;        // optional link to a budget entry
}
```

Uses the existing `metadata` jsonb column — no schema migration beyond adding the type to the enum + a few indexes on `(metadata->>'kind')` and `(metadata->>'date')`.

### Versions

#### v0.1 — Finance entries as a type (1 sprint)

- Add `finance` to `CANONICAL_TYPES`.
- CaptureSheet recognises finance-shaped text ("spent R450 on groceries at Checkers") and offers the finance type with parsed amount/date/category.
- New small icon + color for finance entries in the grid.
- Everything else just works — search, RAG chat, links all flow through the existing pipeline.

**Scope:** enum add, parser prompt update, icon, category seed list. No new view.

#### v0.2 — Finance dashboard view (1 sprint)

- New view `finance` in bottom nav / more menu.
- Top cards: **This month** income, expenses, net, savings rate.
- Transactions list grouped by category.
- Simple line chart (net worth over time), simple donut (spending by category).
- All computed client-side from entries — no server aggregation yet.

#### v0.3 — Budgets (1 sprint)

- Budget entry type = `finance` with `kind: "budget"` and `metadata.category` + `metadata.amount` (monthly limit).
- Progress bars on dashboard: "Groceries R1800 / R2500 (72%)".
- Warning when category exceeds 90% of budget. Red when over.
- Rollover option: unused budget carries to next month.

#### v0.4 — RAG-aware finance chat (1 sprint)

- `api/chat.ts` already handles any entry type. But finance questions need **computation**, not retrieval — "how much did I spend" needs SUM, not similarity search.
- Add a **finance tool** to the chat pipeline: when the query is finance-intent (classified by a cheap LLM call), run a structured query over the user's finance entries before asking the LLM to respond.
- Tool schema:
  ```ts
  type FinanceQuery = {
    kind?: FinanceMeta["kind"] | "all";
    category?: string;
    from?: string; to?: string;
    group_by?: "category" | "month" | "counterparty";
    agg?: "sum" | "count" | "avg";
  };
  ```
- Execute client-side (data is already in memory) or server-side via Supabase RPC — either works.
- Return both the raw number and a natural-language answer.

Example: "How much did I spend on food last month?" →
1. Intent classifier → finance query
2. Run `{kind:"expense", category:"groceries", from:"2026-03-01", to:"2026-03-31", agg:"sum"}`
3. Get `R4,280.50`
4. LLM response: "You spent **R4,280.50** on groceries in March — that's R680 under your R4,960 budget."

#### v0.5 — Recurring income/expense auto-generation (1 sprint)

- When user captures a monthly salary, rent, subscription — Everion auto-creates the next N occurrences as ghost entries.
- Ghost entries upgrade to real ones when the date arrives (or user confirms "yes, I did pay").
- Missed recurring expense → shows up as a reminder in Improve Brain view.

#### v0.6 — Goals & projections (nice-to-have)

- Goal entries: "Save R50k for Japan trip by Dec 2026".
- Dashboard shows progress + projected completion based on recent savings rate.
- Chat: "Will I hit my Japan savings goal?" → RAG + math tool answers.

#### v0.7 — Import (nice-to-have)

- CSV/OFX bank statement import → parses each line as a finance entry.
- Dedupe by `(date, amount, counterparty)`.
- Not a priority — manual capture is already fast and the app is capture-first, not import-first.

### Privacy & Vault integration

- Finance entries carry real money data — many users will want them **encrypted at rest**.
- Offer per-entry "Put in Vault" toggle in CaptureSheet for finance entries. Encrypted finance entries flow through the existing Vault pipeline, which means they **won't appear in RAG chat** unless the user unlocks the vault first (already existing behavior via `secrets[]` in `api/chat.ts`).
- Default: **not** encrypted. Most users want totals/charts and encrypting every entry makes the dashboard useless. Let power users opt in per entry.

### Shared AI key gotcha

- The finance chat tool uses the same provider/model the user has configured globally — no new API key needed.
- Tool-calling requires Anthropic/OpenAI — OpenRouter fallback can do it too. Gemini native API doesn't support tools the same way, so finance-intent questions through Gemini should fall back to retrieval-only (still useful: "show me last month's grocery receipts" works via semantic search alone).

---

## Cross-feature: community finance brain

Once both features exist, a natural extension: **community finance brains**. E.g. a shared "ZA Household Budgets" community brain where contributors share anonymized budget templates, category benchmarks ("average monthly groceries for family of 4 in Cape Town = R6200"), and saving hacks. Treat as v1.0 stretch goal, not a launch feature.

---

## Shipping order

Do not build both at once. Recommended order:

1. **Finance v0.1** (finance entry type) — highest daily-use impact, smallest surface, lives inside existing screens.
2. **Community Brain v0.1** (read-only seed) — cheapest path to a community brain visible to every user, zero moderation load.
3. **Finance v0.2–v0.3** (dashboard + budgets) — turns finance entries into a real tool, drives retention.
4. **Finance v0.4** (RAG-aware chat) — the "wow" demo. Only possible after v0.1–v0.3 because the data has to exist first.
5. **Community Brain v0.2–v0.3** (user-created + voting) — only once the read-only version proves the concept.
6. **Finance v0.5+** and **Community v0.4+** — opportunistic once the base is stable.

Each version is one sprint or less. No single step blocks the others — if Finance stalls, Community can still ship, and vice versa.
