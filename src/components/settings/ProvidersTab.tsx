import { useState } from "react";
import { authFetch } from "../../lib/authFetch";

type Status = "idle" | "loading" | "ok" | "fail";

interface HealthResult {
  db: boolean;
  gemini: boolean;
  geminiModel?: string;
  groq: boolean;
}

const dot = (s: Status) => {
  if (s === "ok") return <span style={{ color: "var(--color-success, #4ade80)" }}>●</span>;
  if (s === "fail") return <span style={{ color: "var(--color-error)" }}>●</span>;
  if (s === "loading") return <span style={{ color: "var(--color-on-surface-variant)", opacity: 0.5 }}>◌</span>;
  return <span style={{ color: "var(--color-outline-variant)" }}>○</span>;
};

const label = (s: Status) => {
  if (s === "ok") return "Connected";
  if (s === "fail") return "Failed";
  if (s === "loading") return "Testing…";
  return "Not tested";
};

export default function ProvidersTab() {
  const [gemini, setGemini] = useState<Status>("idle");
  const [geminiModel, setGeminiModel] = useState("");
  const [groq, setGroq] = useState<Status>("idle");
  const [db, setDb] = useState<Status>("idle");
  const [testing, setTesting] = useState(false);

  async function runTests() {
    setTesting(true);
    setGemini("loading");
    setGroq("loading");
    setDb("loading");
    try {
      const res = await authFetch("/api/health");
      if (res.ok) {
        const data: HealthResult = await res.json();
        setGemini(data.gemini ? "ok" : "fail");
        setGeminiModel(data.geminiModel || "");
        setGroq(data.groq ? "ok" : "fail");
        setDb(data.db ? "ok" : "fail");
      } else {
        setGemini("fail"); setGroq("fail"); setDb("fail");
      }
    } catch {
      setGemini("fail"); setGroq("fail"); setDb("fail");
    }
    setTesting(false);
  }

  const cards: { title: string; desc: string; status: Status }[] = [
    { title: "Gemini AI", desc: geminiModel || "gemma-4-31b-it · text-embedding-004", status: gemini },
    { title: "Groq Voice", desc: "whisper-large-v3-turbo", status: groq },
    { title: "Database",   desc: "Supabase", status: db },
  ];

  return (
    <div className="space-y-4 px-1">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-on-surface)" }}>
          System Status
        </h3>
        <button
          onClick={runTests}
          disabled={testing}
          className="rounded-xl px-4 py-2 text-xs font-semibold transition-all disabled:opacity-50"
          style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}
        >
          {testing ? "Testing…" : "Test all"}
        </button>
      </div>

      <div className="space-y-2">
        {cards.map(({ title, desc, status }) => (
          <div
            key={title}
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{
              background: "var(--color-surface-container)",
              border: "1px solid var(--color-outline-variant)",
            }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--color-on-surface)" }}>{title}</p>
              <p className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>{desc}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--color-on-surface-variant)" }}>
              {dot(status)}
              <span>{label(status)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
