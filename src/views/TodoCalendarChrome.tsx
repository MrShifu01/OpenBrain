// Calendar chrome — purely visual building blocks for the month view.
// Header (with prev/next/today), the dot cluster shown inside each cell,
// the day cell itself, the month grid, the desktop side panel, the
// mobile bottom sheet (with drag-to-dismiss), and the floating add button.
//
// Split out of TodoCalendarTab.tsx; nothing here owns calendar state.

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { toDateKey } from "./todoUtils";
import { type CalEvent, buildMonthGrid, DAY_ABBRS, eventSourceColor } from "./todoCalendarHelpers";

// ── ChevronButton ─────────────────────────────────────────────────────────

export function ChevronButton({
  direction,
  onClick,
  ariaLabel,
}: {
  direction: "left" | "right";
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="press"
      style={{
        height: 32,
        width: 32,
        borderRadius: 999,
        border: 0,
        background: "transparent",
        color: "var(--ink-soft)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 180ms",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-high)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <svg
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={direction === "left" ? "M15.75 19.5L8.25 12l7.5-7.5" : "M8.25 4.5l7.5 7.5-7.5 7.5"}
        />
      </svg>
    </button>
  );
}

// ── CalendarHeader ────────────────────────────────────────────────────────

export function CalendarHeader({
  title,
  onPrev,
  onNext,
  onToday,
}: {
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <ChevronButton direction="left" onClick={onPrev} ariaLabel="Previous" />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: 1,
          justifyContent: "center",
        }}
      >
        <h2
          className="f-serif"
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
            margin: 0,
            textAlign: "center",
          }}
        >
          {title}
        </h2>
        <Button
          size="xs"
          variant="ghost"
          onClick={onToday}
          className="rounded-full bg-[var(--ember-wash)] text-[var(--ember)]"
        >
          Today
        </Button>
      </div>
      <ChevronButton direction="right" onClick={onNext} ariaLabel="Next" />
    </div>
  );
}

// ── EventDots ─────────────────────────────────────────────────────────────
//
// Two-row "Tetris" stacking — top-heavy. Reads cleaner in a narrow day cell
// than a long horizontal row when there are 3+ events:
//   1 → •
//   2 → • •
//   3 → • •  /  •
//   4 → • •  /  • •
//   5 → • • •  /  • •
//   6 → • • •  /  • • •
//   7+ → 6 dots + +N

