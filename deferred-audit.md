# Finish Deferred Audit Items — EverionMind

You're picking up from audit pass 9 (2026-04-23) in `C:\Users\Administrator\Desktop\SmashBurgerBar\Business Systems\WebApp\EverionMind`. The fix sweep already landed all HIGH/MEDIUM/LOW findings. Four items were deferred because each needs its own careful pass. Do them in the order below. **Read `.smashOS/memory/decisions.md` first** — the top entry (`[IMPROVEMENT] Pass 9 fix sweep — 2026-04-23`) has the full context and what's already been done.

**Running rules:**
- Project CLAUDE.md applies: surgical changes, no speculative abstractions, minimum code to solve the problem.
- After each item below, run the full gauntlet: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build && npm audit --audit-level=high`. All must stay green. Commit after each item with a clear message; push to `main` (per memory: no branches/PRs unless asked).
- If an item turns out to be bigger than expected, STOP and report back rather than half-finishing.

---

## Item 1 — Tighten `verifyAuth` return type (foundation for item 2 + 3)

**Why first:** 332 `: any` usages are concentrated in the API layer because `api/_lib/verifyAuth.ts` returns `Promise<any>`. Fix the root, the `user: any` call sites collapse automatically.

**Do:**
1. Read `api/_lib/verifyAuth.ts`. Change the return type from `Promise<any>` to `Promise<AuthedUser | null>` where `AuthedUser` is the shape Supabase's `/auth/v1/user` returns. Match the shape already declared in `api/_lib/withAuth.ts:15` (`{ id: string; [key: string]: unknown }`) — extend it with the fields actually read at call sites (likely `email`, `user_metadata`, `aud`, `role`).
2. Run `grep -rn "user: any = await verifyAuth\|user: any\b.*verifyAuth" api/` to find every call site. Replace `user: any` with the new type. For fields accessed via `user.user_metadata`, narrow properly (don't re-cast to `any`).
3. `npm run typecheck` — fix any newly-surfaced type errors at the narrowest point possible. Don't suppress with `any`.
4. Count `: any` occurrences before and after with `grep -rE ": any\b" src/ api/ --include="*.ts" --include="*.tsx" | wc -l`. Expect ~50-80 of the 332 to drop.

**Scope discipline:** only touch API-layer `: any` that trace to `verifyAuth`. Leave the Supabase-JSON `: any` in the DB response handling alone — that's a separate pass.

---

## Item 2 — Migrate raw `verifyAuth` endpoints to `withAuth`

**Why:** 11 endpoints still use the pre-middleware pattern. Inconsistent, duplicates rate-limit + method-gate + header logic, and pass-9's audit flagged it as MEDIUM.

**The 11 endpoints (from pass-9 audit):**
- `api/user-data.ts` — 9 handlers routed via `?resource=`
- `api/llm.ts:417`
- `api/gmail.ts:166, 180`
- `api/calendar.ts:150, 239`
- `api/memory-api.ts:33`

**Design decision needed first:** `api/user-data.ts` is a dispatcher — one file with a switch on `?resource=`. Two options:
- **(A) Wrap the top-level dispatcher** in `withAuth` → all resources share one rate-limit bucket.
- **(B) Leave the dispatcher, inline `withAuth`-equivalent** at each sub-handler → preserves per-resource rate limits.

Pick (A) if all resources currently use the same rate-limit value; (B) if they differ. Check the current rate-limit calls in each handler before choosing. **State your choice and why before migrating.**

**Do:**
1. For each of the 4 simpler endpoints (`llm.ts`, `gmail.ts`, `calendar.ts`, `memory-api.ts`): wrap in `withAuth` following the pattern in `api/capture.ts:20`, `api/entries.ts:19`, `api/search.ts:23`, `api/transfer.ts:14`. Preserve existing method gates and rate-limit values.
2. For `user-data.ts`: apply the chosen design. Keep behavior identical — same status codes, same response shapes, same rate-limit budgets.
3. Run the API test suite specifically: `npx vitest run tests/api/`. Fix any breakage.
4. Full gauntlet green.

**Do not:** change response shapes, add new auth logic, or "improve" the dispatcher structure beyond the middleware swap.

---

## Item 3 — God-component decomposition

**Why:** 8 files >900 lines. Biggest re-render units in the app, hardest to reason about, highest regression risk on changes.

**The list (from pass-9 audit, line counts may have shifted slightly):**
- `src/Everion.tsx` (~1,262)
- `src/views/TodoView.tsx` (~1,121)
- `src/components/CaptureSheet.tsx` (~1,064 — note: `VoiceWaveform` already extracted in pass 9)
- `src/LoginScreen.tsx` (~1,017)
- `src/views/VaultView.tsx` (~990)
- `src/views/Landing.tsx` (~986)
- `src/views/DetailModal.tsx` (~982)
- `src/views/ChatView.tsx` (~949)

**Don't decompose all 8 in one session.** Pick the top 2 by impact: `Everion.tsx` and `TodoView.tsx`. For each:

1. Read the whole file. Identify natural seams — renderable sub-sections, distinct state clusters, effects that don't share dependencies with others.
2. Extract 2-4 child components per file. Target: each extracted component should have a single responsibility and be testable in isolation. Co-locate in the same directory, not in a shared `components/` folder — these are specific to the parent view.
3. Pass state/handlers through props. Don't invent new context unless prop-drilling crosses >2 levels.
4. After each extraction, run `npm run dev`, open the affected view in a browser, and exercise the golden path + one edge case. Type-checking + tests passing is necessary but not sufficient — the audit explicitly calls this out.
5. Commit after each component is extracted, not at the end. Small commits make regressions bisectable.

**Stop conditions:** if an extraction would require passing >8 props, the seam is wrong — find a better one. If you can't find a clean seam, report back rather than forcing it.

**Explicitly out of scope for this pass:** the other 6 files. Leave them for a follow-up.

---

## Item 4 — Dependabot config

**Why:** pass-9 audit flagged this as LOW — keeps deps fresh so the next `xlsx`-style CVE gets caught automatically.

**Do:**
1. Create `.github/dependabot.yml` with weekly `npm` ecosystem updates, grouped (prod deps separately from dev deps), targeting `main`. Follow the minimal template from GitHub docs.
2. Open a single new commit: `chore: add Dependabot weekly update config`.
3. No gauntlet needed — this is a config file only.

---

## After all 4 items

1. Update `.smashOS/memory/decisions.md` — add a new `[IMPROVEMENT] Deferred items sweep — <date>` entry listing what was done, what's still outstanding (if you had to stop partway on item 3), and current score estimate.
2. Run `npm audit` + full gauntlet one final time. Report the result.
3. Do **not** run a new audit pass — that's a separate command the user triggers.
