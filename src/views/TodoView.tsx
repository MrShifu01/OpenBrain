import { useState, useMemo, useRef, useEffect } from "react";
import { parseISO, startOfDay, endOfDay } from "date-fns";
import { TC, fmtD } from "../data/constants";
import { resolveIcon } from "../lib/typeIcons";
import { useEntries } from "../context/EntriesContext";
import { authFetch } from "../lib/authFetch";
import type { Entry } from "../types";

/* ─── Date extraction ─── */
const ALL_DATE_KEYS = [
  "deadline", "due_date", "valid_to", "valid_from", "date", "event_date",
  "start_date", "end_date", "match_date", "game_date", "scheduled_date",
  "appointment_date", "event_start", "expiry_date", "expiry", "renewal_date",
];
const ACTION_DATE_KEYS = ["due_date", "deadline"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const CONTENT_DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/g;
const DOW: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

function extractDates(entry: Entry): string[] {
  const m = (entry.metadata || {}) as Record<string, unknown>;
  const dates = new Set<string>();
  ALL_DATE_KEYS.forEach((k) => {
    if (m[k] && DATE_RE.test(String(m[k]))) dates.add(String(m[k]).slice(0, 10));
  });
  Object.values(m).forEach((v) => {
    if (typeof v === "string" && DATE_RE.test(v)) dates.add(v.slice(0, 10));
  });
  const text = `${entry.title || ""} ${entry.content || ""}`;
  let match;
  while ((match = CONTENT_DATE_RE.exec(text)) !== null) dates.add(match[1]);
  return [...dates];
}

function extractActionDates(entry: Entry): string[] {
  const m = (entry.metadata || {}) as Record<string, unknown>;
  const dates = new Set<string>();
  ACTION_DATE_KEYS.forEach((k) => {
    if (m[k] && DATE_RE.test(String(m[k]))) dates.add(String(m[k]).slice(0, 10));
  });
  return [...dates];
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isDone(entry: Entry): boolean {
  return (entry.metadata as any)?.status === "done";
}

interface TodoItem { entry: Entry; dateStr: string; }

/* ─── External calendar event shape ─── */
export interface ExternalCalEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string;   // ISO
  allDay?: boolean;
  provider: "google" | "microsoft";
  calendarEmail?: string;
}

/* ─── RBC event shape ─── */
interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  source: "entry" | "google" | "microsoft";
  entry?: Entry;
}

/* ─── Convert entries → RBC events ─── */
function entriesToCalEvents(entries: Entry[]): CalEvent[] {
  const events: CalEvent[] = [];
  entries.forEach((e) => {
    if (isDone(e)) return;
    extractDates(e).forEach((d) => {
      const day = parseISO(d);
      events.push({
        id: `entry-${e.id}-${d}`,
        title: e.title,
        start: startOfDay(day),
        end: endOfDay(day),
        allDay: true,
        source: "entry",
        entry: e,
      });
    });
  });
  return events;
}

/* ─── Convert external events → RBC events ─── */
function externalToCalEvents(exts: ExternalCalEvent[]): CalEvent[] {
  return exts.map((ev) => ({
    id: `ext-${ev.id}`,
    title: ev.title,
    start: new Date(ev.start),
    end: new Date(ev.end),
    allDay: ev.allDay ?? false,
    source: ev.provider,
  }));
}

