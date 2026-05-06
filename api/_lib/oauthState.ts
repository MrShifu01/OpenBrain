/**
 * HMAC-signed, expiring `state` parameter for OAuth flows.
 *
 * Replaces the previous `Buffer.from(JSON.stringify(...)).toString("base64url")`
 * pattern, which was tamperable: anyone could rewrite the state's `userId` and
 * link a different account on callback. The new signed state includes:
 *   - exp: expiry timestamp (default 10 min)
 *   - nonce: random 16-byte token (replay defence inside the window)
 *   - <caller-supplied fields>
 *
 * Server-only — keep the secret on Vercel env (`OAUTH_STATE_SECRET`). Falls back
 * to `SUPABASE_SERVICE_ROLE_KEY` for environments where the dedicated secret
 * hasn't been provisioned yet, since both have the same trust boundary
 * (server-only). Once `OAUTH_STATE_SECRET` is set everywhere the fallback can
 * be removed.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const DEFAULT_TTL_MS = 10 * 60_000;

function getSecret(): string | null {
  const explicit = process.env.OAUTH_STATE_SECRET;
  if (explicit && explicit.length >= 16) return explicit;
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (fallback && fallback.length >= 16) return fallback;
  return null;
}

function b64urlEncode(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad), "base64");
}

export interface SignedStatePayload {
  userId: string;
  /** Optional caller-specific data (e.g. Gmail preferences). */
  data?: Record<string, unknown>;
}

/**
 * Sign an OAuth state token. Throws if no signing secret is configured —
 * callers must surface the error rather than fall back to plaintext.
 */
export function signOAuthState(payload: SignedStatePayload, ttlMs = DEFAULT_TTL_MS): string {
  const secret = getSecret();
  if (!secret) throw new Error("OAuth state signing secret is not configured");
  if (!payload.userId) throw new Error("signOAuthState requires userId");
  const body = {
    userId: payload.userId,
    data: payload.data ?? {},
    exp: Date.now() + ttlMs,
    nonce: randomBytes(16).toString("hex"),
  };
  const bodyJson = JSON.stringify(body);
  const sig = createHmac("sha256", secret).update(bodyJson).digest();
  return `${b64urlEncode(bodyJson)}.${b64urlEncode(sig)}`;
}

export type VerifyResult =
  | { ok: true; payload: SignedStatePayload }
  | { ok: false; reason: "missing_secret" | "malformed" | "bad_signature" | "expired" };

/**
 * Verify a state token. Constant-time comparison on the signature; rejects
 * expired states even if the signature is valid.
 */
export function verifyOAuthState(state: string): VerifyResult {
  const secret = getSecret();
  if (!secret) return { ok: false, reason: "missing_secret" };
  const dot = state.indexOf(".");
  if (dot < 1 || dot >= state.length - 1) return { ok: false, reason: "malformed" };
  const bodyB64 = state.slice(0, dot);
  const sigB64 = state.slice(dot + 1);
  let bodyJson: string;
  let provided: Buffer;
  try {
    bodyJson = b64urlDecode(bodyB64).toString("utf8");
    provided = b64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const expected = createHmac("sha256", secret).update(bodyJson).digest();
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "bad_signature" };
  }
  let body: { userId?: string; data?: Record<string, unknown>; exp?: number };
  try {
    body = JSON.parse(bodyJson);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof body.exp !== "number" || Date.now() > body.exp) {
    return { ok: false, reason: "expired" };
  }
  if (typeof body.userId !== "string" || !body.userId) {
    return { ok: false, reason: "malformed" };
  }
  return { ok: true, payload: { userId: body.userId, data: body.data ?? {} } };
}
