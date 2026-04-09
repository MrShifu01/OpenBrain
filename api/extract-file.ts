import type { ApiRequest, ApiResponse } from "./_lib/types";
import { verifyAuth } from "./_lib/verifyAuth.js";
import { rateLimit } from "./_lib/rateLimit.js";
import { applySecurityHeaders } from "./_lib/securityHeaders.js";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB base64 string limit

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applySecurityHeaders(res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await rateLimit(req, 20))) return res.status(429).json({ error: "Too many requests" });

  const user: any = await verifyAuth(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const apiKey = ((req.headers["x-user-api-key"] as string) || "").trim();
  if (!apiKey) return res.status(400).json({ error: "x-user-api-key required" });

  const provider = ((req.headers["x-provider"] as string) || "openrouter").trim();
  const model = ((req.headers["x-model"] as string) || "").trim();

  const { filename, fileData, mimeType } = req.body as {
    filename?: string;
    fileData?: string;
    mimeType?: string;
  };

  if (!fileData || typeof fileData !== "string") return res.status(400).json({ error: "fileData (base64) required" });
  if (!mimeType) return res.status(400).json({ error: "mimeType required" });
  if (fileData.length > MAX_FILE_BYTES) return res.status(413).json({ error: "File too large (max ~15 MB)" });

  const prompt = "Extract all text and information from this file. Preserve structure. Output only the extracted content, no commentary.";

  try {
    if (provider === "anthropic") {
      const contentBlock = mimeType.startsWith("image/")
        ? { type: "image", source: { type: "base64", media_type: mimeType, data: fileData } }
        : { type: "document", source: { type: "base64", media_type: mimeType, data: fileData } };

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: model || "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }],
        }),
      });
      const data: any = await response.json();
      const text = data.content?.[0]?.text || "";
      return res.status(response.ok ? 200 : response.status).json(response.ok ? { text } : data);
    }

    // OpenRouter / OpenAI-compatible
    const fileBlock = mimeType.startsWith("image/")
      ? { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileData}` } }
      : { type: "file", file: { filename: filename || "file", file_data: `data:${mimeType};base64,${fileData}` } };

    const orModel = model || "google/gemma-3-27b-it";
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://everionmind.com",
        "X-Title": "Everion",
      },
      body: JSON.stringify({
        model: orModel,
        max_tokens: 4096,
        messages: [{ role: "user", content: [fileBlock, { type: "text", text: prompt }] }],
      }),
    });
    const data: any = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    return res.status(response.ok ? 200 : response.status).json(response.ok ? { text } : data);
  } catch (e: any) {
    console.error("[extract-file]", e);
    return res.status(502).json({ error: e.message || "Extraction failed" });
  }
}
