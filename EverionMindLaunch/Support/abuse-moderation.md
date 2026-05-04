# Abuse & moderation

What constitutes abuse on Evara, how to report it, how to act on it. Source of truth for any moderation decision.

## What we don't tolerate

| Category | Examples | Action |
|---|---|---|
| **CSAM** (child sexual abuse material) | Any image, text, audio depicting sexual abuse of minors | Immediate ban, report to NCMEC + SAPS, preserve evidence |
| **Non-consensual intimate imagery** | "Revenge porn", deepfakes of real people without consent | Immediate ban; remove all copies; cooperate with reporter |
| **Targeted harassment** | Repeated abuse, stalking, threats directed at a specific person | Investigate; ban if confirmed |
| **Doxxing** | Sharing private info about a real person to enable harassment | Investigate; ban if confirmed |
| **Spam / abuse of shared brains** | Inviting strangers to a brain to push spam content; bot-generated entries | Ban; revoke shared-brain access |
| **Illegal activity** | Drug trafficking, fraud, etc. — using Evara as a tool for crime | Investigate; preserve evidence; cooperate with authorities under valid legal process |
| **Mass scraping / unauthorized API use** | Hammering endpoints beyond rate limits, scraping content | Rate-limit, then ban; preserve audit logs |

## What we DO tolerate

We default to permissive on:
- Personal opinions, including ones we disagree with
- Adult content involving consenting adults (in private vault — not in shared brains made public)
- Legal-but-controversial speech (politics, religion, etc.) when in a user's own private memory
- Files with embedded malware-like signatures **if** they're stored as personal reference (e.g. security researcher's own toolkit) — but we won't serve them publicly

The principle: your private memory is your private memory. We start to act when content is shared, when it depicts real people without consent, or when it's illegal at a baseline level (like CSAM, which we always act on regardless of context).

## Receiving a report

Channels:
1. In-app `/api/feedback` with an "abuse" category (TODO: ship this category)
2. Direct email `abuse@…` (TODO: real address; forward to Christian)
3. Court-ordered legal request (rare; refer to legal counsel)

Acknowledge any report within 24h. Don't promise an outcome — promise an investigation.

## Investigation procedure

For each report:

### 1. Scope the claim
- Who reported? (Name, email, relation to alleged abuser if any)
- What's the specific entry / brain / message / behaviour?
- When did it happen?
- Have they reported elsewhere (e.g. police)?

### 2. Pull the evidence
- Use Supabase MCP `execute_sql` to read the specific rows.
- Pull `audit_log` for both parties for the relevant window.
- For shared-brain claims: who created the brain, who's a member, who saw what.
- Take a snapshot of the evidence (export to a private drive). Don't rely on the live DB to remain unchanged.

### 3. Assess
For CSAM or NCII: don't deliberate. Act now. (See § Action below.)

For other categories: weigh the evidence. Ambiguous? Ask the reporter for more context. Patterns matter: one bad message is different from a campaign.

### 4. Decide
- **No action** — claim isn't supported. Reply to reporter with neutral language explaining we investigated and didn't find policy-violating content. Don't share details about the other user.
- **Warning** — borderline. Send a written warning to the alleged abuser explaining the policy. No public action.
- **Suspend** — temporarily disable account pending further review or compliance with conditions (e.g. delete the offending content).
- **Ban** — permanent. All access revoked. Email + IP-level block.
- **Legal** — escalate to law enforcement under jurisdiction-appropriate process.

### 5. Action
- For ban: revoke all sessions (`DELETE FROM auth.refresh_tokens`), set `app_metadata.banned=true` (TODO add column gate), revoke from all shared brains, lock account.
- For CSAM: report to NCMEC (USA), South African Police Service (if local), the Internet Watch Foundation (UK reporting line), and preserve evidence. Do not delete the content yourself — preserve under chain of custody.
- For NCII: take down all copies, ban account, cooperate with the depicted person.
- Log every action in `audit_log` with `action='admin_moderation_<verb>'`, metadata={ target_user_id, reporter_id, finding, evidence_ref }.

### 6. Communicate
- To reporter: confirm action taken (without revealing PII about the offender beyond what they're entitled to).
- To offender (for actions other than CSAM): explain what they violated, what you've done, and what (if anything) they can do to appeal.
- Do not communicate with offender for CSAM — coordinate with law enforcement first.

## Appeal process

Banned users can appeal via `appeals@…` (TODO: real address). Appeals are reviewed within 14 days. Categories that are appealable:
- Spam / abuse-of-shared-brains decisions
- Targeted-harassment decisions
- Mistaken-identity bans

Categories that are NOT appealable:
- CSAM (no appeal path)
- NCII (no appeal path)
- Repeat offenders past 3 violations

## Legal process

If you receive a subpoena, court order, or law enforcement request:
1. Don't act unilaterally. Send to legal counsel before responding.
2. Preserve relevant data (don't delete; freeze the affected user's account if they're a target, with a note explaining the freeze).
3. Respond per the jurisdiction's process. South African operator → POPIA + Cybercrimes Act apply.

We expect to receive ~0 of these in the first year. When the first one comes, build the playbook.

## Public transparency

Once we ship: publish a yearly transparency report. Number of:
- Abuse reports received
- Actions taken (warnings / suspensions / bans)
- Government/legal requests received
- Content removed for CSAM (always reported as a category)

Don't reveal individual users in the transparency report. Aggregate stats only.

## TODO before launch

- [ ] Real `abuse@` and `appeals@` email addresses set up
- [ ] In-app "Report" button on shared-brain content
- [ ] `app_metadata.banned` column wired into auth gate
- [ ] Saved investigation template (for evidence consistency)
- [ ] NCMEC reporting account set up if/when shared content goes public
- [ ] Privacy policy + ToS reflect this moderation policy

## References

- `Support/sop.md` — general support flow
- `Legal/privacy-tos-launch.md` — legal terms (must align with this policy)
- `Ops/incident-response.md` — when an abuse case becomes a security incident
