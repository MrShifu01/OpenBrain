/**
 * S5-5: Entry cloning utility.
 */

const CLONE_PREFIX = "Copy of ";

export interface CloneableEntry {
  id?: string;
  title: string;
  content?: string;
  type?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  importance?: number;
  pinned?: boolean;
  brain_id?: string;
}

/**
 * Builds a payload for a cloned entry.
 * - Prefixes title with "Copy of " (unless already prefixed)
 * - Removes id so a new one is assigned
 * - Resets pinned to false
 */
export function buildClonePayload(entry: CloneableEntry): Omit<CloneableEntry, "id"> {
  const { id: _id, ...rest } = entry;
  const title = entry.title.startsWith(CLONE_PREFIX)
    ? entry.title
    : `${CLONE_PREFIX}${entry.title}`;
  return { ...rest, title, pinned: false };
}
