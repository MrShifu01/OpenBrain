import { useState, useEffect, type JSX } from "react";
import { authFetch } from "../lib/authFetch";
import { Button } from "./ui/button";

const STATUS_FLASH_MS = 3000;
const ERROR_FLASH_MS = 8000;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

const DAYS_OF_WEEK = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const LEAD_OPTIONS = [90, 30, 7, 1];

interface NotificationPrefs {
  daily_enabled: boolean;
  daily_time: string;
  daily_timezone: string;
  nudge_enabled: boolean;
  nudge_day: string;
  nudge_time: string;
  nudge_timezone: string;
  expiry_enabled: boolean;
  expiry_lead_days: number[];
}

const DEFAULT_PREFS: NotificationPrefs = {
  daily_enabled: false,
  daily_time: "20:00",
  daily_timezone: detectTimezone(),
  nudge_enabled: false,
  nudge_day: "sunday",
  nudge_time: "10:00",
  nudge_timezone: detectTimezone(),
  expiry_enabled: false,
  expiry_lead_days: [90, 30, 7, 1],
};

import SettingsRow, { SettingsButton, SettingsToggle } from "./settings/SettingsRow";

const cardClasses = "design-card"; // legacy placeholder — unused now
const labelClasses = "text-[13px] font-bold text-on-surface m-0 mb-0.5";
const subClasses = "text-[11px] text-on-surface-variant m-0 mb-3";

// ── Shared styled controls ──────────────────────────────────────────────
//
// Native <input type="time"> renders very differently across browsers and
// OS skins (especially iOS Safari) and clashes with the rest of the app.
// We strip native chrome with appearance:none and use our design tokens
// so every control here looks like part of the same family — same height,
// same border, same ember focus ring, same fonts.

const fieldStyle: React.CSSProperties = {
  padding: "0 12px",
  height: 38,
  background: "var(--surface-low)",
  border: "1px solid var(--line-soft)",
  borderRadius: 10,
  color: "var(--ink)",
  fontFamily: "var(--f-sans)",
  fontSize: 13,
  fontWeight: 500,
  outline: "none",
  transition: "border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
};

// Stripped-native <select> with our chevron baked in via background-image.
// Looks identical across Chrome, Safari, Firefox, iOS — and on mobile the
// OS still shows its native picker when tapped, which is what users want.
function StyledSelect({
  value,
  onChange,
  children,
  width,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  width?: number | string;
  ariaLabel?: string;
}): JSX.Element {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="press"
      style={{
        ...fieldStyle,
        width: width ?? "auto",
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        paddingRight: 32,
        cursor: "pointer",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'><path d='M1 1L5 5L9 1' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        backgroundSize: "10px 6px",
      }}
    >
      {children}
    </select>
  );
}

// 24 hour options shown in localized 12-hour format ("8:00 PM") but stored
// as "HH:00". Cron is hourly, so this matches the actual resolution; minute
// precision in the UI would lie about when notifications actually fire.
const HOURS = Array.from({ length: 24 }, (_, h) => {
  const period = h < 12 ? "AM" : "PM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return {
    value: String(h).padStart(2, "0") + ":00",
    label: `${display}:00 ${period}`,
  };
});

function HourSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}): JSX.Element {
  // Normalize "20:00" or "20:30" to nearest hour bucket so the select shows
  // a matching option (DB might still hold a legacy minute-level value).
  const hourOnly = (value || "20:00").split(":")[0].padStart(2, "0") + ":00";
  return (
    <StyledSelect value={hourOnly} onChange={onChange} width={140} ariaLabel={ariaLabel}>
      {HOURS.map((h) => (
        <option key={h.value} value={h.value}>
          {h.label}
        </option>
      ))}
    </StyledSelect>
  );
}

function DaySelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}): JSX.Element {
  return (
    <StyledSelect value={value} onChange={onChange} width={140} ariaLabel={ariaLabel}>
      {DAYS_OF_WEEK.map((d) => (
        <option key={d} value={d}>
          {d.charAt(0).toUpperCase() + d.slice(1)}
        </option>
      ))}
    </StyledSelect>
  );
}

// Pretty timezone chip. Auto-detected by default — read-only with a Change
// pill that flips to an editable input. Avoids the bare text field that
// looked like a stray bug-report form.
function TimezoneField({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}): JSX.Element {
  const detected = detectTimezone();
  const usingDetected = value === detected;
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
        <input
          aria-label={ariaLabel}
          type="text"
          value={value}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") setEditing(false);
          }}
          placeholder="e.g. Europe/London"
          style={{ ...fieldStyle, flex: 1, minWidth: 180 }}
        />
        <Button
          type="button"
          onClick={() => {
            onChange(detected);
            setEditing(false);
          }}
          variant="outline"
          size="sm"
          style={{ color: "var(--ember)" }}
        >
          Reset
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={ariaLabel}
      className="press"
      style={{
        ...fieldStyle,
        flex: 1,
        minWidth: 200,
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 8,
        justifyContent: "space-between",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {usingDetected && (
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "var(--ember)",
              flexShrink: 0,
            }}
          />
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value || detected}
        </span>
      </span>
      <span style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 600, flexShrink: 0 }}>
        {usingDetected ? "auto" : "custom"}
      </span>
    </button>
  );
}

