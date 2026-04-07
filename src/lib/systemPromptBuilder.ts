import { getLearningsContext } from "./learningEngine";

export interface SystemPromptOptions {
  base?: string;
  memoryGuide?: string;
  /** When provided, auto-injects user learnings into the system prompt */
  brainId?: string;
}

export function buildSystemPrompt({ base = "", memoryGuide, brainId }: SystemPromptOptions): string {
  let prompt = base;

  if (memoryGuide) {
    prompt = `[Classification Guide]\n${memoryGuide}\n\n[Task]\n${prompt}`;
  }

  if (brainId) {
    const learnings = getLearningsContext(brainId);
    if (learnings) {
      prompt = `${prompt}\n\n--- USER LEARNING CONTEXT ---\nThis user's past decisions reveal preferences. Adapt your output accordingly:\n${learnings}\n--- END LEARNING CONTEXT ---`;
    }
  }

  return prompt;
}
