import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { authFetch } from "../../lib/authFetch";
import SettingsRow, { SettingsButton } from "./SettingsRow";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { FEATURE_FLAGS, getAdminFlags, setAdminFlag } from "../../lib/featureFlags";
import {
  ADMIN_PREF_DEFS,
  getAdminPrefs,
  setAdminPref,
  type AdminPrefs,
} from "../../lib/adminPrefs";
import GmailScanReviewModal from "./GmailScanReviewModal";
import { MOCK_REVIEW_ITEMS } from "../../data/mockGmailReviewItems";
import { useEntries } from "../../context/EntriesContext";
import { explainPlacements, toDateKey } from "../../views/todoUtils";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";

type TestStatus = "idle" | "running" | "pass" | "fail";

interface TestResult {
  status: TestStatus;
  latencyMs?: number;
  detail?: string;
}

function ResultBlock({ result }: { result: TestResult }) {
  if (result.status === "idle") return null;
  if (result.status === "running") {
    return (
      <div
        style={{
          marginTop: 10,
          fontFamily: "var(--f-mono)",
          fontSize: 12,
          color: "var(--ink-faint)",
        }}
      >
        running…
      </div>
    );
  }
  const pass = result.status === "pass";
  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        borderRadius: 8,
        background: pass ? "var(--surface-low)" : "var(--blood-wash)",
        border: `1px solid ${pass ? "var(--line-soft)" : "var(--blood)"}`,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: result.detail ? 6 : 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--f-mono)",
            fontSize: 12,
            fontWeight: 700,
            color: pass ? "var(--ember)" : "var(--blood)",
          }}
        >
          {pass ? "✓ PASS" : "✗ FAIL"}
        </span>
        {result.latencyMs != null && (
          <span style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-faint)" }}>
            {result.latencyMs}ms
          </span>
        )}
      </div>
      {result.detail && (
        <pre
          style={{
            margin: 0,
            fontFamily: "var(--f-mono)",
            fontSize: 11,
            color: "var(--ink-soft)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
          {result.detail}
        </pre>
      )}
    </div>
  );
}

const SPLIT_TEST_INPUT = `{"contacts":[{"id":"armand_loots","type":"person","category":"plumbing","name":"Armand Loots","phone":"+27836887174"},{"id":"dave_schoeman","type":"person","category":"irrigation","name":"Dave Schoeman","phone":"+27829643397"},{"id":"evert_venter","type":"person","category":"electrician","name":"Evert Venter","phone":"+27828027452","notes":"COC completed"},{"id":"conrad_van_rensburg","type":"person","category":"security","name":"Conrad van Rensburg","phone":"+27824636417","services":["alarm","cameras","beams"]},{"id":"tracking_alarm_services","type":"company","category":"security","name":"Tracking Alarm Services","phone":"+27824636417"},{"id":"hein_oasis_pools","type":"person","category":"pool_maintenance","name":"Hein (Oasis Pools)","phone":"+27843532439"},{"id":"euan_vosloo","type":"person","category":"pool_construction","name":"Euan Vosloo","phone":"+27825565474"},{"id":"lapas_garnett","type":"person","category":"lawn_service","name":"Lapas Garnett","phone":"+27824518077"},{"id":"thys_buhrmann","type":"person","category":"general_maintenance","name":"Thys Buhrmann","phone":"+27827722083"},{"id":"kobus_visser","type":"person","category":"garage","name":"Kobus Visser","phone":"+27827006827"}]}`;

const CAPTURE_SYSTEM = `You classify and structure a raw text capture into one or more OpenBrain entries. Return ONLY valid JSON.
SPLIT RULES: If the input contains 2 or more clearly distinct real-world entities (e.g. a person + their company, multiple ingredients, a vehicle + its insurance, a recipe + a supplier), return a JSON ARRAY of entries. A name alias for the same entity is NOT a split. Otherwise return a single JSON OBJECT.
Single: {"title":"...","content":"...","type":"...","icon":"SINGLE_EMOJI","metadata":{},"tags":[],"workspace":"business"|"personal"|"both","confidence":{"type":"extracted"|"inferred"|"ambiguous","tags":"...","title":"...","content":"..."}}
Multiple: [{"title":"...","content":"...","type":"...","icon":"SINGLE_EMOJI","metadata":{},"tags":[],"workspace":"...","confidence":{...}}, ...]
CRITICAL: Any phone number found ANYWHERE in the input MUST go into metadata.phone.`;

