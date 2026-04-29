/**
 * Client-side repository for /api/entries.
 *
 * Every call to /api/entries used to be assembled inline at the call site —
 * query-string building, response-shape normalization (array vs. {entries}),
 * and error handling were duplicated in 8+ places. This repository is the
 * single seam so callers never construct /api/entries URLs directly.
 */
import { authFetch } from "./authFetch";
import type { Entry } from "../types";

/** Server responds with either a raw array (legacy) or { entries, nextCursor, hasMore }.
 *  Normalize to a uniform { entries, nextCursor, hasMore } shape so callers can
 *  paginate without sniffing response shape. */
function normalizePage(data: unknown): {
  entries: Entry[];
  nextCursor: string | null;
  hasMore: boolean;
} {
  if (Array.isArray(data)) return { entries: data as Entry[], nextCursor: null, hasMore: false };
  if (data && typeof data === "object") {
    const d = data as { entries?: Entry[]; nextCursor?: string | null; hasMore?: boolean };
    if (Array.isArray(d.entries)) {
      return {
        entries: d.entries,
        nextCursor: typeof d.nextCursor === "string" ? d.nextCursor : null,
        hasMore: !!d.hasMore,
      };
    }
  }
  return { entries: [], nextCursor: null, hasMore: false };
}

interface ListOptions {
  brainId?: string;
  limit?: number;
  cursor?: string | null;
  trash?: boolean;
  onError?: (status: number, body: string) => void;
}

/** Hard cap on total entries pulled by listAll() so a runaway loop can't wedge
 *  the browser. Five thousand is far above the launch P95; bump if real usage
 *  needs it. */
const LIST_ALL_HARD_CAP = 5000;
/** Page size for cursor pagination — server caps at 1000 but smaller pages
 *  give the UI a chance to render incrementally. */
const PAGE_SIZE = 500;

export const entryRepo = {
  /**
   * List entries for a brain (or across brains if brainId omitted — used by settings/data-export).
   * Returns [] on error rather than throwing, matching the existing UI behavior.
   */
  async list(options: ListOptions = {}): Promise<Entry[]> {
    return (await this.listPage(options)).entries;
  },

  /**
   * Single-page fetch that surfaces pagination metadata.
   * Returns { entries, nextCursor, hasMore } so the caller can decide whether
   * to fetch the next page. nextCursor is the created_at of the last entry on
   * the page; pass it back as `options.cursor` for the next call.
   */
  async listPage(
    options: ListOptions = {},
  ): Promise<{ entries: Entry[]; nextCursor: string | null; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (options.brainId) params.set("brain_id", options.brainId);
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    if (options.trash) params.set("trash", "true");

    const qs = params.toString();
    const url = qs ? `/api/entries?${qs}` : "/api/entries";

    try {
      const r = await authFetch(url);
      if (!r.ok) {
        if (options.onError) {
          const body = await r.text().catch(() => "");
          options.onError(r.status, body);
        }
        return { entries: [], nextCursor: null, hasMore: false };
      }
      return normalizePage(await r.json());
    } catch {
      return { entries: [], nextCursor: null, hasMore: false };
    }
  },

  /**
   * Walk every page until the server reports hasMore=false (or LIST_ALL_HARD_CAP
   * is reached). Designed to replace the unbounded `limit: 1000` fetch in
   * useDataLayer's phase 2 — paginates cleanly past the 1000 ceiling without
   * hammering the API in one giant query.
   *
   * Pages are fetched sequentially because each cursor depends on the previous
   * page. onPage fires after each page so the UI can render incrementally.
   */
  async listAll(
    options: Omit<ListOptions, "cursor" | "limit"> & {
      pageSize?: number;
      onPage?: (entries: Entry[]) => void;
    } = {},
  ): Promise<Entry[]> {
    const pageSize = options.pageSize ?? PAGE_SIZE;
    const collected: Entry[] = [];
    let cursor: string | null = null;
    while (collected.length < LIST_ALL_HARD_CAP) {
      const page = await this.listPage({
        brainId: options.brainId,
        trash: options.trash,
        limit: pageSize,
        cursor,
        onError: options.onError,
      });
      if (page.entries.length === 0) break;
      collected.push(...page.entries);
      options.onPage?.(page.entries);
      if (!page.hasMore || !page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return collected;
  },

  /** Partial-update an entry. Server merges metadata. Returns true if the patch succeeded. */
  async patch(
    id: string,
    changes: Partial<Entry> & { metadata?: Record<string, unknown> },
  ): Promise<boolean> {
    try {
      const r = await authFetch("/api/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...changes }),
      });
      return r.ok;
    } catch {
      return false;
    }
  },

  /** Restore a trashed entry. */
  async restore(id: string): Promise<boolean> {
    try {
      const r = await authFetch("/api/entries?action=restore", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      return r.ok;
    } catch {
      return false;
    }
  },

  /** Permanently delete a trashed entry (no undo). */
  async deletePermanent(id: string): Promise<boolean> {
    try {
      const r = await authFetch("/api/entries?permanent=true", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      return r.ok;
    } catch {
      return false;
    }
  },

  /** Permanently delete every trashed entry for the authed user. */
  async emptyTrash(): Promise<boolean> {
    try {
      const r = await authFetch("/api/entries?action=empty-trash", { method: "POST" });
      return r.ok;
    } catch {
      return false;
    }
  },
};
