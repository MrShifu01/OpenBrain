/**
 * S6-2: Learning-informed prompt builder.
 * Prepends the user's learned preferences to any AI prompt when available.
 */

/**
 * Builds a prompt that injects user learnings before the base prompt content.
 * Returns the base prompt unchanged when learnings are empty or null.
 */
export function buildLearningInformedPrompt(base: string, learnings: string | null | undefined): string {
  if (!learnings || !learnings.trim()) return base;
  return `${learnings}\n\n${base}`;
}
