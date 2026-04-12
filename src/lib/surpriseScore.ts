import type { Entry } from "../types";
import type { ConceptGraph } from "./conceptGraph";
import { getConceptsForEntry } from "./conceptGraph";

export interface SurprisingConnection {
  entryA: Entry;
  entryB: Entry;
  score: number;
  why: string;
  confidence: "extracted" | "inferred";
  sharedConcepts: string[];
}

/** Compute surprise score for a pair of entries connected by shared concepts */
function scorePair(
  a: Entry,
  b: Entry,
  sharedConcepts: string[],
  graph: ConceptGraph,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Cross-type bonus
  if (a.type !== b.type) {
    score += 2;
    reasons.push(`different types (${a.type} + ${b.type})`);
  }

  // Cross-workspace bonus
  const wsA = a.workspace || a.metadata?.workspace;
  const wsB = b.workspace || b.metadata?.workspace;
  if (wsA && wsB && wsA !== wsB && wsA !== "both" && wsB !== "both") {
    score += 2;
    reasons.push(`spans ${wsA} and ${wsB}`);
  }

  // Low tag overlap bonus
  const tagsA = new Set(a.tags || []);
  const tagsB = new Set(b.tags || []);
  const tagOverlap = [...tagsA].filter((t) => tagsB.has(t)).length;
  if (tagOverlap === 0 && sharedConcepts.length > 0) {
    score += 3;
    reasons.push("no shared tags but connected by concept");
  }

  // Peripheral-to-hub bonus
  const aConcepts = getConceptsForEntry(graph, a.id);
  const bConcepts = getConceptsForEntry(graph, b.id);
  if (
    (aConcepts.length <= 2 && bConcepts.length >= 5) ||
    (bConcepts.length <= 2 && aConcepts.length >= 5)
  ) {
    score += 1;
    reasons.push("peripheral entry connects to a hub");
  }

  return { score, reasons };
}

/** Find the top N most surprising connections in the concept graph */
export function findSurprisingConnections(
  graph: ConceptGraph,
  entries: Entry[],
  topN = 5,
): SurprisingConnection[] {
  const entryMap = new Map(entries.map((e) => [e.id, e]));
  const pairScores: SurprisingConnection[] = [];
  const seen = new Set<string>();

  // For each concept, find pairs of entries that share it
  for (const concept of graph.concepts) {
    if (concept.source_entries.length < 2) continue;
    const eids = concept.source_entries;
    for (let i = 0; i < eids.length; i++) {
      for (let j = i + 1; j < eids.length; j++) {
        const key = [eids[i], eids[j]].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);

        const a = entryMap.get(eids[i]);
        const b = entryMap.get(eids[j]);
        if (!a || !b) continue;

        // Find all shared concepts between this pair
        const aConcepts = new Set(
          graph.concepts.filter((c) => c.source_entries.includes(a.id)).map((c) => c.label),
        );
        const sharedConcepts = graph.concepts
          .filter((c) => c.source_entries.includes(b.id) && aConcepts.has(c.label))
          .map((c) => c.label);

        const { score, reasons } = scorePair(a, b, sharedConcepts, graph);
        if (score >= 3) {
          pairScores.push({
            entryA: a,
            entryB: b,
            score,
            why: `These entries both relate to ${sharedConcepts.slice(0, 2).join(" and ")} — ${reasons.join(", ")}`,
            confidence: score >= 5 ? "extracted" : "inferred",
            sharedConcepts,
          });
        }
      }
    }
  }

  return pairScores.sort((a, b) => b.score - a.score).slice(0, topN);
}
