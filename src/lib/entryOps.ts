import type { Entry } from "../types";
import { enqueue } from "./offlineQueue";
import { readEntriesCache, writeEntriesCache } from "./entriesCache";
import { encryptEntry } from "./crypto";

export interface SaveEntryOptions {
  brainId: string;
  vaultKey?: string | null;
}

export interface SaveEntryResult {
  entryId: string;
}

export async function saveEntry(
  entry: Entry,
  { brainId, vaultKey }: SaveEntryOptions,
): Promise<SaveEntryResult> {
  const stored = vaultKey ? encryptEntry(entry, vaultKey) : entry;

  // Optimistic cache update
  const cached = (await readEntriesCache()) ?? [];
  const idx = cached.findIndex((e) => e.id === entry.id);
  if (idx >= 0) cached[idx] = stored as Entry;
  else cached.unshift(stored as Entry);
  await writeEntriesCache(cached);

  await enqueue({
    id: crypto.randomUUID(),
    url: "/api/capture",
    method: "POST",
    body: JSON.stringify({
      p_title: entry.title,
      p_content: entry.content ?? "",
      p_type: entry.type,
      p_metadata: (entry as Entry & { metadata?: unknown }).metadata ?? {},
      p_tags: entry.tags ?? [],
      p_brain_id: brainId,
    }),
    created_at: new Date().toISOString(),
    tempId: entry.id,
  });

  return { entryId: entry.id };
}
