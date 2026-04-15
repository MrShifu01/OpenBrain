import { useState } from "react";
import { clearAISettingsCache, persistKeyToDb, getGroqKey, getGeminiKey } from "../../lib/aiSettings";

export default function ProvidersTab(_props?: { activeBrain?: any }) {
  const hasStoredKeys = !!(getGroqKey() || getGeminiKey());
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);

  async function clearAllKeys() {
    setClearing(true);
    setClearMsg(null);
    const { error } = await persistKeyToDb({ groq_key: null, gemini_key: null });
    clearAISettingsCache();
    setClearMsg(error ? `Error: ${error}` : "All frontend API keys removed.");
    setClearing(false);
  }

  return (
    <div className="space-y-4 px-1">
      <div
        className="space-y-3 rounded-xl p-4"
        style={{
          background: "var(--color-surface-container)",
          border: "1px solid var(--color-outline-variant)",
        }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-on-surface)" }}>
            Frontend API keys
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
            {hasStoredKeys
              ? "Keys stored from previous configuration — no longer needed."
              : "Coming soon!"}
          </p>
        </div>
        {hasStoredKeys && (
          <button
            onClick={clearAllKeys}
            disabled={clearing}
            className="w-full rounded-xl py-2 text-xs font-semibold transition-all disabled:opacity-50"
            style={{
              background: "var(--color-error-container)",
              color: "var(--color-on-error-container)",
            }}
          >
            {clearing ? "Clearing…" : "Remove all stored keys"}
          </button>
        )}
        {clearMsg && (
          <p
            className="text-center text-xs"
            style={{
              color: clearMsg.startsWith("Error") ? "var(--color-error)" : "var(--color-primary)",
            }}
          >
            {clearMsg}
          </p>
        )}
      </div>
    </div>
  );
}
