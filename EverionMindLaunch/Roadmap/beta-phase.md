# Beta phase ops — what you actually do days 30-60

**Window: Sat 2026-05-30 (closed beta launch) → Mon 2026-07-01 (public PH launch).**
**Posture: gather retention data, iterate on the leakiest funnel step, build the public-launch waitlist, and don't ship features that aren't pulled by user behavior.**

This is the operational playbook for the 30 days between closed beta and public launch. The schedule (`2026-05-01-30-day-launch-schedule.md`) sets the macro arc; this doc is the daily/weekly cadence that fills it.

---

## The single rule

> Days 30-60: you are not a product builder. You are a retention investigator.

If Day-7 retention from the closed beta is < 25%, **stop shipping features.** Use every day to fix the funnel step where users drop off. The PH launch on day 60 only matters if day-7 retention is decent — top-of-funnel without retention is a vanity-metric trap.

If Day-7 retention is ≥ 35%, you've earned the right to ship Brain Feed v1 and iOS prep. If it's between 25-35%, ship one thing: the polish item that the funnel data points at most clearly.

---

## Daily rhythm (Mon-Fri)

| Time (PST) | Block | Output |
| ---------- | ----- | ------ |
| 08:00–08:30 | **PostHog walk** | Open the funnel, write down the worst-performing step compared to yesterday. One sentence in `Working/beta-daily-log.md`. |
| 08:30–09:00 | **Sentry + Vercel scan** | Any new errors? Any function timeouts? Triage by impact (paying users > free users > anonymous). Add to `Audits/` if something needs deeper work. |
| 09:00–09:30 | **Twitter daily build-in-public** | One tweet. Either: a metric (`day 33: 67 beta users, 41% Day-1 capture, here's what's interesting`), a small ship (`shipped streak counter today, 3 lines of date math caused 2 hours of debugging`), or a question (`for those of you who've been in the beta — does the resurfaced memory feel like nostalgia or noise?`). |
| 09:30–13:00 | **Build block** | Whatever the funnel data says. If retention is the issue, polish onboarding/feed. If onboarding is the issue, polish the question phrasing. If feed is the issue, change which surfaces show. |
| 13:00–14:00 | **Lunch + walk** | Off the screen. The brain solves problems while you're not looking at them. |
| 14:00–17:00 | **Build block 2** | Continue the morning's work. **No new tasks introduced today** — finish what you started this morning. |
| 17:00–17:30 | **Beta inbox triage** | Read every beta-feedback email. Reply to every one (3-5 minutes each). Tag in your tracker. |
| 17:30–18:00 | **Tomorrow's plan** | Write the first task for tomorrow. Pre-deciding kills the morning friction. |

**Saturdays (4-6h):**
- 09:00–11:00 — Beta retention review (see weekly cadence below).
- 11:00–14:00 — Catch up on hunter outreach + PH "upcoming" page traffic.
- 14:00–16:00 — One polish ship that's been on the list.

**Sundays:** off. Real off. Phone in another room. Restoration is a launch input.

---

## Weekly cadence

### Monday morning — retention review (90 min)

This is the most important meeting of the week. You're meeting yourself.

1. **Pull cohort numbers from PostHog:**
   - Day-1 retention: of users who signed up last week, % who came back the next day
   - Day-7 retention: of users who signed up 7+ days ago, % who came back on day 7
   - Activation rate: % of signups who fired `first_insight_viewed`
2. **Plot vs the previous week.** Is it up, flat, down?
3. **For the worst-performing metric, ask: "what changed?"**
   - If you shipped a polish last week, did it help or hurt?
   - If retention is flat, what's the bottleneck — discovery, activation, or stickiness?
4. **Pick ONE number to improve this week.** Write it on a sticky note. Tape it to the monitor.

If you do nothing else weekly, do this. Solo founders die from drift; the Monday review is the anchor.

### Wednesday afternoon — hunter outreach push

If a Product Hunt hunter hasn't been booked yet:
- Send 2 fresh DMs from `EML/marketing/ProductHunt/hunter-outreach.md` candidate list
- Reply to any DMs from the previous Wednesday's batch
- Update the tracker table in that doc

If a hunter is booked, this slot becomes "PH 'upcoming' page traffic push" — one tweet, one Indie Hackers post, one DM to a friend asking them to tell one friend.

### Friday morning — week-in-review tweet/digest

A weekly thread or LinkedIn post documenting:
- One number from PostHog (signups, retention, %)
- One thing that surprised you
- One thing you shipped
- One question for the audience

This is the highest-leverage marketing motion of the beta phase. People follow for the build-in-public arc. Don't skip it.

### Saturday morning — beta cohort calls (optional but high-leverage)

Schedule 2-3 30-min calls with active beta users. **Don't ask "what features do you want?"** — that's a feature-request feedback loop nobody learns from.

Ask:
- "Walk me through the last time you used the app. What were you trying to do?"
- "What did you do RIGHT BEFORE opening Everion?" (Reveals the trigger.)
- "What did you do RIGHT AFTER closing it?" (Reveals whether it produced value.)

3 calls per week × 4 weeks = 12 conversations. That's enough qualitative data to spot the pattern.

---

