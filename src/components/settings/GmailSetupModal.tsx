import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";

interface GmailPreferences {
  categories: string[];
  custom: string;
  lookbackDays?: 1 | 7 | 30;
  // When true (default) the scan ignores the categories pre-filter and
  // pulls every thread in the lookback window, then clusters ~95% similar
  // emails into a single review card. Categories below only matter if the
  // user turns this off (legacy "narrow scan" mode).
  fetchAll?: boolean;
}

interface Category {
  id: string;
  label: string;
  hint: string;
  priority: "high" | "medium";
}

const CATEGORIES: Category[] = [
  {
    id: "invoices",
    label: "Invoices & bills",
    hint: "payment requests, amounts due, billing statements",
    priority: "high",
  },
  {
    id: "action-required",
    label: "Action-required emails",
    hint: "approve, sign, respond, submit by a deadline",
    priority: "high",
  },
  {
    id: "subscription-renewal",
    label: "Subscription renewals & trial endings",
    hint: "renewal notices, trial expiry, subscription changes",
    priority: "high",
  },
  {
    id: "appointment",
    label: "Booking & appointment confirmations",
    hint: "travel, medical, restaurant, events, services",
    priority: "high",
  },
  {
    id: "deadline",
    label: "Deadlines mentioned in emails",
    hint: "any cutoff date or time-sensitive request",
    priority: "high",
  },
  {
    id: "delivery",
    label: "Delivery & collection notices",
    hint: "package tracking, ready-for-collection alerts",
    priority: "medium",
  },
  {
    id: "signing-requests",
    label: "Contract & document signing",
    hint: "DocuSign, HelloSign, Adobe Sign, e-signature requests",
    priority: "medium",
  },
];

const DEFAULT_CATEGORIES = CATEGORIES.filter((c) => c.priority === "high").map((c) => c.id);

interface Props {
  mode: "connect" | "edit";
  initialPreferences?: GmailPreferences;
  onClose: () => void;
  onConnect?: (preferences: GmailPreferences) => void;
  onSave?: (preferences: GmailPreferences) => Promise<void>;
}

