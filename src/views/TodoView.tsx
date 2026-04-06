import { useState, useMemo } from "react";
import { TC, fmtD } from "../data/constants";
import { useEntries } from "../context/EntriesContext";
import type { Entry } from "../types";

/* ─── Shared date extraction (single source of truth) ─── */
const DATE_KEYS = [
  "deadline",
  "due_date",
  "valid_to",
  "valid_from",
  "date",
  "event_date",
  "start_date",
  "end_date",
  "match_date",
  "game_date",
  "scheduled_date",
  "appointment_date",
  "event_start",
  "expiry_date",
  "expiry",
  "renewal_date",
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const CONTENT_DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/g;

const DOW: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

function extractDates(entry: Entry): string[] {
  const m = (entry.metadata || {}) as Record<string, unknown>;
  const dates = new Set<string>();
  DATE_KEYS.forEach((k) => {
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

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface TodoItem {
  entry: Entry;
  dateStr: string;
}

/* ─── Collapsible Mini Calendar ─── */
function MiniCalendar({
  dateMap,
  selectedDay,
  onSelectDay,
}: {
  dateMap: Record<string, Entry[]>;
  selectedDay: string | null;
  onSelectDay: (key: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [month, setMonth] = useState<Date>(() => new Date());
  const year = month.getFullYear();
  const mon = month.getMonth();
  const today = new Date().toISOString().slice(0, 10);

  const firstDow = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthLabel = month.toLocaleDateString("en-ZA", { month: "short", year: "numeric" });
  const dayKey = (d: number) =>
    `${year}-${String(mon + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const eventCount = Object.keys(dateMap).filter((k) => k.startsWith(`${year}-${String(mon + 1).padStart(2, "0")}`)).length;

  return (
    <div>
      {/* Header toggle */}
      <button
        onClick={() => setExpanded((s) => !s)}
      >
        <div>
          <span>📅</span>
          <div>
            <span>{monthLabel}</span>
            {eventCount > 0 && (
              <span>· {eventCount} days with events</span>
            )}
          </div>
        </div>
        <div>
          {expanded && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setMonth(new Date(year, mon - 1, 1)); }}
              >←</button>
              <button
                onClick={(e) => { e.stopPropagation(); setMonth(new Date(year, mon + 1, 1)); }}
              >→</button>
            </>
          )}
          <span>{expanded ? "▾" : "▸"}</span>
        </div>
      </button>

      {/* Calendar grid */}
      {expanded && (
        <div>
          <div>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i}>
                {d}
              </div>
            ))}
          </div>
          <div>
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const key = dayKey(day);
              const dots = dateMap[key] || [];
              const isToday = key === today;
              const isSel = key === selectedDay;
              return (
                <button
                  key={key}
                  onClick={() => onSelectDay(isSel ? null : key)}
                >
                  <span>{day}</span>
                  {dots.length > 0 && !isSel && (
                    <div />
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

/* ─── Main TodoView ─── */
interface TodoViewProps {
  entries?: Entry[];
}

export default function TodoView({ entries: propEntries }: TodoViewProps) {
  const ctx = useEntries();
  const entries = propEntries || ctx?.entries || [];
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const dateMap = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    const addTo = (key: string, entry: Entry) => {
      if (!map[key]) map[key] = [];
      if (!map[key].find((e) => e.id === entry.id)) map[key].push(entry);
    };

    entries.forEach((e: Entry) => {
      if (e.type === "reminder" && (e.metadata as any)?.status === "done") return;
      const dates = extractDates(e);
      dates.forEach((d) => addTo(d, e));
    });

    const now = new Date();
    const year = now.getFullYear();
    const mon = now.getMonth();
    entries.forEach((e: Entry) => {
      const m = (e.metadata || {}) as Record<string, unknown>;
      let rawDay = (m.day_of_week || m.weekday || m.recurring_day || "")
        .toString()
        .toLowerCase()
        .trim();
      if (!rawDay) {
        const text = `${e.title || ""} ${e.content || ""}`.toLowerCase();
        const dayMatch = text.match(
          /every\s+(sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?)/i,
        );
        if (dayMatch) rawDay = dayMatch[1];
      }
      const dowIndex = DOW[rawDay];
      if (dowIndex === undefined) return;
      for (let d = 1; d <= new Date(year, mon + 1, 0).getDate(); d++) {
        if (new Date(year, mon, d).getDay() === dowIndex) {
          addTo(`${year}-${String(mon + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, e);
        }
      }
    });

    return map;
  }, [entries]);

  const { today, tomorrow, thisWeek, overdue } = useMemo(() => {
    const now = new Date();
    const todayKey = toDateKey(now);
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    const tomorrowKey = toDateKey(tom);
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    const endOfWeekKey = toDateKey(endOfWeek);

    const today: TodoItem[] = [];
    const tomorrow: TodoItem[] = [];
    const thisWeek: TodoItem[] = [];
    const overdue: TodoItem[] = [];

    entries.forEach((entry) => {
      if (entry.type === "reminder" && (entry.metadata as any)?.status === "done") return;
      const dates = extractDates(entry);
      dates.forEach((dateStr) => {
        const item = { entry, dateStr };
        if (dateStr === todayKey) today.push(item);
        else if (dateStr === tomorrowKey) tomorrow.push(item);
        else if (dateStr > tomorrowKey && dateStr <= endOfWeekKey) thisWeek.push(item);
        else if (dateStr < todayKey) overdue.push(item);
      });
    });

    const byDate = (a: TodoItem, b: TodoItem) => a.dateStr.localeCompare(b.dateStr);
    thisWeek.sort(byDate);
    overdue.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

    return { today, tomorrow, thisWeek, overdue };
  }, [entries]);

  const selEntries = selectedDay ? dateMap[selectedDay] || [] : [];
  const total = today.length + tomorrow.length + thisWeek.length + overdue.length;

  function renderItem({ entry, dateStr }: TodoItem, showDate: boolean) {
    const tc = TC[entry.type] || TC.note;
    return (
      <div key={`${entry.id}-${dateStr}`}>
        <span>{tc.i}</span>
        <div>
          <p>{entry.title}</p>
          {entry.content && entry.content !== entry.title && (
            <p>{entry.content}</p>
          )}
        </div>
        {showDate && <span>{fmtD(dateStr)}</span>}
        <span>{entry.type}</span>
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
      <div>
        <div>
          <span>{emoji}</span>
          <p>
            {!accentColor && <span>{title}</span>}
            {accentColor && title}
          </p>
          <span>({items.length})</span>
        </div>
        {items.map((item) => renderItem(item, showDate))}
      </div>
    );
  }

  return (
    <div>
      <MiniCalendar dateMap={dateMap} selectedDay={selectedDay} onSelectDay={setSelectedDay} />

      {/* Selected day detail */}
      {selectedDay && (
        <div>
          <p>
            {selEntries.length
              ? `${selEntries.length} item${selEntries.length > 1 ? "s" : ""} — ${selectedDay}`
              : `Nothing on ${selectedDay}`}
          </p>
          {selEntries.map((e) => {
            const cfg = TC[e.type] || TC.note;
            return (
              <div key={e.id}>
                <div>
                  <span>{cfg.i}</span>
                  <span>{e.type}</span>
                </div>
                <p>{e.title}</p>
                {e.content && (
                  <p>{e.content.slice(0, 120)}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!selectedDay && total === 0 && (
        <div>
          <div>📋</div>
          <p>All clear</p>
          <p>
            No upcoming deadlines, events, or reminders this week.
            Entries with dates will show up here automatically.
          </p>
        </div>
      )}

      {!selectedDay && (
        <>
          {renderSection("Overdue", "🔴", overdue, true, "#FF6B35")}
          {renderSection("Today", "🟢", today, false, "#4ECDC4")}
          {renderSection("Tomorrow", "🟡", tomorrow, false, "#FFEAA7")}
          {renderSection("This week", "📅", thisWeek, true)}
        </>
      )}
    </div>
  );
}