## Beta-cohort hygiene

### Onboarding 50-100 users to the closed beta

- 30-50 from your existing waitlist (Twitter, weekly digest readers)
- 20-30 from cold outreach to specific personas (founders, PMs, engineers building productivity products)
- 0-20 from random strangers (do NOT inflate beta numbers with random signups; you want signal, not noise)

For each invited user:
- Send a personalized email — "You've been waiting; here's the link. I'd love a 30-min call when you've used it 3 times."
- Track: invited_at, joined_at, first_capture_at, calls_done.
- Spreadsheet (Google Sheets) is fine. No CRM. The whole list fits on one screen.

### Beta-user feedback queue

Single source of truth: a Notion doc OR a Markdown file in `EML/Working/beta-feedback.md`. Whichever. Don't run two.

For each piece of feedback:
- Date received
- User
- Verbatim quote
- Tag (bug | feature-req | confusion | praise | rant)
- Action: shipped | rejected | parked | next-week

Bugs ship same day. Confusions get a polish in the same week. Feature requests get parked unless 3+ users ask for the same one within 7 days. Rants get a thank-you reply and quiet curiosity about whether they're early signal.

### When to invite the next batch

- When the existing 50-100 hit Day-7 retention >= 25%, invite another 50.
- If they don't, invite zero. Fix the leak first.

---

## Build-vs-fix decision tree

```
Look at PostHog this morning.
│
├─ Day-7 retention < 25%?
│   ├─ Onboarding step has the worst drop?  → polish onboarding copy/timing/example chips
│   ├─ first_capture → first_chat drops?    → make the chat surface easier to find on first visit
│   ├─ first_chat → day_7_return drops?     → push notifications? digest emails? streak nudges?
│   └─ Activation (first_insight_viewed) low? → enrichment is too slow / not surfacing
│
├─ Day-7 retention >= 25%, < 35%?
│   ├─ Highest-friction surface from beta calls? → polish that
│   └─ One feature pulled by 3+ users this week? → ship if it's < 1-day work
│
└─ Day-7 retention >= 35%?
    ├─ Brain Feed v1 (full version)
    ├─ iOS App Store submission prep
    └─ PH "upcoming" page promotion
```

---

## Hard tripwires during the beta phase

| Trigger | Decision |
| ------- | -------- |
| Day-7 retention < 15% by day 45 | Push public launch from day 60 to day 75. Don't launch with leaky retention. |
| Sentry shows P0 error rate > 0.5% of sessions | Stop all feature work. Fix only. |
| Vercel function timeouts > 5/day | Investigate /api/llm.ts maxDuration usage; LemonSqueezy may need its own timeout config |
| Hunter ghosts on day 50 | Self-hunt with the variant maker comment. PH community respects honesty more than a fake hunter |
| Beta-user complaint pattern: "I forgot it existed" | This is a notifications problem AND a streak/feed problem. Ship streak grace-period rethink + a daily reminder push (with opt-in) |
| You're under 6h sleep for 3 nights running | Stop. Take Saturday off. The product launch quality scales with founder sharpness, not founder hours |

---

## Daily log template

Save in `EverionMindLaunch/Working/beta-daily-log.md`. Append-only. One entry per day:

```md
## YYYY-MM-DD (day NN of arc)

**Funnel headline:** Day-7 retention = XX% (was YY% yesterday).

**Worst step:** signup → first_capture (XX% → YY%).

**Cause hypothesis:** users on Android may be hitting a slow first-paint due to ... (or whatever).

**Action today:** ...

**What surprised me:** ...

**Beta-call notes (if any):** ...

**Tomorrow:** ...
```

Append, don't edit. Rolling log = post-launch goldmine for the day-7 retro tweet.

---

## What NOT to do during the beta phase

- ❌ Add features just because a beta user asked. Wait for 3+ to ask, OR for the funnel to point at the same gap.
- ❌ Refactor the codebase. Every refactor in this window costs a feature you could have shipped instead.
- ❌ Add new dependencies. Every new library is another vector for a launch-day surprise.
- ❌ Public-tweet doom posts. The world doesn't need your "this is hard" thread; it needs the metric thread.
- ❌ Compare yourself to other PH launches mid-week. Sunday is fine, Wednesday is corrosive.
- ❌ Skip the Saturday off. The build-in-public arc requires you to still be standing on day 60.

---

## Verification at end of beta phase (day 59 — Sun 2026-06-30, eve of public launch)

You should have:

- [ ] 50-100 closed beta users with measured cohort retention
- [ ] Day-7 retention >= 25% across the cohort (or a 2-week-old fix that you believe moves it)
- [ ] PH hunter confirmed for Mon 00:01 PST OR self-hunt plan locked in
- [ ] PH "upcoming" page with 200+ "Notify me" signups
- [ ] iOS submitted to App Store (likely "in review" — that's fine for day 60)
- [ ] 5 weekly digest tweets out the door, building the launch-day audience
- [ ] One blog post (`/blog/the-60-days`) drafted — this becomes the maker comment + the HN post
- [ ] At least 12 beta-call conversations done, qualitative themes documented

If you have all of these, day 60 is a momentum launch, not a hope-and-pray launch.
