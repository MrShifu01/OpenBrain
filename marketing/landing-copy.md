# Everion — Landing Page Copy

*Drafted: 2026-04-29*
*Source: `.agents/product-marketing-context.md` V1.1*
*Target ICP: founders, knowledge workers, developers (in priority order)*
*Voice: quiet, literary, lowercase fragments OK, italics for emotion. Confident without being loud.*

---

## What changed from current Landing.tsx

- **Examples pivoted from novelist/poet → founder / KW / developer.** "What dad said at the kitchen table" became "what the customer said on Tuesday's call." Same emotional register, different ICP.
- **Sustainability framing softened.** No "always here", no "forever". Lean on present-tense value. ([context doc internal note: 2mo runway, no portability promise yet])
- **Privacy + BYO key bumped up.** Buried in subline currently. Promoted to differentiator copy.
- **CTA tightened.** "Start remembering" stays — it's good. Add specificity option for paid acquisition.

---

## Above the Fold

### Headline (3 options)

**A — Recommended (current, slight tweak):**
> your second memory,
> *quietly kept.*

*Why:* Already on the page. Works. Keeps brand consistency. Italic second line is signature.

**B — Sharper / more concrete:**
> the thoughts you wanted to keep,
> *finally findable.*

*Why:* Names the actual problem (lost thoughts). Promises retrieval. Less abstract than "second memory".

**C — Question-led, more punch for paid traffic:**
> where do your best ideas go?
> *here, now.*

*Why:* Hooks with the felt problem, lands on the resolution. More aggressive.

---

### Subheadline (2 options)

**A — Recommended:**
> A private room for notes, links, voice memos, and half-thoughts. Ask the AI anything — it actually reads them.

*Why:* Concrete (lists the input types), pays off the headline (the AI bit), lands on the differentiator (it actually reads them, vs. ChatGPT which doesn't have your stuff).

**B — Tighter, more poetic:**
> Capture in one tap. Recall by asking. Notice connections you didn't see coming.

*Why:* Mirrors the four pillars structure. Punchier. Less concrete but more rhythmic.

---

### Capture-bar ghost text (rotates, 4 phrases)

Current copy is novelist/poet. Replace with ICP-aligned phrases:

1. *"the thing the customer said on Tuesday's call I keep coming back to…"* (founder)
2. *"that decision we made about the API contract — and why…"* (developer)
3. *"the quote from the offsite that actually matters…"* (KW)
4. *"a half-formed idea for next quarter's pricing…"* (founder)

Keep one literary phrase as the fourth slot for tonal range — optional:

5. *"a line from the book I'll want again in six months…"* (universal)

---

### Primary CTA (2 options)

**A — Recommended (current):**
> Start remembering

*Why:* Already on the page. Metaphor matches the product. Memorable.

**B — Specific, better for paid:**
> Start free — no card

*Why:* Removes friction concern. Better for cold traffic that doesn't trust the brand yet.

---

### Trust line (under CTA, current is good — keep)

> nothing leaves your device until you say so · end-to-end encrypted vault

*Why:* Privacy is a top-3 differentiator for the new ICP. Keep it loud and early.

---

## "What it is" Section

### Eyebrow
> What Everion is

### Headline (2 options)

**A — Recommended (current, lightly tweaked):**
> It's the place where the thought goes —
> *and then stays findable.*

**B — More direct, ICP-aligned:**
> A catch-net for the thoughts your tools keep losing.

*Why for B:* Names the failure mode of current tools. Punchier for analytical buyers (KW, dev).

### Body (rewritten to land for new ICP)

> Not a to-do app. Not a wiki you have to maintain. Not another chat-with-your-docs.
>
> Everion is one opinionated surface for capture, one for asking, and one for the shape of what you know. No folders to choose. No template to fill. No "system" to maintain on Sundays.
>
> It treats your memory like a place — calm, private, yours — not a database.

*Why:* Names three competitor categories explicitly (todo apps, wikis, chatbots) so visitors slot it correctly. "No system to maintain on Sundays" is a direct shot at Notion/Obsidian abandonment, written in a way that lands without being mean.

---

## Four Pillars (rewritten — examples pivoted)

### 01 — Capture
**sub:** *lighter than opening a text box*

Tap once on desktop, thumb once on mobile. Text, voice, paste, file, photo. No title. No folder. No friction. Fast enough that you actually use it — which is the whole game.

### 02 — Recall
**sub:** *ask, don't search*

Chat with your memory. Everion reads your entries, cites sources, and answers in plain language. *"What did the Acme team push back on last quarter?"* works. So does *"that thing about Postgres connection pooling I saved somewhere."*

### 03 — Synthesize
**sub:** *connections you didn't see*

Three notes from three different weeks turn out to be about the same thing. Everion notices. Quiet nudge, not a daily report — surfaces the link when it matters, stays out of the way when it doesn't.

### 04 — The Shape
**sub:** *the night sky of your mind*

Every entry becomes a concept. Concepts become constellations. Pan around the idea-sky you've been making without meaning to. *(This is the one your competitors don't have.)*

*Why this works:* Each pillar now has at least one concrete ICP example. "Acme team" + "Postgres connection pooling" land for KW/dev/founder respectively. Pillar 04's parenthetical is a quiet competitive shot — earned, not boastful.

---

## Demo Section

### Eyebrow
> A demo — not a screenshot

### Headline (current is good — keep)
> Type a thought. Watch it find its place.

### Body (slight rewrite)
> The four scenarios below are real captures. Pick one to see what Everion saves and how it links to what's already in memory.