/* ─── Recurring helper ─── */
function addRecurring(entries: Entry[], add: (key: string, e: Entry) => void, targetYear?: number, targetMon?: number) {
  const now = new Date();
  const year = targetYear ?? now.getFullYear();
  const mon = targetMon ?? now.getMonth();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  entries.forEach((e) => {
    if (isDone(e)) return;
    const m = (e.metadata || {}) as Record<string, unknown>;
    let rawDay = (m.day_of_week || m.weekday || m.recurring_day || "").toString().toLowerCase().trim();
    if (!rawDay) {
      const text = `${e.title || ""} ${e.content || ""}`.toLowerCase();
      const match = text.match(/every\s+(sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?)/i);
      if (match) rawDay = match[1];
    }
    const dowIndex = DOW[rawDay];
    if (dowIndex === undefined) return;
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(year, mon, d).getDay() === dowIndex)
        add(`${year}-${String(mon + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, e);
    }
  });
}

/* ─── Mini calendar (list tab) ─── */
function MiniCalendar({
  dateMap, selectedDay, onSelectDay,
}: { dateMap: Record<string, Entry[]>; selectedDay: string | null; onSelectDay: (k: string | null) => void; }) {
  const [expanded, setExpanded] = useState(false);
  const [month, setMonth] = useState<Date>(() => new Date());
  const year = month.getFullYear();
  const mon = month.getMonth();
  const today = new Date().toISOString().slice(0, 10);

  const firstDow = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = month.toLocaleDateString("en-ZA", { month: "short", year: "numeric" });
  const dayKey = (d: number) => `${year}-${String(mon + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const eventCount = Object.keys(dateMap).filter((k) => k.startsWith(`${year}-${String(mon + 1).padStart(2, "0")}`)).length;

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}>
      <button
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3"
        onClick={() => setExpanded((s) => !s)}
      >
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 flex-shrink-0" style={{ color: "var(--ink-faint)" }} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--f-sans)" }}>{monthLabel}</span>
            {eventCount > 0 && <span className="text-xs" style={{ color: "var(--ink-faint)" }}>· {eventCount} days with events</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expanded && (
            <>
              <button
                className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-opacity hover:opacity-70"
                style={{ color: "var(--ember)", background: "var(--ember-wash)" }}
                onClick={(e) => { e.stopPropagation(); setMonth(new Date(year, mon - 1, 1)); }}
              >←</button>
              <button
                className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-opacity hover:opacity-70"
                style={{ color: "var(--ember)", background: "var(--ember-wash)" }}
                onClick={(e) => { e.stopPropagation(); setMonth(new Date(year, mon + 1, 1)); }}
              >→</button>
            </>
          )}
          <span className="text-xs" style={{ color: "var(--ink-ghost)" }}>{expanded ? "▾" : "▸"}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          <div className="mb-1 grid grid-cols-7 gap-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="py-1 text-center text-[10px] font-medium" style={{ color: "var(--ink-ghost)" }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const key = dayKey(day);
              const dots = dateMap[key] || [];
              const isToday = key === today;
              const isSel = key === selectedDay;
              return (
                <button
                  key={key}
                  className="relative flex aspect-square w-full flex-col items-center justify-center rounded-full text-xs transition-all"
                  style={{
                    background: isSel ? "var(--ember)" : "transparent",
                    color: isSel ? "var(--ember-ink)" : isToday ? "var(--ember)" : "var(--ink-soft)",
                    fontWeight: isSel || isToday ? 700 : 400,
                    boxShadow: isToday && !isSel ? "inset 0 0 0 1.5px var(--ember)" : "none",
                  }}
                  onClick={() => onSelectDay(isSel ? null : key)}
                >
                  <span>{day}</span>
                  {dots.length > 0 && !isSel && (
                    <div className="absolute bottom-0.5 h-1 w-1 rounded-full" style={{ background: "var(--moss)" }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Quick-add form ─── */
function QuickAdd({ brainId, onAdded }: { brainId?: string; onAdded: () => void; defaultDate?: string }) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || !brainId) return;
    setBusy(true);
    const metadata: Record<string, string> = { status: "todo" };
    if (dueDate) metadata.due_date = dueDate;
    await authFetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_title: t, p_type: "todo", p_brain_id: brainId, p_metadata: metadata }),
    }).catch(() => null);
    setTitle("");
    setDueDate("");
    setBusy(false);
    onAdded();
    inputRef.current?.focus();
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-center gap-2 rounded-2xl border px-3 py-2"
      style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}
    >
      <CheckCircleIcon className="h-4 w-4 shrink-0" style={{ color: "var(--ink-ghost)" }} />
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a todo…"
        disabled={busy}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        style={{ color: "var(--ink)", fontFamily: "var(--f-sans)" }}
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        disabled={busy}
        className="shrink-0 rounded-lg border-none bg-transparent text-xs outline-none"
        style={{ color: dueDate ? "var(--ember)" : "var(--ink-ghost)", fontFamily: "var(--f-sans)", cursor: "pointer" }}
      />
      <button
        type="submit"
        disabled={busy || !title.trim()}
        className="shrink-0 rounded-lg px-3 py-1 text-xs font-semibold transition-opacity disabled:opacity-40"
        style={{ background: "var(--ember)", color: "var(--ember-ink)", fontFamily: "var(--f-sans)" }}
      >
        {busy ? "…" : "Add"}
      </button>
    </form>
  );
}

