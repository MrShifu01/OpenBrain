// Stripe webhook idempotency — Stripe retries on non-2xx and on transient
// network failures. Without an event.id dedup, a retry that lands while the
// first call is still in-flight would re-run the side-effects. The current
// handlers all PATCH to a fixed state so a duplicate is a no-op, but any
// future event that increments or charges would double-fire. Cheap insurance.
//
// Implementation: SET NX with 24h TTL on a per-event key. First caller wins.
// Falls back to "always allow" if Upstash isn't configured — the handler then
// runs as before, no worse than today.

const TTL_SECONDS = 24 * 60 * 60;

export async function markStripeEventSeen(eventId: string): Promise<{ firstTime: boolean }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { firstTime: true };

  const key = `stripe:event:${eventId}`;
  try {
    const res = await fetch(`${url}/set/${encodeURIComponent(key)}/1?nx=true&ex=${TTL_SECONDS}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.warn(`[stripeIdempotency] Upstash HTTP ${res.status} — proceeding without dedup`);
      return { firstTime: true };
    }
    const data: any = await res.json();
    // Upstash returns {"result": "OK"} on first SET, {"result": null} when NX rejects
    return { firstTime: data?.result === "OK" };
  } catch (err: any) {
    console.warn(`[stripeIdempotency] Upstash error — proceeding without dedup: ${err.message}`);
    return { firstTime: true };
  }
}
