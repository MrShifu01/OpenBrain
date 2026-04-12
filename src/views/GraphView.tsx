import { useMemo, useCallback, useRef, useState, useEffect, lazy, Suspense } from "react";
import { TC } from "../data/constants";
import { loadGraph, detectCommunities } from "../lib/conceptGraph";
import type { Entry, Brain } from "../types";

const ForceGraph2D = lazy(() => import("react-force-graph-2d"));

interface GraphNode {
  id: string;
  label: string;
  type: string;
  connections: number;
  community?: number;
}

interface GraphLink {
  source: string;
  target: string;
  label: string;
  value: number;
}

interface GraphViewProps {
  entries: Entry[];
  activeBrain: Brain | null;
  onSelectEntry?: (entry: Entry) => void;
}

const COMMUNITY_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
];

export default function GraphView({ entries, activeBrain, onSelectEntry }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: Math.max(300, width), height: Math.max(300, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { nodes, links } = useMemo(() => {
    if (!activeBrain?.id) return { nodes: [], links: [] };
    const graph = loadGraph(activeBrain.id);
    const communities = detectCommunities(graph);

    // Build entry-to-community map
    const entryCommunity = new Map<string, number>();
    communities.forEach((c, i) => {
      for (const eid of c.entryIds) entryCommunity.set(eid, i);
    });

    // Count connections per entry via concept graph
    const connectionCount = new Map<string, number>();
    for (const concept of graph.concepts) {
      for (const eid of concept.source_entries) {
        connectionCount.set(eid, (connectionCount.get(eid) || 0) + 1);
      }
    }

    const filteredEntries = filter
      ? entries.filter(
          (e) =>
            e.type.includes(filter.toLowerCase()) ||
            e.title.toLowerCase().includes(filter.toLowerCase()) ||
            (e.tags || []).some((t) => t.toLowerCase().includes(filter.toLowerCase())),
        )
      : entries;

    const entryIds = new Set(filteredEntries.map((e) => e.id));
    const nodes: GraphNode[] = filteredEntries
      .filter((e) => !e.encrypted)
      .map((e) => ({
        id: e.id,
        label: e.title.slice(0, 30),
        type: e.type,
        connections: connectionCount.get(e.id) || 0,
        community: entryCommunity.get(e.id),
      }));

    // Build links from relationships
    const links: GraphLink[] = [];
    const seen = new Set<string>();
    for (const rel of graph.relationships) {
      // Find entries that belong to both concepts
      const srcEntries = graph.concepts.find((c) => c.id === rel.source_concept)?.source_entries || [];
      const tgtEntries = graph.concepts.find((c) => c.id === rel.target_concept)?.source_entries || [];
      for (const se of srcEntries) {
        for (const te of tgtEntries) {
          if (se === te || !entryIds.has(se) || !entryIds.has(te)) continue;
          const key = [se, te].sort().join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          links.push({ source: se, target: te, label: rel.relation, value: rel.confidence_score });
        }
      }
    }

    return { nodes, links };
  }, [entries, activeBrain, filter]);

  const entryMap = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  const handleNodeClick = useCallback(
    (node: any) => {
      const entry = entryMap.get(node.id);
      if (entry) onSelectEntry?.(entry);
    },
    [entryMap, onSelectEntry],
  );

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D) => {
      const size = 4 + Math.min(node.connections * 1.5, 12);
      const color =
        node.community !== undefined
          ? COMMUNITY_COLORS[node.community % COMMUNITY_COLORS.length]
          : (TC as Record<string, any>)[node.type]?.c || "#6366f1";
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Label
      ctx.font = "3px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(node.label, node.x, node.y + size + 5);
    },
    [],
  );

  if (!activeBrain?.id) {
    return (
      <div className="flex items-center justify-center p-8" style={{ color: "var(--color-on-surface-variant)" }}>
        Select a brain to view its knowledge graph
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 p-8 text-center"
        style={{ color: "var(--color-on-surface-variant)", minHeight: "100%" }}
      >
        <div className="text-4xl">🕸️</div>
        <p className="text-sm font-medium" style={{ color: "var(--color-on-surface)" }}>
          No graph data yet
        </p>
        <p className="text-xs">
          Run "Improve Brain" to extract concepts and build your knowledge graph.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col"
      style={{ background: "var(--color-background)", height: "100%", minHeight: "400px" }}
    >
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by type, tag, or title..."
          className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
          style={{
            background: "var(--color-surface-container)",
            border: "1px solid var(--color-outline-variant)",
            color: "var(--color-on-surface)",
          }}
        />
        <span className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
          {nodes.length} nodes · {links.length} edges
        </span>
      </div>

      {/* Graph */}
      <div className="flex-1">
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-8" style={{ color: "var(--color-on-surface-variant)" }}>
              Loading graph...
            </div>
          }
        >
          <ForceGraph2D
            width={dimensions.width}
            height={dimensions.height - 52}
            graphData={{ nodes, links }}
            nodeCanvasObject={nodeCanvasObject}
            onNodeClick={handleNodeClick}
            linkColor={() => "rgba(255,255,255,0.1)"}
            linkWidth={(link: any) => Math.max(0.5, link.value * 2)}
            backgroundColor="transparent"
            cooldownTicks={100}
            nodeRelSize={6}
          />
        </Suspense>
      </div>
    </div>
  );
}
