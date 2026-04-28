/**
 * Shared embedding generation logic.
 * Uses Google gemini-embedding-001 at 768 dims.
 */

/**
 * Generate an embedding vector for a single text string.
 */
export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const truncated = String(text).slice(0, 8000);
  return generateGoogleEmbedding(truncated, apiKey);
}

/**
 * Generate embeddings for multiple texts in one API call.
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  apiKey: string,
): Promise<number[][]> {
  const truncated = texts.map((t) => String(t).slice(0, 8000));
  return generateGoogleEmbeddingBatch(truncated, apiKey);
}

/**
 * Build the text to embed for an entry (title + content + tags).
 */
export function buildEntryText(entry: {
  title?: string;
  content?: string;
  tags?: string[];
}): string {
  return [entry.title, entry.content, (entry.tags || []).join(" ")].filter(Boolean).join(" ");
}

const GOOGLE_EMBED_MODEL = "gemini-embedding-001";

// Retry transient failures (rate limit + service unavailable) with exponential
// backoff. Without this, a single 429 from Gemini's free tier permanently
// marks an entry as embedding_status='failed' in enrich.ts, leaving it
// unsearchable until the user manually retries.
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const delays = [500, 1500, 3500];
  for (let i = 0; i <= delays.length; i++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    const transient = res.status === 429 || res.status === 503;
    if (!transient || i === delays.length) return res;
    await new Promise((r) => setTimeout(r, delays[i]));
  }
  // Unreachable — for-loop returns or throws. Satisfies TS control-flow.
  throw new Error("retry exhausted");
}

async function generateGoogleEmbedding(text: string, apiKey: string): Promise<number[]> {
  const res = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_EMBED_MODEL}:embedContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${GOOGLE_EMBED_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text().catch(() => String(res.status));
    throw new Error(`Google embedding error ${res.status}: ${err}`);
  }
  const data: any = await res.json();
  const values: number[] = data.embedding.values;
  if (values.length !== 768) {
    throw new Error(`${GOOGLE_EMBED_MODEL} returned ${values.length} dims, expected 768`);
  }
  return values;
}

async function generateGoogleEmbeddingBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const requests = texts.map((text) => ({
    model: `models/${GOOGLE_EMBED_MODEL}`,
    content: { parts: [{ text }] },
    outputDimensionality: 768,
  }));
  const res = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_EMBED_MODEL}:batchEmbedContents?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    },
  );
  if (!res.ok) {
    const err = await res.text().catch(() => String(res.status));
    throw new Error(`Google batch embedding error ${res.status}: ${err}`);
  }
  const data: any = await res.json();
  return (data.embeddings || []).map((e: any) => e.values as number[]);
}
