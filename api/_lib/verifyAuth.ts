import type { ApiRequest } from "./types";
import type { AuthedUser } from "./withAuth.js";

const SB_URL = process.env.SUPABASE_URL;
const VERIFY_TIMEOUT_MS = 5_000;

// Hard-cap the JWT verification round-trip. Supabase auth occasionally
// returns 504/522 under load (Cloudflare front-of-queue timeout); without
// a timeout here the Vercel function holds the connection open until its
// 300s budget runs out, making every page that fetches authed data look
// like it's "loading forever." 5s is generous for a healthy auth call
// (typical: <100ms) and short enough that the client can show an error
// banner and let the user retry.
export async function verifyAuth(req: ApiRequest): Promise<AuthedUser | null> {
  const token = (req.headers.authorization as string | undefined)?.split(" ")[1];
  if (!token) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${token}`,
      },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthedUser;
  } catch {
    // Network error, abort, or non-2xx — treat as unauthenticated. Caller
    // already maps null → 401 so the client gets a fast failure instead of
    // a hung connection.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
