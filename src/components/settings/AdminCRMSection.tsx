import { useEffect, useState, useCallback, useMemo } from "react";
import { authFetch } from "../../lib/authFetch";
import { SettingsButton } from "./SettingsRow";

// ─────────────────────────────────────────────────────────────────────────────
// Internal support CRM — user lookup + tier/usage/audit timeline.
//
// Read-only by default. Tier mutation is gated behind a confirm panel that
// requires a free-text reason; the server records the reason in audit_log
// alongside actor_id + before/after tiers.
//
// All UI is inline-custom (no window.confirm / window.alert / native select)
// per the project's design philosophy.
// ─────────────────────────────────────────────────────────────────────────────

interface AdminUserRow {
  id: string;
  email: string | null;
  tier: string;
  billing_provider: string | null;
  current_period_end: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

interface AdminUserOverview {
  profile: {
    id: string;
    email: string | null;
    auth_created_at: string | null;
    last_sign_in_at: string | null;
    tier: string;
    billing_provider: string | null;
    current_period_end: string | null;
    tier_expires_at: string | null;
    lemonsqueezy_customer_id: string | null;
    lemonsqueezy_subscription_id: string | null;
    appstore_original_transaction_id: string | null;
    playstore_purchase_token: string | null;
    playstore_product_id: string | null;
    profile_created_at: string | null;
    profile_updated_at: string | null;
  };
  usage_period: string;
  usage: {
    period: string;
    captures: number;
    chats: number;
    voice: number;
    improve: number;
  } | null;
  audit: Array<{
    id: string;
    action: string;
    resource_id: string | null;
    timestamp: string;
    metadata: Record<string, unknown> | null;
  }>;
}

const TIERS = ["free", "starter", "pro", "max"] as const;
type Tier = (typeof TIERS)[number];

function tierColor(tier: string): string {
  if (tier === "pro" || tier === "max") return "var(--ember)";
  if (tier === "starter") return "var(--moss)";
  return "var(--ink-ghost)";
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function tierLabel(tier: string): string {
  // Display rename: machine name "free" → user-visible "hobby" so the brand
  // stops calling unpaid users "free." DB rows + API contracts still say
  // "free" everywhere — only the badge text changes.
  return tier === "free" ? "hobby" : tier;
}

function TierBadge({ tier }: { tier: string }) {
  const color = tierColor(tier);
  return (
    <span
      className="f-sans"
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color,
        background: `${color}1F`,
        padding: "2px 7px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {tierLabel(tier)}
    </span>
  );
}

function UserRow({
  u,
  selected,
  onClick,
}: {
  u: AdminUserRow;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="press f-sans"
      style={{
        width: "100%",
        textAlign: "left",
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: selected
          ? "color-mix(in oklch, var(--ember) 6%, var(--surface))"
          : "transparent",
        border: `1px solid ${selected ? "var(--ember)" : "var(--line-soft)"}`,
        borderRadius: 8,
        cursor: "pointer",
        marginBottom: 4,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {u.email ?? "(no email)"}
        </div>
        <div
          className="f-mono"
          style={{
            fontSize: 10,
            color: "var(--ink-faint)",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {u.id}
        </div>
      </div>
      <TierBadge tier={u.tier} />
      <div className="f-sans" style={{ fontSize: 10, color: "var(--ink-faint)" }}>
        {fmtDate(u.created_at).split(",")[0]}
      </div>
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line-soft)",
        borderRadius: 12,
        padding: "14px 16px",
        marginBottom: 10,
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
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  // The .crm-kv class flips between two-column (label | value) on desktop and
  // stacked (label / value) on mobile via the media query in index.css. Without
  // that, the 140px label column eats the value column on narrow screens and
  // overflowWrap: anywhere wraps emails / UUIDs character-by-character.
  return (
    <div
      className="f-sans crm-kv"
      style={{
        gap: 10,
        padding: "5px 0",
        fontSize: 12,
        borderBottom: "1px solid var(--line-soft)",
      }}
    >
      <div style={{ color: "var(--ink-faint)" }}>{k}</div>
      <div
        style={{
          color: "var(--ink)",
          overflowWrap: "anywhere",
          minWidth: 0,
        }}
      >
        {v}
      </div>
    </div>
  );
}

function TierChangePanel({
  currentTier,
  onApply,
  onCancel,
  busy,
}: {
  currentTier: string;
  onApply: (newTier: Tier, reason: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [next, setNext] = useState<Tier>(currentTier as Tier);
  const [reason, setReason] = useState("");
  const tierChanged = next !== currentTier;
  const reasonValid = reason.trim().length > 0;
  // Show the validation error inline once the user has interacted with the
  // pill row or pressed Apply once. Pre-interaction silence keeps the panel
  // calm; post-interaction explicit so the disabled button doesn't feel
  // broken (the original UX bug — user clicked Starter, button stayed
  // disabled, nothing surfaced the missing reason).
  const [touched, setTouched] = useState(false);

  return (
    <div
      style={{
        marginTop: 8,
        padding: 12,
        borderRadius: 10,
        background: "var(--surface-low)",
        border: "1px solid var(--line)",
      }}
    >
      <div
        className="f-sans"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "var(--ember)",
          marginBottom: 10,
        }}
      >
        Change tier
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {TIERS.map((t) => {
          const active = t === next;
          return (
            <button
              key={t}
              onClick={() => setNext(t)}
              disabled={busy}
              className="press f-sans"
              style={{
                height: 28,
                padding: "0 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 999,
                border: `1px solid ${active ? tierColor(t) : "var(--line-soft)"}`,
                background: active
                  ? `color-mix(in oklch, ${tierColor(t)} 12%, var(--surface))`
                  : "var(--surface)",
                color: active ? tierColor(t) : "var(--ink-soft)",
                cursor: busy ? "wait" : "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={200}
        placeholder="Reason (required) — e.g. family member complimentary access, support escalation, refund offset"
        className="f-sans"
        style={{
          width: "100%",
          padding: "8px 10px",
          fontSize: 12,
          background: "var(--surface)",
          border: `1px solid ${touched && !reasonValid ? "var(--blood)" : "var(--line)"}`,
          borderRadius: 8,
          color: "var(--ink)",
          outline: "none",
          resize: "vertical",
        }}
      />
      <div
        className="f-sans"
        style={{
          fontSize: 10,
          color: touched && !reasonValid ? "var(--blood)" : "var(--ink-faint)",
          marginTop: 4,
          marginBottom: 10,
        }}
      >
        {touched && !reasonValid
          ? "Reason is required — describe why you're changing this tier."
          : `${reason.trim().length} / 200 — recorded in audit_log`}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <SettingsButton onClick={onCancel} disabled={busy}>
          Cancel
        </SettingsButton>
        <SettingsButton
          danger={next === "free"}
          onClick={() => {
            setTouched(true);
            if (!tierChanged) return;
            if (!reasonValid) return;
            onApply(next, reason.trim());
          }}
          disabled={!tierChanged || busy}
        >
          {busy ? "Applying…" : `Set to ${next}`}
        </SettingsButton>
      </div>
    </div>
  );
}

export default function AdminCRMSection() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminUserOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [showTierPanel, setShowTierPanel] = useState(false);
  const [tierBusy, setTierBusy] = useState(false);
  const [tierMsg, setTierMsg] = useState<string | null>(null);

  const search = useCallback(async (term: string) => {
    setLoadingList(true);
    setListError(null);
    try {
      const r = await authFetch(
        `/api/user-data?resource=admin_users&q=${encodeURIComponent(term)}&limit=25`,
      );
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setListError(j?.error ?? `HTTP ${r.status}`);
        setUsers([]);
        return;
      }
      const data = (await r.json()) as { users: AdminUserRow[] };
      setUsers(data.users ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
      setUsers([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Initial load — most recent users.
  useEffect(() => {
    search("");
  }, [search]);

  const loadOverview = useCallback(async (id: string) => {
    setLoadingOverview(true);
    setOverviewError(null);
    setShowTierPanel(false);
    setTierMsg(null);
    try {
      const r = await authFetch(
        `/api/user-data?resource=admin_user_overview&id=${encodeURIComponent(id)}`,
      );
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setOverviewError(j?.error ?? `HTTP ${r.status}`);
        setOverview(null);
        return;
      }
      const data = (await r.json()) as AdminUserOverview;
      setOverview(data);
    } catch (e) {
      setOverviewError(e instanceof Error ? e.message : String(e));
      setOverview(null);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadOverview(selectedId);
    else setOverview(null);
  }, [selectedId, loadOverview]);

  const usage = overview?.usage;
  const profile = overview?.profile;

  async function applyTierChange(newTier: Tier, reason: string) {
    if (!profile) return;
    setTierBusy(true);
    setTierMsg(null);
    try {
      // Random idempotency key — protects us against a double-click. Format
      // matches reserveActionIdempotency expectations (16-byte hex).
      const idemKey = crypto.randomUUID().replace(/-/g, "");
      const r = await authFetch("/api/user-data?resource=admin_set_tier", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
        body: JSON.stringify({
          target_user_id: profile.id,
          tier: newTier,
          reason,
        }),
      });
      const data = (await r.json().catch(() => null)) as {
        ok?: boolean;
        previous_tier?: string;
        new_tier?: string;
        error?: string;
      } | null;
      if (!r.ok || !data?.ok) {
        setTierMsg(data?.error ?? `HTTP ${r.status}`);
        return;
      }
      setTierMsg(`OK — ${data.previous_tier} → ${data.new_tier}`);
      setShowTierPanel(false);
      // Reload overview + list so the tier badge updates without a page refresh.
      await Promise.all([loadOverview(profile.id), search(q)]);
    } catch (e) {
      setTierMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setTierBusy(false);
    }
  }

  const auditPreview = useMemo(() => overview?.audit.slice(0, 50) ?? [], [overview]);

  return (
    <div
      style={{
        marginBottom: 28,
        paddingBottom: 24,
        borderBottom: "1px solid var(--line-soft)",
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <div className="f-sans" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          Support CRM
        </div>
        <div className="f-sans" style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
          Search any user by email or id, view tier + this-month usage + recent audit events, and
          override tier with a recorded reason.
        </div>
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search(q)}
          placeholder="Email substring or UUID prefix"
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
        <SettingsButton onClick={() => search(q)} disabled={loadingList}>
          {loadingList ? "Searching…" : "Search"}
        </SettingsButton>
      </div>

      {listError && (
        <div className="f-sans" style={{ fontSize: 12, color: "var(--blood)", marginBottom: 8 }}>
          {listError}
        </div>
      )}

      <div
        className="crm-split"
        style={{
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* User list */}
        <div style={{ minWidth: 0 }}>
          {users.length === 0 && !loadingList && !listError && (
            <div className="f-sans" style={{ fontSize: 12, color: "var(--ink-faint)" }}>
              No matches.
            </div>
          )}
          {users.map((u) => (
            <UserRow
              key={u.id}
              u={u}
              selected={u.id === selectedId}
              onClick={() => setSelectedId(u.id)}
            />
          ))}
        </div>

        {/* Detail */}
        <div style={{ minWidth: 0 }}>
          {!selectedId && (
            <div
              className="f-sans"
              style={{
                fontSize: 12,
                color: "var(--ink-faint)",
                padding: 16,
                border: "1px dashed var(--line-soft)",
                borderRadius: 12,
                textAlign: "center",
              }}
            >
              Select a user.
            </div>
          )}
          {selectedId && loadingOverview && (
            <div
              className="f-sans"
              style={{ fontSize: 12, color: "var(--ink-faint)", padding: 16 }}
            >
              Loading…
            </div>
          )}
          {overviewError && (
            <div className="f-sans" style={{ fontSize: 12, color: "var(--blood)", padding: 8 }}>
              {overviewError}
            </div>
          )}
          {profile && !loadingOverview && (
            <>
              <Card title="Profile / Billing">
                <KV k="Email" v={profile.email ?? "—"} />
                <KV
                  k="ID"
                  v={
                    <span className="f-mono" style={{ fontSize: 11 }}>
                      {profile.id}
                    </span>
                  }
                />
                <KV
                  k="Tier"
                  v={
                    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <TierBadge tier={profile.tier} />
                      {!showTierPanel && (
                        <button
                          onClick={() => setShowTierPanel(true)}
                          className="press f-sans"
                          style={{
                            height: 22,
                            padding: "0 8px",
                            fontSize: 10,
                            fontWeight: 600,
                            borderRadius: 999,
                            border: "1px solid var(--line)",
                            background: "var(--surface)",
                            color: "var(--ink-soft)",
                            cursor: "pointer",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                          }}
                        >
                          Change
                        </button>
                      )}
                    </span>
                  }
                />
                <KV k="Provider" v={profile.billing_provider ?? "—"} />
                <KV k="Renews" v={fmtDate(profile.current_period_end)} />
                <KV k="Tier expires" v={fmtDate(profile.tier_expires_at)} />
                <KV k="Last sign-in" v={fmtDate(profile.last_sign_in_at)} />
                <KV k="Account created" v={fmtDate(profile.auth_created_at)} />
                {profile.lemonsqueezy_subscription_id && (
                  <KV
                    k="LemonSqueezy sub"
                    v={
                      <span className="f-mono" style={{ fontSize: 11 }}>
                        {profile.lemonsqueezy_subscription_id}
                      </span>
                    }
                  />
                )}
                {profile.lemonsqueezy_customer_id && (
                  <KV
                    k="LemonSqueezy cust"
                    v={
                      <span className="f-mono" style={{ fontSize: 11 }}>
                        {profile.lemonsqueezy_customer_id}
                      </span>
                    }
                  />
                )}
                {profile.appstore_original_transaction_id && (
                  <KV
                    k="Apple OTX"
                    v={
                      <span className="f-mono" style={{ fontSize: 11 }}>
                        {profile.appstore_original_transaction_id}
                      </span>
                    }
                  />
                )}
                {profile.playstore_purchase_token && (
                  <KV
                    k="Play token"
                    v={
                      <span className="f-mono" style={{ fontSize: 11 }}>
                        {profile.playstore_purchase_token.slice(0, 24)}…
                      </span>
                    }
                  />
                )}
                {showTierPanel && (
                  <TierChangePanel
                    currentTier={profile.tier}
                    busy={tierBusy}
                    onCancel={() => setShowTierPanel(false)}
                    onApply={applyTierChange}
                  />
                )}
                {tierMsg && (
                  <div
                    className="f-sans"
                    style={{
                      fontSize: 12,
                      marginTop: 8,
                      color: tierMsg.startsWith("OK") ? "var(--moss)" : "var(--blood)",
                    }}
                  >
                    {tierMsg}
                  </div>
                )}
              </Card>

              <Card title={`Usage — ${overview?.usage_period ?? ""}`}>
                {usage ? (
                  <>
                    <KV k="Captures" v={String(usage.captures)} />
                    <KV k="Chats" v={String(usage.chats)} />
                    <KV k="Voice notes" v={String(usage.voice)} />
                    <KV k="Improve scans" v={String(usage.improve)} />
                  </>
                ) : (
                  <div className="f-sans" style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                    No usage row this period.
                  </div>
                )}
              </Card>

              <Card title={`Recent audit events (${auditPreview.length})`}>
                {auditPreview.length === 0 && (
                  <div className="f-sans" style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                    Empty.
                  </div>
                )}
                {auditPreview.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      padding: "6px 0",
                      borderBottom: "1px solid var(--line-soft)",
                      fontSize: 12,
                    }}
                  >
                    <div
                      className="f-mono"
                      style={{
                        fontSize: 11,
                        color: "var(--ink-faint)",
                        display: "flex",
                        gap: 10,
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{fmtDate(a.timestamp)}</span>
                      <span style={{ color: "var(--ember)" }}>{a.action}</span>
                    </div>
                    {a.metadata && Object.keys(a.metadata).length > 0 && (
                      <pre
                        className="f-mono"
                        style={{
                          margin: "4px 0 0",
                          fontSize: 10,
                          color: "var(--ink-soft)",
                          background: "var(--surface-low)",
                          padding: 8,
                          borderRadius: 6,
                          overflow: "auto",
                          maxHeight: 120,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {JSON.stringify(a.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
