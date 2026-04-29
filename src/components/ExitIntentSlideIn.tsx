/**
 * ExitIntentSlideIn — bottom-right corner email capture, landing-only.
 *
 * Triggers on cursor exit toward browser chrome (top of viewport) or on
 * scroll-back from the pricing section. Fires at most once per visitor —
 * dismissals and submissions both set localStorage so the slide-in is dead
 * forever for that browser. Suppressed entirely on mobile (no exit-intent
 * cursor events) and for users who already clicked any auth CTA.
 */
import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "./ui/button";

type Phase = "hidden" | "visible" | "submitting" | "done";

const STORAGE_KEY = "everion_exitslide_state"; // values: "shown" | "submitted" | "dismissed"
const PRICING_ANCHOR_ID = "pricing";

function isMobileLike(): boolean {
  if (typeof window === "undefined") return true;
  // Cursor exit events don't fire on touch-only devices. matchMedia is the
  // most reliable signal across mobile browsers.
  return (
    window.matchMedia?.("(pointer: coarse)")?.matches ||
    window.matchMedia?.("(max-width: 820px)")?.matches
  );
}

function alreadyShown(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return true; // private mode → don't bother user
  }
}

function markShown(state: "shown" | "submitted" | "dismissed") {
  try {
    localStorage.setItem(STORAGE_KEY, state);
  } catch {
    /* ignore */
  }
}

export default function ExitIntentSlideIn() {
  const [phase, setPhase] = useState<Phase>("hidden");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const armedRef = useRef(true);
  const lastScrollY = useRef(0);
  const passedPricingRef = useRef(false);

  // Suppress entirely on mobile + already-shown.
  useEffect(() => {
    if (alreadyShown() || isMobileLike()) {
      armedRef.current = false;
    }
  }, []);

  // Suppress when the user clicks any CTA on the page (focused intent).
  useEffect(() => {
    const onCtaInteraction = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const text = (t.closest("button, a")?.textContent || "").toLowerCase();
      if (
        text.includes("start free") ||
        text.includes("start remembering") ||
        text.includes("start 14-day trial") ||
        text.includes("sign up") ||
        text.includes("sign in") ||
        text.includes("try it with your own thoughts")
      ) {
        armedRef.current = false;
        markShown("shown"); // never show; they engaged
      }
    };
    document.addEventListener("click", onCtaInteraction, { capture: true });
    return () => document.removeEventListener("click", onCtaInteraction, { capture: true } as any);
  }, []);

  // Trigger 1: cursor leaves toward top of viewport (toward browser chrome).
  useEffect(() => {
    const onMouseOut = (e: MouseEvent) => {
      if (!armedRef.current) return;
      // Only fire when leaving toward the top — sideways exits are rarely
      // intent-to-leave.
      if (e.clientY > 8) return;
      if (e.relatedTarget) return; // moving to another in-document element
      fire();
    };
    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger 2: scroll-back-from-pricing without converting.
  useEffect(() => {
    const onScroll = () => {
      if (!armedRef.current) return;
      const pricing = document.getElementById(PRICING_ANCHOR_ID);
      if (!pricing) return;
      const rect = pricing.getBoundingClientRect();
      // Track whether the pricing block is/was on screen.
      const pricingOnScreen = rect.top < window.innerHeight && rect.bottom > 0;
      if (pricingOnScreen) passedPricingRef.current = true;
      const y = window.scrollY;
      const isScrollingUp = y < lastScrollY.current;
      lastScrollY.current = y;
      // Fire when they've SEEN pricing, are scrolling UP, and pricing is now
      // above the fold (rect.bottom < 0 = pricing scrolled off the top).
      if (passedPricingRef.current && isScrollingUp && rect.bottom < 0 && y > 200) {
        fire();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fire() {
    if (!armedRef.current) return;
    armedRef.current = false;
    markShown("shown");
    setPhase("visible");
  }

  function dismiss() {
    markShown("dismissed");
    setPhase("hidden");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("that doesn't look like a valid email");
      return;
    }
    setPhase("submitting");
    try {
      const { error: dbErr } = await supabase.from("marketing_leads").insert({
        email: trimmed,
        source: "exit_slide_in",
        ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
      });
      // Duplicate email is fine — our promise was "one note", they get one.
      if (dbErr && !/duplicate|unique/i.test(dbErr.message)) {
        throw dbErr;
      }
      markShown("submitted");
      setPhase("done");
    } catch (err) {
      console.error("[exit-slide] submit failed", err);
      setError("something broke on our side — try again in a moment");
      setPhase("visible");
    }
  }

  if (phase === "hidden") return null;

  return (
    <div
      role="dialog"
      aria-label="Stay in the loop"
      className="exit-slide-in"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: "min(360px, calc(100vw - 32px))",
        zIndex: 80,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        boxShadow: "var(--lift-3)",
        padding: 20,
        animation: "exit-slide-in-fade 320ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={dismiss}
        className="press"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 28,
          height: 28,
          borderRadius: 8,
          border: 0,
          background: "transparent",
          color: "var(--ink-faint)",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ×
      </button>

      {phase !== "done" ? (
        <>
          <div className="micro" style={{ marginBottom: 8, color: "var(--ember)" }}>
            Not ready yet?
          </div>
          <p
            className="f-serif"
            style={{
              fontSize: 16,
              lineHeight: 1.45,
              color: "var(--ink)",
              margin: "0 0 14px",
            }}
          >
            Drop us your email and we'll send a single note when the offline vault decryption tool
            ships.{" "}
            <span style={{ fontStyle: "italic", color: "var(--ink-soft)" }}>Nothing else.</span>
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              disabled={phase === "submitting"}
              required
              className="f-sans"
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 14,
                background: "var(--surface-low)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                color: "var(--ink)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {error && (
              <div
                role="alert"
                className="f-sans"
                style={{ fontSize: 12, color: "var(--blood, #c44)" }}
              >
                {error}
              </div>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={phase === "submitting" || !email.trim()}
              className="w-full"
            >
              {phase === "submitting" ? "Sending…" : "Send me the note"}
            </Button>
          </form>

          <div
            className="f-sans"
            style={{
              marginTop: 10,
              fontSize: 11,
              color: "var(--ink-faint)",
              fontStyle: "italic",
              lineHeight: 1.4,
            }}
          >
            no marketing list · one email, then silence ·{" "}
            <a href="/privacy" style={{ color: "inherit", textDecoration: "underline" }}>
              privacy
            </a>
          </div>

          <button
            type="button"
            onClick={dismiss}
            className="f-sans press"
            style={{
              marginTop: 8,
              background: "transparent",
              border: 0,
              padding: 0,
              fontSize: 11,
              color: "var(--ink-faint)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            no thanks
          </button>
        </>
      ) : (
        <>
          <div className="micro" style={{ marginBottom: 8, color: "var(--ember)" }}>
            Got it.
          </div>
          <p
            className="f-serif"
            style={{
              fontSize: 16,
              lineHeight: 1.45,
              color: "var(--ink)",
              margin: 0,
            }}
          >
            We'll be quiet until there's something worth telling you.
          </p>
        </>
      )}

      <style>{`
        @keyframes exit-slide-in-fade {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 540px) {
          .exit-slide-in {
            left: 16px !important;
            right: 16px !important;
            bottom: 16px !important;
            width: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
