// ─── Core Domain Types ───

// Canonical type vocabulary — AI should output one of these.
// "secret" is reserved for E2E encryption (vault). "other" is the catch-all.
export const CANONICAL_TYPES = [
  "person",
  "note",
  "task",
  "todo",
  "someday",
  "document",
  "recipe",
  "event",
  "health",
  "finance",
  "reminder",
  "contact",
  "place",
  "idea",
  "decision",
  "persona",
  "other",
  "secret",
] as const;

// Entry types are flexible strings — the AI picks the most descriptive label.
// Well-known types with dedicated icons: reminder, document, contact, place,
// person, idea, color, decision, note. "secret" is reserved for E2E encryption.
export type EntryType = string;

export type Priority = "high" | "medium" | "low";

type ConfidenceLevel = "extracted" | "inferred";

export type Workspace = "business" | "personal" | "both";

// Enrichment-pipeline state. Lives on metadata.enrichment so the four
// step handlers in src/lib/enrichEntry.ts can each read/write their own
// flag without clobbering siblings. Keep these names in sync with that
// file — readFlags() / mergeEnrichmentFlags().
interface EnrichmentFlags {
  parsed?: boolean;
  embedded?: boolean;
  concepts_count?: number;
  has_related?: boolean;
  has_insight?: boolean;
}

interface EntryMetadata {
  phone?: string;
  email?: string;
  url?: string;
  due_date?: string;
  deadline?: string;
  expiry_date?: string;
  renewal_date?: string;
  event_date?: string;
  day_of_week?: string;
  date?: string;
  price?: string;
  unit?: string;
  status?: string;
  priority?: "p1" | "p2" | "p3" | "p4";
  energy?: "low" | "medium" | "high";
  workspace?: Workspace;
  confidence?: Record<string, ConfidenceLevel>;
  // Enrichment-pipeline housekeeping fields. Explicit so enrichEntry.ts
  // doesn't need to cast through `any` to read them.
  enrichment?: EnrichmentFlags;
  ai_insight?: string;
  ai_insight_short?: string;
  full_text?: string;
  // Provenance — what created this entry (gmail-scan, manual capture, etc).
  // DetailModal branches on `source === "gmail"` to surface the "ignore email"
  // affordance.
  source?: string;
  gmail_subject?: string;
  gmail_from?: string;
  email_type?: string;
  // Extracted concepts (graph nodes). Read-only on the client; the brain
  // graph extractor on the server populates this.
  concepts?: string[];
  [key: string]: unknown;
}

export interface Entry {
  id: string;
  title: string;
  content?: string;
  type: EntryType;
  tags?: string[];
  metadata?: EntryMetadata;
  workspace?: Workspace;
  brain_id?: string;
  created_at?: string;
  updated_at?: string;
  embedded_at?: string;
  embedding_status?: "pending" | "done" | "failed";
  encrypted?: boolean;
  pinned?: boolean;
  importance?: number;
  status?: "active" | "staged";
}

export interface TypeConfig {
  i: string; // icon emoji
  c: string; // color hex
}

export interface PriorityConfig {
  bg: string;
  c: string;
  l: string;
}

export interface Brain {
  id: string;
  name: string;
  owner_id?: string;
  created_at?: string;
}

export interface ToastEvent {
  message: string;
  type: "info" | "error" | "success";
  id: number;
}

export type ToastListener = (event: ToastEvent) => void;

export interface Concept {
  id: string;
  label: string;
  source_entries: string[];
  frequency: number;
}

export interface Relationship {
  source_concept: string;
  target_concept: string;
  relation: string;
  confidence: "extracted" | "inferred";
  confidence_score: number;
  evidence_entries: string[];
}

export interface Link {
  from: string;
  to: string;
  rel: string;
}

export interface OfflineOp {
  id: string;
  url: string;
  method: string;
  body: string;
  created_at: string;
  tempId?: string;
}