// Container row used by both Daily and Nudge timing controls. Card-style
// surface that visually groups the time/day/tz fields under their toggle
// instead of leaving them to float as bare inputs.
function TimingCard({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        padding: 14,
        marginBottom: 14,
        background: "var(--surface)",
        border: "1px solid var(--line-soft)",
        borderRadius: 12,
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <span
      className="micro"
      style={{
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 10,
        fontWeight: 600,
        color: "var(--ink-faint)",
      }}
    >
      {children}
    </span>
  );
}

function DailyTimingControls({
  prefs,
  savePref,
}: {
  prefs: NotificationPrefs;
  savePref: (u: Partial<NotificationPrefs>) => Promise<void>;
}): JSX.Element {
  return (
    <TimingCard>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel>Time</FieldLabel>
        <HourSelect
          value={prefs.daily_time}
          onChange={(v) => savePref({ daily_time: v })}
          ariaLabel="Daily prompt time"
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 220 }}>
        <FieldLabel>Timezone</FieldLabel>
        <TimezoneField
          value={prefs.daily_timezone}
          onChange={(v) => savePref({ daily_timezone: v })}
          ariaLabel="Daily prompt timezone"
        />
      </label>
    </TimingCard>
  );
}

function NudgeTimingControls({
  prefs,
  savePref,
}: {
  prefs: NotificationPrefs;
  savePref: (u: Partial<NotificationPrefs>) => Promise<void>;
}): JSX.Element {
  return (
    <TimingCard>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel>Day</FieldLabel>
        <DaySelect
          value={prefs.nudge_day}
          onChange={(v) => savePref({ nudge_day: v })}
          ariaLabel="Nudge day of week"
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel>Time</FieldLabel>
        <HourSelect
          value={prefs.nudge_time}
          onChange={(v) => savePref({ nudge_time: v })}
          ariaLabel="Nudge time"
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 220 }}>
        <FieldLabel>Timezone</FieldLabel>
        <TimezoneField
          value={prefs.nudge_timezone}
          onChange={(v) => savePref({ nudge_timezone: v })}
          ariaLabel="Nudge timezone"
        />
      </label>
    </TimingCard>
  );
}

