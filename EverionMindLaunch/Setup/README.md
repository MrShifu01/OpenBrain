# Setup runbooks

Step-by-step "do these things in this order" guides for one-time external setup. Each runbook is self-contained — open the doc, follow the steps top-to-bottom, tick boxes as you go.

These cover the **operator side** only — the dashboards, vendor accounts, and store consoles you have to configure outside the codebase. The code is already shipped and tested; it just needs the credentials and dashboard config to start working.

| Runbook | What it covers | Operator status |
|---|---|---|
| [lemonsqueezy.md](lemonsqueezy.md) | Web billing — store, products, variants, API key, webhook, test mode round-trip | ❌ not done |
| [revenuecat.md](revenuecat.md) | Mobile IAP — RC project, products, entitlement (`everion_mind_pro`), offering, paywall, customer center, webhook | ❌ not done |
| [ios.md](ios.md) | Apple Developer + App Store Connect + Xcode signing + sandbox tester + push cert + Universal Links | ❌ not done |
| [android.md](android.md) | Google Play Console + signed keystore + service account + license tester + App Links | ❌ not done |

## How to use

1. Pick a runbook.
2. Open the LemonSqueezy / RC / App Store / Play Console dashboard side-by-side.
3. Follow the steps in order.
4. Each step ends with what env var to copy where.
5. Tick the boxes — the launch dashboard surfaces incomplete setup.

## When something doesn't match the docs

Vendor dashboards change. If a screen looks different from the runbook, **update the runbook in the same PR** — that way the next operator (or future-you) doesn't trip on the same outdated screenshot.

## Related

- `LAUNCH_CHECKLIST.md` — gates these block at the launch level
- `Ops/env-vars.md` — full env var reference
- `Ops/vendors.md` — vendor accounts, billing contacts, status pages
- `Specs/billing-revenuecat.md` — implementation spec (architecture, code map, edge cases)
- `Legal/pricing-billing.md` — commercial model + provider decision
