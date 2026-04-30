import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { useSubscription } from "../lib/useSubscription";

interface UsageWarningBannerProps {
  onNavigate?: (view: string) => void;
}

const STORAGE_KEY = "everion_usage_warning_dismissed";
const WARN_THRESHOLD = 80;

function dismissedKey(period: string, action: string, tier: string): string {
  return `${STORAGE_KEY}:${tier}:${period}:${action}`;
}

export function UsageWarningBanner({ onNavigate }: UsageWarningBannerProps) {
  const { tier, usage, limits, pct, isLoading } = useSubscription();
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set());

  const period = useMemo(() => new Date().toISOString().slice(0, 7), []);

  useEffect(() => {
    const fresh = new Set<string>();
    if (typeof localStorage === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR fallback; resets to empty set on environments without localStorage so the banner renders deterministically.
      setDismissedKeys(fresh);
      return;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY + ":")) fresh.add(key);
    }
    setDismissedKeys(fresh);
  }, [period, tier]);

  if (isLoading) return null;
  if (tier === "free" || tier === "max") return null;

  const offenders: Array<{ action: "captures" | "chats"; pct: number }> = [];
  for (const action of ["captures", "chats"] as const) {
    const p = pct[action];
    if (typeof p === "number" && p >= WARN_THRESHOLD) {
      offenders.push({ action, pct: p });
    }
  }
  if (offenders.length === 0) return null;

  const visible = offenders.filter((o) => !dismissedKeys.has(dismissedKey(period, o.action, tier)));
  if (visible.length === 0) return null;

  const top = visible.sort((a, b) => b.pct - a.pct)[0];
  const overLimit = top.pct >= 100;
  const used = usage[top.action];
  const cap = limits[top.action];
  const noun = top.action === "captures" ? "captures" : "chats";

  function dismiss() {
    const key = dismissedKey(period, top.action, tier);
    try {
      localStorage.setItem(key, "1");
    } catch {
      // ignore
    }
    setDismissedKeys((prev) => new Set(prev).add(key));
  }

  function upgrade() {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "billing");
    window.history.replaceState({}, "", url.toString());
    onNavigate?.("settings");
  }

  return (
    <div
      className="mx-4 mt-4 mb-2 flex items-start gap-3 rounded-2xl border p-4"
      style={{
        background: overLimit
          ? "color-mix(in oklch, var(--ember) 10%, var(--color-surface))"
          : "color-mix(in oklch, var(--ember) 6%, var(--color-surface))",
        borderColor: "color-mix(in oklch, var(--ember) 24%, transparent)",
      }}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-base"
        style={{ background: "color-mix(in oklch, var(--ember) 16%, transparent)" }}
      >
        ⚡
      </div>
      <div className="flex-1 text-sm leading-relaxed">
        <div className="text-on-surface" style={{ fontWeight: 600 }}>
          {overLimit ? `${noun} limit reached` : `${top.pct}% of monthly ${noun} used`}
        </div>
        <div className="text-on-surface-variant mt-0.5" style={{ fontSize: 13 }}>
          {used} of {cap} {noun} this month on{" "}
          {tier === "starter" ? "Starter" : tier === "pro" ? "Pro" : tier}.{" "}
          {overLimit
            ? "New ones will queue or fail until next month — or upgrade now."
            : tier === "starter"
              ? "Pro gives you 4× the headroom."
              : "Resets on the 1st."}
        </div>
      </div>
      {tier !== "pro" && (
        <Button size="xs" variant="default" onClick={upgrade} className="press-scale flex-shrink-0">
          Upgrade →
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-on-surface-variant/50 hover:text-on-surface press-scale mt-0.5 flex-shrink-0"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Button>
    </div>
  );
}