export function EventDots({ events }: { events: CalEvent[] }) {
  if (events.length === 0) return null;
  const MAX = 6;
  const visible = events.slice(0, MAX);
  const overflow = events.length - visible.length;
  // Top row gets the extra dot when count is odd (top-heavy looks like a
  // proper Tetris piece resting; bottom-heavy reads as off-balance).
  const topCount = Math.ceil(visible.length / 2);
  const top = visible.slice(0, topCount);
  const bottom = visible.slice(topCount);

  const dotStyle = (ev: CalEvent): React.CSSProperties => ({
    width: 5,
    height: 5,
    borderRadius: 999,
    background: eventSourceColor(ev.source),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ display: "flex", gap: 3 }}>
        {top.map((ev, i) => (
          <span key={`t${i}`} aria-hidden="true" style={dotStyle(ev)} />
        ))}
      </div>
      {bottom.length > 0 && (
        <div style={{ display: "flex", gap: 3 }}>
          {bottom.map((ev, i) => (
            <span key={`b${i}`} aria-hidden="true" style={dotStyle(ev)} />
          ))}
        </div>
      )}
      {overflow > 0 && (
        <span
          aria-hidden="true"
          style={{ fontSize: 9, color: "var(--ink-ghost)", lineHeight: 1, marginTop: 1 }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

// ── DayCell ───────────────────────────────────────────────────────────────

export function DayCell({
  date,
  events,
  isToday,
  isSelected,
  onClick,
}: {
  date: Date | null;
  events: CalEvent[];
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  if (!date) {
    return (
      <div
        aria-hidden="true"
        className="cal-day-empty"
        style={{
          minHeight: 78,
          background: "var(--surface-low)",
        }}
      />
    );
  }
  return (
    <button
      onClick={onClick}
      className="cal-day press"
      data-today={isToday || undefined}
      data-selected={isSelected || undefined}
      style={{
        minHeight: 78,
        padding: "8px 6px 6px",
        background: isSelected ? "var(--ember-wash)" : "var(--surface)",
        border: 0,
        textAlign: "center",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        transition: "background 160ms ease",
        font: "inherit",
        color: "inherit",
      }}
    >
      <span
        className="f-sans"
        style={{
          width: 26,
          height: 26,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: isToday ? 700 : 500,
          color: isToday ? "var(--ember-ink)" : isSelected ? "var(--ember)" : "var(--ink)",
          background: isToday ? "var(--ember)" : "transparent",
          borderRadius: 999,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {date.getDate()}
      </span>
      <div style={{ flex: 1 }} />
      <EventDots events={events} />
    </button>
  );
}

// ── MonthGrid ─────────────────────────────────────────────────────────────

export function MonthGrid({
  navDate,
  selectedKey,
  todayKey,
  eventMap,
  onSelect,
}: {
  navDate: Date;
  selectedKey: string | null;
  todayKey: string;
  eventMap: Record<string, CalEvent[]>;
  onSelect: (key: string) => void;
}) {
  const grid = useMemo(() => buildMonthGrid(navDate.getFullYear(), navDate.getMonth()), [navDate]);
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          marginBottom: 8,
        }}
      >
        {DAY_ABBRS.map((d) => (
          <div
            key={d}
            className="f-sans"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--ink-ghost)",
              textAlign: "center",
              padding: "4px 0",
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <div
        className="cal-grid-frame"
        style={{
          border: "1px solid var(--line-soft)",
          borderRadius: 14,
          overflow: "hidden",
          background: "var(--line-soft)",
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 1,
        }}
      >
        {grid.flat().map((day, i) => {
          if (!day)
            return (
              <DayCell
                key={`empty-${i}`}
                date={null}
                events={[]}
                isToday={false}
                isSelected={false}
                onClick={() => {}}
              />
            );
          const key = toDateKey(day);
          return (
            <DayCell
              key={key}
              date={day}
              events={eventMap[key] || []}
              isToday={key === todayKey}
              isSelected={key === selectedKey}
              onClick={() => onSelect(key)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── SidePanel ─────────────────────────────────────────────────────────────

export function SidePanel({ children }: { children: React.ReactNode }) {
  return (
    <aside
      style={{
        width: 320,
        flexShrink: 0,
        alignSelf: "flex-start",
        position: "sticky",
        top: 16,
        background: "var(--surface)",
        border: "1px solid var(--line-soft)",
        borderRadius: 16,
        padding: 18,
        boxShadow: "var(--lift-1)",
      }}
    >
      {children}
    </aside>
  );
}

// ── BottomSheet ───────────────────────────────────────────────────────────

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Lock body scroll while sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Drag-to-dismiss state. Only triggered from the handle area at the top —
  // otherwise scrolling through the event list would conflict with closing.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);
  const CLOSE_THRESHOLD = 90; // px of downward drag to dismiss

  function onHandleTouchStart(e: React.TouchEvent) {
    startYRef.current = e.touches[0]?.clientY ?? 0;
    setDragging(true);
  }
  function onHandleTouchMove(e: React.TouchEvent) {
    const y = e.touches[0]?.clientY ?? 0;
    const delta = y - startYRef.current;
    setDragY(Math.max(0, delta)); // never drag up
  }
  function onHandleTouchEnd() {
    setDragging(false);
    if (dragY > CLOSE_THRESHOLD) {
      onClose();
      // Reset for next open. The sheet animates closed via animation; the
      // transform jumps back to 0 once `open=false` unmounts.
      setTimeout(() => setDragY(0), 200);
    } else {
      setDragY(0); // snap back
    }
  }

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-fullscreen)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        animation: "cal-sheet-fade 200ms ease",
      }}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--scrim)",
          border: 0,
          cursor: "pointer",
        }}
      />
      <div
        style={{
          position: "relative",
          background: "var(--surface)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          // Bottom padding includes the 56px BottomNav height so the last
          // event card has clearance instead of disappearing under the nav.
          padding: "14px 20px calc(84px + env(safe-area-inset-bottom))",
          boxShadow: "var(--lift-3)",
          maxHeight: "85vh",
          overflowY: "auto",
          animation: dragY > 0 ? undefined : "cal-sheet-slide 240ms cubic-bezier(0.22, 1, 0.36, 1)",
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? "none" : "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
          touchAction: "pan-y",
        }}
      >
        {/* Handle: enlarged hit area + touch handlers for drag-to-dismiss. */}
        <div
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          onTouchCancel={onHandleTouchEnd}
          role="button"
          aria-label="Drag down to close"
          tabIndex={0}
          style={{
            // Generous hit area around the visible bar so it's easy to grab.
            margin: "-14px -20px 4px",
            padding: "12px 20px 8px",
            cursor: "grab",
            touchAction: "none",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 40,
              height: 4,
              background: "var(--line)",
              borderRadius: 2,
              margin: "0 auto",
            }}
          />
        </div>
        {children}
      </div>
    </div>
  );
}

// ── FloatingActionButton ──────────────────────────────────────────────────

export function FloatingActionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Add todo"
      className="press"
      style={{
        position: "fixed",
        right: 24,
        bottom: "calc(96px + env(safe-area-inset-bottom))",
        height: 52,
        width: 52,
        borderRadius: 999,
        background: "var(--ember)",
        color: "var(--ember-ink)",
        border: 0,
        boxShadow: "var(--lift-3)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "var(--z-dropdown)",
      }}
    >
      <svg
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}