*Why:* Removes "This is real" (which raises the question). Replaces with a confident framing that explains the interaction.

### Demo scenarios (REPLACE all four)

The current demo has: friendship, travel, idea (novel chapter), link (longread). Pivot to ICP:

**1. Customer call (founder)**
- *Input:* "the head of ops at Northwind kept saying 'we just need it to not break during month-end' — that's the real pitch"
- *Inferred:* note
- *Concepts:* northwind, customer-insight, positioning
- *Related:* "Northwind discovery call notes — they care about reliability over features" — 12 days ago · sales, positioning

**2. Architecture decision (developer)**
- *Input:* "moving the embedding pipeline to a queue — direct calls were timing out at 8s with batches over 200"
- *Inferred:* note
- *Concepts:* embeddings, queue-architecture, performance
- *Related:* "Vercel function timeout limits — investigate streaming as alternative" — 6 days ago · infra

**3. Decision from offsite (KW)**
- *Input:* "team decided we're killing the legacy reporting view in Q3 even though three big customers still use it — exec call, not negotiable"
- *Inferred:* note
- *Concepts:* roadmap, q3-deprecation, exec-decision
- *Related:* "Customer impact list for legacy reporting — 3 enterprise accounts" — 2 weeks ago · planning

**4. Idea (universal)**
- *Input:* "what if the onboarding asks one question instead of seven — measure activation week over week"
- *Inferred:* idea
- *Concepts:* onboarding, activation, experiment
- *Related:* "Activation rate dropped 4% after we added the third onboarding step" — 18 days ago · metrics

*Footer caption (keep current):*
> scripted preview · sign up to try it on your own thoughts

---

## Pricing Section

### Eyebrow
> Pricing

### Headline (current is good — keep)
> Two tiers. Both honest.

### Hobby (free)

**Body:**
> The whole product. Forever. Bring your own AI key.

**Bullets:**
- Unlimited entries
- Local-first, works offline
- End-to-end encrypted vault
- Bring your own key (Anthropic, OpenAI, OpenRouter, Groq)

**CTA:** Start free

*Why this rewrite:* Current body says "Unlimited entries, local-first, encrypted vault, one brain, bring your own AI key" — flat list. New version leads with the radical promise ("the whole product, forever") and uses bullets for the spec. "BYO key" naming the providers makes the developer/founder ICP relax — they know what they're signing up for.

### Pro ($6/mo)

**Body:**
> For the people who actually live here. Hosted AI, sync, shared brains.

**Bullets:**
- Everything in Hobby
- Hosted AI — no key required
- Sync across devices
- Shared brains with one other person
- Export everything, anytime, in standard formats

**CTA:** Start 14-day trial

*Why:* Body line is current — keep it, it's strong. Final bullet adds the export commitment that the context doc flagged as missing — **only ship this bullet if the founder commits to building the export.** Without it, leave the current "Export anywhere, anytime" wording (vaguer, less binding).

---

## Final CTA Section (NEW — currently missing on landing)

The current page ends at pricing. Add a closing section before the footer to give one more conversion attempt.

### Eyebrow
> One more thing

### Headline
> Your thoughts deserve somewhere to go.

### Body
> Three taps from now you'll have captured the first one. A week from now you'll wonder where it used to live.

### CTA
> Start free

### Trust line below CTA
> end-to-end encrypted · works offline · bring your own AI key

*Why:* Recap the core promise without restating features. Future-pace ("a week from now") is a proven conversion pattern. Trust line under the CTA is the last thing they read before clicking — privacy + offline + BYO key triple-stacked answers the three biggest objections of the technical ICP.

---

## Footer (current is good — minor tweak)

Tagline currently: *"a room, not a tool."*

Keep. It's perfect for the brand. Don't change it.

---

## Meta Content

### Page title
> Everion — your second memory

*Why:* Lowercase second clause matches brand. Under 50 chars. Brand-name first for direct-search.

### Meta description (replace current)
> A private room for the thoughts you want to keep. Capture in one tap, recall by asking, notice connections you didn't see. Local-first, encrypted, works with your own AI key.

*Why:* Current is "Everion — your personal memory and knowledge OS. Capture, organise, and surface what matters." Vague — could be any tool. New version is specific (one tap, recall by asking), names the differentiators (local-first, encrypted, BYO key), under 160 chars.

### OG title
> Everion — your second memory, quietly kept.

### OG description
> A private room for notes, links, and half-thoughts. The AI actually reads them when you ask.

---

## Implementation notes

1. **Hero is the highest-leverage swap.** If you only change one thing, change the subheadline to specify input types (notes/links/voice memos/half-thoughts) and the AI differentiator (it actually reads them).
2. **Demo scenarios are the second-highest.** Current ones tell the visitor "this is for novelists." New ones tell founders/devs/KW "this is for me."
3. **Pricing rewrite is medium-leverage.** The current copy is fine; the rewrite is sharper but not urgent.
4. **Final CTA section is missing.** Currently the page ends at pricing → footer. Adding one more attempt at conversion is conservatively +5-15% on signups.
5. **Don't ship the export bullet on Pro until export actually exists.** Otherwise it's a promise you can't keep, which is worse than not saying it.

---

## Open questions for founder

1. Do you want to ship a real export feature so we can lean on the portability promise everywhere? (~1 day build, big trust unlock)
2. Should the headline pivot to B or C, or keep A? (A is safe + on-brand; C is sharper for paid acquisition — A/B if budget)
3. Comfortable with "shared brains with one other person" wording on Pro, or change?
4. Any logos / press / beta-user tags that can be stacked above the demo as social proof? (Currently zero proof on the page — biggest gap.)
