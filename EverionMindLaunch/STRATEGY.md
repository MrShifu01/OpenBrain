# Everion Mind — Strategic Blueprint

**Cleaned + consolidated 2026-04-30** from the original "OpenBrain" winning-strategy + product-spec docs (pre-rebrand). The frameworks held up; the product name and a few specifics evolved. This document is the durable strategic spine.

---

## Core positioning

**Everion Mind is your personal AI brain that remembers everything, thinks with you, and takes action.**

Not a chatbot. Not a notes app. **The OS layer for human intelligence.**

---

## MVP: the viral wedge

**Use case:** Never forget anything important — and act on it.

The five-step core experience:

1. **Capture** (text/voice/file/paste)
2. **Store** (semantic memory: vector + metadata)
3. **Connect** (context linking, auto-tags, persona facts)
4. **Recall** (ask anything in natural language, with citations)
5. **Act** (suggest + execute next-step actions)

---

## The "holy shit" moment

User asks:

> "What have I been doing wrong in my business?"

System:

- Finds patterns across captured entries
- Surfaces mistakes / repetitions / unfinished threads
- Suggests concrete actions

This is the demo that makes someone tell a friend.

---

## The retention loop

```
Capture → Memory → Insight → Action → Reward → Repeat
```

Every time a user captures, the system gets smarter. Every time they recall, they get reward (memory surfaced + insight). Every action they take, they feel ownership (IKEA effect). Reward closes the loop and pulls them back tomorrow.

If this loop breaks at any step, retention drops. Every roadmap decision should ask: **does this strengthen the loop or distract from it?**

---

## MVP feature scope

### Keep

- Single brain per user (multi-brain hidden behind paid-tier flag at launch)
- Memory store (vector + metadata)
- Ask your brain (RAG with citations)
- 3–5 actions:
  - Summarize
  - Suggest next steps
  - Create task
  - Remind later
  - Share insight
- Resurfacing insights (daily / weekly)

### Remove (or defer)

- Multi-agent configurations
- Over-engineering
- Excess abstraction
- Anything that increases setup time before first value

---

## UX principles

### Home = Brain Feed (not empty grid)

The home screen is **never empty**. It composes:

- Resurfaced thoughts (entries 1–6 months old, weighted by importance + tag recency)
- AI-generated insights ("You've mentioned X 5 times this month")
- Suggested actions ("Your supplier list is missing phone numbers — enrich?")

Variable composition per visit = variable reward = dopamine hook.

### Input = single conversation

> "Talk to your brain..."

One large textarea. No type selector at point of capture. AI categorizes after.

### Output = structured insight, not chat

Instead of a chat bubble, show:

- The insight (one sentence)
- Context (past memory references with click-through)
- Actions (buttons: capture this · remind me · share · create task)

### Navigation = 5 items max

`Feed | Capture | Ask | Memory | Settings`

Everything else lives inside one of these (Vault under Settings → Security; Todo as a Memory filter; Concept Graph as a 50+ entries unlock).

---

## Differentiation

1. **Persistence** — memory over time, not session-by-session
2. **Ownership** — user-owned brain, exportable, encryptable
3. **Action > chat** — the chat is the means, action is the end
4. **Local-first / privacy-first** — future regulatory advantage as AI policy tightens

---

## The moat

These are the durable advantages competitors can't quickly copy:

- **Long-term memory** — months/years of personal context they don't have
- **Behavioral insights** — pattern detection over your data, not generic
- **Action execution** — the "do" layer, not just the "know" layer
- **Identity attachment** — "this is my brain, not a tool I rent"

---

## Distribution strategy

### Build shareable outputs

Users don't invite friends to "a notes app." They share **insights that make them look smart.**

- **Insight cards** — "AI summary of my Q1" with brand mark; one-tap share to X, LinkedIn, WhatsApp
- **Weekly reports** — Sunday digest the user voluntarily forwards
- **Business analysis** — "I asked my brain what I'm doing wrong and..." → tweetable

