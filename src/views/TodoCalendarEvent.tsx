// Calendar event UI — the agenda card, the inline editor, and the
// per-day detail wrapper. Split out of TodoCalendarTab.tsx so the
// orchestrator + DayAgenda + WeekStrip can stay readable.

import { useState } from "react";
import { parseISO } from "date-fns";
import type { Entry } from "../types";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toDateKey } from "./todoUtils";
import {
  type CalEvent,
  type EventDeleteHandler,
  type EventUpdateHandler,
  type RepeatMode,
  SPECIFIC_DATE_KEYS_FOR_EDITOR,
  WEEKDAY_NAMES,
  deriveCurrentDateKey,
  deriveCurrentRepeat,
  deriveEventStatus,
  deriveOriginalDateKeyName,
  deriveSubtitle,
  formatDayHeader,
  formatDuration,
  formatShortTime,
} from "./todoCalendarHelpers";

// ── EventCard ─────────────────────────────────────────────────────────────

export function EventCard({
  event,
  onUpdate,
  onDelete,
}: {
  event: CalEvent;
  onUpdate?: EventUpdateHandler;
  onDelete?: EventDeleteHandler;
}) {
  const editable = event.source === "entry" && !!event.entry;
  const [editing, setEditing] = useState(false);

  if (editing && event.entry) {
    return (
      <EventEditor
        entry={event.entry}
        defaultDateKey={toDateKey(event.start)}
        onSave={async (changes) => {
          if (onUpdate && event.entry) await onUpdate(event.entry.id, changes);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
        onDelete={
          onDelete && event.entry
            ? () => {
                onDelete(event.entry!.id);
                setEditing(false);
              }
            : undefined
        }
      />
    );
  }

  const status = deriveEventStatus(event);
  const timeLabel = event.allDay ? "All day" : formatShortTime(event.start);
  const durationLabel = event.allDay ? null : formatDuration(event.start, event.end);
  const subtitle = deriveSubtitle(event);
  const initial = (event.entry?.type || event.source).charAt(0).toUpperCase();

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "stretch",
      }}
    >
      {/* Left time column — outside the card, PrimePro-style */}
      <div
        className="f-sans"
        style={{
          width: 56,
          flexShrink: 0,
          paddingTop: 14,
          textAlign: "right",
          color: "var(--ink-soft)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.1, color: "var(--ink)" }}>
          {timeLabel}
        </div>
        {durationLabel && (
          <div style={{ fontSize: 11, marginTop: 3, color: "var(--ink-ghost)" }}>
            {durationLabel}
          </div>
        )}
      </div>

      {/* Card */}
      <button
        type="button"
        onClick={editable ? () => setEditing(true) : undefined}
        disabled={!editable}
        aria-label={editable ? `Open ${event.title}` : event.title}
        className={editable ? "press" : undefined}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          background: "var(--surface)",
          border: "1px solid var(--line-soft)",
          borderRadius: 14,
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          cursor: editable ? "pointer" : "default",
          font: "inherit",
          color: "inherit",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            className="f-sans"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: status.color,
            }}
          >
            {status.label}
          </span>
          {editable && (
            <span
              aria-hidden="true"
              style={{
                color: "var(--ink-ghost)",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
          )}
        </div>
        <div
          className="f-sans"
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--ink)",
            lineHeight: 1.3,
            wordBreak: "break-word",
          }}
        >
          {event.title}
        </div>
        {subtitle && (
          <div
            className="f-sans"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 2,
              paddingTop: 8,
              borderTop: "1px solid var(--line-soft)",
              fontSize: 12,
              color: "var(--ink-soft)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: "var(--surface-high, var(--surface))",
                border: "1px solid var(--line-soft)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 700,
                color: "var(--ink-soft)",
                flexShrink: 0,
              }}
            >
              {initial}
            </span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {subtitle}
            </span>
          </div>
        )}
      </button>
    </div>
  );
}

// ── EventEditor ───────────────────────────────────────────────────────────

export function EventEditor({
  entry,
  defaultDateKey,
  onSave,
  onCancel,
  onDelete,
}: {
  entry: Entry;
  defaultDateKey: string;
  onSave: (changes: Partial<Entry>) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const meta = (entry.metadata || {}) as Record<string, unknown>;
  const [title, setTitle] = useState(entry.title || "");
  const [dateStr, setDateStr] = useState(deriveCurrentDateKey(meta) ?? defaultDateKey);
  const [repeat, setRepeat] = useState<RepeatMode>(deriveCurrentRepeat(meta));
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const next: Record<string, unknown> = { ...meta };

    // Always reset recurrence + specific-date fields, then set the chosen mode.
    SPECIFIC_DATE_KEYS_FOR_EDITOR.forEach((k) => delete next[k]);
    delete next.day_of_week;
    delete next.weekday;
    delete next.recurring_day;
    delete next.day_of_month;

    const picked = parseISO(dateStr + "T00:00:00");

    if (repeat === "none") {
      const fieldName = deriveOriginalDateKeyName(meta);
      next[fieldName] = dateStr;
    } else if (repeat === "weekly") {
      next.day_of_week = WEEKDAY_NAMES[picked.getDay()];
    } else {
      next.day_of_month = picked.getDate();
    }

    const changes: Partial<Entry> = { metadata: next as Entry["metadata"] };
    if (title.trim() && title !== entry.title) changes.title = title.trim();

    await onSave(changes);
    setSaving(false);
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "var(--f-sans)",
    color: "var(--ink)",
    background: "var(--surface-high)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    outline: "none",
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--ember)",
        borderRadius: 12,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="f-sans"
        style={{ ...fieldStyle, fontSize: 14, fontWeight: 500 }}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ flex: "1 1 140px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            className="f-sans"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            Date
          </span>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            style={fieldStyle}
          />
        </label>
        <label style={{ flex: "1 1 140px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            className="f-sans"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            Repeat
          </span>
          <Select value={repeat} onValueChange={(v) => setRepeat(v as RepeatMode)}>
            <SelectTrigger style={fieldStyle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None — one shot</SelectItem>
              <SelectItem value="weekly">Every week (same weekday)</SelectItem>
              <SelectItem value="monthly">Every month (same day-of-month)</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
        {onDelete ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            disabled={saving}
            className="border-[color-mix(in_oklch,var(--blood)_35%,transparent)] text-[var(--blood)]"
          >
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── DayDetailContent ──────────────────────────────────────────────────────

export function DayDetailContent({
  date,
  events,
  onClose,
  onUpdate,
  onDelete,
}: {
  date: Date;
  events: CalEvent[];
  onClose?: () => void;
  onUpdate?: EventUpdateHandler;
  onDelete?: EventDeleteHandler;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <div>
          <p
            className="f-sans"
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink-ghost)",
            }}
          >
            {events.length === 0
              ? "Free"
              : `${events.length} ${events.length === 1 ? "event" : "events"}`}
          </p>
          <h3
            className="f-serif"
            style={{
              margin: "4px 0 0",
              fontSize: 20,
              fontWeight: 500,
              color: "var(--ink)",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            {formatDayHeader(date)}
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="press"
            style={{
              height: 28,
              width: 28,
              borderRadius: 999,
              border: 0,
              background: "var(--surface-low)",
              color: "var(--ink-soft)",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>
      {events.length === 0 ? (
        <p
          className="f-serif"
          style={{
            margin: 0,
            fontSize: 14,
            fontStyle: "italic",
            color: "var(--ink-ghost)",
            padding: "12px 0",
          }}
        >
          Nothing scheduled.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
