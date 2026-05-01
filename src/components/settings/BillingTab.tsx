import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useSubscription } from "../../lib/useSubscription";
import { authFetch } from "../../lib/authFetch";
import SettingsRow, { SettingsButton } from "./SettingsRow";

function UsageMeter({
  label,
  used,
  limit,
  pct,
}: {
  label: string;
  used: number;
  limit: number;
  pct?: number;
}) {
  if (limit === 0 || limit >= 9999) return null;
  const p = pct ?? Math.min(100, Math.round((used / limit) * 100));
  const color = p >= 100 ? "var(--blood)" : p >= 90 ? "var(--amber, #f59e0b)" : "var(--moss)";
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        className="f-sans"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          marginBottom: 5,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{label}</span>
        <span style={{ color: p >= 90 ? color : "var(--ink-faint)" }}>
          {used} / {limit}
        </span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: "var(--line-soft)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${p}%`,
            background: color,
            borderRadius: 2,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  tagline,
  accent,
  highlight = false,
  busy = false,
  onClick,
}: {
  name: string;
  price: string;
  tagline: string;
  accent: string;
  highlight?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="press f-sans"
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px",
        borderRadius: 12,
        border: `1px solid ${highlight ? accent : "var(--line)"}`,
        background: highlight
          ? `color-mix(in oklch, ${accent} 8%, var(--surface))`
          : "var(--surface)",
        cursor: busy ? "wait" : "pointer",
        textAlign: "left",
        gap: 12,
        opacity: busy ? 0.6 : 1,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: accent,
            marginBottom: 3,
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{tagline}</div>
      </div>
      <div style={{ flexShrink: 0, textAlign: "right" }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)", lineHeight: 1.1 }}>
          {price}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>/ mo</div>
      </div>
    </button>
  );
}

// Web checkout — opens LemonSqueezy hosted page in same tab.
async function startWebCheckout(plan: "starter" | "pro"): Promise<{ ok: boolean; error?: string }> {
  const r = await authFetch("/api/lemon-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  if (!r.ok) {
    let message = "Checkout failed";
    try {
      const j = (await r.json()) as { error?: string };
      if (j?.error) message = j.error;
    } catch {
      /* non-JSON */
    }
    return { ok: false, error: message };
  }
  const { url } = (await r.json()) as { url?: string };
  if (!url) return { ok: false, error: "No checkout URL returned" };
  window.location.href = url;
  return { ok: true };
}

// Native checkout — drives the RevenueCat SDK paywall. We dynamic-import so
// the SDK doesn't enter the web bundle (it pulls native bridge code Vite
// can't tree-shake).
//
// Configure-then-purchase is one round trip: configure() is idempotent, so
// calling it on every checkout keeps the appUserId bound to user_profiles.id
// even after a sign-out/sign-in cycle without us tracking RC state separately.
async function startNativeCheckout(
  appUserId: string,
  plan: "starter" | "pro",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");

    // Pick the platform-specific public RC key. Vite inlines these at build,
    // so they must be prefixed VITE_*. Missing keys are operator error —
    // surface clearly rather than failing inside the native bridge.
    const isIOS = Capacitor.getPlatform() === "ios";
    const apiKey = isIOS
      ? import.meta.env.VITE_REVENUECAT_API_KEY_IOS
      : import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID;
    if (!apiKey || typeof apiKey !== "string") {
      return {
        ok: false,
        error: `Missing VITE_REVENUECAT_API_KEY_${isIOS ? "IOS" : "ANDROID"}`,
      };
    }

    await Purchases.configure({ apiKey, appUserID: appUserId });

    const offeringsRes = await Purchases.getOfferings();
    const current = offeringsRes.current;
    if (!current) {
      return { ok: false, error: "No offerings configured in RevenueCat dashboard" };
    }
    const pkg = current.availablePackages.find((p) => p.identifier.toLowerCase().includes(plan));
    if (!pkg) {
      return { ok: false, error: `No package found for tier "${plan}"` };
    }
    await Purchases.purchasePackage({ aPackage: pkg });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Native checkout failed";
    // RC throws on user-cancelled; treat that as a soft no-op.
    if (/cancel/i.test(message)) return { ok: false };
    return { ok: false, error: message };
  }
}

