import { getLearningsContext } from "./learningEngine";
import { loadGraph, getGodNodes } from "./conceptGraph";

interface SystemPromptOptions {
  base?: string;
  memoryGuide?: string;
  brainId?: string;
  /** S2-5: Opt-in to learning injection — only chat handler should pass true */
  withLearnings?: boolean;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Today's date as the model needs it. The model has no internal clock —
 * without this, "this Friday", "next Monday", "tomorrow" become guesswork.
 * The "this Friday → weekly recurring" calendar bug had this as one root
 * cause. Cheap to inject; saves a class of date-extraction errors.
 */
function todayContextLine(): string {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `Today is ${iso} (${DAY_NAMES[d.getDay()]}). Use this when resolving relative dates like "today", "tomorrow", "this Friday", "next month".`;
}

export function buildSystemPrompt({
  base = "",
  memoryGuide,
  brainId,
  withLearnings = false,
}: SystemPromptOptions): string {
  // Date context goes first — every prompt benefits, none are hurt.
  let prompt = `[Context]\n${todayContextLine()}\n\n${base}`;

  if (memoryGuide) {
    prompt = `[Classification Guide]\n${memoryGuide}\n\n[Task]\n${prompt}`;
  }

  if (brainId) {
    const graph = loadGraph(brainId);
    const godNodes = getGodNodes(graph, 10);
    if (godNodes.length > 0) {
      const themes = godNodes.map((c) => c.label).join(", ");
      prompt = `${prompt}\n\n--- BRAIN CONTEXT ---\nThis brain's core themes are: ${themes}\n--- END BRAIN CONTEXT ---`;
    }
  }

  if (withLearnings && brainId) {
    const learnings = getLearningsContext(brainId);
    if (learnings) {
      prompt = `${prompt}\n\n--- USER LEARNING CONTEXT ---\nThis user's past decisions reveal preferences. Adapt your output accordingly:\n${learnings}\n--- END LEARNING CONTEXT ---`;
    }
  }

  return prompt;
}
