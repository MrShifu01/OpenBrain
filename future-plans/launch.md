# Launch Readiness Assessment: Everion vs. OpenBrain Research

**Date**: 2026-04-12  
**Honest Assessment**: You've built a solid technical foundation, but the product has drifted from its viral core into feature bloat. The MVP is survivable for launch, but will struggle to retain users without refocus.

---

## 🎯 The Gap: What the Research Said vs. What You Built

### Research Vision: "Personal AI that remembers everything, thinks with you, and takes action"

**Core loop prescribed:**
```
Capture → Store → Embed → Link → Retrieve → Analyze → Suggest → Act
```

**Emotional core:** "Get called out on your mistakes." The holy shit moment is when the brain surfaces patterns you've been blind to.

---

### What You Actually Built: A Capable But Unfocused Memory Tool

✅ **Things done right:**
- Semantic search via pgvector + embeddings (✓ correctly implemented)
- Multi-LLM support (Anthropic, OpenAI, OpenRouter, Groq)
- Offline-first architecture with sync
- Supabase auth + security headers
- Rate limiting + crypto vault for sensitive data
- Desktop + mobile UI with responsive design
- File parsing (PDF, Excel, Word docs)
- Voice recording support
- Auto-enrichment/gap-analyst cron job

❌ **Things that missed the vision:**
- **Multiple brains + sharing** — Research said "Single Brain MVP." You added team/org features. This adds auth complexity, permission bugs, support burden.
- **Graph view** (appears removed from git log) — Added then cut. Right call, but signals you weren't sure what the core was.
- **Vault/encryption** — Crypto is right for long-term trust, but MVP doesn't need it. Adds complexity, key management bugs, UX friction (passphrase recovery modals interrupt the flow).
- **Todo view** — Drift toward task management. Not the core promise.
- **Refine view** — What is this? The codebase suggests "auto-enrich sparse content" but it's unclear and not mentioned in the research.
- **Settings complexity** — Providers tab, brain tab, storage tab, notifications tab, danger tab. MVP should hide this.
- **No shareable outputs** — Research emphasized "Look what my brain just told me" cards and weekly reports for virality. You have none of this.
- **LLM selector in UI** — BYO keys are good, but should be hidden in advanced settings, not front-and-center.

---

## 📊 MVP Readiness Score: 6.5/10

### What's Blockers for Launch

| Issue | Severity | Fix Effort |
|-------|----------|-----------|
| **No clear "holy shit" demo** | CRITICAL | 1–2 weeks |
| **Onboarding doesn't explain value** | CRITICAL | 3–4 days |
| **Lack of shareable outputs** | HIGH | 1–2 weeks |
| **Crypto vault UX breaks flow** | MEDIUM | 3 days (or remove) |
| **Settings overwhelming for new users** | MEDIUM | 2 days |
| **Multi-brain complexity (if keeping)** | MEDIUM | Already built, but confuses focus |
| **No habit-forming daily loop** | HIGH | Requires design work |

### What's Actually Ship-Ready

✅ Capture (text + voice + files)  
✅ Semantic search + chat interface  
✅ Auth + offline sync  
✅ Core AI inference loop  
✅ Responsive UI  
❌ First-time user experience  
❌ Viability loop (why they come back)  
❌ Shareable moments (how they invite friends)  

---

## 🔴 Critical Feedback: What Needs to Change

### 1. **Define the One Insane Moment (MUST DO BEFORE LAUNCH)**

The research said: User asks "What have I been doing wrong in my business?" → System finds patterns → Suggests actions.

**You need a specific variant of this for launch.** Examples:
- *For founders*: "Show me the 3 business mistakes I keep repeating"
- *For engineers*: "What bugs do I keep making in the same files?"
- *For health*: "What habits are sabotaging my fitness?"

Pick ONE. Record a 60-second demo showing that moment. This is your marketing video and your onboarding hero.

**Why it matters:** Every user needs to understand in the first 30 seconds why Everion is different from Notion or ChatGPT. "Remember stuff and ask about it" is not different. "Get called out on your blind spots" is.

---

### 2. **Simplify Settings for MVP (SHOULD DO)**

**Current state:**
- ProvidersTab (select AI model)
- BrainTab (brain settings)
- StorageTab (Vault passphrase, recovery key)
- NotificationsTab
- AccountTab
- DangerTab (delete account, export data)