const TIER_OPTIONS = ["free", "starter", "pro", "max"] as const;
type TierOption = (typeof TIER_OPTIONS)[number];

function TierChanger() {
  const [current, setCurrent] = useState<TierOption>("free");
  const [selected, setSelected] = useState<TierOption>("free");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("tier")
        .eq("id", user.id)
        .single();
      const t = (data?.tier ?? "free") as TierOption;
      setCurrent(t);
      setSelected(t);
    });
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("user_profiles")
      .update({ tier: selected })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setMsg(`Error: ${error.message}`);
    } else {
      setCurrent(selected);
      setMsg("Tier updated — reload to apply.");
    }
  }

  return (
    <div
      style={{ marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid var(--line-soft)" }}
    >
      <div style={{ marginBottom: 14 }}>
        <div className="f-sans" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          Your tier
        </div>
        <div className="f-sans" style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
          Change your own account tier for testing. Current: <strong>{current}</strong>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Select value={selected} onValueChange={(v) => setSelected(v as TierOption)}>
          <SelectTrigger
            className="f-sans"
            style={{
              height: 34,
              borderRadius: 6,
              border: "1px solid var(--line-soft)",
              background: "var(--surface)",
              color: "var(--ink)",
              fontSize: 13,
            }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIER_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SettingsButton onClick={save} disabled={saving || selected === current}>
          {saving ? "Saving…" : "Apply"}
        </SettingsButton>
      </div>
      {msg && (
        <div
          className="f-sans"
          style={{
            fontSize: 12,
            marginTop: 8,
            color: msg.startsWith("Error") ? "var(--blood)" : "var(--moss)",
          }}
        >
          {msg}
        </div>
      )}
    </div>
  );
}

// Phase 5 of the schedule fix: paste an entry id, see exactly which signals
// the placement engine considered, what dates it landed on, and what
// exclusions fired. Catches future "why isn't X showing?" regressions in
// seconds without needing to dig through SQL or code.
function ScheduleInspectorSection() {
  const ctx = useEntries();
  const [input, setInput] = useState("");
  const [resolved, setResolved] = useState<{
    id: string;
    title: string;
    type: string;
    metadata: string;
    actions: ReturnType<typeof explainPlacements>;
    calendar: ReturnType<typeof explainPlacements>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function inspect() {
    setError(null);
    setResolved(null);
    const raw = input.trim();
    if (!raw) {
      setError("Paste an entry id, search title, or full UUID");
      return;
    }
    const all = ctx?.entries ?? [];
    const byId = all.find((e) => e.id === raw);
    const byPartialId = !byId && raw.length >= 6 ? all.find((e) => e.id.startsWith(raw)) : null;
    const byTitle =
      !byId && !byPartialId
        ? all.find((e) => (e.title || "").toLowerCase().includes(raw.toLowerCase()))
        : null;
    const entry = byId ?? byPartialId ?? byTitle;
    if (!entry) {
      setError(`No entry matched "${raw}". Try a UUID, a UUID prefix, or part of the title.`);
      return;
    }

    // Use the visible-month range for calendar mode so the trace matches
    // what TodoCalendarTab would actually compute.
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const range = { from: toDateKey(first), to: toDateKey(last) };

    const actions = explainPlacements(entry, { mode: "actions" });
    const calendar = explainPlacements(entry, {
      mode: "calendar",
      range,
      expandRecurrence: true,
    });

    setResolved({
      id: entry.id,
      title: entry.title,
      type: entry.type,
      metadata: JSON.stringify(entry.metadata ?? {}, null, 2),
      actions,
      calendar,
    });
  }

  return (
    <div
      style={{ marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid var(--line-soft)" }}
    >
      <div style={{ marginBottom: 14 }}>
        <div className="f-sans" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          Schedule inspector
        </div>
        <div className="f-sans" style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
          Paste an entry id (or part of its title) to see why it appears — or doesn't appear — on
          the Schedule views.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && inspect()}
          placeholder="entry-id, uuid prefix, or part of the title"
          className="f-sans"
          style={{
            flex: 1,
            padding: "8px 10px",
            background: "var(--surface-low)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            color: "var(--ink)",
            fontSize: 13,
            outline: "none",
          }}
        />
        <SettingsButton onClick={inspect}>Inspect</SettingsButton>
      </div>
      {error && (
        <div className="f-sans" style={{ fontSize: 12, marginTop: 8, color: "var(--blood)" }}>
          {error}
        </div>
      )}
      {resolved && (
        <div
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 8,
            background: "var(--surface-low)",
            border: "1px solid var(--line-soft)",
          }}
        >
          <div
            className="f-mono"
            style={{ fontSize: 11, color: "var(--ink-faint)", marginBottom: 6 }}
          >
            {resolved.id}
          </div>
          <div
            className="f-sans"
            style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}
          >
            {resolved.title}
          </div>
          <div
            className="f-sans"
            style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 12 }}
          >
            type=<strong style={{ color: "var(--ink)" }}>{resolved.type}</strong>
          </div>
          <PlacementTraceBlock label="My Day / Week (actions mode)" detail={resolved.actions} />
          <PlacementTraceBlock label="Calendar (this month)" detail={resolved.calendar} />
          <Accordion type="single" collapsible>
            <AccordionItem value="metadata" className="border-0">
              <AccordionTrigger
                className="f-sans py-1.5 hover:no-underline"
                style={{ fontSize: 11, color: "var(--ink-faint)" }}
              >
                metadata JSON
              </AccordionTrigger>
              <AccordionContent>
                <pre
                  style={{
                    margin: "6px 0 0",
                    fontFamily: "var(--f-mono)",
                    fontSize: 11,
                    color: "var(--ink-soft)",
                    background: "var(--surface)",
                    padding: 10,
                    borderRadius: 6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 240,
                    overflow: "auto",
                  }}
                >
                  {resolved.metadata}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </div>
  );
}

function PlacementTraceBlock({
  label,
  detail,
}: {
  label: string;
  detail: ReturnType<typeof explainPlacements>;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        className="f-sans"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: detail.excluded ? "var(--blood)" : "var(--ember)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        className="f-sans"
        style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 4 }}
      >
        {detail.dates.length === 0 ? "(no placements)" : detail.dates.join(", ")}
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: 16,
          fontSize: 12,
          color: "var(--ink-soft)",
          fontFamily: "var(--f-mono)",
          lineHeight: 1.5,
        }}
      >
        {detail.trace.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function MockGmailReviewSection() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        style={{ borderBottom: "1px solid var(--line-soft)", paddingBottom: 20, marginBottom: 4 }}
      >
        <SettingsRow
          label="Gmail review UI"
          hint="Opens the swipe review modal with mock cards — no Gmail scan needed."
          last
        >
          <SettingsButton onClick={() => setOpen(true)}>Preview</SettingsButton>
        </SettingsRow>
      </div>
      {open && <GmailScanReviewModal items={MOCK_REVIEW_ITEMS} onClose={() => setOpen(false)} />}
    </>
  );
}

