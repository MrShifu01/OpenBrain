// Provider-agnostic webhook event de-dup. Both LemonSqueezy and RevenueCat
// retry on non-2xx and transient network failures, so a retry that lands
// while the first call is still in-flight would re-run side-effects (the
// RC bridge call, the DB tier write). SET NX with 24h TTL is cheap insurance.
//
// Falls back to "always allow" if Upstash isn't configured — the handler
// then runs as before, no worse than today.

const TTL_SECONDS = 24 * 60 * 60;

export async function markWebhookEventSeen(
  namespace: "lemon" | "revenuecat",
  eventId: string,
): Promise<{ firstTime: boolean }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { firstTime: true };

  const key = `${namespace}:event:${eventId}`;
  try {
    const res = await fetch(
      `${url}/set/${encodeURIComponent(key)}/1?nx=true&ex=${TTL_SECONDS}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) {
      console.warn(
        `[webhookIdempotency:${namespace}] Upstash HTTP ${res.status} — proceeding without dedup`,
      );
      return { firstTime: true };
    }
    const data = (await res.json()) as { result?: string | null };
    // Upstash returns {"result": "OK"} on first SET, {"result": null} when NX rejects.
    return { firstTime: data?.result === "OK" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[webhookIdempotency:${namespace}] Upstash error — proceeding without dedup: ${msg}`,
    );
    return { firstTime: true };
  }
}
