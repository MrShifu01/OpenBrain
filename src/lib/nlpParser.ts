import * as chrono from "chrono-node";
import { format } from "date-fns";

export type ParsedPriority = "p1" | "p2" | "p3" | "p4" | null;
export type ParsedEnergy = "low" | "medium" | "high" | null;

export interface ParseResult {
  cleanTitle: string;
  dueDate: string | null; // yyyy-MM-dd
  priority: ParsedPriority;
  tags: string[];
  energy: ParsedEnergy;
}

const PRIORITY_RE = /\b(p[1-4])\b/i;
const TAG_RE = /#([a-zA-Z0-9_-]+)/g;
const ENERGY_RE = /!(high|med(?:ium)?|low)\b/i;

function mapEnergy(raw: string): ParsedEnergy {
  const l = raw.toLowerCase();
  if (l === "high") return "high";
  if (l === "low") return "low";
  return "medium";
}

export function parseTask(input: string): ParseResult {
  let working = input;

  // Priority
  const priorityMatch = PRIORITY_RE.exec(working);
  const priority = priorityMatch ? (priorityMatch[1].toLowerCase() as ParsedPriority) : null;
  if (priorityMatch) working = working.replace(priorityMatch[0], "");

  // Energy
  const energyMatch = ENERGY_RE.exec(working);
  const energy = energyMatch ? mapEnergy(energyMatch[1]) : null;
  if (energyMatch) working = working.replace(energyMatch[0], "");

  // Tags
  const tags: string[] = [];
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = TAG_RE.exec(working)) !== null) tags.push(tagMatch[1]);
  working = working.replace(/#[a-zA-Z0-9_-]+/g, "");

  // Date (chrono-node)
  const chronoResults = chrono.parse(working, new Date(), { forwardDate: true });
  let dueDate: string | null = null;
  if (chronoResults.length > 0) {
    const r = chronoResults[0];
    dueDate = format(r.date(), "yyyy-MM-dd");
    working = working.replace(r.text, "");
  }

  const cleanTitle = working.replace(/\s{2,}/g, " ").trim();

  return { cleanTitle, dueDate, priority, tags, energy };
}
