import { useState } from "react";
import { authFetch } from "../../lib/authFetch";
import { Button } from "../ui/button";
import { useCachedQuery } from "../../lib/useCachedQuery";

// Patterns are clusters of accept/reject decisions the user has taught the
// classifier. Surfaces what the system has learned and lets the user prune,
// tune, or correct mislearned patterns. Backed by /api/gmail?action=patterns-*.

interface Pattern {
  id: string;
  summary: string;
  example_subject: string | null;
  example_from: string | null;
  accept_score: number;
  reject_score: number;
  accept_hits: number;
  reject_hits: number;
  last_accept_at: string | null;
  last_reject_at: string | null;
  auto_accept_eligible_at: string | null;
  created_at: string;
}

function formatRelative(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function ScoreBar({ value, color, label }: { value: number; color: string; label: string }) {
  const pct = Math.max(0, Math.min(10, value)) * 10;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span
        className="f-sans"
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--ink-faint)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          width: 38,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          background: "var(--surface-low)",
          border: "1px solid var(--line-soft)",
          overflow: "hidden",
          minWidth: 60,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            transition: "width 0.2s ease",
          }}
        />
      </div>
      <span
        className="f-sans"
        style={{
          fontSize: 11,
          color: "var(--ink)",
          fontVariantNumeric: "tabular-nums",
          width: 28,
          textAlign: "right",
        }}
      >
        {value}/10
      </span>
    </div>
  );
}

