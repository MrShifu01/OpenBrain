import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useBrain } from "../context/BrainContext";
import AccountTab from "../components/settings/AccountTab";
import ProvidersTab from "../components/settings/ProvidersTab";
import BrainTab from "../components/settings/BrainTab";
import StorageTab from "../components/settings/StorageTab";
import DangerTab from "../components/settings/DangerTab";
import ClaudeCodeTab from "../components/settings/ClaudeCodeTab";
import { isMultiBrainEnabled } from "../lib/featureFlags";

type TabId = "profile" | "advanced" | "claude";

const TAB_DEFS: { id: TabId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "advanced", label: "Advanced" },
  { id: "claude", label: "MCP Access" },
];

function VaultCard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-2xl border"
      style={{
        background: "var(--color-surface-container)",
        borderColor: "var(--color-outline-variant)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="min-w-0">
          <p className="text-on-surface text-sm font-semibold">Vault</p>
          {!open && (
            <p className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
              End-to-end encrypted secrets
            </p>
          )}
        </div>
        <svg
          className={`ml-3 h-4 w-4 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          style={{ color: "var(--color-on-surface-variant)" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div style={{ overflow: "hidden" }}>
          <div className="px-4 pb-4">
            <p className="mb-3 text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
              End-to-end encrypted secrets
            </p>
            <button
              onClick={() => onNavigate("vault")}
              className="press-scale rounded-xl px-4 py-2 text-xs font-semibold transition-all"
              style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}
            >
              Open Vault
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SettingsViewProps {
  onNavigate?: (id: string) => void;
}

export default function SettingsView({ onNavigate }: SettingsViewProps = {}) {
  const { activeBrain, canInvite, canManageMembers, refresh, deleteBrain } = useBrain();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem("everion_email") || ""; } catch { return ""; }
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const e = user?.email || "";
      setEmail(e);
      try { if (e) localStorage.setItem("everion_email", e); } catch { /* ignore */ }
    });
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--color-background)",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div
        className="border-b px-4 pt-4 pb-2"
        style={{ borderColor: "var(--color-outline-variant)" }}
      >
        <h2 className="text-on-surface mb-1 text-2xl font-bold">Settings</h2>
        <p className="text-sm" style={{ color: "var(--color-on-surface-variant)" }}>
          Manage your account and preferences
        </p>
      </div>

      <div
        className="scrollbar-hide overflow-x-auto px-4 pt-2 pb-0"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex gap-2">
          {TAB_DEFS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-3 text-sm font-medium whitespace-nowrap transition-all"
              style={{
                color: activeTab === tab.id ? "var(--color-primary)" : "var(--color-on-surface-variant)",
                borderBottom: activeTab === tab.id ? "2px solid var(--color-primary)" : "2px solid transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {activeTab === "profile" && (
          <>
            <AccountTab email={email} brainId={activeBrain?.id} />
            {isMultiBrainEnabled() && activeBrain && (
              <BrainTab
                activeBrain={activeBrain}
                canInvite={canInvite}
                canManageMembers={canManageMembers}
                onRefreshBrains={refresh}
              />
            )}
          </>
        )}
        {activeTab === "advanced" && (
          <>
            <ProvidersTab activeBrain={activeBrain ?? undefined} />
            <StorageTab activeBrain={activeBrain ?? undefined} />
            {onNavigate && <VaultCard onNavigate={onNavigate} />}
            {activeBrain && (
              <DangerTab
                activeBrain={activeBrain}
                deleteBrain={deleteBrain}
                isOwner={activeBrain.myRole === "owner"}
                deleteAccount={async () => {
                  const session = await supabase.auth.getSession();
                  const token = session.data.session?.access_token;
                  const r = await fetch("/api/user-data?resource=account", {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (!r.ok) {
                    const data = await r.json().catch(() => ({}));
                    throw new Error(data.error || "Failed to delete account");
                  }
                  await supabase.auth.signOut();
                }}
              />
            )}
          </>
        )}
        {activeTab === "claude" && <ClaudeCodeTab />}
      </div>
    </div>
  );
}
