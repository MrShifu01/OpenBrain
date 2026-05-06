# Voice & tone

How we sound when we're writing — onboarding, error states, marketing copy, support emails, social posts. Match this and the product feels coherent. Drift from it and the product feels generic.

## Voice (the constant)

We are:

- **Plainspoken** — no enterprise-speak, no AI-hype words, no buzzwords. Say what's true in normal English.
- **Concrete** — examples beat abstractions. "Track your driver's license expiry" beats "manage important life dates."
- **Honest about limits** — if something doesn't work yet, say so. If we can't recover a passphrase, we say it can't be recovered. We don't soften with weasel words.
- **Calm** — never urgent for urgency's sake. No exclamation marks in normal copy. No FOMO. The user is in charge of their attention.
- **Warm but not cute** — friendly, not chirpy. We don't say "Whoops!" or "Oh no!" — we describe what happened and what to do.

We are NOT:

- **Cute / quirky** — no mascot voice, no jokes in error messages, no "Loading… [funny phrase]"
- **Salesy** — we don't sell against fear. We describe the product.
- **Apologetic by default** — "we're so sorry" everywhere reads as insincere. Reserve "sorry" for genuine failures.
- **Tech-y / buzzword-y** — never "AI-powered," "leveraging LLMs," "synergizing." Just say what it does.

## Tone (varies by context)

| Context | Tone | Example |
|---|---|---|
| First-run onboarding | Welcoming, direct, low-friction | "What's one thing you're afraid of forgetting? Tell Evara." |
| Empty states | Encouraging, practical | "No memories yet. Try pasting an email — Evara will sort it out." |
| Success confirmations | Quiet, factual | "Saved." (Not "Awesome! Memory saved!") |
| Error messages | Honest, actionable | "Couldn't reach the AI provider. Your memory is saved — we'll enrich it when the connection is back." |
| Critical errors | Calm, direct, no panic | "Something went wrong on our side. Try again in a minute, or email christian@…" |
| Pricing / upgrade nudges | Confident, no FOMO | "You've used your monthly captures. Pro removes the limit and adds X." (Not "Upgrade now to unlock unlimited!") |
| Support emails | Warm, specific, sign with first name | "Hi {name}, I've signed out every device on your account. Here's what's happened in the past 30 days: …" |
| Marketing / SEO | Plainspoken, evidence-based | "Evara remembers what you'd otherwise forget — license expiries, family birthdays, where you saved that policy PDF." |
| Social (X / LinkedIn) | Founder-voice, observational | First-person, honest about what's working and what isn't. No "🚀 Excited to share…" |

## Rules of thumb

- **Show, don't tell**. "Your private AI memory" works because we then show what a memory looks like. "The most powerful AI memory" is a claim with nothing behind it.
- **Cut filler words**. "Just," "really," "basically," "actually," "simply" — almost always deletable.
- **Lead with the verb, not the apology**. "Reset your password →" is better than "If you've forgotten your password, please click here to reset it."
- **Headlines: 6 words max**. Subheadlines: 12 max.
- **Use the user's words back**. If they said "stuff I forget," the homepage can say "the stuff you forget." Not "the items you may overlook."
- **No pluralized first-person**. We don't say "We here at Evara…" — we just say what the product does.
- **Plain numbers, not approximated marketing claims**. "Used by 1,200 people" beats "Used by thousands."

## Forbidden phrases

Never ship these:

- "AI-powered"
- "Game-changer"
- "Reimagining" / "redefining"
- "Best-in-class"
- "Seamless" / "frictionless"
- "Cutting-edge"
- "Revolutionize"
- "Empower" (in the sense of "empower users to…")
- "Unlock"
- "Effortless" (it's never effortless; saying so is gaslighting the user)
- "🚀" in marketing copy
- Any emoji in error messages

If a draft uses one of these, it's a sign the underlying claim isn't grounded.

## Example transformations

| Before | After |
|---|---|
| "🚀 Welcome to Evara! Your AI-powered memory companion!" | "Welcome. Capture your first memory →" |
| "Whoops! Something went wrong loading your data." | "Couldn't load your memories. Refresh, or email christian@…" |
| "We're so sorry, but we couldn't recover your passphrase." | "Vault content is encrypted with your passphrase. We don't store a copy. Without the passphrase or recovery key, the encrypted entries can't be recovered." |
| "Upgrade now to unlock unlimited captures!" | "You've used this month's captures. Pro removes the limit." |

## When in doubt

Read it aloud. If it sounds like an ad, rewrite. If it sounds like a person who'd help you, ship it.

## References

- `marketing/seo-marketing-playbook.md` — copy patterns for landing/SEO
- `Brand/assets.md` — what the brand looks like
- George Orwell, "Politics and the English Language" — the rules at the end
- The Economist style guide — for headline economy
