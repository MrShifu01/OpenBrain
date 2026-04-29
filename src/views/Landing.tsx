/**
 * Landing page — ported from EverionV2-handoff/project/landing.jsx
 *
 * A full marketing surface: hero with typing capture bar, what-it-is,
 * four pillars, demo section, pricing, and footer.
 *
 * Business logic: navigation only. Auth happens in LoginScreen; clicks on
 * "Sign in" / "Start remembering" call onAuth.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "../components/ui/button";
import ExitIntentSlideIn from "../components/ExitIntentSlideIn";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";

interface LandingProps {
  onAuth: (mode: "login" | "signup") => void;
}

const MOD = typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘" : "Ctrl";

function Motes({ count = 44 }: { count?: number }) {
  const [motes] = useState(() =>
    Array.from({ length: count }, () => {
      const size = 1 + Math.random() * 3;
      return {
        size,
        top: Math.random() * 100,
        left: Math.random() * 100,
        dx: (Math.random() - 0.5) * 60 + "px",
        dy: (Math.random() - 0.5) * 80 + "px",
        dur: 14 + Math.random() * 18,
        delay: Math.random() * -20,
        op: 0.06 + Math.random() * 0.12,
        bHigh: 0.06 + Math.random() * 0.12,
        bLow: 0.02 + Math.random() * 0.05,
        breatheDur: 8 + Math.random() * 6,
      };
    }),
  );
  return (
    <div className="motes" aria-hidden="true">
      {motes.map((m, i) => (
        <div
          key={i}
          className="mote"
          data-ambient
          style={{
            width: m.size,
            height: m.size,
            top: m.top + "%",
            left: m.left + "%",
            opacity: m.op,
            ["--dx" as string]: m.dx,
            ["--dy" as string]: m.dy,
            ["--b-high" as string]: String(m.bHigh),
            ["--b-low" as string]: String(m.bLow),
            animation: `design-drift ${m.dur}s ease-in-out infinite ${m.delay}s, design-breathe ${m.breatheDur}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <span
      className="f-sans"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        background: "var(--surface-low)",
        border: "1px solid var(--line)",
        borderRadius: 4,
        fontSize: 11,
        color: "var(--ink-faint)",
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}

function Micro({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="micro" style={style}>
      {children}
    </div>
  );
}

function Pillar({ n, title, sub, body }: { n: string; title: string; sub: string; body: string }) {
  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 24 }}>
      <div className="micro" style={{ color: "var(--ember)", marginBottom: 20 }}>
        {n}
      </div>
      <h3
        className="f-serif"
        style={{
          fontSize: 28,
          lineHeight: 1.1,
          fontWeight: 450,
          margin: 0,
          letterSpacing: "-0.01em",
          color: "var(--ink)",
        }}
      >
        {title}
      </h3>
      <div
        className="f-serif"
        style={{
          fontStyle: "italic",
          color: "var(--ink-faint)",
          fontSize: 14,
          marginTop: 4,
        }}
      >
        {sub}
      </div>
      <p
        className="f-serif"
        style={{
          fontSize: 16,
          lineHeight: 1.55,
          color: "var(--ink-soft)",
          marginTop: 16,
        }}
      >
        {body}
      </p>
    </div>
  );
}

function PlanCard({
  tier,
  price,
  suffix,
  body,
  bullets,
  cta,
  onCta,
  ctaCaption,
  featured,
}: {
  tier: string;
  price: string;
  suffix?: string;
  body: string;
  bullets: string[];
  cta: string;
  onCta: () => void;
  ctaCaption?: string;
  featured?: boolean;
}) {
  return (
    <div
      className="press"
      style={{
        padding: 32,
        background: featured ? "var(--surface-high)" : "var(--surface)",
        border: `1px solid ${featured ? "var(--ember)" : "var(--line-soft)"}`,
        borderRadius: 18,
        transition: "all 240ms",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="f-serif"
        style={{ fontSize: 14, color: "var(--ink-faint)", fontStyle: "italic", marginBottom: 8 }}
      >
        {tier}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
        <span
          className="f-serif"
          style={{
            fontSize: 56,
            lineHeight: 1,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
          }}
        >
          {price}
        </span>
        {suffix && (
          <span className="f-sans" style={{ color: "var(--ink-faint)", fontSize: 14 }}>
            {suffix}
          </span>
        )}
      </div>
      <p
        className="f-serif"
        style={{
          fontSize: 15,
          lineHeight: 1.5,
          color: "var(--ink-soft)",
          minHeight: 50,
          margin: 0,
        }}
      >
        {body}
      </p>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "20px 0",
          fontSize: 14,
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
        className="f-sans"
      >
        {bullets.map((b) => (
          <li
            key={b}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 0",
              color: "var(--ink-soft)",
            }}
          >
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
              style={{ color: featured ? "var(--ember)" : "var(--ink-faint)", flexShrink: 0 }}
              aria-hidden="true"
            >
              <path d="M5 12l4 4 10-10" />
            </svg>
            {b}
          </li>
        ))}
      </ul>
      <Button
        variant={featured ? "default" : "outline"}
        size="lg"
        className="mt-auto w-full"
        onClick={onCta}
      >
        {cta}
      </Button>
      {ctaCaption && (
        <div
          className="f-sans"
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "var(--ink-faint)",
            textAlign: "center",
            fontStyle: "italic",
          }}
        >
          {ctaCaption}
        </div>
      )}
    </div>
  );
}

// Pre-recorded demo scenarios. Honest landing-page showcase: visitors pick a
// scenario chip and see real captured input + the structured output Everion
// would produce. The textarea is read-only — the right column would have to
// be faked anyway (a logged-out visitor has no memory to surface "related"
// entries from), so a scripted demo is strictly more honest than a live
// classifier with fabricated relateds.
interface DemoScenario {
  key: string;
  chipLabel: string;
  input: string;
  inferredType: string;
  concepts: string[];
  related: { title: string; meta: string };
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    key: "renewal",
    chipLabel: "Renewal",
    input:
      "driver's licence expires 14 March next year — testing centre at Sea Point, slot opens 60 days before",
    inferredType: "reminder",
    concepts: ["drivers-licence", "renewal", "deadline"],
    related: {
      title: "Vehicle insurance renewal — same week, broker is Sarah at Outsurance",
      meta: "9 days ago · admin, renewals",
    },
  },
  {
    key: "spare-key",
    chipLabel: "Spare key",
    input:
      "spare key for the Cape Town flat is taped to the back of the framed photo above the geyser cupboard — Mom and the cleaner know",
    inferredType: "note",
    concepts: ["spare-key", "cape-town-flat", "household"],
    related: {
      title: "Gate code 4471 · alarm panic word 'rooibos' · Mom's cell as backup contact",
      meta: "3 weeks ago · household, security",
    },
  },
  {
    key: "customer",
    chipLabel: "Customer call",
    input:
      "the head of ops at Northwind kept saying 'we just need it to not break during month-end' — that's the real pitch",
    inferredType: "note",
    concepts: ["northwind", "customer-insight", "positioning"],
    related: {
      title: "Northwind discovery call — they care about reliability over features",
      meta: "12 days ago · sales, positioning",
    },
  },
  {
    key: "idea",
    chipLabel: "Idea",
    input:
      "what if onboarding asks one question instead of seven — measure activation week over week",
    inferredType: "idea",
    concepts: ["onboarding", "activation", "experiment"],
    related: {
      title: "Activation rate dropped 4% after we added the third onboarding step",
      meta: "18 days ago · metrics",
    },
  },
];

function LandingDemo({ onSignup }: { onSignup: () => void }) {
  const [scenarioKey, setScenarioKey] = useState<string>(DEMO_SCENARIOS[0].key);
  const scenario = DEMO_SCENARIOS.find((s) => s.key === scenarioKey) ?? DEMO_SCENARIOS[0];

  return (
    <div style={{ marginTop: 48, maxWidth: 1000 }}>
      {/* Scenario picker */}
      <Tabs value={scenarioKey} onValueChange={setScenarioKey} className="mb-5">
        <TabsList variant="line" aria-label="Demo scenario" className="flex-wrap gap-2">
          {DEMO_SCENARIOS.map((s) => (
            <TabsTrigger
              key={s.key}
              value={s.key}
              className="rounded-full border data-active:border-[var(--ember)] data-active:bg-[var(--ember-wash)] data-active:text-[var(--ember)]"
              style={{ borderColor: "var(--line)" }}
            >
              {s.chipLabel}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div
        className="landing-demo-grid"
        style={{
          display: "grid",
          gap: 32,
        }}
      >
        <div>
          <Micro style={{ marginBottom: 12 }}>you type</Micro>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 18,
              padding: 20,
              minHeight: 200,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <p
              className="f-serif"
              style={{
                fontSize: 17,
                lineHeight: 1.55,
                color: "var(--ink)",
                margin: 0,
              }}
            >
              {scenario.input}
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--ink-faint)",
                fontSize: 13,
                marginTop: 16,
              }}
            >
              <span className="f-sans">inferred: {scenario.inferredType}</span>
            </div>
          </div>
        </div>
        <div>
          <Micro style={{ marginBottom: 12 }}>everion finds</Micro>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 18,
              padding: 20,
              minHeight: 200,
            }}
          >
            <div className="micro" style={{ color: "var(--ember)", marginBottom: 10 }}>
              ● captured · concepts extracted
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              {scenario.concepts.map((c) => (
                <span key={c} className="design-chip f-sans" style={{ fontSize: 12 }}>
                  {c}
                </span>
              ))}
            </div>
            <Micro style={{ marginBottom: 10, opacity: 0.7 }}>related, already in memory</Micro>
            <div style={{ borderLeft: "2px solid var(--line-soft)", paddingLeft: 14 }}>
              <div
                className="f-serif"
                style={{ fontSize: 15, fontWeight: 450, marginBottom: 2, color: "var(--ink)" }}
              >
                {scenario.related.title}
              </div>
              <div
                className="f-serif"
                style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic" }}
              >
                {scenario.related.meta}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}>
        <Button size="lg" onClick={onSignup}>
          Try it with your own thoughts
        </Button>
      </div>
      <p
        className="f-sans"
        style={{
          marginTop: 12,
          fontSize: 12,
          color: "var(--ink-faint)",
          textAlign: "center",
          fontStyle: "italic",
        }}
      >
        scripted preview · free, no card required
      </p>
    </div>
  );
}