export default function NotificationSettings(): JSX.Element {
  const [permission, setPermission] = useState<string>(
    "Notification" in window ? Notification.permission : "unsupported",
  );
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  // Subscribing state — push subscription on mobile can take 5–15s while
  // the browser hits FCM/APNs and round-trips to the server. Without a
  // visible loading state the user thinks the app froze and force-quits.
  // null = idle, "subscribing" = setting up, "unsubscribing" = tearing down
  const [busy, setBusy] = useState<null | "subscribing" | "unsubscribing">(null);

  const pushSupported = "serviceWorker" in navigator && "PushManager" in window;
  const iosNoStandalone = isIOS() && !("Notification" in window);

  useEffect(() => {
    authFetch("/api/notification-prefs")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPrefs(data ? { ...DEFAULT_PREFS, ...data } : DEFAULT_PREFS))
      .catch(() => setPrefs(DEFAULT_PREFS))
      .finally(() => setLoading(false));

    if (pushSupported) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscription(sub))
        .catch((err) =>
          console.error("[NotificationSettings] Failed to get push subscription", err),
        );
    }
  }, []);

  async function handleEnable() {
    if (!pushSupported || busy) return;
    setBusy("subscribing");
    try {
      // Permission prompt is fast (native dialog) but we keep the busy
      // state on so the UI doesn't flash idle between dialog dismissal
      // and the slow pushManager.subscribe() that follows.
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        flash("VAPID key not configured — push notifications need server setup");
        return;
      }
      // pushManager.subscribe is the slow step — it round-trips to the
      // browser's push service (FCM on Android/Chrome, APNs on iOS).
      // Can take 5–15s on a cold mobile connection.
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
      setSubscription(sub);
      const json = sub.toJSON();
      const resp = await authFetch("/api/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent.slice(0, 150),
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        flash("Failed to save subscription — " + (err.error || "server error"));
        return;
      }
      flash("Notifications enabled");
    } catch (err: any) {
      console.error("[Push] subscribe error:", err);
      flash("Failed to enable — " + (err.message || "unknown error"));
    } finally {
      setBusy(null);
    }
  }

  async function handleDisable() {
    if (!subscription || busy) return;
    setBusy("unsubscribing");
    try {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      setSubscription(null);
      await authFetch("/api/push-subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      flash("Notifications disabled");
    } finally {
      setBusy(null);
    }
  }

  async function savePref(updates: Partial<NotificationPrefs>): Promise<void> {
    setPrefs((p) => ({ ...p, ...updates }));
    setSaving(true);
    try {
      await authFetch("/api/notification-prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleLeadDay(day: number): void {
    const current = prefs.expiry_lead_days || [];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => b - a);
    savePref({ expiry_lead_days: next });
  }

  function flash(msg: string): void {
    setStatusMsg(msg);
    const isError = msg.includes("Failed") || msg.includes("not configured");
    setTimeout(() => setStatusMsg(null), isError ? ERROR_FLASH_MS : STATUS_FLASH_MS);
  }

  const isStatusError =
    statusMsg && (statusMsg.includes("Failed") || statusMsg.includes("not configured"));

  if (loading) return <div className="text-on-surface-variant py-6 text-[13px]">Loading…</div>;

  // iOS not in standalone → show home screen instructions
  if (iosNoStandalone) {
    return (
      <div className={cardClasses}>
        <p className={labelClasses}>📱 Notifications on iPhone</p>
        <p className={subClasses}>
          To receive notifications, OpenBrain must be on your Home Screen.
        </p>
        <ol className="text-on-surface-variant/60 m-0 pl-5 text-xs leading-8">
          <li>
            Tap the <strong>Share button</strong> (□↑) in Safari
          </li>
          <li>
            Tap <strong>"Add to Home Screen"</strong>
          </li>
          <li>Open OpenBrain from your Home Screen</li>
          <li>Come back here to enable notifications</li>
        </ol>
      </div>
    );
  }

  // Push not supported at all
  if (!pushSupported) {
    return (
      <div className={cardClasses}>
        <p className={labelClasses}>Notifications</p>
        <p className="text-on-surface-variant m-0 text-[11px]">
          Push notifications are not supported in this browser.
        </p>
      </div>
    );
  }

  const subscribed = !!subscription && permission === "granted";

  return (
    <div>
      {/* Status / error flash */}
      {(saving || statusMsg) && (
        <p
          className="f-serif"
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            fontStyle: "italic",
            color: isStatusError ? "var(--blood)" : "var(--ink-faint)",
          }}
        >
          {saving ? "saving…" : statusMsg}
        </p>
      )}

      {/* Master toggle / permission state */}
      {permission === "denied" ? (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: "var(--blood-wash)",
            border: "1px solid var(--blood)",
            marginBottom: 8,
          }}
        >
          <p
            className="f-serif"
            style={{ margin: 0, fontSize: 14, color: "var(--blood)", fontStyle: "italic" }}
          >
            notifications blocked. enable them in your browser settings, then reload.
          </p>
        </div>
      ) : (
        <SettingsRow
          label="Push notifications"
          hint={
            busy === "subscribing"
              ? "talking to your browser's push service — this can take a few seconds on mobile…"
              : busy === "unsubscribing"
                ? "removing this device…"
                : subscribed
                  ? "active on this device."
                  : "not subscribed on this device."
          }
        >
          {subscribed ? (
            <SettingsButton onClick={handleDisable} disabled={!!busy} danger>
              {busy === "unsubscribing" ? "Disabling…" : "Disable"}
            </SettingsButton>
          ) : (
            <SettingsButton onClick={handleEnable} disabled={!!busy}>
              {busy === "subscribing" ? "Enabling…" : "Enable"}
            </SettingsButton>
          )}
        </SettingsRow>
      )}

      {subscribed && (
        <>
          <SettingsRow
            label="Daily capture prompt"
            hint={`a nightly nudge at ${prefs.daily_time} (${prefs.daily_timezone}) to capture what's worth remembering.`}
          >
            <SettingsToggle
              value={prefs.daily_enabled}
              onChange={(v) => savePref({ daily_enabled: v })}
              ariaLabel="Daily capture prompt"
            />
          </SettingsRow>
          {prefs.daily_enabled && <DailyTimingControls prefs={prefs} savePref={savePref} />}

          <SettingsRow
            label="Quiet nudge"
            hint="when something in your memory rhymes with something new. weekly at most."
          >
            <SettingsToggle
              value={prefs.nudge_enabled}
              onChange={(v) => savePref({ nudge_enabled: v })}
              ariaLabel="Quiet nudge"
            />
          </SettingsRow>
          {prefs.nudge_enabled && <NudgeTimingControls prefs={prefs} savePref={savePref} />}

          <SettingsRow
            label="Expiry reminders"
            hint="alerts before passport, licence, insurance expire."
            last={!prefs.expiry_enabled}
          >
            <SettingsToggle
              value={prefs.expiry_enabled}
              onChange={(v) => savePref({ expiry_enabled: v })}
              ariaLabel="Expiry reminders"
            />
          </SettingsRow>
          {prefs.expiry_enabled && (
            <div
              style={{
                padding: "4px 0 18px",
              }}
            >
              <div className="micro" style={{ marginBottom: 8 }}>
                remind me this many days before
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {LEAD_OPTIONS.map((day) => {
                  const active = (prefs.expiry_lead_days || []).includes(day);
                  return (
                    <Button
                      key={day}
                      onClick={() => toggleLeadDay(day)}
                      aria-pressed={active}
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      style={{
                        background: active ? "var(--ember-wash)" : "var(--surface)",
                        color: active ? "var(--ember)" : "var(--ink-soft)",
                        borderColor: active ? "var(--ember)" : "var(--line-soft)",
                      }}
                    >
                      {day}d
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
