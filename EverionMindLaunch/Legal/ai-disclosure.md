# AI provider data disclosure

What this app sends to AI vendors, what they retain, and what you (the user) get to control.

> **Why this exists**: users will ask. Regulators (GDPR, POPIA) are starting to require this in plain language. Privacy policy stays generic; this doc is the source of truth for "what specifically does my data go through?"

## TL;DR

- **Default provider**: Google Gemini (free tier on launch, paid via Google Cloud later).
- **What we send**: chat messages, entry text being enriched, embedding inputs.
- **What we don't send**: encrypted vault content (ever), raw OAuth tokens, other users' data.
- **Retention**: per Google's API ToS — "not used to improve products" for the standard API. We do not opt in to any training data programs.
- **User control**: opt out of enrichment entirely (Settings → AI → Personalisation toggle); BYOK any of Gemini / OpenAI / Anthropic / OpenRouter; bring own key on Pro/Max tiers.

## Per-provider detail

### Gemini (Google AI) — primary provider

**What we use it for**:
1. Chat completions (`gemini-2.5-flash` / `gemini-2.5-pro` per tier)
2. Embeddings (`gemini-embedding-001`, 768d) for semantic search
3. Persona fact extraction (`gemini-2.0-flash` for cost)
4. Structured-output parsing during enrichment (parse / insight / concepts steps)

**What we send**:
- Chat: the user's question + retrieved context (their own entries) + system preamble (their persona core in personal brain only — see `architecture/security.md` § "persona context leak fix")
- Enrichment: each entry's title + content + tags + type
- Embeddings: each entry's title + content joined as text
- Persona extractor: entry text + identity context (full_name, preferred_name, family) so the model knows whose facts these are

**What we don't send**:
- `vault_entries.content` / `vault_entries.metadata` — these are AES-256-GCM encrypted client-side; we have ciphertext only
- Other users' entries (RLS-enforced retrieval)
- Raw passphrases, recovery keys, OAuth refresh tokens

**Retention by Google**:
- Standard Gemini API: **no input/output retention beyond 24h for abuse monitoring**, no training use. Source: <https://ai.google.dev/gemini-api/terms#data-use-paid>.
- We do NOT use Vertex AI's enterprise data residency program (would be needed for paying enterprise customers).

### OpenAI — opt-in only (BYOK)

User can paste their own OpenAI API key in Settings → AI → BYOK. From that point:
- Their chat + enrichment route to OpenAI instead of Gemini.
- Embedding routes to `text-embedding-3-small` (768d, dimensions param).
- We pay nothing; user is billed by OpenAI directly.

OpenAI ToS: <https://openai.com/policies/api-data-usage-policies> — "API data not used to train models" by default.

### Anthropic — opt-in only (BYOK)

Same shape as OpenAI. Anthropic ToS: <https://www.anthropic.com/legal/commercial-terms>.

### OpenRouter — opt-in only (BYOK)

Same shape. Routing layer over many providers. User picks which model in Settings → AI.

### Groq — fallback experimental

`GROQ_API_KEY` env var; not in regular request flow today. Held for fast-fallback if Gemini regional outages spike.

## What's never sent to any AI

- **Vault content**: encrypted client-side before it leaves the browser. Server stores ciphertext only.
- **OAuth refresh tokens**: encrypted at rest with `OAUTH_TOKEN_ENCRYPTION_KEY` / `GMAIL_TOKEN_ENCRYPTION_KEY`. Decrypted briefly server-side to perform Gmail / calendar reads, then dropped.
- **Other users' data**: RLS prevents the retrieval step from pulling rows owned by other users. The AI provider only sees what `match_entries_for_user` returned.
- **PII not in entry content**: the raw `auth.users` row is never serialised to AI. Only the persona surface (preferred_name, pronouns, optionally family/habits/About-Me — and only in the user's own personal brain) joins the prompt.

## Persona-context leak fix (2026-05-04)

Earlier, the persona core (full_name, family, habits, About-Me text) was injected into chat in **every** brain regardless of who owned it. That meant your personal identity surface bled into family / business / shared brain chat scope. Fixed in commit `33b08ff`:

- Personal brain: full persona core injected (you're talking about yourself in your own scope)
- Any shared brain: only `preferred_name` + `pronouns` survive, so the assistant can greet you correctly but no global identity surface flows
- Persona facts (`type='persona'` entries) stay brain-scoped via the `brain_id=eq.X` filter

Source: `api/_lib/buildProfilePreamble.ts:brainIsOwnerPersonal`.

## User controls

| Control | Where | Effect |
|---|---|---|
| Enrichment off | Settings → AI → Personalisation toggle | New entries skip parse/insight/concepts/persona/embed. Searchable via FTS only. |
| Provider switch | Settings → AI → Provider | BYOK key replaces managed Gemini for chat + enrichment. |
| Embedding off | (TODO — not yet shipped) | Vector search disabled, FTS only. |
| Vault | Vault tab | Anything stored there is end-to-end encrypted; never seen by us or any AI provider. |
| Account delete | Settings → Account → Delete | Cascade purges every user-owned table. See `Support/account-recovery.md`. |

## Compliance notes

- **POPIA (South Africa)** — we're a South African operator; data subjects have right to access, correct, delete. Account-delete flow handles all three.
- **GDPR (EU)** — same set of rights. Account-delete + audit-log access satisfies them.
- **AI Act (EU, 2026)** — this is a "general-purpose AI integrated app." Disclosure of AI use is required; we surface it in the privacy page + inline next to AI features (the "P/I/C/E" enrichment chips, the chat-disclaimer in ChatView).

## Audit cadence

Re-read this doc every 6 months OR when any of the following changes:
- Default provider switches (Gemini → other)
- New provider added to BYOK list
- Privacy policy revision
- Vendor ToS update affecting retention or training use

Last reviewed: 2026-05-04.
