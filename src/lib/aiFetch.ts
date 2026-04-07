import { getUserApiKey } from "./aiSettings";
import { authFetch } from "./authFetch";

export async function aiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const userKey = getUserApiKey();
  if (!userKey) return authFetch(url, options);
  return authFetch(url, {
    ...options,
    headers: { ...options.headers, "X-User-Api-Key": userKey },
  });
}
