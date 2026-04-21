import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { GNode, GEdge } from "../../hooks/useGraph";

// ── Type → color mapping ────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  person:      "var(--moss)",
  contact:     "var(--moss)",
  health:      "var(--moss)",
  place:       "var(--moss)",
  event:       "oklch(65% 0.09 185)",   // teal
  finance:     "oklch(68% 0.10 75)",    // gold
  transaction: "oklch(68% 0.10 75)",
  contract:    "oklch(68% 0.10 75)",
  note:        "var(--ember)",
  idea:        "var(--ember)",
  insight:     "var(--ember)",
  reminder:    "var(--ember)",
  decision:    "var(--ember)",
  task:        "var(--ink-soft)",
  document:    "var(--ink-soft)",
  recipe:      "oklch(60% 0.06 50)",    // warm brown
  ingredient:  "oklch(60% 0.06 50)",
  company:     "oklch(62% 0.09 285)",   // violet
  other:       "var(--ink-ghost)",
};

function typeColor(type: string): string {
  return TYPE_COLOR[type] ?? "var(--ink-ghost)";
}

function calcRadius(degree: number): number {
  return Math.max(4, Math.min(16, 4 + Math.sqrt(degree) * 3));
}

// ── Types ────────────────────────────────────────────────────────────────────
interface Vp { panX: number; panY: number; zoom: number }

