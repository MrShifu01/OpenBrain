/**
 * Graph view — constellation layout ported from graph_system.jsx.
 *
 * The handoff describes concept nodes as stars with breathing opacity,
 * faint curved edges, hover highlights, click-to-open rail panel, and a
 * corner legend. Data comes from ConceptGraphContext (conceptGraph +
 * godNodes). Positions are deterministic-hashed from the concept label so
 * the map is stable between renders.
 */
import { useMemo, useState } from "react";
import { useConceptGraph } from "../context/ConceptGraphContext";
import { useEntries } from "../context/EntriesContext";
import type { Concept, Entry } from "../types";

interface GraphViewProps {
  openEntry?: (e: Entry) => void;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

/** Deterministic pseudo-random position in [0.08, 0.92] so stars don't crowd edges. */
function placeStar(label: string, axis: "x" | "y"): number {
  const h = hash(label + axis);
  return 0.08 + ((h % 1000) / 1000) * 0.84;
}

interface Mote {
  x: number; y: number; size: number; dx: string; dy: string; dur: number; delay: number; op: number;
}
function useMotes(count: number): Mote[] {
  return useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 2,
        dx: (Math.random() - 0.5) * 60 + "px",
        dy: (Math.random() - 0.5) * 80 + "px",
        dur: 14 + Math.random() * 18,
        delay: Math.random() * -20,
        op: 0.04 + Math.random() * 0.1,
      })),
    [count],
  );
}

