import { useState, useMemo } from "react";
import { TC, fmtD } from "../data/constants";
import { useEntries } from "../context/EntriesContext";
import type { Entry } from "../types";

export default function CalendarView() {
  const { entries } = useEntries();
  const [month, setMonth] = useState<Date>(() => new Date());
  const [selDay, setSelDay] = useState<number | null>(null);

  const year = month.getFullYear();
  const mon = month.getMonth();
  const today = new Date().toISOString().slice(0, 10);

  const DOW: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };

  const dateMap = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    const addTo = (key: string, entry: Entry) => {
      if (!map[key]) map[key] = [];
      if (!map[key].find((e) => e.id === entry.id)) map[key].push(entry);
    };

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

    // Explicit date fields — skip completed reminders
    entries.forEach((e: Entry) => {
      if (e.type === "reminder" && e.metadata?.status === "done") return;
      const m: Record<string, unknown> = e.metadata || {};
      // Check all known date keys
      DATE_KEYS.forEach((k) => {
        if (m[k]) addTo(String(m[k]).slice(0, 10), e);
      });
      // Fallback: scan all metadata values for any YYYY-MM-DD shaped string
      Object.values(m).forEach((v) => {
        if (typeof v === "string" && DATE_RE.test(v)) addTo(v.slice(0, 10), e);
      });
      // Fallback: scan title and content for YYYY-MM-DD dates
      const text = `${e.title || ""} ${e.content || ""}`;
      let match;
      while ((match = CONTENT_DATE_RE.exec(text)) !== null) addTo(match[1], e);
    });

    // Recurring day-of-week entries — show on every matching weekday in displayed month
    entries.forEach((e: Entry) => {
      let rawDay = (
        e.metadata?.day_of_week ||
        e.metadata?.weekday ||
        e.metadata?.recurring_day ||
        ""
      )
        .toString()
        .toLowerCase()
        .trim();
      // Fallback: scan title/content for "every <day>" pattern
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
  }, [entries, year, mon]);

  const firstDow = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthLabel = month.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  const dayKey = (d: number) =>
    `${year}-${String(mon + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const selKey = selDay ? dayKey(selDay) : null;
  const selEntries = selKey ? dateMap[selKey] || [] : [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={() => setMonth(new Date(year, mon - 1, 1))}
          aria-label="Previous month"
          className="bg-ob-surface border-ob-border text-ob-text-muted min-h-11 min-w-11 cursor-pointer rounded-lg border px-4 py-2 text-base"
        >
          ←
        </button>
        <span className="text-ob-text text-base font-bold">{monthLabel}</span>
        <button
          onClick={() => setMonth(new Date(year, mon + 1, 1))}
          aria-label="Next month"
          className="bg-ob-surface border-ob-border text-ob-text-muted min-h-11 min-w-11 cursor-pointer rounded-lg border px-4 py-2 text-base"
        >
          →
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div
            key={d}
            className="text-ob-text-faint py-1 text-center text-[9px] font-bold tracking-[1px]"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const key = dayKey(day);
          const dots = dateMap[key] || [];
          const isToday = key === today;
          const isSel = day === selDay;
          return (
            <div
              key={key}
              onClick={() => setSelDay(day === selDay ? null : day)}
              className={`flex aspect-square min-h-11 cursor-pointer flex-col items-center justify-center rounded-lg ${
                isSel
                  ? "bg-teal"
                  : isToday
                    ? "bg-teal/[0.12]"
                    : dots.length
                      ? "bg-ob-surface"
                      : "bg-transparent"
              } ${
                isToday && !isSel
                  ? "border-teal/[0.25] border"
                  : dots.length && !isSel
                    ? "border-ob-border border"
                    : "border border-transparent"
              }`}
            >
              <span
                className={`text-xs ${isToday ? "font-extrabold" : "font-normal"} ${isSel ? "text-ob-bg" : isToday ? "text-teal" : "text-ob-text-mid"}`}
              >
                {day}
              </span>
              {dots.length > 0 && !isSel && (
                <div className="mt-0.5 flex gap-0.5">
                  {dots.slice(0, 3).map((e, ei) => (
                    <div
                      key={ei}
                      className="h-1 w-1 rounded-full"
                      style={{
                        background:
                          (e as any).importance >= 2 ? "#FF6B35" : (TC[e.type] || TC.note).c,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selDay && (
        <div className="mt-5">
          <p className="text-ob-text-faint mb-3 text-[11px] font-semibold tracking-[1.2px] uppercase">
            {selEntries.length
              ? `${selEntries.length} item${selEntries.length > 1 ? "s" : ""} — ${selKey}`
              : `Nothing on ${selKey}`}
          </p>
          {selEntries.map((e) => {
            const cfg = TC[e.type] || TC.note;
            return (
              <div
                key={e.id}
                className="bg-ob-surface border-ob-border mb-2 rounded-[10px] border px-4 py-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm">{cfg.i}</span>
                  <span className="text-[11px] font-bold uppercase" style={{ color: cfg.c }}>
                    {e.type}
                  </span>
                </div>
                <p className="text-ob-text-soft m-0 text-sm font-medium">{e.title}</p>
                {e.content && (
                  <p className="text-ob-text-muted mt-1 mb-0 text-xs leading-relaxed">
                    {e.content.slice(0, 120)}
                  </p>
                )}
              </div>
            );
          })}
          {selEntries.length === 0 && (
            <p className="text-ob-text-faint text-[13px]">
              No entries with this date in their metadata.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
