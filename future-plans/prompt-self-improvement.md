# Prompt Self-Improvement Strategy

## Layer 1: Manual data-driven improvements (do now)

The prompts are written by feel, not by evidence. Use existing signal to make data-driven edits:

- Pull low-rated chat responses (thumbs down) and identify which prompt instruction they violated
- Pull entries where AI chose `type: "note"` — these are classification failures (note is last resort)
- Look at entries where all `confidence` fields are `"ambiguous"` — the CAPTURE prompt is failing to extract structure
- Run `ENTRY_AUDIT` against your own brain and see what it flags — proxy for how much CAPTURE leaves on the table

This gives evidence-based edits instead of gut-feel edits. Highest ROI, do first.

---

## Layer 2: Per-user personalisation (build at ~50 active users)

Each user accumulates a small `user_prompt_context` blob appended to system prompts at inference time. Examples:
- "User prefers supplier entries to always include a price field"
- "User frequently types in Afrikaans — handle mixed-language input"
- "User tends to split contacts from companies — don't merge them"

**Mechanism:**
- A lightweight weekly job reads each user's correction patterns (thumbs down, manual edits, type overrides)
- Writes 3-5 preference sentences into a `user_preferences` DB field
- Injected as a `<user_preferences>` block in CAPTURE and CHAT system prompts

Infrastructure already exists — feedback is stored in the DB, the loop just isn't closed yet.

---

## Layer 3: Global self-improvement across all users (build at ~500 active users)

When many users correct the same type of mistake, that correction improves the base prompt for everyone.

**Mechanism:**
- Track correction patterns in aggregate (never individual data — pattern type only)
- e.g. "23 users reclassified `reminder` → `note` this month" → CAPTURE's reminder rules are too loose
- Weekly "prompt diff" job: take top 5 correction patterns, ask LLM to suggest a rule addition, human reviews and approves before merging

**Important:** Keep a human-in-the-loop review step — prevents prompt drift from edge cases.

---

## Order of operations

| Layer | When | Why |
|---|---|---|
| 1. Manual edits | Now | Highest ROI, uses existing signal |
| 2. Per-user personalisation | ~50 active users | Infra mostly ready, needs loop closed |
| 3. Global self-improvement | ~500 active users | Needs volume to distinguish signal from noise |

---

## Related files
- Prompts live in `src/config/prompts.ts` (client-side) and `api/_lib/prompts.ts` (server-side)
- Feedback signal is in the `feedback` DB table and `api/_lib/feedback.ts`
- Thumbs up/down UI is wired in `AskView.tsx` and `useChat.ts`