interface Props {
  nodes: GNode[];
  edges: GEdge[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function GraphCanvas({ nodes, edges, selected, onSelect, onMoveNode }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const vpRef  = useRef<Vp>({ panX: 0, panY: 0, zoom: 1 });
  const [vp, setVpState] = useState<Vp>({ panX: 0, panY: 0, zoom: 1 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [fitted,  setFitted]  = useState(false);

  // Sync ref + state together
  const setVp = useCallback((next: Vp | ((p: Vp) => Vp)) => {
    const v = typeof next === "function" ? next(vpRef.current) : next;
    vpRef.current = v;
    setVpState(v);
  }, []);

  // ── Derived maps ────────────────────────────────────────────────────────
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of edges) {
      d.set(e.source, (d.get(e.source) ?? 0) + 1);
      d.set(e.target, (d.get(e.target) ?? 0) + 1);
    }
    return d;
  }, [edges]);

  const connectedIds = useMemo(() => {
    if (!selected) return new Set<string>();
    const s = new Set([selected]);
    for (const e of edges) {
      if (e.source === selected) s.add(e.target);
      if (e.target === selected) s.add(e.source);
    }
    return s;
  }, [selected, edges]);

  const maxWeight = useMemo(
    () => Math.max(1, ...edges.map(e => e.weight)),
    [edges],
  );

  // ── Auto-fit ─────────────────────────────────────────────────────────────
  const fitAll = useCallback(() => {
    const el = svgRef.current;
    if (!el || nodes.length === 0) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    const xs  = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad  = 90;
    const zoom = Math.min(
      (rect.width  - pad * 2) / Math.max(maxX - minX, 1),
      (rect.height - pad * 2) / Math.max(maxY - minY, 1),
      1.4,
    );
    setVp({
      panX: rect.width  / 2 - ((minX + maxX) / 2) * zoom,
      panY: rect.height / 2 - ((minY + maxY) / 2) * zoom,
      zoom,
    });
  }, [nodes, setVp]);

  useEffect(() => {
    if (nodes.length === 0 || fitted) return;
    const id = requestAnimationFrame(() => { fitAll(); setFitted(true); });
    return () => cancelAnimationFrame(id);
  }, [nodes, fitted, fitAll]);

  // Re-fit when nodes set changes substantially
  useEffect(() => { setFitted(false); }, [nodes.length]);

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setVp(prev => {
        const f = e.deltaY < 0 ? 1.12 : 0.9;
        const z = Math.max(0.08, Math.min(6, prev.zoom * f));
        const r = z / prev.zoom;
        return { panX: cx + (prev.panX - cx) * r, panY: cy + (prev.panY - cy) * r, zoom: z };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setVp]);

  // ── Drag (pan + node move) ────────────────────────────────────────────────
  const dragRef = useRef<{
    type: "pan" | "node";
    startX: number; startY: number;
    panOX?: number; panOY?: number;
    nodeId?: string; nodeStartX?: number; nodeStartY?: number;
    moved: boolean;
  } | null>(null);

  function onPointerDownCanvas(e: React.PointerEvent<SVGSVGElement>) {
    if ((e.target as Element).closest("[data-node]")) return;
    dragRef.current = {
      type: "pan", startX: e.clientX, startY: e.clientY,
      panOX: e.clientX - vpRef.current.panX,
      panOY: e.clientY - vpRef.current.panY,
      moved: false,
    };
    svgRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerDownNode(e: React.PointerEvent, nodeId: string) {
    e.stopPropagation();
    const n = nodeMap.get(nodeId);
    if (!n) return;
    dragRef.current = {
      type: "node", startX: e.clientX, startY: e.clientY,
      nodeId, nodeStartX: n.x, nodeStartY: n.y, moved: false,
    };
    svgRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved &&
        (Math.abs(e.clientX - d.startX) > 3 || Math.abs(e.clientY - d.startY) > 3))
      d.moved = true;

    if (d.type === "pan" && d.panOX !== undefined) {
      setVp(prev => ({ ...prev, panX: e.clientX - d.panOX!, panY: e.clientY - d.panOY! }));
    } else if (d.type === "node" && d.nodeId) {
      const z = vpRef.current.zoom;
      onMoveNode(d.nodeId,
        d.nodeStartX! + (e.clientX - d.startX) / z,
        d.nodeStartY! + (e.clientY - d.startY) / z,
      );
    }
  }

  function onPointerUp() {
    const d = dragRef.current;
    if (d?.type === "pan" && !d.moved) onSelect(null);
    dragRef.current = null;
  }

  // Zoom toward viewport center
  function zoomBy(delta: number) {
    const el = svgRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const cx = width / 2, cy = height / 2;
    setVp(prev => {
      const z = Math.max(0.08, Math.min(6, prev.zoom * delta));
      const r = z / prev.zoom;
      return { panX: cx + (prev.panX - cx) * r, panY: cy + (prev.panY - cy) * r, zoom: z };
    });
  }

  // ── Derived display state ─────────────────────────────────────────────────
  const showLabels = vp.zoom > 0.3;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

      <svg
        ref={svgRef}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          display: "block", background: "var(--surface-dim)", cursor: "default",
          touchAction: "none",
        }}
        onPointerDown={onPointerDownCanvas}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          {/* Glow for selected node */}
          <filter id="glow-sel" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Subtle ember ambient halo */}
          <radialGradient id="rg-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="var(--ember)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--ember)" stopOpacity="0"    />
          </radialGradient>

          {/* Dot-grid pattern */}
          <pattern id="dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="0.5" cy="0.5" r="0.7" fill="var(--ink)" fillOpacity="0.06" />
          </pattern>
        </defs>

        {/* ── Background ── */}
        <rect width="100%" height="100%" fill="url(#dots)" />
        <ellipse cx="50%" cy="50%" rx="42%" ry="38%" fill="url(#rg-halo)" />

        {/* ── Graph world (pan + zoom) ── */}
        <g transform={`translate(${vp.panX} ${vp.panY}) scale(${vp.zoom})`}>

          {/* Edges */}
          <g>
            {edges.map((edge, i) => {
              const src = nodeMap.get(edge.source);
              const tgt = nodeMap.get(edge.target);
              if (!src || !tgt) return null;
              const active = selected !== null &&
                (edge.source === selected || edge.target === selected);
              const w = edge.weight / maxWeight;
              return (
                <line key={i}
                  x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                  stroke={active ? "var(--ember)" : "var(--ink)"}
                  strokeWidth={active ? 1.5 : 0.5 + w * 0.7}
                  strokeOpacity={active ? 0.65 : 0.08 + w * 0.16}
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {nodes.map(node => {
              const deg    = degree.get(node.id) ?? 0;
              const r      = calcRadius(deg);
              const color  = typeColor(node.entry.type);
              const isSel  = selected === node.id;
              const isConn = connectedIds.has(node.id);
              const isFade = selected !== null && !isConn;
              const isHov  = hovered === node.id;

              const title  = node.entry.title;
              const label  = title.length > 28 ? title.slice(0, 26) + "…" : title;

              const labelOpacity = isSel || isHov ? 0.95
                : isConn             ? 0.75
                : 0.38;

              return (
                <g key={node.id} data-node
                  transform={`translate(${node.x} ${node.y})`}
                  opacity={isFade ? 0.1 : 1}
                  style={{ cursor: "pointer" }}
                  onPointerDown={e => onPointerDownNode(e, node.id)}
                  onClick={() => onSelect(isSel ? null : node.id)}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* Selected ambient halo */}
                  {isSel && (
                    <circle r={r + 12} fill={color} fillOpacity={0.12} />
                  )}

                  {/* Hover ring */}
                  {isHov && !isSel && (
                    <circle r={r + 5} fill="none"
                      stroke={color} strokeOpacity={0.5} strokeWidth={1} />
                  )}

                  {/* Node body */}
                  <circle
                    r={isHov && !isSel ? r * 1.18 : r}
                    fill={color}
                    fillOpacity={isSel ? 1 : 0.85}
                    filter={isSel ? "url(#glow-sel)" : undefined}
                  />

                  {/* Inner specular dot for larger nodes */}
                  {r >= 7 && (
                    <circle r={r * 0.32} cx={-r * 0.18} cy={-r * 0.22}
                      fill="white" fillOpacity={0.22} />
                  )}

                  {/* Label */}
                  {showLabels && (
                    <text
                      y={r + 13}
                      textAnchor="middle"
                      fontFamily="var(--f-serif)"
                      fontSize={10.5}
                      fill="var(--ink)"
                      fillOpacity={labelOpacity}
                      style={{ userSelect: "none", pointerEvents: "none" }}
                    >
                      {label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* ── Controls overlay ── */}
      <div style={{
        position: "absolute", bottom: 20, right: 20,
        display: "flex", flexDirection: "column", gap: 4,
        pointerEvents: "auto",
      }}>
        {([
          { label: "+",  title: "Zoom in",       action: () => zoomBy(1.2)  },
          { label: "−",  title: "Zoom out",      action: () => zoomBy(0.83) },
          { label: "⊙",  title: "Fit all nodes", action: fitAll             },
        ] as const).map(({ label, title, action }) => (
          <button key={label} title={title} onClick={action} className="press"
            style={{
              width: 30, height: 30, borderRadius: 7,
              background: "var(--surface)", border: "1px solid var(--line-soft)",
              color: "var(--ink-soft)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: label === "⊙" ? 13 : 17,
              fontFamily: "var(--f-sans)", boxShadow: "var(--lift-1)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Legend ── */}
      <div style={{
        position: "absolute", bottom: 22, left: 20,
        fontFamily: "var(--f-serif)", fontStyle: "italic",
        fontSize: 12, color: "var(--ink-ghost)", pointerEvents: "none",
      }}>
        {nodes.length} nodes · {edges.length} connections
      </div>

      {/* ── Zoom hint (hidden once zoomed) ── */}
      {vp.zoom < 0.5 && (
        <div style={{
          position: "absolute", top: 14, right: 14,
          fontFamily: "var(--f-sans)", fontSize: 11,
          color: "var(--ink-ghost)", letterSpacing: "0.04em",
          pointerEvents: "none",
        }}>
          scroll to zoom · drag to pan
        </div>
      )}
    </div>
  );
}
