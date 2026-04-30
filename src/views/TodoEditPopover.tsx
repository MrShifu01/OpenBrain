import { useState } from "react";
import type { Entry } from "../types";
import { Button } from "../components/ui/button";
import { DateField } from "../components/ui/date-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const REPEAT_OPTIONS = [
  { value: "none", label: "Never" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

type RepeatValue = (typeof REPEAT_OPTIONS)[number]["value"];

// Read a recurrence summary from either the canonical Phase 2 field
// (metadata.recurrence) or legacy day_of_week / day_of_month. The popover
// only edits weekly/monthly today — daily/biweekly/yearly used to live
// here as labels only with no engine support, so they're dropped.
function getRepeat(entry: Entry): RepeatValue {
  const m = (entry.metadata || {}) as Record<string, unknown>;
  const rec = m.recurrence as { freq?: string; dow?: unknown; dom?: unknown } | undefined;
  if (rec?.freq === "weekly" || (Array.isArray(rec?.dow) && rec.dow.length > 0)) return "weekly";
  if (rec?.freq === "monthly" || (Array.isArray(rec?.dom) && rec.dom.length > 0)) return "monthly";
  if (m.day_of_week) return "weekly";
  if (m.day_of_month) return "monthly";
  return "none";
}

interface Props {
  entry: Entry;
  rect: DOMRect;
  onClose: () => void;
  onSave: (changes: Partial<Entry>) => Promise<void>;
}

export default function TodoEditPopover({ entry, rect, onClose, onSave }: Props) {
  const [title, setTitle] = useState(entry.title || "");
  const [content, setContent] = useState(entry.content || "");
  // Read either the canonical scheduled_for or legacy due_date so existing
  // entries open with the right initial value.
  const [dueDate, setDueDate] = useState(() => {
    const m = (entry.metadata || {}) as Record<string, unknown>;
    return String(m.scheduled_for ?? m.due_date ?? "");
  });
  const [repeat, setRepeat] = useState<RepeatValue>(getRepeat(entry));
  const [saving, setSaving] = useState(false);
  const [reenriching, setReenriching] = useState(false);

  // Escape hatch for the AI firewall (Phase 3). The firewall normally fills
  // *missing* fields only — once tags/summary/type are set the AI never
  // overwrites them. If the user wants AI to redo those, clear them here and
  // flip `enrichment.parsed = false` so the next pass re-parses. USER_OWNED
  // keys (status, scheduled_for, recurrence, …) are still untouched — AI
  // never writes those regardless.
  async function reenrich() {
    setReenriching(true);
    const meta = { ...(entry.metadata || {}) } as Record<string, unknown>;
    const enrichment = { ...((meta.enrichment as Record<string, unknown>) || {}) };
    enrichment.parsed = false;
    meta.enrichment = enrichment;
    delete meta.summary;
    await onSave({ tags: [], metadata: meta as Entry["metadata"] });
    setReenriching(false);
    onClose();
  }

  const W = 320;
  const EST_H = 310;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const top =
    rect.bottom + 8 + EST_H > vh - 8 ? Math.max(8, rect.top - EST_H - 8) : rect.bottom + 8;
  const left = Math.min(Math.max(8, rect.left), vw - W - 16);

  async function save() {
    setSaving(true);
    const meta = { ...(entry.metadata || {}) } as Record<string, unknown>;

    // ── Canonical scheduled_for (Phase 2). Mirror to legacy due_date for
    //    back-compat with any callers that still read it.
    if (dueDate) {
      meta.scheduled_for = dueDate;
      meta.due_date = dueDate;
    } else {
      delete meta.scheduled_for;
      delete meta.due_date;
    }

    // ── Canonical recurrence object. Translate the dropdown:
    //    weekly  → recurrence.dow = [day-of-week of dueDate, fallback Mon]
    //    monthly → recurrence.dom = [day-of-month of dueDate, fallback 1]
    //    none    → drop recurrence + legacy day_of_week / day_of_month
    if (repeat === "weekly") {
      const dow = dueDate ? new Date(dueDate + "T12:00:00").getDay() : 1;
      meta.recurrence = { freq: "weekly", dow: [dow] };
      delete meta.day_of_week;
      delete meta.day_of_month;
    } else if (repeat === "monthly") {
      const dom = dueDate ? new Date(dueDate + "T12:00:00").getDate() : 1;
      meta.recurrence = { freq: "monthly", dom: [dom] };
      delete meta.day_of_week;
      delete meta.day_of_month;
    } else {
      delete meta.recurrence;
      delete meta.day_of_week;
      delete meta.day_of_month;
    }

    // Legacy `repeat` string (no engine support) — clear it; canonical
    // recurrence above replaces it.
    delete meta.repeat;

    await onSave({ title, content, metadata: meta as Entry["metadata"] });
    setSaving(false);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 rounded-2xl border shadow-xl"
        style={{
          top,
          left,
          width: W,
          background: "var(--surface)",
          borderColor: "var(--line-soft)",
        }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span
            className="text-[10px] font-semibold tracking-widest uppercase"
            style={{ color: "var(--ink-ghost)", fontFamily: "var(--f-sans)" }}
          >
            Edit
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            aria-label="Close"
            className="h-5 w-5 rounded-full text-sm leading-none"
            style={{ color: "var(--ink-ghost)", background: "var(--surface-high)" }}
          >
            ×
          </Button>
        </div>
        <div className="space-y-2.5 px-4 pb-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="w-full rounded-xl border px-3 py-2 text-sm font-medium outline-none"
            style={{
              background: "var(--surface-low)",
              borderColor: "var(--line-soft)",
              color: "var(--ink)",
              fontFamily: "var(--f-sans)",
            }}
            placeholder="Title"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--surface-low)",
              borderColor: "var(--line-soft)",
              color: "var(--ink)",
              fontFamily: "var(--f-sans)",
            }}
            placeholder="Notes"
          />
          <div className="flex items-center gap-3">
            <span
              className="w-14 shrink-0 text-xs"
              style={{ color: "var(--ink-faint)", fontFamily: "var(--f-sans)" }}
            >
              Date
            </span>
            <DateField
              value={dueDate}
              onChange={setDueDate}
              ariaLabel="Due date"
              placeholder="Pick a date"
              triggerClassName="flex-1"
              triggerStyle={{
                height: 34,
                borderRadius: 12,
                padding: "0 12px",
                fontSize: 13,
              }}
            />
            {dueDate && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setDueDate("")}
                aria-label="Clear date"
                className="shrink-0 text-sm leading-none"
                style={{ color: "var(--ink-ghost)" }}
              >
                ✕
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span
              className="w-14 shrink-0 text-xs"
              style={{ color: "var(--ink-faint)", fontFamily: "var(--f-sans)" }}
            >
              Repeat
            </span>
            <Select value={repeat} onValueChange={(v) => setRepeat(v as RepeatValue)}>
              <SelectTrigger
                className="flex-1 rounded-xl text-sm"
                style={{
                  background: "var(--surface-low)",
                  borderColor: "var(--line-soft)",
                  color: "var(--ink)",
                  fontFamily: "var(--f-sans)",
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPEAT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={save}
            disabled={saving || !title.trim()}
            className="w-full rounded-xl py-2 text-sm font-semibold"
            style={{
              background: "var(--ember)",
              color: "var(--ember-ink)",
              fontFamily: "var(--f-sans)",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="link"
            size="xs"
            onClick={reenrich}
            disabled={reenriching || saving}
            title="Clear AI-derived tags/summary and let the AI re-parse this entry. Schedule and status are never touched."
            className="w-full text-[11px]"
            style={{
              color: "var(--ink-faint)",
              fontFamily: "var(--f-sans)",
              padding: "4px 0 0",
            }}
          >
            {reenriching ? "Re-enriching…" : "↻ Let AI re-derive tags & summary"}
          </Button>
        </div>
      </div>
    </>
  );
}
