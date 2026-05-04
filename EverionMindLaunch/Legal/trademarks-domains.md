# Trademarks & domains

What we own, what we want to own, what we need to defend.

> **Stub** — finalize after brand name is locked. See `EML/BRAINSTORM.md` § brand-name for current candidates.

## Current state (working name: "Evara Mind")

| Asset | Status | Owner | Cost / year |
|---|---|---|---|
| `everion.smashburgerbar.co.za` (operating subdomain) | live | Christian | included in parent domain |
| `evara.app` | TODO check availability | — | ~$15/yr if available |
| `evara.com` | TODO check availability | — | varies; if taken, alt: `evaramind.com` |
| `evara.co.za` | TODO check availability | — | ~R150/yr |
| Trademark "Evara" SA | not registered | — | ~R590 + R590 per class |
| Trademark "Evara" US | not registered | — | $250–350 USPTO + lawyer |
| Trademark "Evara" EU | not registered | — | €850 EUIPO + lawyer |

## Domain shopping list (whichever brand wins)

When a brand name is locked, register all of these on the SAME DAY before announcing:

- `<brand>.com` — primary
- `<brand>.app` — for native app stores (some directories prefer .app)
- `<brand>.io` — defensive (devs sometimes type .io reflexively)
- `<brand>.co` — defensive
- `<brand>.co.za` — local SA
- `<brand>.ai` — TODO consider; .ai is trendy and pricy (~$80/yr)
- Forward all variants to the primary `<brand>.com`

Use Cloudflare or Namecheap. Don't use the registrar's DNS (slow); always use Cloudflare for DNS.

## Trademark strategy

### Phase 1 — pre-launch
- File trademark in primary jurisdictions: SA + US (cheapest combo for global protection via Madrid Protocol expansion later).
- Cover classes:
  - **Class 9** — software / mobile apps
  - **Class 42** — SaaS / cloud computing services
  - Optionally **Class 35** — business management (if family/business sharing is core)
- Use a TM-specific filing service (TrademarkRoom, Brikner, or local SA agent like Spoor & Fisher); DIY USPTO is doable but easy to mess up.
- Cost ballpark: SA + US = ~$1500 with services, ~$700 DIY.

### Phase 2 — post-launch defense
- Set up Google Alerts for the brand name
- TM watch service (TrademarkBob, or via a SaaS like CompuMark — overkill at first but cheap insurance once revenue scales)
- USPTO has a free TESS search to monitor for confusingly-similar filings

### Phase 3 — international
- Madrid Protocol filing once SA / US is registered — cheaper way to file in EU + UK + AU + 80+ other jurisdictions.

## Brand name search checklist

When choosing a name, before committing:

- [ ] Domain `.com` available (or buyable for < $5k)
- [ ] No identical/confusing trademark in Class 9 + 42 in SA, US, EU (USPTO TESS, EUIPO, SA TM database)
- [ ] No identical brand in App Store + Play Store (top 100 results in your category)
- [ ] Twitter / X handle available
- [ ] LinkedIn company page available
- [ ] No glaring negative meaning in major languages (Google Translate test: 10 languages)
- [ ] No association with offensive person/event (Google news search)
- [ ] Ego-google: search the name + your industry — does anything weird come up?

## Logo / mark trademark (separate from word mark)

- Logo can be trademarked separately. Cheaper: file as a "design mark" alongside the word mark (one filing covers both).
- Don't bother with trade dress / color trademarks at this stage; they're hard to defend and rarely worth it for early-stage products.

## Defensive vs offensive enforcement

- **Defensive**: when someone files a similar mark, oppose it (USPTO opposition has a 30-day window post-publication; SA has similar). Costs ~$5k–10k legal if it goes to trial; usually settles in cease-and-desist phase.
- **Offensive**: when someone uses your name, send a friendly cease-and-desist first. Most cases resolve in 30 days. Court is last resort.

Don't be a TM bully. Send polite letters, not aggressive ones. Reputation among small founders matters more than bullet-point wins.

## Domain squatter response

If `<brand>.com` is parked or held by a squatter:
- Check WhoIs / Wayback Machine — is it actually being used?
- Make a one-time, low-ball offer ($500–2000). Don't reveal you're launching.
- If they counter at $20k+: walk away, pick alternate domain, file UDRP claim only if they're squatting in bad faith with no legitimate use (UDRP is $1500 fee + ~3 months).

## Legal entity

- Currently: sole proprietor (Christian Stander).
- Before launch: register a (Pty) Ltd in South Africa. Cost: R175 CIPC + ~R1500 if using a registration agent.
- Reasons:
  - Liability separation (the company holds debts, not you personally)
  - Trademark holding (TMs assigned to the company, not the person — easier to transfer in M&A)
  - Tax separation (you can pay yourself a salary; SARS requires it once turnover > certain threshold)

## TODO before launch

- [ ] Lock brand name (decision required)
- [ ] Buy all domain variants (one-day batch)
- [ ] File trademark in SA + US (Class 9 + 42)
- [ ] Register (Pty) Ltd; assign IP to the company
- [ ] Set up Cloudflare DNS for all domains (forward variants to primary)
- [ ] Set up Google Alerts for brand name + variations
- [ ] TM monitor service post-launch

## References

- `Brand/assets.md` — the logo + word mark to trademark
- `Brand/press-kit.md` — public name usage
- USPTO TESS: <https://tmsearch.uspto.gov>
- EUIPO TMview: <https://www.tmdn.org/tmview/>
- SA Trade Marks: <https://www.cipc.co.za>
- Cloudflare: <https://www.cloudflare.com>