export default function GmailSetupModal({
  mode,
  initialPreferences,
  onClose,
  onConnect,
  onSave,
}: Props) {
  const [selected, setSelected] = useState<string[]>(
    initialPreferences?.categories ?? DEFAULT_CATEGORIES,
  );
  const [custom, setCustom] = useState(initialPreferences?.custom ?? "");
  const [lookbackDays, setLookbackDays] = useState<1 | 7 | 30>(
    initialPreferences?.lookbackDays ?? 7,
  );
  const [fetchAll, setFetchAll] = useState<boolean>(initialPreferences?.fetchAll ?? true);
  const [saving, setSaving] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState(initialPreferences?.custom ?? "");

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit() {
    const prefs: GmailPreferences = {
      categories: selected,
      custom: custom.trim(),
      lookbackDays,
      fetchAll,
    };
    if (mode === "connect") {
      onConnect?.(prefs);
    } else {
      setSaving(true);
      await onSave?.(prefs);
      setSaving(false);
      onClose();
    }
  }

  const highCats = CATEGORIES.filter((c) => c.priority === "high");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100dvh-128px)] !max-w-[480px] flex-col overflow-hidden !rounded-[20px]"
        style={{
          background: "var(--bg)",
          borderColor: "var(--line-soft)",
          padding: "20px 20px 16px",
        }}
      >
        {/* Header — sticky at top */}
        <div style={{ marginBottom: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <GmailIcon />
            <DialogTitle
              className="f-serif"
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 450,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
              }}
            >
              {mode === "connect" ? "Connect Gmail" : "Email preferences"}
            </DialogTitle>
          </div>
        </div>

        {/* Scrollable body — header + actions stay visible at all viewport heights;
            previously DialogContent was overflow-hidden with no inner scroll, so the
            Connect / Cancel actions disappeared below the fold on smaller screens. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            margin: "0 -20px",
            padding: "0 20px",
          }}
        >
          {/* Scan mode */}
          <p
            className="f-sans"
            style={{
              margin: "0 0 6px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink-soft)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Scan mode
          </p>
          <ScanModeToggle fetchAll={fetchAll} onChange={setFetchAll} />

          {/* Hard filters */}
          <p
            className="f-sans"
            style={{
              margin: "14px 0 6px",
              fontSize: 12,
              fontWeight: 600,
              color: fetchAll ? "var(--ink-faint)" : "var(--ink-soft)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Hard filters{" "}
            {fetchAll && (
              <span style={{ textTransform: "none", fontWeight: 400, fontStyle: "italic" }}>
                — ignored in cluster mode
              </span>
            )}
          </p>
          <div
            style={{
              marginBottom: 4,
              opacity: fetchAll ? 0.45 : 1,
              pointerEvents: fetchAll ? "none" : "auto",
              transition: "opacity 180ms",
            }}
          >
            {highCats.map((cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                checked={selected.includes(cat.id)}
                onToggle={toggle}
              />
            ))}
          </div>
          <p
            className="f-serif"
            style={{
              margin: "0 0 10px",
              fontSize: 12,
              color: "var(--ink-faint)",
              fontStyle: "italic",
              opacity: fetchAll ? 0.6 : 1,
            }}
          >
            {fetchAll
              ? "Cluster mode pulls every email and groups ~95% similar messages into one card. Filters above only apply if you switch to narrow scan."
              : "Only emails matching a checked type are captured. Untick all to rely solely on your custom rules below."}
          </p>

          {/* Custom input — collapsible edit panel */}
          <div
            style={{
              marginBottom: 8,
              borderTop: "1px solid var(--line-soft)",
              borderBottom: "1px solid var(--line-soft)",
            }}
          >
            {!customOpen ? (
              <div style={{ display: "flex", alignItems: "center", padding: "8px 0" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    className="f-sans"
                    style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-soft)" }}
                  >
                    Other
                  </span>
                  {custom.trim() && (
                    <span
                      className="f-sans"
                      style={{ fontSize: 12, color: "var(--ink-faint)", marginLeft: 8 }}
                    >
                      {custom.trim().slice(0, 48)}
                      {custom.trim().length > 48 ? "…" : ""}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    setCustomDraft(custom);
                    setCustomOpen(true);
                  }}
                  variant="outline"
                  size="xs"
                  className="shrink-0"
                >
                  Edit
                </Button>
              </div>
            ) : (
              <div style={{ padding: "10px 0 8px" }}>
                <textarea
                  autoFocus
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  placeholder="e.g. ignore emails from noreply@, flag anything mentioning VAT or warranty…"
                  rows={6}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--line-soft)",
                    background: "var(--surface)",
                    color: "var(--ink)",
                    fontFamily: "var(--f-sans)",
                    fontSize: 13,
                    lineHeight: 1.6,
                    resize: "none",
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Button
                    type="button"
                    onClick={() => setCustomOpen(false)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setCustom(customDraft);
                      setCustomOpen(false);
                    }}
                    size="sm"
                    className="flex-[2]"
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Look-back period */}
          <div style={{ marginBottom: 8 }}>
            <div
              className="f-sans"
              style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-soft)", marginBottom: 8 }}
            >
              Manual scan look-back window
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {([1, 7, 30] as const).map((d) => {
                const label = d === 1 ? "1 day" : d === 7 ? "1 week" : "1 month";
                const active = lookbackDays === d;
                return (
                  <Button
                    key={d}
                    type="button"
                    onClick={() => setLookbackDays(d)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    style={{
                      borderColor: active ? "var(--ember)" : "var(--line-soft)",
                      background: active ? "var(--ember-wash)" : "var(--surface)",
                      color: active ? "var(--ember)" : "var(--ink-soft)",
                    }}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions — sticky at bottom of the modal regardless of body height */}
        <div style={{ display: "flex", gap: 10, flexShrink: 0, marginTop: 12 }}>
          <Button onClick={onClose} variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="flex-[2]">
            {saving ? "Saving…" : mode === "connect" ? "Connect Gmail" : "Save preferences"}
          </Button>
        </div>

        {mode === "connect" && (
          <p
            className="f-sans"
            style={{
              flexShrink: 0,
              margin: "10px 0 0",
              fontSize: 12,
              color: "var(--ink-faint)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            You'll be redirected to Google to grant read-only inbox access. Everion never stores
            email content — only extracted summaries.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ScanModeToggle({
  fetchAll,
  onChange,
}: {
  fetchAll: boolean;
  onChange: (v: boolean) => void;
}) {
  const options: { id: "cluster" | "narrow"; label: string; hint: string; value: boolean }[] = [
    {
      id: "cluster",
      label: "Cluster",
      hint: "Pull everything, group ~95% similar into one card",
      value: true,
    },
    {
      id: "narrow",
      label: "Narrow",
      hint: "Only emails matching the filters below",
      value: false,
    },
  ];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {options.map((opt) => {
        const active = fetchAll === opt.value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.value)}
            className="press f-sans"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${active ? "var(--ember)" : "var(--line-soft)"}`,
              background: active ? "var(--ember-wash)" : "var(--surface)",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 150ms, border-color 150ms",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--ember)" : "var(--ink-soft)",
                marginBottom: 2,
              }}
            >
              {opt.label}
            </div>
            <div
              className="f-serif"
              style={{
                fontSize: 11,
                fontStyle: "italic",
                color: "var(--ink-faint)",
                lineHeight: 1.4,
              }}
            >
              {opt.hint}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CategoryRow({
  cat,
  checked,
  onToggle,
}: {
  cat: Category;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "6px 0",
        borderBottom: "1px solid var(--line-soft)",
        cursor: "pointer",
      }}
    >
      <div style={{ paddingTop: 2, flexShrink: 0, alignSelf: "flex-start", lineHeight: 0 }}>
        <Checkbox checked={checked} onChange={() => onToggle(cat.id)} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="f-serif"
          style={{ fontSize: 15, fontWeight: 450, color: "var(--ink)", letterSpacing: "-0.005em" }}
        >
          {cat.label}
        </div>
      </div>
    </label>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      style={{
        width: 20,
        height: 20,
        minWidth: 20,
        minHeight: 20,
        maxHeight: 20,
        borderRadius: "50%",
        border: `2px solid ${checked ? "var(--ember)" : "var(--line-soft)"}`,
        background: checked ? "var(--ember)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "flex-start",
        transition: "background 150ms, border-color 150ms",
        flexShrink: 0,
        padding: 0,
        cursor: "pointer",
        appearance: "none",
        WebkitAppearance: "none",
        boxSizing: "content-box",
      }}
    >
      {checked && (
        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
          <path
            d="M1 4.5L4 7.5L10 1"
            stroke="var(--ember-ink)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

function GmailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6Z"
        fill="#EA4335"
        fillOpacity="0.15"
        stroke="#EA4335"
        strokeWidth="1.5"
      />
      <path d="M2 6L12 13L22 6" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
