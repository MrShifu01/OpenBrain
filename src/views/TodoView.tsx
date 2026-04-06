import { useMemo } from "react";
import { TC, fmtD } from "../data/constants";
import type { Entry } from "../types";

const DATE_KEYS = [
  "deadline",
  "due_date",
  "valid_to",
  "expiry_date",
  "expiry",
  "renewal_date",
  "event_date",
  "date",
  "start_date",
  "end_date",
  "scheduled_date",
  "appointment_date",
  "event_start",
  "match_date",
  "game_date",
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function extractDates(entry: Entry): string[] {
  const m = entry.metadata || {};
  const dates = new Set<string>();

  // Explicit date fields
  DATE_KEYS.forEach((k) => {
    if (m[k] && DATE_RE.test(String(m[k]))) dates.add(String(m[k]).slice(0, 10));
  });

  // Generic metadata scan
  Object.values(m).forEach((v) => {
    if (typeof v === "string" && DATE_RE.test(v)) dates.add(v.slice(0, 10));
  });

  return [...dates];
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface TodoViewProps {
  entries?: Entry[];
}

interface TodoItem {
  entry: Entry;
  dateStr: string;
}

export default function TodoView({ entries = [] }: TodoViewProps) {
  const { today, tomorrow, thisWeek, overdue } = useMemo(() => {
    const now = new Date();
    const todayKey = toDateKey(now);

    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    const tomorrowKey = toDateKey(tom);

    // End of week (Sunday)
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    const endOfWeekKey = toDateKey(endOfWeek);

    const today: TodoItem[] = [];
    const tomorrow: TodoItem[] = [];
    const thisWeek: TodoItem[] = []; // days after tomorrow through end of week
    const overdue: TodoItem[] = [];

    entries.forEach((entry) => {
      // Skip completed reminders
      if (entry.type === "reminder" && entry.metadata?.status === "done") return;

      const dates = extractDates(entry);
      dates.forEach((dateStr) => {
        const item = { entry, dateStr };
        if (dateStr === todayKey) {
          today.push(item);
        } else if (dateStr === tomorrowKey) {
          tomorrow.push(item);
        } else if (dateStr > tomorrowKey && dateStr <= endOfWeekKey) {
          thisWeek.push(item);
        } else if (dateStr < todayKey) {
          overdue.push(item);
        }
      });
    });

    // Sort each section by date
    const byDate = (a: TodoItem, b: TodoItem) => a.dateStr.localeCompare(b.dateStr);
    thisWeek.sort(byDate);
    overdue.sort((a, b) => b.dateStr.localeCompare(a.dateStr)); // most recent first

    return { today, tomorrow, thisWeek, overdue };
  }, [entries]);

  const total = today.length + tomorrow.length + thisWeek.length + overdue.length;

  function renderItem({ entry, dateStr }: TodoItem, showDate: boolean) {
    const tc = TC[entry.type] || TC.note;
    return (
      <div
        key={`${entry.id}-${dateStr}`}
        className="bg-ob-surface border-ob-border mb-1.5 flex items-center gap-2.5 rounded-[10px] border px-3.5 py-2.5"
      >
        <span className="shrink-0 text-base">{tc.i}</span>
        <div className="min-w-0 flex-1">
          <p className="text-ob-text m-0 overflow-hidden text-[13px] font-semibold text-ellipsis whitespace-nowrap">
            {entry.title}
          </p>
          {entry.content && entry.content !== entry.title && (
            <p className="text-ob-text-dim mt-0.5 mb-0 overflow-hidden text-[11px] text-ellipsis whitespace-nowrap">
              {entry.content}
            </p>
          )}
        </div>
        {showDate && <span className="text-ob-text-dim shrink-0 text-[10px]">{fmtD(dateStr)}</span>}
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold"
          style={{ background: `${tc.c}20`, color: tc.c }}
        >
          {entry.type}
        </span>
      </div>
    );
  }

  function renderSection(
    title: string,
    emoji: string,
    items: TodoItem[],
    showDate: boolean,
    accentColor?: string,
  ) {
    if (items.length === 0) return null;
    return (
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-sm">{emoji}</span>
          <p
            className="m-0 text-xs font-bold tracking-[1px] uppercase"
            style={accentColor ? { color: accentColor } : undefined}
          >
            {!accentColor && <span className="text-ob-text-mid">{title}</span>}
            {accentColor && title}
          </p>
          <span className="text-ob-text-dim text-[11px] font-normal">({items.length})</span>
        </div>
        {items.map((item) => renderItem(item, showDate))}
      </div>
    );
  }

  return (
    <div>
      {total === 0 && (
        <div className="pt-12 text-center">
          <div className="mb-3 text-[40px]">📋</div>
          <p className="text-ob-text mb-1 text-[15px] font-semibold">All clear</p>
          <p className="text-ob-text-dim m-0 text-[13px] leading-relaxed">
            No upcoming deadlines, events, or reminders this week.
            <br />
            Entries with dates will show up here automatically.
          </p>
        </div>
      )}

      {renderSection("Overdue", "🔴", overdue, true, "#FF6B35")}
      {renderSection("Today", "🟢", today, false, "#4ECDC4")}
      {renderSection("Tomorrow", "🟡", tomorrow, false, "#FFEAA7")}
      {renderSection("This week", "📅", thisWeek, true)}
    </div>
  );
}
