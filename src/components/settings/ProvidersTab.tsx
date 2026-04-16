import { useState } from "react";
import { clearAISettingsCache, persistKeyToDb, getGroqKey, getGeminiKey } from "../../lib/aiSettings";

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    className={`ml-3 h-4 w-4 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
    style={{ color: "var(--color-on-surface-variant)" }}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

export default function ProvidersTab(_props?: { activeBrain?: any }) {
  const hasStoredKeys = !!(getGroqKey() || getGeminiKey());
  const [open, setOpen] = useState(false);
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
    <div className="px-1">
      <div
        className="rounded-2xl border"
        style={{
          background: "var(--color-surface-container)",
          borderColor: "var(--color-outline-variant)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left"
        >
          <div className="min-w-0">
            <p className="text-on-surface text-sm font-semibold">Frontend API keys</p>
            {!open && (
              <p className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
                {hasStoredKeys ? "Stored keys from previous configuration" : "Coming soon!"}
              </p>
            )}
          </div>
          <Chevron open={open} />
        </button>

        <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr" }}>
          <div style={{ overflow: "hidden" }}>
            <div className="space-y-3 px-4 pb-4">
              <p className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
                {hasStoredKeys
                  ? "Keys stored from previous configuration — no longer needed."
                  : "Coming soon!"}
              </p>
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
        </div>
      </div>
    </div>
  );
}