export default function GraphView({ openEntry }: GraphViewProps) {
  const { conceptGraph, godNodes } = useConceptGraph();
  const { entries } = useEntries();
  const [hover, setHover] = useState<Concept | null>(null);
  const [selected, setSelected] = useState<Concept | null>(null);
  const motes = useMotes(40);

  const concepts = conceptGraph?.concepts ?? [];
  const maxWeight = Math.max(1, ...concepts.map((c) => c.source_entries.length));

  // Positioned stars — label → stable (x,y) in [0,1]²
  const stars = useMemo(
    () =>
      concepts.map((c) => ({
        ...c,
        x: placeStar(c.label, "x"),
        y: placeStar(c.label, "y"),
        weight: c.source_entries.length,
      })),
    [concepts],
  );

  // Edges — connect co-occurring concepts (share an entry).
  // Limited to pairs from the godNode set + their strongest neighbours to avoid noise.
  const edges = useMemo(() => {
    if (stars.length < 2) return [] as [string, string][];
    const byEntry = new Map<string, string[]>(); // entryId -> concept ids
    for (const c of concepts) {
      for (const eid of c.source_entries) {
        const arr = byEntry.get(eid);
        if (arr) arr.push(c.id);
        else byEntry.set(eid, [c.id]);
      }
    }
    const pairScore = new Map<string, number>();
    byEntry.forEach((ids) => {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
          const k = `${a}|${b}`;
          pairScore.set(k, (pairScore.get(k) ?? 0) + 1);
        }
      }
    });
    const out: [string, string][] = [];
    pairScore.forEach((v, k) => {
      if (v < 2) return; // co-occurrence threshold
      const [a, b] = k.split("|");
      out.push([a, b]);
    });
    return out.slice(0, 60);
  }, [stars, concepts]);

  const entriesForSelected = useMemo(() => {
    if (!selected) return [];
    const ids = new Set(selected.source_entries);
    return entries.filter((e) => ids.has(e.id)).slice(0, 6);
  }, [selected, entries]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* Top bar */}
      <header
        className="graph-topbar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 32px",
          borderBottom: "1px solid var(--line-soft)",
          minHeight: 72,
          gap: 20,
        }}
      >
        <div>
          <h1
            className="f-serif"
            style={{
              fontSize: 28,
              fontWeight: 450,
              letterSpacing: "-0.015em",
              lineHeight: 1.1,
              margin: 0,
              color: "var(--ink)",
            }}
          >
            Graph
          </h1>
          <div
            className="f-serif"
            style={{ fontSize: 14, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 4 }}
          >
            the shape of what you've been writing about
          </div>
        </div>
      </header>

      {/* Body: canvas + optional rail */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <div
          style={{
            flex: 1,
            position: "relative",
            background: "var(--surface-dim)",
            overflow: "hidden",
          }}
        >
          {/* Motes */}
          <div className="motes" aria-hidden="true">
            {motes.map((m, i) => (
              <div
                key={i}
                className="mote"
                data-ambient
                style={{
                  width: m.size,
                  height: m.size,
                  top: m.y + "%",
                  left: m.x + "%",
                  opacity: m.op,
                  ["--dx" as string]: m.dx,
                  ["--dy" as string]: m.dy,
                  ["--b-high" as string]: "0.12",
                  ["--b-low" as string]: "0.04",
                  animation: `design-drift ${m.dur}s ease-in-out infinite ${m.delay}s, design-breathe ${8 + Math.random() * 6}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>

          {/* Soft ember halo */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 600,
              height: 600,
              borderRadius: "50%",
              background: "radial-gradient(circle, var(--ember-wash) 0%, transparent 70%)",
              opacity: 0.4,
              pointerEvents: "none",
            }}
          />

          {/* Empty state */}
          {stars.length === 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: 40,
                gap: 8,
              }}
            >
              <h3
                className="f-serif"
                style={{
                  fontSize: 26,
                  fontWeight: 450,
                  color: "var(--ink)",
                  letterSpacing: "-0.005em",
                  margin: 0,
                }}
              >
                the night sky is empty.
              </h3>
              <p
                className="f-serif"
                style={{
                  fontSize: 15,
                  fontStyle: "italic",
                  color: "var(--ink-faint)",
                  margin: 0,
                  maxWidth: 360,
                  lineHeight: 1.5,
                }}
              >
                remember a few things and concepts will start to appear.
              </p>
            </div>
          )}

          {/* Stars + edges */}
          {stars.length > 0 && (
            <>
              <svg
                viewBox="0 0 1 1"
                preserveAspectRatio="xMidYMid meet"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              >
                {/* Edges */}
                {edges.map(([a, b], i) => {
                  const A = stars.find((s) => s.id === a);
                  const B = stars.find((s) => s.id === b);
                  if (!A || !B) return null;
                  const active =
                    (hover && (hover.id === a || hover.id === b)) ||
                    (selected && (selected.id === a || selected.id === b));
                  return (
                    <line
                      key={i}
                      x1={A.x}
                      y1={A.y}
                      x2={B.x}
                      y2={B.y}
                      stroke={active ? "var(--ember)" : "var(--ink-ghost)"}
                      strokeWidth={active ? 0.0014 : 0.0007}
                      opacity={active ? 0.55 : 0.18}
                      style={{ transition: "all 260ms" }}
                    />
                  );
                })}

                {/* Stars */}
                {stars.map((c) => {
                  const weightRatio = c.weight / maxWeight;
                  const r = 0.003 + weightRatio * 0.009;
                  const active = hover?.id === c.id || selected?.id === c.id;
                  const breathLow = 0.35 + weightRatio * 0.1;
                  const breathHigh = 0.55 + weightRatio * 0.15;
                  return (
                    <g
                      key={c.id}
                      onMouseEnter={() => setHover(c)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => setSelected(c)}
                      style={{ cursor: "pointer" }}
                    >
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r={r * 3.5}
                        fill="var(--ember)"
                        opacity={active ? 0.22 : 0}
                        style={{ transition: "opacity 260ms" }}
                      />
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r={r}
                        fill={active ? "var(--ember)" : "var(--ink)"}
                        opacity={active ? 1 : breathLow + 0.1}
                        style={{
                          transition: "fill 260ms",
                          animation: `design-breathe ${6 + (c.weight % 4)}s ease-in-out infinite`,
                          ["--b-low" as string]: String(breathLow),
                          ["--b-high" as string]: String(breathHigh),
                        }}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Hover / selected label */}
              {stars.map((c) => {
                const active = hover?.id === c.id || selected?.id === c.id;
                if (!active) return null;
                return (
                  <div
                    key={"hover-" + c.id}
                    className="f-serif"
                    style={{
                      position: "absolute",
                      left: `calc(${c.x * 100}% + 10px)`,
                      top: `calc(${c.y * 100}% + 8px)`,
                      fontSize: 15,
                      fontStyle: "italic",
                      color: "var(--ember)",
                      pointerEvents: "none",
                      textShadow: "0 1px 4px var(--bg)",
                    }}
                  >
                    {c.label}
                  </div>
                );
              })}

              {/* Prominent labels for god-nodes — shown permanently so the sky has shapes */}
              {stars
                .filter((c) => godNodes.some((g) => g.id === c.id))
                .map((c) => {
                  if (hover?.id === c.id || selected?.id === c.id) return null;
                  return (
                    <div
                      key={"lbl-" + c.id}
                      className="f-serif"
                      style={{
                        position: "absolute",
                        left: `calc(${c.x * 100}% + 10px)`,
                        top: `calc(${c.y * 100}% + 8px)`,
                        fontSize: 13,
                        color: "var(--ink-faint)",
                        pointerEvents: "none",
                        fontStyle: "italic",
                        opacity: 0.7,
                      }}
                    >
                      {c.label}
                    </div>
                  );
                })}

              {/* Corner legend */}
              <div
                style={{ position: "absolute", bottom: 20, left: 20 }}
                className="f-serif"
              >
                <div
                  style={{ fontSize: 13, fontStyle: "italic", color: "var(--ink-faint)" }}
                >
                  {stars.length} concepts · {edges.length} threads
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right rail — shows when a concept is selected */}
        {selected && (
          <aside
            className="graph-rail"
            style={{
              width: 360,
              borderLeft: "1px solid var(--line-soft)",
              padding: 28,
              background: "var(--surface)",
              overflow: "auto",
              flexShrink: 0,
            }}
          >
            <button
              className="design-btn-ghost press"
              onClick={() => setSelected(null)}
              aria-label="Close"
              style={{ width: 32, height: 32, minHeight: 32, padding: 0, marginBottom: 12 }}
            >
              <svg
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <div className="micro" style={{ marginBottom: 8 }}>concept</div>
            <h2
              className="f-serif"
              style={{
                fontSize: 36,
                fontWeight: 400,
                fontStyle: "italic",
                letterSpacing: "-0.015em",
                margin: 0,
                color: "var(--ink)",
                lineHeight: 1.1,
              }}
            >
              {selected.label}
            </h2>
            <div
              className="f-serif"
              style={{
                fontSize: 14,
                color: "var(--ink-faint)",
                marginTop: 8,
                fontStyle: "italic",
              }}
            >
              appears in {selected.source_entries.length} entr
              {selected.source_entries.length === 1 ? "y" : "ies"}
            </div>

            {entriesForSelected.length > 0 && (
              <>
                <div className="micro" style={{ marginTop: 28, marginBottom: 12 }}>entries</div>
                <div style={{ display: "grid", gap: 12 }}>
                  {entriesForSelected.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => openEntry?.(e)}
                      className="press"
                      style={{
                        textAlign: "left",
                        background: "transparent",
                        border: 0,
                        borderLeft: "2px solid var(--line)",
                        paddingLeft: 14,
                        paddingTop: 2,
                        paddingBottom: 2,
                        cursor: "pointer",
                      }}
                    >
                      <div
                        className="f-serif"
                        style={{ fontSize: 15, fontWeight: 450, color: "var(--ink)" }}
                      >
                        {e.title}
                      </div>
                      {e.content && (
                        <div
                          className="f-serif"
                          style={{
                            fontSize: 13,
                            color: "var(--ink-faint)",
                            marginTop: 2,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {e.content as string}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </aside>
        )}
      </div>

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 1024px) {
          .graph-topbar { padding: 14px 20px !important; min-height: 56px !important; }
          .graph-rail { position: fixed; inset: 0; width: 100% !important; z-index: 60; }
        }
      `}</style>
    </div>
  );
}
