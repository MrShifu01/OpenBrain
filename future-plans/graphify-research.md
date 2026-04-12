# Graphify Research — Learnings for Everion

**Source:** https://github.com/safishamsi/graphify
**Date:** 2026-04-12

## What Graphify Is

AI coding assistant skill that transforms any file collection (code, docs, papers, images, video) into a **persistent, queryable knowledge graph**. Built on NetworkX + Leiden clustering + tree-sitter AST parsing. Claims 71.5x token reduction vs reading raw files on a 52-file benchmark.

## Key Ideas Worth Adopting

### 1. Persistent Knowledge Graph Per Vault

Build a graph once from vault entries, query it across sessions without re-processing. Store as `graph.json` per brain. Token savings compound over time — users can ask "how does X relate to Y?" without re-reading every entry.

**Implementation path:** After AI analysis runs on entries, store extracted concepts and relationships as graph edges. Use NetworkX (Python) or a JS graph library (e.g., graphology) on the frontend.

### 2. Automatic Relationship Discovery

Graphify extracts three types of relationships:
- **EXTRACTED** (explicit): entry B is cited/linked in entry A — confidence 1.0
- **INFERRED** (reasonable): both entries discuss the same concept — confidence 0.6-0.9
- **AMBIGUOUS** (uncertain): flagged for user review — low confidence

**For Everion:** When refine analysis runs, extract concept nodes and relationship edges alongside the existing structured fields. Surface "did you know these entries connect?" suggestions.

### 3. Confidence Labeling on AI Analysis

Every AI-generated connection is labeled with confidence level. Users see what was found vs what was guessed. This builds trust and lets users verify uncertain connections.

**For Everion:** Add confidence scores to AI-suggested tags, types, and relationships. Show EXTRACTED vs INFERRED indicators in the UI.

### 4. Topology-Based Clustering (No Embeddings Needed)

Graphify uses Leiden community detection on the graph itself — no separate vector DB or embedding model required. Semantic similarity edges that the LLM extracts are already in the graph, so they influence clustering directly.

**For Everion:** Could replace or supplement current tag/type-based organization with automatic concept clusters. "Your vault has 5 conceptual themes: [A, B, C, D, E]."

### 5. God Nodes (Core Concepts)

Top-degree entities in the graph = the most load-bearing concepts in a vault. Answers "what are the 10 core ideas in your brain?" automatically.

**For Everion:** Surface "Key Concepts" view showing the most connected ideas across all entries. Useful for vault overview and onboarding new users to their own knowledge.

### 6. Surprising Connections

Multi-signal ranking algorithm finds non-obvious relationships:
- Cross-type connections (e.g., a note links to a task unexpectedly)
- Cross-cluster connections (structurally distant but semantically related)
- Peripheral-to-hub connections (obscure entry connects to core concept)

Each result includes a `why` field explaining the surprise in plain English.

**For Everion:** "Discovery" feature that surfaces unexpected relationships between entries. Could be a daily digest or a dedicated view.

### 7. Design Rationale Tracking

Special handling for WHY decisions were made, not just WHAT was decided. Extracted from comments, notes, and explicit rationale sections. Stored as `rationale_for` edges.

**For Everion:** When capturing decisions, prompt users for rationale. Store as a first-class relationship type. Later: "why did we decide X?" queries.

### 8. Feedback Loop — Graph Grows From Queries

When users query the graph, results are saved as docs. Next rebuild picks them up and extracts new concepts. The knowledge base learns from what users ask.

**For Everion:** User searches and AI chat interactions could feed back into the graph, strengthening connections that users actually care about.

### 9. Interactive Graph Visualization

vis.js-based HTML visualization with:
- Node size = degree (importance)
- Node color = community (cluster)
- Search box, click-to-inspect, hover tooltips
- Toggle communities on/off

**For Everion:** Visual graph view of vault entries and their relationships. Could be a premium/power-user feature.

## Integration Approaches

### Option A: Library Integration (Recommended for Backend)
Use graphify's Python extraction + clustering in Everion's API layer. When entries are saved/updated, rebuild the vault graph incrementally.

### Option B: Concept Extraction Only
Don't use graphify directly. Instead, adopt its extraction patterns in Everion's existing AI pipeline:
- Add concept/relationship extraction to refine analysis prompts
- Store as graph edges in Firestore alongside entries
- Run community detection client-side with a JS graph library

### Option C: Export to Graphify
Let users export their vault to graphify format for external analysis. Lightweight integration, no backend changes.

## What NOT to Copy

- **Tree-sitter AST parsing** — Everion is not a code analysis tool
- **Video/audio transcription** — Everion already handles voice via its own pipeline
- **MCP server** — Not relevant to Everion's architecture
- **Multi-platform skill system** — Everion is a standalone app

## Priority Recommendations

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Confidence labels on AI analysis | High (trust) | Low | P0 |
| Concept extraction in refine | High (discovery) | Medium | P1 |
| Surprising connections view | High (delight) | Medium | P1 |
| God nodes / key concepts | Medium (overview) | Low | P2 |
| Interactive graph visualization | High (wow factor) | High | P2 |
| Automatic clustering | Medium (organization) | Medium | P3 |
| Feedback loop from queries | Medium (learning) | High | P3 |
