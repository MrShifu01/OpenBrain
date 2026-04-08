/**
 * S5-3: Drag-to-organize brain links utilities.
 */

export interface BrainLink {
  id: string;
  from: string;
  to: string;
  rel: string;
}

/**
 * Reorders an array of links by moving the item at `fromIndex` to `toIndex`.
 * Returns a new array without mutating the original.
 */
export function reorderLinks<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return [...items];
  const result = [...items];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}