function Quote({ text, who }: { text: string; who: string }) {
  return (
    <figure
      style={{
        margin: 0,
        padding: 24,
        background: "var(--surface)",
        border: "1px solid var(--line-soft)",
        borderRadius: 18,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <blockquote
        className="f-serif"
        style={{
          margin: 0,
          fontSize: 16,
          lineHeight: 1.55,
          color: "var(--ink)",
          fontStyle: "italic",
        }}
      >
        “{text}”
      </blockquote>
      <figcaption className="f-sans" style={{ fontSize: 12, color: "var(--ink-faint)" }}>
        — {who}
      </figcaption>
    </figure>
  );
}

function Compare({ tool, line }: { tool: string; line: string }) {
  return (
    <div
      style={{
        padding: 24,
        background: "var(--surface)",
        border: "1px solid var(--line-soft)",
        borderRadius: 18,
      }}
    >
      <div
        className="f-serif"
        style={{
          fontSize: 18,
          fontWeight: 450,
          color: "var(--ink)",
          marginBottom: 8,
        }}
      >
        Why not just use <span style={{ fontStyle: "italic", color: "var(--ember)" }}>{tool}</span>?
      </div>
      <p
        className="f-serif"
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: 1.55,
          color: "var(--ink-soft)",
        }}
      >
        {line}
      </p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: ReactNode }) {
  return (
    <div
      style={{
        borderTop: "1px solid var(--line-soft)",
        paddingTop: 24,
      }}
    >
      <h3
        className="f-serif"
        style={{
          fontSize: 20,
          lineHeight: 1.3,
          fontWeight: 450,
          margin: 0,
          color: "var(--ink)",
        }}
      >
        {q}
      </h3>
      <p
        className="f-serif"
        style={{
          marginTop: 12,
          marginBottom: 0,
          fontSize: 16,
          lineHeight: 1.6,
          color: "var(--ink-soft)",
        }}
      >
        {a}
      </p>
    </div>
  );
}