**For MVP, hide these defaults:**
- AI provider selection → Default to Anthropic, bury LLM chooser in "Advanced"
- Vault passphrase → Either auto-generate or hide until user explicitly wants security
- Storage/quota UI → Not ready
- Brain settings → Only show if multi-brain is enabled (which it shouldn't be for MVP)

**New user should see:**
1. Connect providers (optional)
2. Import data (optional)
3. That's it.

**Effort:** 2 days. **Impact:** Reduces onboarding cognitive load by 60%.

---

### 3. **Remove or Scope Multi-Brain Feature (SHOULD CONSIDER)**

**Current state:** Users can have multiple brains, share them, accept invites.

**Research guidance:** "Single Brain MVP. Multi-brain is Phase 2."

**Your options:**
- **Remove for MVP**: Delete multi-brain UI, return "one brain per user" model. Simplifies auth (no permission bugs), launch, support. Easy to add back post-launch.
- **Keep but hidden**: Keep the code, disable UI. Ship with single brain only, feature-flag multi-brain for beta testers.
- **Ship as-is**: Accept that this adds complexity, confusion, and support burden.

**Recommendation:** Remove. You can re-add in v1.1 with your first 100 paying users as beta. The cleanup effort (removing BrainSwitcher, CreateBrainModal, invite flow) is maybe 4–5 hours, but saves you from shipping a broken/confusing feature.

---

### 4. **Vault UX is Too Interruptive (SHOULD FIX)**

**Current state:** When user tries to chat with a locked vault, a modal pops up requiring passphrase or recovery key.

**Problem:** 
- Breaks conversational flow mid-query
- New users don't understand why
- Recovery key UI is complex (XXXXX-XXXXX format)
- Creates support burden ("I lost my recovery key")

**For MVP:**
- Don't enable vault by default
- If user wants it, build it post-signup (not in settings modal)
- Consider: "Is crypto vault really needed for MVP?" (Research says no, it's trust-building for year 2)

**If you ship it:**
- Test with 5 new users. Track: Do they understand the modal? Do they abandon?
- Have a clear "I forgot my recovery key" flow (send reset email, wipe encrypted data, re-prompt passphrase setup)

---

### 5. **Build the Habit Loop (CRITICAL FOR RETENTION)**

Research loop: `Capture → Memory → Insight → Action → Reward → Repeat`

**What you're missing:**
- **Home screen is empty** for new users (only shows example prompts). Needs a "Brain Feed" with:
  - Resurfaced memories (memories from 1–6 months ago, resurface 1–2 per day)
  - Insights (patterns detected by AI, e.g., "You mention customer churn 5 times this week")
  - Suggested actions (based on patterns, e.g., "Create a task: Review churn metrics")
  - Weekly/monthly digest card ("This week you captured 12 ideas, here's what stood out")

- **No reminder/notification loop** (you have NotificationsTab but no push notifications driving daily return)

- **No reward** for consistent capture (e.g., "7-day capture streak! 🔥")

**What to do:**
- Add a "Brain Feed" view showing resurfaced memories and AI-detected insights (Refine view may already be trying this?)
- Auto-generate a weekly email digest
- Add simple push notifications: "Remember this memory from 3 months ago?"
- Add a "streak" counter (days captured consecutively)

**Effort:** 2–3 weeks. **Impact:** Determines whether users open the app daily or forget about it in a week.

---

### 6. **Shareable Outputs (MVP NICE-TO-HAVE, POST-LAUNCH CRITICAL)**

Research said: "User shares an insight card → new users join."

**You have none of this.** For launch:
- Can ship without this (focus on core retention)
- But plan it for v1.1 (week 2 post-launch)

**What to build post-launch:**
- Insight card (image/share-ready): "I keep making this mistake: [pattern]"
- Weekly report PDF: Summary of captured ideas, insights, suggested actions
- One-click sharing to Twitter/X with pre-written copy

---

## 🟢 What You're Doing Right (Don't Break This)

1. **Smart stack:** Vite for speed, pgvector for semantic search, Vercel Functions for cheap scaling. All good.
2. **Offline + sync:** Enormous moat. Users trust you with data if it never leaves their device unless they want it to.
3. **BYO keys:** Right-hand-side UX for power users without scaring normal people.
4. **Responsive design:** Works beautifully on mobile + desktop. Most note apps suck on mobile.
5. **Auto-enrichment cron:** Smart play. Users don't even ask, insights appear.
6. **File parsing:** Uploads + parsing (PDF, Excel, Word) is a real value-add.
7. **Voice input:** Lowers friction to capture (some users will only use voice).

**Keep all of this. Don't remove. Just polish and simplify the layer on top.**

---

## 🚀 Pre-Launch Checklist (Next 2 Weeks)

### Week 1: Focus & Polish
- [ ] **Decide multi-brain fate.** Remove or hide. 4–5 hours.
- [ ] **Define the "holy shit" moment.** Write it down. Record a 60-sec demo. 2–3 days.
- [ ] **Simplify settings.** Hide non-essentials, label clearly. 2 days.
- [ ] **Fix Vault UX or remove.** Either full passphrase flow with recovery, or disable for MVP. 1 day.
- [ ] **Write onboarding copy.** First-time user sees: "Ask your brain anything. Find patterns you've been blind to. Get suggestions." 1 day.
- [ ] **Typecheck + lint.** Run `npm run typecheck`, fix any `// @ts-expect-error` comments. 1 day.

### Week 2: Launch Prep
- [ ] **Load test.** 100 concurrent users, can you handle it? (Vercel Functions should, but test anyway.)
- [ ] **UAT with 3 power users.** Have them spend 10 minutes. Ask: Does the value prop make sense? Where did you get confused?
- [ ] **Set up monitoring.** Sentry alerts, Vercel analytics, log any errors. 1 day.
- [ ] **Prepare landing page.** (Not in this repo, but: one-pager, Twitter link, email signup.)
- [ ] **Plan day-1 support.** Who responds to bugs? What's the escalation path?

---

## 📋 Post-Launch Roadmap (v1.1 → v2)

### v1.1 (Week 2–3 post-launch)
- Shareable insight cards (image generation, share-to-Twitter)
- Weekly email digest
- Push notifications (remind of old memories)
- Streak counter (days captured)

### v1.2 (Week 4–6)
- Re-enable multi-brain (with onboarding that explains it)
- Brain templates (e.g., "Founder Brain" with example capture structure)
- Import from Notion, Obsidian, Apple Notes

### v2 (Month 2–3)
- Community brains (marketplace, fork, remix)
- Collaborative brains (team access, shared insights)
- Advanced analysis (trends over time, predictive nudges)

---

## 💬 Honest Take: Should You Launch Now?

**Short answer:** Yes, but fix the three CRITICAL items first (holy shit demo, onboarding clarity, habit loop).

**Why launch despite feature creep:**
- You have a working semantic search + chat loop (the hard part).
- Users will tell you what matters (e.g., they might hate multi-brain, love voice input).
- Shipping is learning. You'll find retention bugs you can't spot now.
- Waiting for "perfect" means never launching.

**Why you're at risk:**
- If your first 100 users don't get the "call you out on mistakes" moment, they churn.
- If they get lost in settings/features, they churn.
- If they capture 10 notes and never come back, you learn nothing useful about fit.

**The ask:** Spend 5 days fixing clarity (onboarding, settings, one-moment focus). Then launch. Then iterate based on real usage.

---

## 🎬 Final Insight (From Research)

> "You are not building a chatbot. You are building the OS layer for human intelligence."

Your app is called Everion. Your code is called OpenBrain. Your research doc is called OpenBrain. Your UI has chats, vaults, todos, graphs, refine views.

**Pick a focus.** Everion should be known for one thing at launch. Not "everything." One. Thing.

**Suggestion:** Launch as "Everion — Your brain that never forgets and keeps you honest."

Then iterate toward the empire.

---

## 📞 Questions to Answer Before Shipping

1. **Who is the first user?** (e.g., "founder analyzing their business mistakes" or "student retaining lecture notes"?)
2. **What's the one thing they couldn't do before?** (e.g., "Find the 3 mistakes I keep repeating" or "Remember a conversation from 6 months ago and resurface it")
3. **How do you know it worked?** (e.g., "They ask their brain a hard question and get a surprising answer" or "They come back 5 days in a row")
4. **What will kill the product?** (e.g., "Users disable notifications because they're too spammy" or "Multi-brain permission bugs leak data between users")
5. **What's the riskiest technical assumption?** (e.g., "pgvector performance at scale" or "Offline sync reliability")

Answer these. Then ship.

---

## Summary

**MVP Readiness: 6.5/10**
- **Technical foundation:** 9/10 (solid)
- **Feature focus:** 4/10 (too much, unfocused)
- **UX clarity:** 5/10 (onboarding needs work)
- **Habit loop:** 3/10 (missing entirely)
- **Launch risk:** Medium (fixable in 1–2 weeks)

**To reach 8/10 (shippable):** Fix critical clarity issues, remove or hide multi-brain, define the moment, simplify settings. 

**Time to launch:** 2 weeks, 2 people, focused sprint.

Go.
