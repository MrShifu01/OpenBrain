import { useState } from "react";
import {
  clearAISettingsCache,
  persistKeyToDb,
  getGroqKey,
  getGeminiKey,
} from "../../lib/aiSettings";
import SettingsRow, { SettingsButton } from "./SettingsRow";

function StatusDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: on ? "var(--moss)" : "var(--ink-ghost)",
        flexShrink: 0,
      }}
    />
  );
}

export default function ProvidersTab(_props?: { activeBrain?: any }) {
  const groqKey = getGroqKey();
  const geminiKey = getGeminiKey();
  const hasStoredKeys = !!(groqKey || geminiKey);
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);

  async function clearAllKeys() {
    setClearing(true);
    setClearMsg(null);
    const { error } = await persistKeyToDb({ groq_key: null, gemini_key: null });
    clearAISettingsCache();
    setClearMsg(error ? `error: ${error}` : "all stored keys removed.");
    setClearing(false);
  }

  const maskKey = (k?: string | null) =>
    k && k.length > 6 ? `${k.slice(0, 6)}…${k.slice(-4)}` : k ?? "";

  return (
    <div>
      {/* Claude — BYOK, not provided by Everion */}
      <SettingsRow
        label="Claude"
        hint="bring your own Anthropic key to use Claude models."
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusDot on={false} />
          <SettingsButton disabled>Add key</SettingsButton>
        </div>
      </SettingsRow>

      {/* OpenAI — BYOK, not provided by Everion */}
      <SettingsRow
        label="OpenAI"
        hint="bring your own OpenAI key to use GPT models."
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusDot on={false} />
          <SettingsButton disabled>Add key</SettingsButton>
        </div>
      </SettingsRow>

      {/* Groq — BYOK, functional */}
      <SettingsRow
        label="Groq"
        hint={groqKey ? maskKey(groqKey) : "bring your own Groq key for fast voice transcription."}
        last={!hasStoredKeys && !geminiKey}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusDot on={!!groqKey} />
          <SettingsButton>{groqKey ? "Rotate" : "Add key"}</SettingsButton>
        </div>
      </SettingsRow>

      {/* Google Gemini — BYOK override key */}
      {geminiKey && (
        <SettingsRow
          label="Google Gemini"
          hint={maskKey(geminiKey)}
          last={!hasStoredKeys}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatusDot on />
            <SettingsButton>Rotate</SettingsButton>
          </div>
        </SettingsRow>
      )}

      {hasStoredKeys && (
        <SettingsRow
          label="Stored keys"
          hint="legacy keys from a previous configuration. safe to remove."
          last
        >
          <SettingsButton onClick={clearAllKeys} danger disabled={clearing}>
            {clearing ? "Clearing…" : "Remove all"}
          </SettingsButton>
        </SettingsRow>
      )}

      {clearMsg && (
        <p
          className="f-sans"
          style={{
            fontSize: 12,
            color: clearMsg.startsWith("error") ? "var(--blood)" : "var(--moss)",
            marginTop: 8,
          }}
        >
          {clearMsg}
        </p>
      )}
    </div>
  );
}
