import { useMemo, useState, useRef, type JSX } from "react";
import { format } from "date-fns";
import { authFetch } from "../lib/authFetch";
import type { Entry } from "../types";
import { isDone } from "./todoUtils";

// GTD Someday/Maybe inbox.
//
// Shows incomplete `type="someday"` entries — newest first. Each row offers
// three actions: Done (mark completed), Schedule (date picker → flip to
// type="todo" with metadata.due_date so the existing Calendar tab picks it
// up), and Drop (soft-delete). Quick-add at the top stores raw text directly
// as a someday entry, no AI parsing — feels like jotting on a Post-it.
//
// Gated behind the `someday` power feature in Everion.tsx; the parent
// TodoView only mounts this when the flag is on.

interface Props {
  entries: Entry[];
  brainId?: string;
  onAdded: () => void;
  onUpdate?: (id: string, changes: Partial<Entry>) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

export default function TodoSomedayTab({
  entries,
  brainId,
  onAdded,
  onUpdate,
  onDelete,
}: Props): JSX.Element {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);

  const items = useMemo(
    () =>
      entries
        .filter((e) => e.type === "someday" && !isDone(e))
        .sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
        ),
    [entries],
  );

  const completedItems = useMemo(
    () =>
      entries
        .filter((e) => e.type === "someday" && isDone(e))
        .sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
        ),
    [entries],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line-soft)",
          borderRadius: 16,
          padding: 16,
          boxShadow: "var(--lift-1)",
        }}
      >
        <SomedayQuickAdd brainId={brainId} onAdded={onAdded} />
      </div>

      {items.length === 0 ? (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            borderRadius: 16,
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>∞</div>
          <p
            className="f-serif"
            style={{
              fontSize: 16,
              fontStyle: "italic",
              color: "var(--ink-soft)",
              margin: "0 0 6px",
            }}
          >
            Someday is empty.
          </p>
          <p
            className="f-sans"
            style={{ fontSize: 13, color: "var(--ink-faint)", margin: 0, lineHeight: 1.5 }}
          >
            Capture anything that's not for today. When the week's planned, pull from here.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {items.map((entry, idx) => (
            <SomedayRow
              key={entry.id}
              entry={entry}
              last={idx === items.length - 1}
              busy={busyId === entry.id}
              scheduling={scheduleId === entry.id}
              onStartSchedule={() => setScheduleId(entry.id)}
              onCancelSchedule={() => setScheduleId(null)}
              onSchedule={async (dateStr) => {
                setBusyId(entry.id);
                setScheduleId(null);
                try {
                  await onUpdate?.(entry.id, {
                    type: "todo",
                    metadata: { ...(entry.metadata || {}), due_date: dateStr, status: "todo" },
                  });
                } finally {
                  setBusyId(null);
                }
              }}
              onDone={async () => {
                setBusyId(entry.id);
                try {
                  await onUpdate?.(entry.id, {
                    metadata: { ...(entry.metadata || {}), status: "done" },
                  });
                } finally {
                  setBusyId(null);
                }
              }}
              onDrop={async () => {
                setBusyId(entry.id);
                try {
                  await onDelete?.(entry.id);
                } finally {
                  setBusyId(null);
                }
              }}
            />
          ))}
        </div>
      )}

      {completedItems.length > 0 && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            borderRadius: 16,
            padding: "12px 16px",
          }}
        >
          <p
            className="f-sans"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              margin: "0 0 6px",
            }}
          >
            Recently done · {completedItems.length}
          </p>
          {completedItems.slice(0, 5).map((e) => (
            <p
              key={e.id}
              className="f-serif"
              style={{
                margin: "4px 0",
                fontSize: 13,
                color: "var(--ink-ghost)",
                textDecoration: "line-through",
              }}
            >
              {e.title}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function SomedayRow({
  entry,
  last,
  busy,
  scheduling,
  onStartSchedule,
  onCancelSchedule,
  onSchedule,
  onDone,
  onDrop,
}: {
  entry: Entry;
  last: boolean;
  busy: boolean;
  scheduling: boolean;
  onStartSchedule: () => void;
  onCancelSchedule: () => void;
  onSchedule: (dateStr: string) => void;
  onDone: () => void;
  onDrop: () => void;
}): JSX.Element {
  // Captured once at mount so React Compiler can treat the row as pure;
  // age stamps don't need second-by-second precision.
  const [now] = useState(() => Date.now());
  const ageDays = entry.created_at
    ? Math.floor((now - new Date(entry.created_at).getTime()) / 86_400_000)
    : null;
  return (
    <div
      style={{
        padding: "14px 16px",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
        opacity: busy ? 0.5 : 1,
        transition: "opacity 200ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "var(--ember)",
            flexShrink: 0,
            marginTop: 8,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            className="f-serif"
            style={{
              margin: 0,
              fontSize: 15,
              color: "var(--ink)",
              lineHeight: 1.45,
              wordBreak: "break-word",
            }}
          >
            {entry.title}
          </p>
          {entry.content && entry.content !== entry.title && (
            <p
              className="f-sans"
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "var(--ink-faint)",
                lineHeight: 1.45,
                wordBreak: "break-word",
              }}
            >
              {entry.content.length > 240 ? entry.content.slice(0, 237) + "…" : entry.content}
            </p>
          )}
          {ageDays !== null && (
            <p
              className="f-sans"
              style={{ margin: "6px 0 0", fontSize: 11, color: "var(--ink-ghost)" }}
            >
              {ageDays === 0 ? "Just now" : ageDays === 1 ? "Yesterday" : `${ageDays} days ago`}
            </p>
          )}
        </div>
      </div>

      {scheduling ? (
        <ScheduleInline onConfirm={onSchedule} onCancel={onCancelSchedule} />
      ) : (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <SmallBtn label="Done" onClick={onDone} disabled={busy} tone="moss" />
          <SmallBtn label="Schedule" onClick={onStartSchedule} disabled={busy} tone="ember" />
          <SmallBtn label="Drop" onClick={onDrop} disabled={busy} tone="ghost" />
        </div>
      )}
    </div>
  );
}

function SmallBtn({
  label,
  onClick,
  disabled,
  tone,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: "ember" | "moss" | "ghost";
}): JSX.Element {
  const palettes = {
    ember: { bg: "var(--ember)", fg: "var(--ember-ink)" },
    moss: { bg: "var(--moss, #4caf50)", fg: "#fff" },
    ghost: { bg: "transparent", fg: "var(--ink-faint)" },
  } as const;
  const p = palettes[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="press f-sans"
      style={{
        background: p.bg,
        color: p.fg,
        border: tone === "ghost" ? "1px solid var(--line-soft)" : "none",
        borderRadius: 8,
        padding: "5px 12px",
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

function ScheduleInline({
  onConfirm,
  onCancel,
}: {
  onConfirm: (dateStr: string) => void;
  onCancel: () => void;
}): JSX.Element {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextMon = new Date(today);
  const dow = today.getDay();
  const daysToMonday = dow === 0 ? 1 : dow === 1 ? 7 : 8 - dow;
  nextMon.setDate(today.getDate() + daysToMonday);
  const [picked, setPicked] = useState(todayStr);

  return (
    <div
      style={{
        marginTop: 10,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 6,
      }}
    >
      <SmallBtn label="Today" tone="ember" onClick={() => onConfirm(todayStr)} />
      <SmallBtn
        label="Tomorrow"
        tone="ember"
        onClick={() => onConfirm(format(tomorrow, "yyyy-MM-dd"))}
      />
      <SmallBtn
        label="Next Mon"
        tone="ember"
        onClick={() => onConfirm(format(nextMon, "yyyy-MM-dd"))}
      />
      <input
        type="date"
        value={picked}
        onChange={(e) => setPicked(e.target.value)}
        className="f-sans"
        style={{
          height: 30,
          padding: "0 8px",
          fontSize: 12,
          border: "1px solid var(--line-soft)",
          borderRadius: 8,
          background: "var(--surface-low)",
          color: "var(--ink)",
        }}
      />
      <SmallBtn label="Set" tone="moss" onClick={() => onConfirm(picked)} />
      <SmallBtn label="Cancel" tone="ghost" onClick={onCancel} />
    </div>
  );
}

function SomedayQuickAdd({
  brainId,
  onAdded,
}: {
  brainId?: string;
  onAdded: () => void;
}): JSX.Element {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  function autoResize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const raw = text.trim();
    if (!raw || !brainId || busy) return;
    setBusy(true);
    const title = raw.length > 60 ? raw.slice(0, 57) + "…" : raw;
    try {
      await authFetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_title: title,
          p_content: raw,
          p_type: "someday",
          p_brain_id: brainId,
          p_metadata: {},
          p_tags: [],
        }),
      });
    } catch (err) {
      console.error("[someday-quick-add]", err);
    } finally {
      setText("");
      setBusy(false);
      onAdded();
      const el = ref.current;
      if (el) el.style.height = "auto";
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--surface-low)",
        border: "1px solid var(--line-soft)",
        borderRadius: 10,
        padding: "8px 12px",
      }}
    >
      <span style={{ fontSize: 18, color: "var(--ember)", flexShrink: 0 }}>∞</span>
      <textarea
        ref={ref}
        value={text}
        rows={1}
        onChange={(e) => {
          setText(e.target.value);
          autoResize();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit(e as React.FormEvent);
          }
        }}
        placeholder="Something for someday — no date needed…"
        disabled={busy}
        className="f-sans"
        style={{
          flex: 1,
          background: "transparent",
          border: 0,
          outline: 0,
          resize: "none",
          fontSize: 14,
          lineHeight: 1.5,
          color: "var(--ink)",
          padding: 0,
        }}
      />
      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="press f-sans"
        style={{
          flexShrink: 0,
          padding: "6px 14px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          background: "var(--ember)",
          color: "var(--ember-ink)",
          border: "none",
          cursor: busy || !text.trim() ? "not-allowed" : "pointer",
          opacity: busy || !text.trim() ? 0.4 : 1,
        }}
      >
        {busy ? "…" : "Add"}
      </button>
    </form>
  );
}
