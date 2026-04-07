/**
 * S4-1: Single persistent Supabase REST client shared across all API routes.
 * Avoids repeated header object construction on every request.
 */
const SB_URL = process.env.SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Pre-built header objects — created once at module init */
export const sbHeaders = {
  json: {
    "Content-Type": "application/json",
    "apikey": SB_KEY,
    "Authorization": `Bearer ${SB_KEY}`,
  } as Record<string, string>,
  plain: {
    "apikey": SB_KEY,
    "Authorization": `Bearer ${SB_KEY}`,
  } as Record<string, string>,
};

/** Build a Supabase REST URL for a given table and query string */
export function sbUrl(table: string, query = ""): string {
  return `${SB_URL}/rest/v1/${table}${query ? `?${query}` : ""}`;
}

/** Convenience: POST JSON to a Supabase table */
export async function sbPost(table: string, body: unknown, query = ""): Promise<Response> {
  return fetch(sbUrl(table, query), {
    method: "POST",
    headers: { ...sbHeaders.json, "Prefer": "return=representation" },
    body: JSON.stringify(body),
  });
}

/** Convenience: PATCH JSON in a Supabase table */
export async function sbPatch(table: string, body: unknown, query: string): Promise<Response> {
  return fetch(sbUrl(table, query), {
    method: "PATCH",
    headers: { ...sbHeaders.json, "Prefer": "return=representation" },
    body: JSON.stringify(body),
  });
}