function PatternCard({
  p,
  onChanged,
  onDelete,
}: {
  p: Pattern;
  onChanged: () => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(p.summary);
  const [accept, setAccept] = useState(p.accept_score);
  const [reject, setReject] = useState(p.reject_score);

  const probationActive =
    p.auto_accept_eligible_at && new Date(p.auto_accept_eligible_at).getTime() > Date.now();
  const isAutoAccept = p.accept_score >= 8 && p.reject_score <= 2 && !probationActive;
  const isHardBlock = p.reject_score >= 8 && p.accept_score <= 2;
  const isContested = p.accept_score > 3 && p.reject_score > 3;

  let stateLabel = "learning";
  let stateColor = "var(--ink-faint)";
  if (isAutoAccept) {
    stateLabel = "auto-accept";
    stateColor = "var(--moss)";
  } else if (probationActive) {
    stateLabel = `probation → ${new Date(p.auto_accept_eligible_at!).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
    stateColor = "var(--moss)";
  } else if (isHardBlock) {
    stateLabel = "hard-block";
    stateColor = "var(--danger, var(--blood))";
  } else if (isContested) {
    stateLabel = "contested";
    stateColor = "var(--ember)";
  }

  async function saveEdits() {
    setBusy(true);
    try {
      await authFetch("/api/gmail?action=patterns-update", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: p.id,
          summary,
          accept_score: accept,
          reject_score: reject,
        }),
      });
      setEditing(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    try {
      await authFetch(`/api/gmail?action=patterns-delete&id=${encodeURIComponent(p.id)}`, {
        method: "DELETE",
      });
      onDelete(p.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        padding: "14px 14px 12px",
        borderRadius: 10,
        background: "var(--surface)",
        border: "1px solid var(--line-soft)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          {editing ? (
            <textarea
              className="f-sans"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              style={{
                width: "100%",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--ink)",
                background: "var(--surface-low)",
                border: "1px solid var(--line-soft)",
                borderRadius: 6,
                padding: "6px 8px",
                resize: "vertical",
              }}
            />
          ) : (
            <div
              className="f-sans"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--ink)",
                lineHeight: 1.4,
                wordBreak: "break-word",
              }}
            >
              {p.summary}
            </div>
          )}
          {p.example_from || p.example_subject ? (
            <div
              className="f-sans"
              style={{
                fontSize: 11,
                color: "var(--ink-faint)",
                marginTop: 4,
                wordBreak: "break-word",
              }}
            >
              {p.example_from ? `from ${p.example_from}` : ""}
              {p.example_from && p.example_subject ? " · " : ""}
              {p.example_subject ? `"${p.example_subject}"` : ""}
            </div>
          ) : null}
        </div>
        <span
          className="f-sans"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: stateColor,
            border: `1px solid ${stateColor}`,
            padding: "3px 8px",
            borderRadius: 999,
            flexShrink: 0,
            background: "transparent",
          }}
        >
          {stateLabel}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {editing ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                className="f-sans"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--ink-faint)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  width: 38,
                }}
              >
                ACC
              </span>
              <input
                type="range"
                min={0}
                max={10}
                value={accept}
                onChange={(e) => setAccept(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span
                className="f-sans"
                style={{ fontSize: 11, color: "var(--ink)", width: 28, textAlign: "right" }}
              >
                {accept}/10
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                className="f-sans"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--ink-faint)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  width: 38,
                }}
              >
                REJ
              </span>
              <input
                type="range"
                min={0}
                max={10}
                value={reject}
                onChange={(e) => setReject(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span
                className="f-sans"
                style={{ fontSize: 11, color: "var(--ink)", width: 28, textAlign: "right" }}
              >
                {reject}/10
              </span>
            </div>
          </>
        ) : (
          <>
            <ScoreBar value={p.accept_score} color="var(--moss)" label="ACC" />
            <ScoreBar value={p.reject_score} color="var(--danger, var(--blood))" label="REJ" />
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 11,
          color: "var(--ink-faint)",
        }}
      >
        <div className="f-sans">
          {p.accept_hits} accept{p.accept_hits === 1 ? "" : "s"} · {p.reject_hits} reject
          {p.reject_hits === 1 ? "" : "s"} · last fired{" "}
          {formatRelative(
            p.last_accept_at && p.last_reject_at
              ? new Date(p.last_accept_at).getTime() > new Date(p.last_reject_at).getTime()
                ? p.last_accept_at
                : p.last_reject_at
              : (p.last_accept_at ?? p.last_reject_at),
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {editing ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </Button>
              <Button size="sm" onClick={saveEdits} disabled={busy}>
                Save
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={busy}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDelete} disabled={busy}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GmailPatternRules() {
  const {
    data: patterns,
    isLoading,
    error,
    refetch,
    mutate,
  } = useCachedQuery<Pattern[]>("gmail:patterns", async () => {
    const r = await authFetch("/api/gmail?action=patterns-list");
    const d = await r?.json?.();
    return Array.isArray(d?.patterns) ? (d.patterns as Pattern[]) : [];
  });

  function onPatternDeleted(id: string) {
    mutate((patterns ?? []).filter((p) => p.id !== id));
  }

  if (isLoading && !patterns) {
    return (
      <div style={{ padding: "16px 0", color: "var(--ink-faint)", fontSize: 12 }}>
        Loading patterns…
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div
        className="f-sans"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
          marginBottom: 10,
        }}
      >
        Learned patterns ({patterns?.length ?? 0})
      </div>
      {error && (
        <div
          className="f-sans"
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            fontSize: 12,
            background: "var(--blood-wash)",
            color: "var(--blood)",
            marginBottom: 10,
          }}
        >
          {error.message}
        </div>
      )}
      {(patterns?.length ?? 0) === 0 ? (
        <div
          className="f-sans"
          style={{
            padding: "14px 16px",
            borderRadius: 10,
            background: "var(--surface)",
            border: "1px dashed var(--line-soft)",
            fontSize: 12,
            color: "var(--ink-faint)",
            lineHeight: 1.5,
          }}
        >
          No patterns yet. Accept or reject a few staged emails — the classifier will start
          clustering similar messages here. Once a pattern hits 8/10 it auto-accepts (after a 7-day
          probation) or hard-blocks similar emails before they reach the classifier.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(patterns ?? []).map((p) => (
            <PatternCard key={p.id} p={p} onChanged={() => refetch()} onDelete={onPatternDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}
