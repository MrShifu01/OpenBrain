/**
 * Boundary types for AI responses.
 *
 * Providers (Anthropic, OpenAI, OpenRouter, internal /api/chat) return
 * different shapes. These types describe the *union* of fields we read so
 * call-sites can stop using `any`. Parsing / shape-normalisation is the
 * responsibility of `extractTokenUsage` and `extractNudgeText`.
 */

/** A single content block (Anthropic-style). Other providers may be absent. */
export interface AIContentBlock {
  type?: string;
  text?: string;
}

/** Token accounting (shape varies by provider — we only read from here). */
export interface AIUsageBlock {
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
}

/**
 * Union shape covering Anthropic, OpenAI/OpenRouter, and our internal
 * `/api/chat` responses. All fields are optional — the reader must handle
 * missing values.
 */
export interface AIResponseBody {
  /** Anthropic-style content blocks. */
  content?: AIContentBlock[];
  /** OpenAI-style text (`choices[].message.content`). */
  choices?: Array<{ message?: { content?: string } }>;
  /** Nudge / freeform text some internal endpoints return. */
  text?: string;
  /** Token usage across all providers. */
  usage?: AIUsageBlock;
  /** Error bag. */
  error?: string | { message?: string };
}

/** Persisted vault metadata returned by `GET /api/vault`. */
export interface VaultData {
  exists?: boolean;
  salt: string;
  verify_token: string;
  recovery_blob: string;
}

/** A secret entry after client-side decryption. */
export interface DecryptedSecret {
  title: string;
  content?: string;
  tags?: string[];
}