function AdminDisplaySection() {
  const [prefs, setPrefs] = useState<AdminPrefs>(getAdminPrefs);

  const toggle = (key: keyof AdminPrefs, val: boolean) => {
    setAdminPref(key, val);
    setPrefs(getAdminPrefs());
  };

  return (
    <div
      style={{ marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid var(--line-soft)" }}
    >
      <div style={{ marginBottom: 14 }}>
        <div className="f-sans" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          Admin display
        </div>
        <div className="f-sans" style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
          Toggle the admin-only debug overlays scattered through the app. Off = hidden for you (and
          only you), On = back where they were.
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        {ADMIN_PREF_DEFS.map((def) => {
          const on = prefs[def.key];
          return (
            <div
              key={def.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: "var(--surface-low)",
                border: "1px solid var(--line-soft)",
                borderRadius: 8,
              }}
            >
              <div style={{ minWidth: 0, paddingRight: 12 }}>
                <div
                  className="f-sans"
                  style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}
                >
                  {def.label}
                </div>
                <div
                  className="f-sans"
                  style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}
                >
                  {def.hint}
                </div>
              </div>
              <Button
                onClick={() => toggle(def.key, !on)}
                aria-pressed={on}
                variant="outline"
                size="xs"
                className="rounded-full"
                style={{
                  background: on ? "var(--ember-wash)" : "transparent",
                  color: on ? "var(--ember)" : "var(--ink-faint)",
                  borderColor: on ? "var(--ember)" : "var(--line-soft)",
                }}
              >
                {on ? "On" : "Off"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeatureFlagsSection() {
  const [flags, setFlags] = useState(getAdminFlags);

  const toggle = (key: string, val: boolean) => {
    setAdminFlag(key, val);
    setFlags(getAdminFlags());
    window.dispatchEvent(new StorageEvent("storage", { key: "openbrain_admin_flags" }));
  };

  return (
    <div
      style={{ marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid var(--line-soft)" }}
    >
      <div style={{ marginBottom: 14 }}>
        <div className="f-sans" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          Feature Flags
        </div>
        <div className="f-sans" style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
          Toggle individual features on for yourself before making them live in production.
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        {(
          Object.entries(FEATURE_FLAGS) as [
            string,
            { label: string; icon: string; prodEnabled: boolean },
          ][]
        ).map(([key, flag]) => {
          const adminOn = flags[key] ?? false;
          const visibleToYou = flag.prodEnabled || adminOn;
          return (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: "var(--surface-low)",
                border: "1px solid var(--line-soft)",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, color: "var(--ink-faint)" }}>{flag.icon}</span>
                <div>
                  <span
                    className="f-sans"
                    style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}
                  >
                    {flag.label}
                  </span>
                  <span
                    className="f-sans"
                    style={{
                      marginLeft: 10,
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: flag.prodEnabled ? "var(--ember)" : "var(--ink-faint)",
                    }}
                  >
                    {flag.prodEnabled ? "Live" : "Dev only"}
                  </span>
                </div>
              </div>

              {!flag.prodEnabled && (
                <Button
                  onClick={() => toggle(key, !adminOn)}
                  variant="outline"
                  size="xs"
                  style={{
                    background: visibleToYou
                      ? "color-mix(in oklch, var(--ember) 12%, transparent)"
                      : "var(--surface)",
                    color: visibleToYou ? "var(--ember)" : "var(--ink-faint)",
                    borderColor: visibleToYou
                      ? "color-mix(in oklch, var(--ember) 30%, transparent)"
                      : "var(--line-soft)",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: visibleToYou ? "var(--ember)" : "var(--ink-faint)",
                      flexShrink: 0,
                    }}
                  />
                  {visibleToYou ? "Visible to you" : "Hidden"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Admin-only push diagnostic. Triggers the test-push GitHub Actions
// workflow (NOT the Vercel cron path) — keeps the test isolated so we can
// tell whether VAPID + the saved subscription are healthy without Vercel
// being part of the loop. Stays on Hobby plan: no new serverless function,
// just another action handler in the existing user-data.ts.
function PushTestSection() {
  const [enabled, setEnabled] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestResult>({ status: "idle" });
  const [title, setTitle] = useState("Everion · test push");
  const [body, setBody] = useState(
    "Sent from GitHub Actions. If you see this, push is wired correctly.",
  );

  async function send() {
    setSending(true);
    setResult({ status: "running" });
    const t0 = Date.now();
    try {
      const res = await authFetch("/api/user-data?resource=trigger-test-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const ms = Date.now() - t0;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({
          status: "fail",
          latencyMs: ms,
          detail: data?.error || `HTTP ${res.status}`,
        });
        return;
      }
      setResult({
        status: "pass",
        latencyMs: ms,
        detail: [
          "Workflow dispatched. Push delivery happens on the GH Actions runner.",
          data.run_url ? `Run: ${data.run_url}` : "",
          "Notification arrives in ~10–30s if VAPID + your subscription are healthy.",
        ]
          .filter(Boolean)
          .join("\n"),
      });
    } catch (e) {
      setResult({
        status: "fail",
        latencyMs: Date.now() - t0,
        detail: String(e instanceof Error ? e.message : String(e)),
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{ marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid var(--line-soft)" }}
    >
      <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div className="f-sans" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            Push diagnostics
          </div>
          <div className="f-sans" style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
            Toggle on, then send a test push to your own device via the GitHub Actions workflow
            (bypasses Vercel cron entirely).
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label="Push diagnostics toggle"
        />
      </div>

      {enabled && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Title"
              className="f-sans"
              style={{
                padding: "8px 10px",
                background: "var(--surface-low)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                color: "var(--ink)",
                fontSize: 13,
                outline: "none",
              }}
            />
            <input
              type="text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={200}
              placeholder="Body"
              className="f-sans"
              style={{
                padding: "8px 10px",
                background: "var(--surface-low)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                color: "var(--ink)",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
          <SettingsButton onClick={send} disabled={sending}>
            {sending ? "Dispatching…" : "Send test push (via GH Actions)"}
          </SettingsButton>
          <ResultBlock result={result} />
        </>
      )}
    </div>
  );
}

// Toggles the admin-only "daily roundup" push that fires at the end of the
// GitHub Actions cron-daily run with counts (push sent, gmail created,
// brains enriched, persona decay). Stored in user_metadata.notification_prefs
// so it rides the existing /api/user-data?resource=prefs endpoint — no new
// serverless function.
function DailySummarySection() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch("/api/user-data?resource=prefs", { method: "GET" });
        const data = await r.json().catch(() => null);
        setEnabled(data?.admin_summary_enabled === true);
      } catch {
        setEnabled(false);
      }
    })();
  }, []);

  async function toggle(next: boolean) {
    setSaving(true);
    setMsg(null);
    const prev = enabled;
    setEnabled(next);
    try {
      const r = await authFetch("/api/user-data?resource=prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_summary_enabled: next }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setMsg(next ? "On — fires after each cron run." : "Off — no roundup notification.");
    } catch (e) {
      setEnabled(prev);
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  const on = enabled === true;
  return (
    <div
      style={{ marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid var(--line-soft)" }}
    >
      <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div className="f-sans" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            Daily roundup notification
          </div>
          <div className="f-sans" style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
            Push notification at the end of the daily cron with counts (push sent, emails staged,
            brains enriched, persona decay).
          </div>
        </div>
        <Switch
          checked={on}
          disabled={enabled === null || saving}
          onCheckedChange={(next) => !saving && enabled !== null && toggle(next)}
          aria-label="Daily roundup toggle"
        />
      </div>
      {msg && (
        <div
          className="f-sans"
          style={{
            fontSize: 12,
            color: msg.startsWith("Error") ? "var(--blood)" : "var(--ink-faint)",
          }}
        >
          {msg}
        </div>
      )}
    </div>
  );
}

export default function AdminTab() {
  const [authResult, setAuthResult] = useState<TestResult>({ status: "idle" });
  const [llmResult, setLlmResult] = useState<TestResult>({ status: "idle" });
  const [captureResult, setCaptureResult] = useState<TestResult>({ status: "idle" });
  const [splitResult, setSplitResult] = useState<TestResult>({ status: "idle" });
  const [running, setRunning] = useState(false);

  async function testAuth(): Promise<boolean> {
    setAuthResult({ status: "running" });
    const t0 = Date.now();
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      const ms = Date.now() - t0;
      if (error) {
        setAuthResult({ status: "fail", latencyMs: ms, detail: `Auth error: ${error.message}` });
        return false;
      }
      if (!session) {
        setAuthResult({
          status: "fail",
          latencyMs: ms,
          detail: "No session — user is not authenticated.",
        });
        return false;
      }
      const now = Math.floor(Date.now() / 1000);
      const expired = session.expires_at != null && session.expires_at < now;
      const expiresAt = session.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : "unknown";
      setAuthResult({
        status: expired ? "fail" : "pass",
        latencyMs: ms,
        detail: [
          `User:     ${session.user.email}`,
          `ID:       ${session.user.id}`,
          `Expires:  ${expiresAt}`,
          `State:    ${expired ? "⚠ TOKEN EXPIRED" : "valid"}`,
          `Provider: ${session.user.app_metadata?.provider ?? "email"}`,
        ].join("\n"),
      });
      return !expired;
    } catch (e) {
      setAuthResult({
        status: "fail",
        latencyMs: Date.now() - t0,
        detail: String(e instanceof Error ? e.message : String(e)),
      });
      return false;
    }
  }

  async function testLLM(): Promise<boolean> {
    setLlmResult({ status: "running" });
    const t0 = Date.now();
    try {
      const res = await authFetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.5-flash-lite",
          messages: [{ role: "user", content: "Reply with exactly the word: OK" }],
          system: "Reply with exactly the word: OK",
          max_tokens: 10,
        }),
      });
      const ms = Date.now() - t0;
      const text = await res.text();
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* raw text */
      }

      if (!res.ok) {
        setLlmResult({
          status: "fail",
          latencyMs: ms,
          detail: `HTTP ${res.status}\n\n${text}`,
        });
        return false;
      }

      const aiText =
        ((parsed as { content?: Array<{ text?: string }> })?.content?.[0]?.text ??
          (parsed as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message
            ?.content) ||
        "(no text field)";
      setLlmResult({
        status: "pass",
        latencyMs: ms,
        detail: `HTTP ${res.status}\n\nAI replied: "${aiText}"\n\nFull response:\n${JSON.stringify(parsed, null, 2)}`,
      });
      return true;
    } catch (e) {
      setLlmResult({
        status: "fail",
        latencyMs: Date.now() - t0,
        detail: String(e instanceof Error ? e.message : String(e)),
      });
      return false;
    }
  }

  async function testCapture(): Promise<boolean> {
    setCaptureResult({ status: "running" });
    const t0 = Date.now();
    try {
      const res = await authFetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_title: "[ADMIN TEST] Ping",
          p_content: "Test entry created by admin debug panel — safe to delete.",
          p_type: "note",
          p_metadata: { _admin_test: true },
          p_tags: ["_test"],
        }),
      });
      const ms = Date.now() - t0;
      const text = await res.text();
      if (!res.ok) {
        setCaptureResult({
          status: "fail",
          latencyMs: ms,
          detail: `HTTP ${res.status}\n\n${text}`,
        });
        return false;
      }
      setCaptureResult({
        status: "pass",
        latencyMs: ms,
        detail: `HTTP ${res.status}\n\nResponse:\n${text}`,
      });
      return true;
    } catch (e) {
      setCaptureResult({
        status: "fail",
        latencyMs: Date.now() - t0,
        detail: String(e instanceof Error ? e.message : String(e)),
      });
      return false;
    }
  }

  async function testSplitEntry(): Promise<boolean> {
    setSplitResult({ status: "running" });
    const t0 = Date.now();
    try {
      const res = await authFetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.5-flash-lite",
          system: CAPTURE_SYSTEM,
          messages: [{ role: "user", content: SPLIT_TEST_INPUT }],
          max_tokens: 4000,
        }),
      });
      const ms = Date.now() - t0;
      const text = await res.text();
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* raw text */
      }

      if (!res.ok) {
        setSplitResult({
          status: "fail",
          latencyMs: ms,
          detail: `HTTP ${res.status}\n\n${text}`,
        });
        return false;
      }

      const aiText =
        ((parsed as { content?: Array<{ text?: string }> })?.content?.[0]?.text ??
          (parsed as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message
            ?.content) ||
        "";

      // Attempt to parse the AI JSON response (same logic as useCaptureSheetParse)
      let entries: Array<{ title?: string; metadata?: { phone?: string } }> = [];
      let parseError = "";
      try {
        const stripped = aiText.replace(/```json|```/g, "").trim();
        const jsonMatch = stripped.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        const jsonResult = JSON.parse(jsonMatch ? jsonMatch[1] : stripped);
        entries = Array.isArray(jsonResult) ? jsonResult : [jsonResult];
      } catch (e) {
        parseError = `JSON parse failed: ${e instanceof Error ? e.message : String(e)}`;
      }

      const tokensUsed =
        (parsed as { usage?: { total_tokens?: number } })?.usage?.total_tokens ?? "unknown";

      if (parseError) {
        setSplitResult({
          status: "fail",
          latencyMs: ms,
          detail: [
            `HTTP ${res.status} — tokens used: ${tokensUsed}`,
            "",
            parseError,
            "",
            `Raw AI output (${aiText.length} chars):`,
            aiText,
          ].join("\n"),
        });
        return false;
      }

      const titlesWithPhones = entries.map(
        (e) => `• ${e.title ?? "(no title)"} — phone: ${e.metadata?.phone ?? "(missing)"}`,
      );

      setSplitResult({
        status: "pass",
        latencyMs: ms,
        detail: [
          `HTTP ${res.status} — ${entries.length} entries parsed — tokens: ${tokensUsed}`,
          "",
          "Entries:",
          ...titlesWithPhones,
          "",
          `Raw AI output (${aiText.length} chars):`,
          aiText.slice(0, 600) + (aiText.length > 600 ? "\n…[truncated]" : ""),
        ].join("\n"),
      });
      return true;
    } catch (e) {
      setSplitResult({
        status: "fail",
        latencyMs: Date.now() - t0,
        detail: String(e instanceof Error ? e.message : String(e)),
      });
      return false;
    }
  }

  async function runAll() {
    setRunning(true);
    await testAuth();
    await testLLM();
    await testCapture();
    await testSplitEntry();
    setRunning(false);
  }

  const sections: {
    label: string;
    hint: string;
    btn: string;
    result: TestResult;
    run: () => void;
  }[] = [
    {
      label: "Auth token",
      hint: "verifies the session JWT is present and not expired.",
      btn: "Test auth",
      result: authResult,
      run: () => testAuth(),
    },
    {
      label: "LLM call",
      hint: "POST /api/llm — pings Gemini with a 1-token reply.",
      btn: "Test LLM",
      result: llmResult,
      run: () => testLLM(),
    },
    {
      label: "Capture API",
      hint: "POST /api/capture — creates a test entry (safe to delete).",
      btn: "Test capture",
      result: captureResult,
      run: () => testCapture(),
    },
    {
      label: "Split entry — 10 phones",
      hint: "sends a structured JSON of 10 contacts to /api/llm with the real CAPTURE prompt and max_tokens 4000, then parses the JSON.",
      btn: "Test split",
      result: splitResult,
      run: () => testSplitEntry(),
    },
  ];

  return (
    <div>
      <TierChanger />
      <PushTestSection />
      <DailySummarySection />
      <ScheduleInspectorSection />
      <MockGmailReviewSection />
      <AdminDisplaySection />
      <FeatureFlagsSection />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        <Button onClick={runAll} disabled={running} size="sm">
          {running ? "Running…" : "Run all tests"}
        </Button>
      </div>

      {sections.map(({ label, hint, btn, result, run }, i) => (
        <div
          key={label}
          style={{
            borderBottom: i < sections.length - 1 ? "1px solid var(--line-soft)" : "none",
            paddingBottom: 20,
            marginBottom: i < sections.length - 1 ? 4 : 0,
          }}
        >
          <SettingsRow label={label} hint={hint} last>
            <SettingsButton onClick={run} disabled={result.status === "running"}>
              {result.status === "running" ? "Testing…" : btn}
            </SettingsButton>
          </SettingsRow>
          <ResultBlock result={result} />
        </div>
      ))}
    </div>
  );
}