async function openPortal(): Promise<{ ok: boolean; error?: string }> {
  const r = await authFetch("/api/lemon-portal", { method: "POST" });
  if (!r.ok) {
    let message = "Could not open billing portal";
    try {
      const j = (await r.json()) as { error?: string };
      if (j?.error) message = j.error;
    } catch {
      /* non-JSON */
    }
    return { ok: false, error: message };
  }
  const { url } = (await r.json()) as { url?: string };
  if (!url) return { ok: false, error: "No portal URL returned" };
  window.location.href = url;
  return { ok: true };
}

export default function BillingTab() {
  const { tier, usage, limits, pct, renewalDate, provider, isLoading } = useSubscription();
  const [busyPlan, setBusyPlan] = useState<"starter" | "pro" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appUserId, setAppUserId] = useState<string | null>(null);

  const isNative = Capacitor.isNativePlatform();

  // Need user.id for the RC native flow — read it once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Lazy-import supabase to avoid the BillingTab pulling it on every chat
      // session that never opens settings. The app's main bundle already has
      // it cached so this resolves synchronously after first auth.
      const { supabase } = await import("../../lib/supabase");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) setAppUserId(user?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Strip ?billing=success / ?billing=cancel after returning from LemonSqueezy.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing")) {
      params.delete("billing");
      const newUrl = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  async function startCheckout(plan: "starter" | "pro") {
    setError(null);
    setBusyPlan(plan);
    try {
      const res = isNative
        ? appUserId
          ? await startNativeCheckout(appUserId, plan)
          : { ok: false, error: "Not signed in" }
        : await startWebCheckout(plan);
      if (!res.ok && res.error) setError(res.error);
    } finally {
      setBusyPlan(null);
    }
  }

  async function handleManage() {
    setError(null);
    setBusyPlan("portal");
    try {
      // Native users manage in App Store / Play settings — we can't open
      // those from inside the app reliably, so surface a hint instead of
      // calling /api/lemon-portal which only works for web subs.
      if (provider === "revenuecat") {
        setError(
          "Manage your subscription from your device's Subscriptions settings (iOS) or Play Store > Subscriptions (Android).",
        );
        return;
      }
      const res = await openPortal();
      if (!res.ok && res.error) setError(res.error);
    } finally {
      setBusyPlan(null);
    }
  }

  const tierLabel =
    tier === "max" ? "Max" : tier === "pro" ? "Pro" : tier === "starter" ? "Starter" : "Hobby";
  const tierColor =
    tier === "max" || tier === "pro"
      ? "var(--ember)"
      : tier === "starter"
        ? "var(--moss)"
        : "var(--ink-ghost)";

  if (isLoading) {
    return (
      <div
        className="f-sans"
        style={{ fontSize: 13, color: "var(--ink-faint)", padding: "24px 0" }}
      >
        Loading billing info…
      </div>
    );
  }

  return (
    <div>
      {/* Current plan */}
      <SettingsRow label="Current plan">
        <span
          className="f-sans"
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: tierColor,
            background: `${tierColor}18`,
            padding: "3px 8px",
            borderRadius: 5,
          }}
        >
          {tierLabel}
        </span>
        {renewalDate && tier !== "free" && (
          <span
            className="f-sans"
            style={{ fontSize: 11, color: "var(--ink-ghost)", marginLeft: 8 }}
          >
            renews {new Date(renewalDate).toLocaleDateString()}
          </span>
        )}
      </SettingsRow>

      {error && (
        <div
          className="f-sans"
          role="alert"
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            background: "color-mix(in oklch, var(--blood) 12%, var(--surface))",
            border: "1px solid color-mix(in oklch, var(--blood) 35%, transparent)",
            color: "var(--ink)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Usage meters (only for paid tiers) */}
      {tier !== "free" && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            borderRadius: 12,
            padding: "16px 18px",
            marginTop: 16,
            marginBottom: 16,
          }}
        >
          <div
            className="f-sans"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              marginBottom: 14,
            }}
          >
            Usage this month
          </div>
          <UsageMeter
            label="Captures"
            used={usage.captures}
            limit={limits.captures}
            pct={pct.captures}
          />
          <UsageMeter label="Chats" used={usage.chats} limit={limits.chats} pct={pct.chats} />
          <UsageMeter label="Voice notes" used={usage.voice} limit={limits.voice} pct={pct.voice} />
          <UsageMeter
            label="Improve scans"
            used={usage.improve}
            limit={limits.improve}
            pct={pct.improve}
          />
        </div>
      )}

      {/* Upgrade / manage buttons */}
      {tier === "free" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
          <PlanCard
            name="Starter"
            price="$4.99"
            tagline="Platform AI + 500 captures / mo"
            accent="var(--moss)"
            busy={busyPlan === "starter"}
            onClick={() => startCheckout("starter")}
          />
          <PlanCard
            name="Pro"
            price="$9.99"
            tagline="Sonnet AI + 2 000 captures + all features"
            accent="var(--ember)"
            highlight
            busy={busyPlan === "pro"}
            onClick={() => startCheckout("pro")}
          />
        </div>
      )}
      {tier === "starter" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
          <PlanCard
            name="Pro"
            price="$9.99"
            tagline="Sonnet AI + 2 000 captures + all features"
            accent="var(--ember)"
            highlight
            busy={busyPlan === "pro"}
            onClick={() => startCheckout("pro")}
          />
          <div style={{ marginTop: 4 }}>
            <SettingsButton onClick={handleManage} disabled={busyPlan === "portal"}>
              Manage subscription
            </SettingsButton>
          </div>
        </div>
      )}
      {(tier === "pro" || tier === "max") && (
        <div style={{ marginTop: 16 }}>
          <SettingsButton onClick={handleManage} disabled={busyPlan === "portal"}>
            Manage subscription
          </SettingsButton>
        </div>
      )}

      {/* Plan comparison */}
      <div
        style={{
          marginTop: 28,
          background: "var(--surface)",
          border: "1px solid var(--line-soft)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {(["", "Hobby", "Starter", "Pro", "Max"] as const).map((h) => (
                <th
                  key={h}
                  className="f-sans"
                  style={{
                    padding: "10px 14px",
                    textAlign: h === "" ? "left" : "center",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: h === tierLabel ? "var(--ember)" : "var(--ink-faint)",
                    borderBottom: "1px solid var(--line-soft)",
                    background: "var(--surface-high)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              {
                label: "Price",
                free: "$0",
                starter: "$4.99/mo",
                pro: "$9.99/mo",
                max: "$19.99/mo",
              },
              { label: "Raw capture", free: "✓", starter: "✓", pro: "✓", max: "✓" },
              { label: "BYOK AI", free: "✓", starter: "✓", pro: "✓", max: "✓" },
              { label: "Platform AI", free: "—", starter: "✓", pro: "✓", max: "✓" },
              { label: "Captures / mo", free: "—", starter: "500", pro: "2 000", max: "Unlimited" },
              { label: "Chats / mo", free: "—", starter: "200", pro: "1 000", max: "Unlimited" },
              {
                label: "AI models",
                free: "—",
                starter: "Flash",
                pro: "Sonnet",
                max: "Frontier",
              },
              { label: "File storage", free: "—", starter: "—", pro: "—", max: "✓" },
              { label: "All features", free: "—", starter: "—", pro: "✓", max: "✓" },
            ].map((row, i) => (
              <tr
                key={row.label}
                style={{ background: i % 2 === 0 ? "transparent" : "var(--surface-high)" }}
              >
                <td
                  className="f-sans"
                  style={{ padding: "9px 14px", fontSize: 12, color: "var(--ink-soft)" }}
                >
                  {row.label}
                </td>
                {(["free", "starter", "pro", "max"] as const).map((t) => (
                  <td
                    key={t}
                    className="f-sans"
                    style={{
                      padding: "9px 14px",
                      fontSize: 12,
                      textAlign: "center",
                      color:
                        row[t] === "—"
                          ? "var(--ink-ghost)"
                          : row[t] === "✓"
                            ? "var(--moss)"
                            : t === "max"
                              ? // Max is wired but not yet purchaseable — keep its
                                // column visually present but muted so users don't
                                // expect to upgrade today. Coming-soon label below
                                // the table communicates the timing.
                                "var(--ink-soft)"
                              : "var(--ink)",
                      fontWeight: t === tier ? 600 : 400,
                    }}
                  >
                    {row[t]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div
          className="f-sans"
          style={{
            padding: "10px 14px",
            fontSize: 11,
            color: "var(--ink-faint)",
            borderTop: "1px solid var(--line-soft)",
            textAlign: "center",
            background: "var(--surface-high)",
          }}
        >
          Max — frontier AI models, unlimited usage, file storage to app or vault.{" "}
          <span style={{ color: "var(--ember)", fontWeight: 600 }}>Coming soon.</span>
        </div>
      </div>
    </div>
  );
}
