import { useState, useEffect } from "react";
import { authFetch } from "../../lib/authFetch";
import { SettingsButton } from "./SettingsRow";
import { IntegrationRow, DisconnectButton } from "./GmailSyncTab";
import { useCachedQuery, invalidateCachedQuery } from "../../lib/useCachedQuery";

interface Integration {
  id: string;
  provider: "google" | "microsoft";
  calendar_email: string | null;
  sync_enabled: boolean;
}

const CALENDAR_INTEGRATIONS_KEY = "calendar:integrations";

export default function CalendarSyncTab() {
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const { data, isLoading, mutate } = useCachedQuery<Integration[]>(
    CALENDAR_INTEGRATIONS_KEY,
    async () => {
      const r = await authFetch("/api/calendar?action=integrations");
      const d = await r?.json?.();
      return Array.isArray(d) ? (d as Integration[]) : [];
    },
  );
  const integrations = data ?? [];
  const loading = isLoading && !data;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("calendarConnected");
    const error = params.get("calendarError");
    if (connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot URL-param surfacing on mount; the URL is then cleaned via replaceState.
      setMsg("Google Calendar connected successfully.");
      window.history.replaceState({}, "", window.location.pathname);
      // Force-refresh the cache — we just came back from OAuth.
      invalidateCachedQuery(CALENDAR_INTEGRATIONS_KEY);
    }
    if (error) {
      setMsg(`Connection failed: ${error.replace(/_/g, " ")}.`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function disconnect(provider: string) {
    setDisconnecting(provider);
    await authFetch("/api/calendar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    }).catch(() => null);
    mutate(integrations.filter((i) => i.provider !== provider));
    setDisconnecting(null);
  }

  async function connectGoogle() {
    // POST with Authorization header so the Supabase bearer never lands in
    // the URL (logs, history, Referer header). Server returns the signed
    // Google authorise URL — we navigate to it once we have it.
    const r = await authFetch("/api/calendar-auth?provider=google", { method: "POST" });
    if (!r.ok) {
      setMsg(`Connection failed: HTTP ${r.status}`);
      return;
    }
    const { redirect_url } = (await r.json()) as { redirect_url?: string };
    if (!redirect_url) {
      setMsg("Connection failed: missing redirect_url");
      return;
    }
    window.location.href = redirect_url;
  }

  const googleInt = integrations.find((i) => i.provider === "google");

  if (loading) {
    return (
      <div style={{ padding: "24px 0", color: "var(--ink-faint)", fontSize: 13 }}>Loading…</div>
    );
  }

  return (
    <div>
      {msg && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{
            background: msg.includes("success") ? "var(--moss-wash)" : "var(--blood-wash)",
            color: msg.includes("success") ? "var(--moss)" : "var(--blood)",
            border: `1px solid ${msg.includes("success") ? "var(--moss)" : "var(--blood)"}`,
            opacity: 0.9,
          }}
        >
          {msg}
        </div>
      )}

      <IntegrationRow
        connected={!!googleInt}
        label={
          googleInt
            ? (googleInt.calendar_email ?? "unknown")
            : "Sync your Google Calendar events into the Todo calendar view."
        }
      >
        {googleInt ? (
          <DisconnectButton
            onClick={() => disconnect("google")}
            disabled={disconnecting === "google"}
          />
        ) : (
          <SettingsButton onClick={connectGoogle}>Connect Google Calendar</SettingsButton>
        )}
      </IntegrationRow>
    </div>
  );
}