Goal: every shared output is the message **"look what my brain just told me"** — implicit credit to the tool.

---

## Phase ladder

### Phase 1 — Single Brain

Nail the core loop. Single brain, single user. Everything in this doc lives here.

### Phase 2 — Brain Types

Pre-shaped templates: Founder Brain, Fitness Brain, Money Brain. Each comes with its own seed prompts + insight templates.

### Phase 3 — Multi-Brain

Brains collaborate. Shared brain with one other person (partner, business partner, co-founder). **Strongest viral mechanic** — only enable post-retention proof.

### Phase 4 — Brain Network

Share / sell / fork brains. Marketplace. Community brains. Out of scope for 2026; revisit only if community use case re-emerges.

---

## Technical direction

### Focus

- **Speed > perfection.** Sub-second perceived response on every interaction.
- **Simple architecture.** PostgreSQL + pgvector for memory; serverless functions for compute; one client app (PWA).

### Keep

- Vector memory (pgvector)
- Lightweight event system (no full event-sourcing — just hooks for cron + analytics)

### Avoid

- Premature scaling decisions
- Complex orchestration (multi-agent, agent-frameworks, workflow engines)
- Speculative database normalization

---

## Risks

| Risk                              | Mitigation                                                       |
| --------------------------------- | ---------------------------------------------------------------- |
| **No clear use case**             | The "brain that thinks with you" tagline is concrete + testable  |
| **Too complex**                   | Week 1 prune list explicitly hides multi-brain, vault, todo, graph from default nav |
| **No daily habit**                | Brain Feed + streak counter + weekly digest = three habit hooks |
| **Competing on features**         | Compete on outcomes (insight share rate, retention) not features |
| **AI model lock-in**              | BYOK from day one (Gemini default, OpenAI/Anthropic/Groq optional) |
| **Privacy backlash**              | E2EE vault + local-first + GDPR delete + transparent data policy |

---

## Content angles for launch

For Twitter, blog posts, demo videos, Product Hunt — these are the four narratives that resonate:

1. "My AI remembers everything I do" (memory angle — proves the moat)
2. "This AI called me out on my mistakes" (insight angle — the "holy shit" moment)
3. "I built a second brain" (ownership angle — IKEA effect, builder narrative)
4. "Look what my brain just told me" (sharing angle — viral mechanic in action)

---

## Viral mechanics

### Phase 1 — Shareable insight cards

OG-image-ready card: insight quote + brain logo + `everion.app` URL. One-tap share. **This is the organic acquisition engine.** Target metric: `share_click / insight_view` ≥ 5%.

### Phase 2 — Shared brains

One user invites 5 → each invites 3 → exponential. Only ships after single-brain retention proven (Day 7 retention ≥ 25%).

### Phase 3 — Referral program

$5 credit for referrer + referee on Starter upgrade. Only enable once organic share rate > 2%.

---

## Final strategy

Focus on:

- **One use case** (memory + recall + action)
- **One insane experience** (the holy-shit moment)
- **Daily usage loop** (Brain Feed + streak + weekly digest)

Ignore:

- Complexity
- Scaling too early
- Feature creep
- Competitor feature-matching

---

## End state

Everion Mind becomes:

> Your second brain that thinks, remembers, and acts.

For the entrepreneur. For the parent. For the developer. For the knowledge worker. For anyone who has ever been the person their family calls when nobody else can find the policy number.

**Privately. Encrypted. Yours.**

---

## Source documents

- `research/Openai_Gemini.md` — original "OpenBrain" winning-strategy blueprint (pre-rebrand, 2025–2026 era)
- `research/Openai_Gemini.md` — embedded "Full Product + UX + Launch Blueprint"
- AI-research extracts on second-brain MVP principles + capture-interface design (now consolidated into `RESEARCH.md`)

This document is the **strategic spine.** When in doubt about a feature, prune list, or messaging decision, return here. If a proposal doesn't strengthen positioning, the loop, the moat, or the viral mechanic — it doesn't ship.