/* ─── Checkbox ─── */
function CheckButton({ entry, ctx }: { entry: Entry; ctx: ReturnType<typeof useEntries> }) {
  const serverDone = isDone(entry);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const done = optimistic ?? serverDone;

  function toggle() {
    if (!ctx?.handleUpdate) return;
    setOptimistic(!done);
    ctx.handleUpdate(entry.id, {
      metadata: { ...(entry.metadata || {}), status: done ? "todo" : "done" },
    }).catch(() => setOptimistic(null));
  }

  return (
    <button
      onClick={toggle}
      className="shrink-0 flex items-center justify-center rounded-full border-2 transition-all"
      style={{
        width: 20, height: 20, minWidth: 20, minHeight: 20,
        borderColor: done ? "var(--ember)" : "var(--line)",
        background: done ? "var(--ember)" : "transparent",
        cursor: "pointer",
      }}
      aria-label={done ? "Mark incomplete" : "Mark done"}
    >
      {done && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5L8 3" stroke="var(--ember-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/* ─── Todo edit popover ─── */
const REPEAT_OPTIONS = [
  { value: "none", label: "Never" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

function getRepeat(entry: Entry): string {
  const m = (entry.metadata || {}) as Record<string, unknown>;
  const r = String(m.repeat ?? "");
  return REPEAT_OPTIONS.some((o) => o.value === r) ? r : "none";
}

function TodoEditPopover({
  entry,
  rect,
  onClose,
  onSave,
}: {
  entry: Entry;
  rect: DOMRect;
  onClose: () => void;
  onSave: (changes: Partial<Entry>) => Promise<void>;
}) {
  const [title, setTitle] = useState(entry.title || "");
  const [content, setContent] = useState(entry.content || "");
  const [dueDate, setDueDate] = useState(String((entry.metadata as any)?.due_date ?? ""));
  const [repeat, setRepeat] = useState(getRepeat(entry));
  const [saving, setSaving] = useState(false);

  const W = 320;
  const EST_H = 310;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const top = rect.bottom + 8 + EST_H > vh - 8 ? Math.max(8, rect.top - EST_H - 8) : rect.bottom + 8;
  const left = Math.min(Math.max(8, rect.left), vw - W - 16);

  async function save() {
    setSaving(true);
    const meta = { ...(entry.metadata || {}) } as Record<string, unknown>;
    if (dueDate) meta.due_date = dueDate; else delete meta.due_date;
    if (repeat !== "none") meta.repeat = repeat; else delete meta.repeat;
    await onSave({ title, content, metadata: meta as Entry["metadata"] });
    setSaving(false);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 rounded-2xl border shadow-xl"
        style={{ top, left, width: W, background: "var(--surface)", borderColor: "var(--line-soft)" }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--ink-ghost)", fontFamily: "var(--f-sans)" }}>Edit</span>
          <button
            onClick={onClose}
            className="flex h-5 w-5 items-center justify-center rounded-full text-sm leading-none"
            style={{ color: "var(--ink-ghost)", background: "var(--surface-high)" }}
          >×</button>
        </div>
        <div className="space-y-2.5 px-4 pb-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="w-full rounded-xl border px-3 py-2 text-sm font-medium outline-none"
            style={{ background: "var(--surface-low)", borderColor: "var(--line-soft)", color: "var(--ink)", fontFamily: "var(--f-sans)" }}
            placeholder="Title"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ background: "var(--surface-low)", borderColor: "var(--line-soft)", color: "var(--ink)", fontFamily: "var(--f-sans)" }}
            placeholder="Notes"
          />
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs" style={{ color: "var(--ink-faint)", fontFamily: "var(--f-sans)" }}>Date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 rounded-xl border px-3 py-1.5 text-sm outline-none"
              style={{ background: "var(--surface-low)", borderColor: "var(--line-soft)", color: dueDate ? "var(--ember)" : "var(--ink-ghost)", fontFamily: "var(--f-sans)" }}
            />
            {dueDate && (
              <button onClick={() => setDueDate("")} className="shrink-0 text-sm leading-none" style={{ color: "var(--ink-ghost)" }}>✕</button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs" style={{ color: "var(--ink-faint)", fontFamily: "var(--f-sans)" }}>Repeat</span>
            <select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className="flex-1 rounded-xl border px-3 py-1.5 text-sm outline-none"
              style={{ background: "var(--surface-low)", borderColor: "var(--line-soft)", color: "var(--ink)", fontFamily: "var(--f-sans)", cursor: "pointer" }}
            >
              {REPEAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="w-full rounded-xl py-2 text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: "var(--ember)", color: "var(--ember-ink)", fontFamily: "var(--f-sans)" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Tiny icon helpers ─── */
function CheckCircleIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/* ─── Calendar helpers ─── */
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_ABBRS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function eventSourceColor(source: CalEvent["source"]): string {
  if (source === "entry") return "var(--ember)";
  if (source === "google") return "oklch(54% 0.13 248)";
  return "oklch(52% 0.10 192)";
}

function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const total = new Date(year, month + 1, 0).getDate();
  const startOffset = (first.getDay() + 6) % 7; // Mon = 0
  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: total }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/* ─── Day detail panel ─── */
function DayDetailPanel({
  dateKey, events, onClose,
}: { dateKey: string; events: CalEvent[]; onClose: () => void }) {
  const date = new Date(dateKey + "T00:00:00");
  const label = date.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="rounded-2xl border p-4 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--f-sans)" }}>{label}</p>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full text-sm transition-colors"
          style={{ color: "var(--ink-ghost)", background: "var(--surface-high)" }}
          aria-label="Close"
        >×</button>
      </div>
      {events.length === 0 ? (
        <p className="py-4 text-center text-xs" style={{ color: "var(--ink-ghost)" }}>Nothing scheduled</p>
      ) : (
        <div className="space-y-2">
          {events.map((ev) => {
            const color = eventSourceColor(ev.source);
            const timeStr = ev.allDay
              ? "All day"
              : `${ev.start.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}–${ev.end.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}`;
            const srcLabel = ev.source === "entry" ? "Todo" : ev.source === "google" ? "Google" : "Outlook";
            return (
              <div
                key={ev.id}
                className="flex items-start gap-3 rounded-xl p-3"
                style={{ background: `color-mix(in oklch, ${color} 6%, var(--surface-low))` }}
              >
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug" style={{ color: "var(--ink)" }}>{ev.title}</p>
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--ink-faint)" }}>{timeStr} · {srcLabel}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Agenda view ─── */
function AgendaList({ days, today }: { days: { key: string; date: Date; events: CalEvent[] }[]; today: string }) {
  if (days.length === 0) {
    return (
      <div className="py-12 text-center" style={{ color: "var(--ink-ghost)" }}>
        <p className="text-sm">No upcoming events in the next 60 days</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {days.map(({ key, date, events }) => {
        const isToday = key === today;
        return (
          <div key={key} className="flex gap-4">
            <div className="w-14 shrink-0 pt-0.5 text-right">
              <p className="text-xs font-semibold leading-tight" style={{ color: isToday ? "var(--ember)" : "var(--ink-soft)", fontFamily: "var(--f-sans)" }}>
                {isToday ? "Today" : date.toLocaleDateString("en-ZA", { weekday: "short" })}
              </p>
              {!isToday && (
                <p className="text-[10px] leading-tight" style={{ color: "var(--ink-ghost)" }}>
                  {date.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                </p>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 border-l pl-4" style={{ borderColor: isToday ? "var(--ember)" : "var(--line-soft)" }}>
              {events.map((ev) => {
                const color = eventSourceColor(ev.source);
                return (
                  <div key={ev.id} className="flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2" style={{ background: "var(--surface)" }}>
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="flex-1 truncate text-sm" style={{ color: "var(--ink)" }}>{ev.title}</span>
                    {!ev.allDay && (
                      <span className="shrink-0 text-[10px]" style={{ color: "var(--ink-ghost)" }}>
                        {ev.start.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                      style={{ background: `color-mix(in oklch, ${color} 12%, var(--surface-high))`, color }}
                    >
                      {ev.source === "entry" ? "Todo" : ev.source === "google" ? "Google" : "Outlook"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Calendar tab ─── */
function CalendarTab({
  entries,
  externalEvents,
  brainId,
  onAdded,
}: {
  entries: Entry[];
  externalEvents: ExternalCalEvent[];
  brainId?: string;
  onAdded: () => void;
}) {
  const [navDate, setNavDate] = useState(new Date());
  const [selectedKey, setSelectedKey] = useState<string | null>(toDateKey(new Date()));
  const [calView, setCalView] = useState<"month" | "agenda">("month");

  const year = navDate.getFullYear();
  const month = navDate.getMonth();
  const today = toDateKey(new Date());

  const calEvents = useMemo(
    () => [...entriesToCalEvents(entries), ...externalToCalEvents(externalEvents)],
    [entries, externalEvents],
  );

  const eventMap = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    calEvents.forEach((ev) => {
      const key = toDateKey(ev.start);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    // Add recurring entries for the currently viewed month
    addRecurring(entries, (key, e) => {
      if (!map[key]) map[key] = [];
      if (!map[key].find((ev) => ev.id === `entry-${e.id}-recurring`)) {
        map[key].push({
          id: `entry-${e.id}-recurring`,
          title: e.title,
          start: startOfDay(parseISO(key)),
          end: endOfDay(parseISO(key)),
          allDay: true,
          source: "entry",
          entry: e,
        });
      }
    }, year, month);
    return map;
  }, [calEvents, entries, year, month]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const selectedEvents = selectedKey ? (eventMap[selectedKey] || []) : [];

  const agendaDays = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(Date.now() + 60 * 86400000);
    const days: { key: string; date: Date; events: CalEvent[] }[] = [];
    const d = new Date(start);
    while (d <= end) {
      const key = toDateKey(d);
      if (eventMap[key]?.length) days.push({ key, date: new Date(d), events: eventMap[key] });
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [eventMap]);

  return (
    <div className="space-y-4">
      <QuickAdd brainId={brainId} onAdded={onAdded} />

      {externalEvents.length === 0 && (
        <p className="text-xs" style={{ color: "var(--ink-ghost)" }}>
          Connect Google or Outlook in{" "}
          <strong style={{ color: "var(--ink-soft)", fontWeight: 600 }}>Settings → Calendar Sync</strong>{" "}
          to see your events here.
        </p>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setNavDate(new Date(year, month - 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          style={{ color: "var(--ink-soft)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-high)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          aria-label="Previous month"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <h2 className="flex-1 text-base font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--f-serif)", letterSpacing: "-0.01em" }}>
          {MONTH_NAMES[month]} {year}
        </h2>

        <button
          onClick={() => { setNavDate(new Date()); setSelectedKey(today); }}
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: "var(--ember-wash)", color: "var(--ember)" }}
        >
          Today
        </button>

        <button
          onClick={() => setNavDate(new Date(year, month + 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          style={{ color: "var(--ink-soft)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-high)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          aria-label="Next month"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        <div className="flex overflow-hidden rounded-lg border" style={{ borderColor: "var(--line-soft)" }}>
          {(["month", "agenda"] as const).map((v, i) => (
            <button
              key={v}
              onClick={() => setCalView(v)}
              className="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
              style={{
                background: calView === v ? "var(--ember)" : "var(--surface)",
                color: calView === v ? "var(--ember-ink)" : "var(--ink-soft)",
                borderRight: i === 0 ? "1px solid var(--line-soft)" : "none",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Month view */}
      {calView === "month" && (
        <div>
          <div className="lg:flex lg:gap-4">
            <div className="min-w-0 flex-1">
            <div className="mb-1.5 grid grid-cols-7">
              {DAY_ABBRS.map((d) => (
                <div key={d} className="py-1 text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-ghost)" }}>
                  {d}
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--line-soft)" }}>
              {grid.map((row, ri) => (
                <div key={ri} className="grid grid-cols-7" style={{ borderTop: ri > 0 ? "1px solid var(--line-soft)" : "none" }}>
                  {row.map((day, ci) => {
                    if (!day) {
                      return (
                        <div
                          key={`e${ci}`}
                          style={{
                            background: "var(--surface-low)",
                            borderLeft: ci > 0 ? "1px solid var(--line-soft)" : "none",
                            minHeight: 64,
                          }}
                        />
                      );
                    }
                    const key = toDateKey(day);
                    const dayEvents = eventMap[key] || [];
                    const isToday = key === today;
                    const isSel = key === selectedKey;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedKey(isSel ? null : key)}
                        className="flex flex-col p-1.5 text-left transition-colors sm:p-2"
                        style={{
                          background: isSel ? "color-mix(in oklch, var(--ember) 7%, var(--surface))" : "var(--surface)",
                          borderLeft: ci > 0 ? "1px solid var(--line-soft)" : "none",
                          minHeight: 64,
                        }}
                      >
                        <div className="flex justify-end">
                          <span
                            className="flex h-[22px] w-[22px] items-center justify-center text-[11px] leading-none"
                            style={{
                              borderRadius: "50%",
                              background: isToday ? "var(--ember)" : "transparent",
                              color: isToday ? "var(--ember-ink)" : isSel ? "var(--ember)" : "var(--ink-soft)",
                              fontWeight: isToday || isSel ? 700 : 500,
                            }}
                          >
                            {day.getDate()}
                          </span>
                        </div>
                        {/* Dots on all screen sizes */}
                        {dayEvents.length > 0 && (
                          <div className="mt-auto flex justify-center gap-0.5 pb-0.5">
                            {dayEvents.slice(0, 3).map((ev, i) => (
                              <div key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: eventSourceColor(ev.source) }} />
                            ))}
                            {dayEvents.length > 3 && (
                              <div className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ink-ghost)" }} />
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>{/* end overflow-hidden rounded-2xl border */}
            </div>{/* end min-w-0 flex-1 */}

            {/* Desktop day panel */}
            {selectedKey && (
              <div className="hidden w-72 shrink-0 lg:block">
                <DayDetailPanel dateKey={selectedKey} events={selectedEvents} onClose={() => setSelectedKey(null)} />
              </div>
            )}
          </div>

          {/* Mobile day panel */}
          {selectedKey && (
            <div className="mt-3 lg:hidden">
              <DayDetailPanel dateKey={selectedKey} events={selectedEvents} onClose={() => setSelectedKey(null)} />
            </div>
          )}

          {/* Legend */}
          {externalEvents.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {[
                { label: "Todos", color: "var(--ember)" },
                ...(externalEvents.some((e) => e.provider === "google") ? [{ label: "Google", color: "oklch(54% 0.13 248)" }] : []),
                ...(externalEvents.some((e) => e.provider === "microsoft") ? [{ label: "Outlook", color: "oklch(52% 0.10 192)" }] : []),
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ background: color }} />
                  <span className="text-[10px] font-medium" style={{ color: "var(--ink-faint)" }}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agenda view */}
      {calView === "agenda" && <AgendaList days={agendaDays} today={today} />}
    </div>
  );
}

/* ─── Main TodoView ─── */
interface TodoViewProps {
  entries?: Entry[];
  typeIcons?: Record<string, string>;
  activeBrainId?: string;
}

export default function TodoView({ entries: propEntries, typeIcons = {}, activeBrainId }: TodoViewProps) {
  const ctx = useEntries();
  const entries = propEntries || ctx?.entries || [];
  const [tab, setTab] = useState<"list" | "calendar">("list");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [editState, setEditState] = useState<{ entry: Entry; rect: DOMRect } | null>(null);

  async function handleEditSave(changes: Partial<Entry>) {
    if (!ctx?.handleUpdate || !editState) return;
    await ctx.handleUpdate(editState.entry.id, changes);
  }

  /* External calendar events (from Google/Outlook sync) */
  const [externalEvents, setExternalEvents] = useState<ExternalCalEvent[]>([]);
  useEffect(() => {
    authFetch("/api/calendar?action=events")
      .then((r) => r?.json?.())
      .then((d) => { if (Array.isArray(d?.events)) setExternalEvents(d.events); })
      .catch(() => null);
  }, []);

  const mkAdd = (map: Record<string, Entry[]>) => (key: string, e: Entry) => {
    if (!map[key]) map[key] = [];
    if (!map[key].find((x) => x.id === e.id)) map[key].push(e);
  };

  const dateMap = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    const add = mkAdd(map);
    entries.forEach((e) => { if (!isDone(e)) extractDates(e).forEach((d) => add(d, e)); });
    addRecurring(entries, add);
    return map;
  }, [entries]);

  const taskMap = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    const add = mkAdd(map);
    entries.forEach((e) => { if (!isDone(e)) extractActionDates(e).forEach((d) => add(d, e)); });
    addRecurring(entries, add);
    return map;
  }, [entries]);

  const { weekDays, mondayKey, todayKey } = useMemo(() => {
    const now = new Date();
    const todayKey = toDateKey(now);
    const dow = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0, 0, 0, 0);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
    return { weekDays, mondayKey: toDateKey(monday), todayKey };
  }, []);

  const overdue = useMemo(() => {
    const seen = new Set<string>();
    return entries
      .filter((e) => !isDone(e))
      .flatMap((e) => extractActionDates(e).map((d) => ({ entry: e, dateStr: d })))
      .filter(({ entry, dateStr }) => {
        if (dateStr >= mondayKey) return false;
        const k = `${entry.id}-${dateStr}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [entries, mondayKey]);

  const todoList = useMemo(
    () => entries.filter((e) => !isDone(e) && e.type === "todo" && extractActionDates(e).length === 0),
    [entries],
  );

  const completed = useMemo(() => entries.filter(isDone), [entries]);
  const selEntries = selectedDay ? dateMap[selectedDay] || [] : [];
  const weekItemCount = weekDays.reduce((n, d) => n + (taskMap[toDateKey(d)]?.length || 0), 0);
  const total = overdue.length + weekItemCount + todoList.length;

  function renderItem({ entry, dateStr }: TodoItem, showDate: boolean) {
    const tc = TC[entry.type] || TC.note;
    const icon = resolveIcon(entry.type, typeIcons);
    const done = isDone(entry);
    return (
      <div
        key={`${entry.id}-${dateStr}`}
        className="flex items-center gap-3 py-2.5 cursor-pointer"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          setEditState({ entry, rect: e.currentTarget.getBoundingClientRect() });
        }}
      >
        <CheckButton entry={entry} ctx={ctx} />
        <span className="mt-0.5 text-base shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" style={{ color: done ? "var(--ink-ghost)" : "var(--ink)", textDecoration: done ? "line-through" : "none" }}>
            {entry.title}
          </p>
          {entry.content && entry.content !== entry.title && (
            <p className="mt-0.5 truncate text-xs" style={{ color: "var(--ink-faint)" }}>{entry.content}</p>
          )}
        </div>
        {showDate && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "var(--ember-wash)", color: "var(--ember)" }}>
            {fmtD(dateStr)}
          </span>
        )}
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize" style={{ background: `${tc.c}18`, color: tc.c }}>
          {entry.type}
        </span>
      </div>
    );
  }

  function renderEntryRow(entry: Entry) {
    const done = isDone(entry);
    const tc = TC[entry.type] || TC.todo;
    const icon = resolveIcon(entry.type, typeIcons);
    return (
      <div
        key={entry.id}
        className="flex items-center gap-3 py-2.5 cursor-pointer"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          setEditState({ entry, rect: e.currentTarget.getBoundingClientRect() });
        }}
      >
        <CheckButton entry={entry} ctx={ctx} />
        {icon && <span className="mt-0.5 text-base shrink-0">{icon}</span>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" style={{ color: done ? "var(--ink-ghost)" : "var(--ink)", textDecoration: done ? "line-through" : "none" }}>
            {entry.title}
          </p>
        </div>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize" style={{ background: `${tc.c}18`, color: tc.c }}>
          {entry.type}
        </span>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100%" }}>
      {/* Desktop header */}
      <header
        className="hidden lg:flex"
        style={{ alignItems: "center", justifyContent: "space-between", padding: "18px 32px", borderBottom: "1px solid var(--line-soft)", minHeight: 68, gap: 20 }}
      >
        <div>
          <h1 className="f-serif" style={{ fontSize: 22, fontWeight: 450, letterSpacing: "-0.01em", margin: 0, color: "var(--ink)" }}>
            Todos
          </h1>
          <div className="f-serif" style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 2 }}>
            {total > 0 ? `${total} active · ${completed.length} done` : "your focused task list"}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center rounded-xl overflow-hidden border" style={{ borderColor: "var(--line-soft)" }}>
          {(["list", "calendar"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 text-sm font-medium capitalize transition-colors"
              style={{
                background: tab === t ? "var(--ember)" : "var(--surface)",
                color: tab === t ? "var(--ember-ink)" : "var(--ink-soft)",
                borderRight: t === "list" ? "1px solid var(--line-soft)" : "none",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <div style={{ padding: "16px 24px 120px", maxWidth: tab === "calendar" ? 1100 : 780, margin: "0 auto" }}>
        {/* Mobile tab switcher */}
        <div className="mb-4 flex items-center rounded-xl overflow-hidden border lg:hidden" style={{ borderColor: "var(--line-soft)" }}>
          {(["list", "calendar"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 text-sm font-medium capitalize transition-colors"
              style={{
                background: tab === t ? "var(--ember)" : "var(--surface)",
                color: tab === t ? "var(--ember-ink)" : "var(--ink-soft)",
                borderRight: t === "list" ? "1px solid var(--line-soft)" : "none",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Calendar tab ── */}
        {tab === "calendar" && (
          <CalendarTab
            entries={entries}
            externalEvents={externalEvents}
            brainId={activeBrainId}
            onAdded={() => ctx?.refreshEntries()}
          />
        )}

        {/* ── List tab ── */}
        {tab === "list" && (
          <>
            <div className="mb-4">
              <QuickAdd brainId={activeBrainId} onAdded={() => ctx?.refreshEntries()} />
            </div>

            <MiniCalendar dateMap={dateMap} selectedDay={selectedDay} onSelectDay={setSelectedDay} />

            {/* Selected day detail */}
            {selectedDay && (
              <div
                className="mt-4 space-y-3 rounded-2xl border p-4"
                style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}
              >
                <p className="text-sm font-semibold" style={{ color: selEntries.length ? "var(--ember)" : "var(--ink-faint)", fontFamily: "var(--f-sans)" }}>
                  {selEntries.length ? `${selEntries.length} item${selEntries.length > 1 ? "s" : ""} — ${selectedDay}` : `Nothing on ${selectedDay}`}
                </p>
                {selEntries.map((e) => {
                  const cfg = TC[e.type] || TC.note;
                  const eIcon = resolveIcon(e.type, typeIcons);
                  return (
                    <div key={e.id} className="flex items-start gap-3 rounded-xl border px-3 py-2" style={{ background: "var(--surface-low)", borderColor: "var(--line-soft)" }}>
                      <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                        <span className="text-base">{eIcon}</span>
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize" style={{ background: `${cfg.c}18`, color: cfg.c }}>
                          {e.type}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm" style={{ color: "var(--ink)" }}>{e.title}</p>
                        {e.content && (
                          <p className="mt-0.5 truncate text-xs" style={{ color: "var(--ink-faint)" }}>{e.content.slice(0, 120)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!selectedDay && (
              <div className="mt-6 space-y-6">

                {/* Overdue */}
                {overdue.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="block h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--blood)" }} />
                      <p className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ fontFamily: "var(--f-sans)", color: "var(--blood)" }}>Overdue</p>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "var(--blood-wash)", color: "var(--blood)" }}>{overdue.length}</span>
                    </div>
                    <div className="divide-y rounded-2xl border px-3" style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}>
                      {overdue.map((item) => renderItem(item, true))}
                    </div>
                  </div>
                )}

                {/* Weekly day-by-day */}
                {weekDays.map((dayDate) => {
                  const key = toDateKey(dayDate);
                  const isToday = key === todayKey;
                  const isPast = key < todayKey;
                  const items = taskMap[key] || [];
                  const dayLabel = dayDate.toLocaleDateString("en-ZA", { weekday: "short" });
                  const dateLabel = dayDate.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

                  return (
                    <div key={key} style={{ opacity: isPast ? 0.5 : 1 }}>
                      <div className="mb-2 flex items-center gap-2">
                        {isToday && (
                          <span className="f-sans shrink-0" style={{ background: "var(--ember)", color: "var(--ember-ink)", borderRadius: 999, padding: "1px 8px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            Today
                          </span>
                        )}
                        <span className="f-sans" style={{ fontSize: 12, fontWeight: 600, color: isToday ? "var(--ink)" : "var(--ink-soft)" }}>{dayLabel}</span>
                        <span className="f-sans" style={{ fontSize: 12, color: "var(--ink-faint)" }}>{dateLabel}</span>
                        {items.length > 0 && (
                          <span className="f-sans ml-auto" style={{ fontSize: 10, color: "var(--ink-faint)" }}>{items.length}</span>
                        )}
                      </div>
                      {items.length > 0 ? (
                        <div className="divide-y rounded-2xl border px-3" style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}>
                          {items.map((entry) => renderItem({ entry, dateStr: key }, false))}
                        </div>
                      ) : (
                        <div style={{ height: 1, background: "var(--line-soft)", margin: "4px 2px" }} />
                      )}
                    </div>
                  );
                })}

                {/* Undated todos */}
                {todoList.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="block h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--ember)" }} />
                      <p className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ fontFamily: "var(--f-sans)", color: "var(--ember)" }}>To Do</p>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "var(--ember-wash)", color: "var(--ember)" }}>{todoList.length}</span>
                    </div>
                    <div className="divide-y rounded-2xl border px-3" style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}>
                      {todoList.map((e) => renderEntryRow(e))}
                    </div>
                  </div>
                )}

                {/* Completed */}
                {completed.length > 0 && (
                  <div>
                    <button onClick={() => setShowCompleted((s) => !s)} className="flex w-full items-center gap-2 py-1">
                      <span className="block h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--ink-ghost)" }} />
                      <p className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ fontFamily: "var(--f-sans)", color: "var(--ink-faint)" }}>Completed</p>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "var(--surface-high)", color: "var(--ink-faint)" }}>{completed.length}</span>
                      <span className="f-sans ml-auto text-xs" style={{ color: "var(--ink-ghost)" }}>{showCompleted ? "▾" : "▸"}</span>
                    </button>
                    {showCompleted && (
                      <div className="mt-2 divide-y rounded-2xl border px-3" style={{ background: "var(--surface)", borderColor: "var(--line-soft)" }}>
                        {completed.map((e) => renderEntryRow(e))}
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state */}
                {total === 0 && completed.length === 0 && (
                  <div className="mt-8 flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4" style={{ fontSize: 40, opacity: 0.3 }}>☑</div>
                    <p className="mb-1 text-lg font-semibold" style={{ fontFamily: "var(--f-sans)", color: "var(--ink)" }}>All clear</p>
                    <p className="max-w-xs text-sm" style={{ color: "var(--ink-faint)" }}>
                      Add todos above, or they'll appear automatically when entries have due dates.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {editState && (
        <TodoEditPopover
          entry={editState.entry}
          rect={editState.rect}
          onClose={() => setEditState(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