function FooterCol({
  title,
  links,
  go,
}: {
  title: string;
  links: [string, string][];
  go: (to: string) => void;
}) {
  // Map route token → real URL so anchors are crawlable; onClick still
  // intercepts to drive SPA navigation without the browser leaving the page.
  // Tokens starting with "/" are treated as real URLs — used for static
  // marketing pages (/learn.html, /vs/*, /research/*) served outside the SPA.
  const toHref = (to: string): string => {
    if (to.startsWith("/")) return to;
    if (to.startsWith("landing#")) return `#${to.slice("landing#".length)}`;
    if (to === "privacy") return "/privacy";
    if (to === "terms") return "/terms";
    if (to === "status") return "/status";
    if (to === "login" || to === "signup") return "/login";
    return "#";
  };
  return (
    <div>
      <Micro style={{ marginBottom: 14 }}>{title}</Micro>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {links.map(([label, to]) => {
          const external = to.startsWith("/");
          return (
            <a
              key={label}
              href={toHref(to)}
              onClick={
                external
                  ? undefined
                  : (e) => {
                      e.preventDefault();
                      go(to);
                    }
              }
              className="f-sans press"
              style={{
                fontSize: 14,
                color: "var(--ink-soft)",
                cursor: "pointer",
                background: "transparent",
                textDecoration: "none",
              }}
            >
              {label}
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default function Landing({ onAuth }: LandingProps) {
  useDocumentMeta({
    title: "Everion — your second memory, quietly kept.",
    description:
      "One private place for everything worth remembering — meeting notes, decisions, half-formed ideas, the customer insight from last quarter. Capture in one tap, recall by asking. Encrypted vault for the few real secrets — passwords, cards, recovery codes.",
    canonical: "https://everionmind.com/",
  });
  const [typed, setTyped] = useState("");
  const phrases = useMemo(
    () => [
      "the thing the customer said on Tuesday's call I keep coming back to…",
      "where that book recommendation went — the one about systems thinking…",
      "the architecture sketch for the auth refactor I drew last March…",
      "what we decided in the pricing call before everyone forgot…",
      "a half-formed idea for next quarter's pricing…",
      "the recovery code for the wallet — locked away in the vault…",
    ],
    [],
  );
  const [pIdx, setPIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  // Cmd/Ctrl+K on the landing page = the same thing the kbd hint promises:
  // start the signup flow. The hint exists, so the binding has to honor it.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onAuth("signup");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onAuth]);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setTyped(phrases[0]);
      return;
    }
    const cur = phrases[pIdx];
    const t = setTimeout(
      () => {
        if (!deleting) {
          if (charIdx < cur.length) {
            setTyped(cur.slice(0, charIdx + 1));
            setCharIdx((c) => c + 1);
          } else {
            setTimeout(() => setDeleting(true), 2400);
          }
        } else {
          if (charIdx > 0) {
            setTyped(cur.slice(0, charIdx - 1));
            setCharIdx((c) => c - 1);
          } else {
            setDeleting(false);
            setPIdx((p) => (p + 1) % phrases.length);
          }
        }
      },
      deleting ? 22 : 42 + Math.random() * 30,
    );
    return () => clearTimeout(t);
  }, [charIdx, deleting, pIdx, phrases]);

  const goto = (to: string) => {
    if (to === "login") onAuth("login");
    else if (to === "signup") onAuth("signup");
    else if (to === "privacy") window.location.assign("/privacy");
    else if (to === "terms") window.location.assign("/terms");
    else if (to === "status") window.location.assign("/status");
    else if (to === "memory") onAuth("login");
    else if (to.startsWith("landing#")) {
      const id = to.slice("landing#".length);
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div
      className="scrollbar-hide"
      style={{
        height: "100vh",
        overflowY: "auto",
        position: "relative",
        background: "var(--bg)",
        color: "var(--ink)",
      }}
    >
      {/* Top nav */}
      <header
        className="landing-nav"
        style={{
          position: "sticky",
          top: 0,
          zIndex: "var(--z-sticky)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "calc(18px + env(safe-area-inset-top)) 40px 18px",
          background: "color-mix(in oklch, var(--bg) 82%, transparent)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--line-soft)",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img
            src="/logoNew.webp"
            width={26}
            height={26}
            alt=""
            aria-hidden="true"
            decoding="async"
            style={{ flexShrink: 0, objectFit: "contain", display: "block" }}
          />
          <span
            className="f-serif"
            style={{
              fontSize: 22,
              letterSpacing: "-0.01em",
              fontWeight: 450,
              color: "var(--ink)",
            }}
          >
            Everion
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--ember)",
              animation: "design-breathe 3.5s ease-in-out infinite",
            }}
          />
        </div>
        <nav
          className="landing-nav-links f-sans"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            fontSize: 13,
            color: "var(--ink-faint)",
          }}
        >
          <a
            className="press"
            href="#what"
            onClick={(e) => {
              e.preventDefault();
              goto("landing#what");
            }}
            style={{ cursor: "pointer", color: "inherit", textDecoration: "none" }}
          >
            What it is
          </a>
          <a
            className="press"
            href="#pricing"
            onClick={(e) => {
              e.preventDefault();
              goto("landing#pricing");
            }}
            style={{ cursor: "pointer", color: "inherit", textDecoration: "none" }}
          >
            Pricing
          </a>
          <a
            className="press"
            href="/privacy"
            onClick={(e) => {
              e.preventDefault();
              goto("privacy");
            }}
            style={{ cursor: "pointer", color: "inherit", textDecoration: "none" }}
          >
            Privacy
          </a>
          <Button variant="outline" size="sm" onClick={() => goto("login")}>
            Sign in
          </Button>
          <Button size="sm" className="landing-nav-cta" onClick={() => goto("signup")}>
            <span className="landing-nav-cta-full">Start remembering</span>
            <span className="landing-nav-cta-short">Sign up</span>
          </Button>
        </nav>
      </header>

      <main>
        {/* HERO */}
        <section
          style={{
            position: "relative",
            minHeight: "calc(100vh - 80px)",
            padding: "80px 40px 120px",
            overflow: "hidden",
          }}
        >
          <Motes count={44} />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "30%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 900,
              height: 900,
              borderRadius: "50%",
              background: "radial-gradient(circle, var(--ember-wash) 0%, transparent 60%)",
              pointerEvents: "none",
              opacity: 0.6,
            }}
          />
          <div
            style={{
              position: "relative",
              maxWidth: 940,
              margin: "0 auto",
              textAlign: "center",
              paddingTop: 80,
            }}
          >
            <div
              className="micro anim-fade-up"
              style={{ marginBottom: 24, animationDelay: "50ms" }}
            >
              <span style={{ color: "var(--ember)" }}>●</span> For the thoughts you'd lose · and the
              facts you can't afford to
            </div>
            <h1
              className="f-serif anim-fade-up"
              style={{
                fontSize: "clamp(48px, 8vw, 104px)",
                lineHeight: 0.98,
                fontWeight: 400,
                margin: 0,
                letterSpacing: "-0.025em",
                fontVariationSettings: '"opsz" 72',
                color: "var(--ink)",
                animationDelay: "120ms",
              }}
            >
              your second memory,
              <br />
              <span style={{ fontStyle: "italic", color: "var(--ink-soft)" }}>quietly kept.</span>
            </h1>
            <p
              className="f-serif anim-fade-up"
              style={{
                fontSize: "clamp(17px, 2vw, 22px)",
                lineHeight: 1.5,
                color: "var(--ink-soft)",
                maxWidth: 620,
                margin: "36px auto 48px",
                animationDelay: "240ms",
              }}
            >
              One private place for everything worth remembering — meeting notes, decisions,
              half-formed ideas, the customer insight from last quarter. Ask the AI anything; it
              actually reads them. Encrypted vault for the few real secrets.
            </p>

            {/* Live-feeling capture bar — clickable: lands the visitor on signup with the
                typing-animation phrase as their first entry idea. */}
            <div
              className="anim-fade-up"
              style={{ animationDelay: "360ms", maxWidth: 640, margin: "0 auto" }}
            >
              <div
                role="button"
                tabIndex={0}
                aria-label="Start free — try this with your own thoughts"
                onClick={() => goto("signup")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goto("signup");
                  }
                }}
                className="press landing-capture-bar"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 28,
                  padding: "14px 18px 14px 24px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  boxShadow: "var(--lift-2)",
                  cursor: "pointer",
                  transition: "border-color 200ms, box-shadow 200ms",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                  style={{ color: "var(--ember)", flexShrink: 0 }}
                  aria-hidden="true"
                >
                  <path d="M5 19c3-9 8-14 14-14-1 6-4 12-12 14M8 12l4 4" />
                </svg>
                <div
                  className="f-serif"
                  style={{
                    flex: 1,
                    textAlign: "left",
                    fontSize: 17,
                    color: "var(--ink-soft)",
                    fontStyle: "italic",
                    // Grid-stack the ghosts and the live typed string in one
                    // cell so the container's intrinsic height = the tallest
                    // phrase at the current width. Without this, the typewriter
                    // bumped the entire page up/down every keystroke as
                    // phrases wrapped to 1/2/3 lines.
                    display: "grid",
                    alignItems: "center",
                  }}
                >
                  {phrases.map((p, i) => (
                    <span
                      key={`ghost-${i}`}
                      aria-hidden="true"
                      style={{
                        gridArea: "1 / 1",
                        visibility: "hidden",
                        pointerEvents: "none",
                      }}
                    >
                      {p}
                    </span>
                  ))}
                  <span style={{ gridArea: "1 / 1" }}>
                    {typed}
                    <span
                      style={{
                        display: "inline-block",
                        width: 1,
                        height: 18,
                        background: "var(--ember)",
                        marginLeft: 2,
                        animation: "design-breathe 1s ease-in-out infinite",
                        ["--b-low" as string]: "0.2",
                        ["--b-high" as string]: "1",
                      }}
                    />
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Kbd>{MOD}</Kbd>
                  <Kbd>K</Kbd>
                </div>
              </div>
              <div className="micro" style={{ marginTop: 14, opacity: 0.7 }}>
                nothing leaves your device until you say so ·{" "}
                <a
                  className="press"
                  href="/privacy#encryption"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.assign("/privacy#encryption");
                  }}
                  style={{
                    color: "inherit",
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                    textDecorationColor: "var(--line)",
                  }}
                >
                  end-to-end encrypted vault
                </a>
              </div>
            </div>

            {/* Hero CTAs */}
            <div
              className="anim-fade-up"
              style={{
                animationDelay: "480ms",
                marginTop: 32,
                display: "flex",
                gap: 12,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Button size="lg" onClick={() => goto("signup")}>
                Start free — no card
              </Button>
              <Button variant="outline" size="lg" onClick={() => goto("landing#demo")}>
                See it work
              </Button>
            </div>
            <div
              className="micro anim-fade-up"
              style={{ marginTop: 14, opacity: 0.6, animationDelay: "560ms" }}
            >
              free forever · no credit card · your own AI key works
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 32,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <div
              className="f-serif"
              style={{
                fontSize: 14,
                fontStyle: "italic",
                color: "var(--ink-ghost)",
                textAlign: "center",
              }}
            >
              what it does
              <br />
              <span style={{ fontSize: 20 }}>↓</span>
            </div>
          </div>
        </section>

        {/* WHAT IT IS */}
        <section id="what" style={{ padding: "120px 40px", maxWidth: 1120, margin: "0 auto" }}>
          <Micro style={{ marginBottom: 24 }}>What Everion is</Micro>
          <h2
            className="f-serif"
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              lineHeight: 1.1,
              fontWeight: 400,
              margin: 0,
              letterSpacing: "-0.02em",
              maxWidth: 880,
              color: "var(--ink)",
            }}
          >
            One place for the thoughts you'd lose —{" "}
            <span style={{ fontStyle: "italic", color: "var(--ink-soft)" }}>
              and the facts you can't afford to.
            </span>
          </h2>
          <p
            className="f-serif"
            style={{
              fontSize: 19,
              lineHeight: 1.6,
              color: "var(--ink-soft)",
              maxWidth: 680,
              marginTop: 32,
            }}
          >
            Not a to-do app. Not a password manager. Not a wiki you have to maintain. Everion holds
            the half-thought and the customer insight in the same calm room — and locks the few real
            secrets in an encrypted vault on your device. No folders to choose. No template to fill.
            No system to maintain on Sundays. The same one tap that saves an idea saves a meeting
            note; the same chat that recalls the decision tells you what Acme pushed back on last
            quarter.
          </p>

          <div style={{ marginTop: 40 }}>
            <Micro style={{ marginBottom: 14 }}>What goes in</Micro>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                "notes",
                "voice memos",
                "links",
                "PDFs",
                "photos",
                "meeting notes",
                "decisions",
                "customer insights",
                "code snippets",
                "research",
                "renewal dates",
                "todos & reminders",
                "half-formed ideas",
                "passwords (vault)",
                "credit cards (vault)",
                "recovery codes (vault)",
                "PINs (vault)",
              ].map((label) => (
                <span key={label} className="design-chip f-sans" style={{ fontSize: 12 }}>
                  {label}
                </span>
              ))}
            </div>
            <p
              className="f-serif"
              style={{
                fontSize: 14,
                color: "var(--ink-faint)",
                fontStyle: "italic",
                marginTop: 14,
                maxWidth: 520,
              }}
            >
              Anything worth not losing. Encrypted. Askable. Yours.
            </p>
          </div>
        </section>

        {/* FOUR PILLARS */}
        <section style={{ padding: "40px 40px 120px", maxWidth: 1120, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 24,
            }}
          >
            <Pillar
              n="01"
              title="Capture"
              sub="lighter than opening a text box"
              body="Tap once on desktop, thumb once on mobile. Text, voice, paste, file, photo. A passing thought, a meeting note, a screenshot — same one tap. No title. No folder. Fast enough that you actually use it."
            />
            <Pillar
              n="02"
              title="Recall"
              sub="ask, don't search"
              body="Chat with your memory. Everion reads your entries, cites sources, answers in plain language. 'what did the Acme team push back on last quarter' works. So does 'how did I solve that auth bug last March'. So does 'what was that book recommendation about systems thinking'."
            />
            <Pillar
              n="03"
              title="Synthesize"
              sub="connections you didn't see"
              body="Three notes from three different weeks turn out to be about the same thing. Everion notices. Quiet nudge, not a daily report — surfaces the link when it matters, stays out of the way when it doesn't."
            />
            <Pillar
              n="04"
              title="The Shape"
              sub="the night sky of your mind"
              body="Every entry becomes a concept. Concepts become constellations. Pan around the idea-sky you've been making without meaning to."
            />
          </div>
        </section>

        {/* SOCIAL PROOF — placeholder quotes, replace with real ones post-launch */}
        <section
          style={{
            padding: "80px 40px",
            maxWidth: 1120,
            margin: "0 auto",
          }}
        >
          <Micro style={{ textAlign: "center", marginBottom: 40 }}>
            From the people already living here
          </Micro>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 24,
            }}
          >
            <Quote
              text="It's the first one of these I actually opened on a Tuesday. I forgot how much was rattling around in my head."
              who="Sarah · founder"
            />
            <Quote
              text="I asked it what we decided in the pricing call from October. Five seconds. That alone earned its place."
              who="Andre · senior engineer"
            />
            <Quote
              text="My recovery codes and card numbers live in the vault now. Everything else — meeting notes, decisions, half-thoughts — lives next to them in plain entries. One app, finally."
              who="Megan · operator"
            />
          </div>
        </section>

        {/* DEMO */}
        <section
          id="demo"
          style={{
            padding: "120px 40px",
            background: "var(--surface-low)",
            borderTop: "1px solid var(--line-soft)",
            borderBottom: "1px solid var(--line-soft)",
          }}
        >
          <div style={{ maxWidth: 1120, margin: "0 auto" }}>
            <Micro style={{ marginBottom: 16 }}>A demo — not a screenshot</Micro>
            <h2
              className="f-serif"
              style={{
                fontSize: "clamp(28px, 4.5vw, 48px)",
                lineHeight: 1.1,
                fontWeight: 400,
                margin: 0,
                letterSpacing: "-0.02em",
                maxWidth: 820,
                color: "var(--ink)",
              }}
            >
              Type a thought. Watch it find its place.
            </h2>
            <p
              className="f-serif"
              style={{
                fontSize: 17,
                lineHeight: 1.6,
                color: "var(--ink-soft)",
                maxWidth: 620,
                marginTop: 20,
              }}
            >
              The four scenarios below are real captures. Pick one to see what Everion saves and how
              it links to what's already in memory.
            </p>
            <LandingDemo onSignup={() => goto("signup")} />
          </div>
        </section>

        {/* WHY NOT JUST USE… */}
        <section style={{ padding: "120px 40px", maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <Micro style={{ marginBottom: 16 }}>Where Everion fits</Micro>
            <h2
              className="f-serif"
              style={{
                fontSize: "clamp(28px, 4.5vw, 44px)",
                lineHeight: 1.15,
                fontWeight: 400,
                margin: 0,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
              }}
            >
              Why not just use{" "}
              <span style={{ fontStyle: "italic", color: "var(--ink-soft)" }}>
                what you already have?
              </span>
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 24,
            }}
          >
            <Compare
              tool="Notion"
              line="Notion expects you to build a system on Sundays. Everion is the system — there's nothing to set up."
            />
            <Compare
              tool="Apple Notes"
              line="Notes can't ask itself a question. And the few real secrets in plaintext feel wrong because they are."
            />
            <Compare
              tool="1Password"
              line="1Password is for credentials. Everion is for everything else worth keeping — meeting notes, decisions, customer insights, half-thoughts — with a small encrypted vault for the few real secrets."
            />
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" style={{ padding: "120px 40px", maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <Micro style={{ marginBottom: 16 }}>Pricing</Micro>
            <h2
              className="f-serif"
              style={{
                fontSize: "clamp(32px, 5vw, 56px)",
                lineHeight: 1.1,
                fontWeight: 400,
                margin: 0,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
              }}
            >
              Three tiers. All honest.
            </h2>
            <p
              className="f-serif"
              style={{
                fontSize: 16,
                lineHeight: 1.5,
                color: "var(--ink-soft)",
                fontStyle: "italic",
                maxWidth: 540,
                margin: "20px auto 0",
              }}
            >
              Start free, upgrade only when it earns it.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 20,
              maxWidth: 1000,
              margin: "0 auto",
            }}
          >
            <PlanCard
              tier="Hobby"
              price="free"
              body="The whole product on your own AI key. Forever."
              bullets={[
                "Unlimited entries",
                "Local-first, works offline",
                "End-to-end encrypted vault",
                "Bring your own key (Anthropic, OpenAI, OpenRouter, Groq)",
              ]}
              cta="Start free"
              ctaCaption="no card · works on day one"
              onCta={() => goto("signup")}
            />
            <PlanCard
              tier="Starter"
              price="$4.99"
              suffix="/mo"
              body="Hosted AI without the key juggling."
              bullets={[
                "Everything in Hobby",
                "Hosted AI included (Gemini Flash)",
                "500 captures · 200 chats / month",
                "Cross-device sync",
              ]}
              cta="Start free"
              ctaCaption="upgrade in-app whenever you're ready"
              onCta={() => goto("signup")}
            />
            <PlanCard
              tier="Pro"
              price="$9.99"
              suffix="/mo"
              body="For the people who actually live here."
              bullets={[
                "Everything in Starter",
                "Premium AI (Claude Sonnet)",
                "2,000 captures · 1,000 chats / month",
                "Shared brain with one other person",
                "All features included",
              ]}
              cta="Start free"
              ctaCaption="upgrade in-app whenever you're ready"
              onCta={() => goto("signup")}
              featured
            />
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding: "120px 40px", maxWidth: 820, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <Micro style={{ marginBottom: 16 }}>Questions worth answering</Micro>
            <h2
              className="f-serif"
              style={{
                fontSize: "clamp(28px, 4.5vw, 44px)",
                lineHeight: 1.15,
                fontWeight: 400,
                margin: 0,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
              }}
            >
              The honest ones.
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <FaqItem
              q="I already use 1Password — do I need this?"
              a="1Password is for credentials. Everion is for everything else worth keeping — meeting notes, decisions, customer insights, half-thoughts. The vault is for the few real secrets you'd lock anyway: passwords if you don't have a manager, recovery codes, card numbers, PINs. Different shape, different job. Use both."
            />
            <FaqItem
              q="Is the encryption real?"
              a={
                <>
                  Yes. Vault entries are end-to-end encrypted with AES-GCM 256, key derived from
                  your passphrase via PBKDF2 (310k iterations). Your passphrase never leaves the
                  browser; the server can't decrypt vault content. Regular entries (notes, links,
                  voice memos) are stored in our DB so search and AI work — that's the trade. With
                  your own AI key, prompts go through your account — we never see them. Full
                  architecture on the{" "}
                  <a
                    className="press"
                    href="/privacy#vault"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.assign("/privacy#vault");
                    }}
                    style={{
                      color: "var(--ember)",
                      textDecoration: "underline",
                      textUnderlineOffset: 2,
                    }}
                  >
                    privacy page
                  </a>
                  .
                </>
              }
            />
            <FaqItem
              q="Will I bounce off it like I did Notion?"
              a="If you don't open it again, that's our problem to fix, not yours. Notion expects you to build a system on Sundays. Everion has nothing to set up. Capture is one tap because the friction is the whole game — most second-brain tools die on it."
            />
          </div>
        </section>

        {/* FINAL CTA */}
        <section
          style={{
            padding: "120px 40px",
            borderTop: "1px solid var(--line-soft)",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <Micro style={{ marginBottom: 16 }}>One more thing</Micro>
            <h2
              className="f-serif"
              style={{
                fontSize: "clamp(32px, 5vw, 56px)",
                lineHeight: 1.1,
                fontWeight: 400,
                margin: 0,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
              }}
            >
              Everything that matters,{" "}
              <span style={{ fontStyle: "italic", color: "var(--ink-soft)" }}>
                in one calm place.
              </span>
            </h2>
            <p
              className="f-serif"
              style={{
                fontSize: 19,
                lineHeight: 1.6,
                color: "var(--ink-soft)",
                maxWidth: 560,
                margin: "32px auto 40px",
              }}
            >
              Three taps from now, the first thing is in. A week from now, you'll wonder how you
              held it all in your head.
            </p>
            <Button size="lg" onClick={() => goto("signup")}>
              Start free
            </Button>
            <div className="micro" style={{ marginTop: 20, opacity: 0.7 }}>
              free forever · no credit card · export anytime
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer
        style={{
          padding: "56px 40px 32px",
          borderTop: "1px solid var(--line-soft)",
          background: "var(--surface-dim)",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 32,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span
                className="f-serif"
                style={{ fontSize: 20, fontWeight: 450, color: "var(--ink)" }}
              >
                Everion
              </span>
              <span
                aria-hidden="true"
                style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--ember)" }}
              />
            </div>
            <p
              className="f-serif"
              style={{
                fontSize: 14,
                color: "var(--ink-faint)",
                lineHeight: 1.5,
                fontStyle: "italic",
                maxWidth: 220,
                margin: 0,
              }}
            >
              a room, not a tool.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={[
              ["What it is", "landing#what"],
              ["Pricing", "landing#pricing"],
              ["Privacy", "privacy"],
              ["Terms", "terms"],
            ]}
            go={goto}
          />
          <FooterCol
            title="For you"
            links={[
              ["Sign in", "login"],
              ["Sign up", "signup"],
            ]}
            go={goto}
          />
          <FooterCol
            title="Learn"
            links={[
              ["What is Everion?", "/learn.html"],
              ["The Second Brain in 2026", "/research/second-brain-2026.html"],
              ["vs Notion", "/vs/notion.html"],
              ["vs Mem.ai", "/vs/mem.html"],
              ["vs 1Password", "/vs/1password.html"],
            ]}
            go={goto}
          />
          <FooterCol
            title="Support"
            links={[
              ["Service status", "status"],
              ["Privacy policy", "privacy"],
              ["Terms of service", "terms"],
            ]}
            go={goto}
          />
        </div>
        <div
          style={{
            maxWidth: 1120,
            margin: "40px auto 0",
            display: "flex",
            justifyContent: "space-between",
            color: "var(--ink-ghost)",
            fontSize: 12,
          }}
        >
          <span>© {new Date().getFullYear()} Everion</span>
          <span className="f-serif" style={{ fontStyle: "italic" }}>
            quietly kept
          </span>
        </div>
      </footer>

      {/* Responsive CSS */}
      <style>{`
        .landing-demo-grid { grid-template-columns: 1fr 1fr; }
        .landing-nav-cta-short { display: none; }
        .landing-capture-bar:hover { border-color: var(--ember) !important; box-shadow: var(--lift-3) !important; }
        .landing-capture-bar:focus-visible { outline: 2px solid var(--ember); outline-offset: 4px; }
        @media (max-width: 820px) {
          .landing-demo-grid { grid-template-columns: 1fr !important; }
          .landing-nav { padding: calc(14px + env(safe-area-inset-top)) 16px 14px !important; gap: 12px !important; }
          .landing-nav-links { gap: 8px !important; }
          .landing-nav-links a:not(button) { display: none !important; }
        }
        @media (max-width: 460px) {
          .landing-nav-cta-full { display: none; }
          .landing-nav-cta-short { display: inline; }
        }
      `}</style>

      <ExitIntentSlideIn />
    </div>
  );
}
