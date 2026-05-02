import { useMemo } from "react";
import type { Entry } from "../../types";

interface RecentCapturesStripProps {
  entries: Entry[];
  onSelectEntry: (entry: Entry) => void;
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function RecentCapturesStrip({ entries, onSelectEntry }: RecentCapturesStripProps) {
  const recent = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bT - aT;
    });
    return sorted.slice(0, 5);
  }, [entries]);

  if (recent.length === 0) return null;

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
          padding: "0 2px",
        }}
      >
        <div
          className="f-sans"
          style={{
            fontSize: 12,
            color: "var(--ink-faint)",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          recently captured
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 6,
          margin: "0 -20px",
          paddingLeft: 20,
          paddingRight: 20,
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
        className="hide-scrollbar"
      >
        {recent.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onSelectEntry(e)}
            className="press"
            style={{
              flexShrink: 0,
              width: 200,
              scrollSnapAlign: "start",
              background: "var(--surface-high)",
              border: "1px solid var(--line-soft)",
              borderRadius: 14,
              padding: "12px 14px",
              textAlign: "left",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              minHeight: 110,
              boxShadow: "var(--lift-1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--ember)",
                }}
              />
              <span
                className="f-sans"
                style={{
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: "var(--ink-faint)",
                }}
              >
                {relativeTime(e.created_at)} · {e.type}
              </span>
            </div>
            <div
              className="f-serif"
              style={{
                fontSize: 14,
                fontWeight: 450,
                color: "var(--ink)",
                lineHeight: 1.35,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {e.title || e.content?.slice(0, 80) || "(no title)"}
            </div>
          </button>
        ))}
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { scrollbar-width: none; }
      `}</style>
    </section>
  );
}
