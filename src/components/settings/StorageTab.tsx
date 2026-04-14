import { useState, useEffect } from "react";
import TrashView from "../../views/TrashView";
import type { Brain } from "../../types";
import { KEYS } from "../../lib/storageKeys";
import { authFetch } from "../../lib/authFetch";
import { buildBrainConnections } from "../../lib/brainConnections";

function fmt(n: number) {
  return n.toLocaleString();
}
function fmtBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
function fmtUsd(usd: number) {
  if (usd === 0) return null;
  return `~$${usd < 0.0001 ? usd.toExponential(2) : usd.toFixed(4)}`;
}

const PROVIDER_LABELS: Record<string, string> = {
  groq: "Groq",
  google: "Google",
};

function label(provider: string) {
  return PROVIDER_LABELS[provider] ?? provider;
}

function Row({ name, value, sub }: { name: string; value: string; sub?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span style={{ color: "var(--color-on-surface-variant)" }}>{name}</span>
      <span className="text-on-surface text-right">
        {value}
        {sub && <span style={{ color: "var(--color-outline)", marginLeft: 4 }}>{sub}</span>}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold" style={{ color: "var(--color-outline)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function UsagePanel() {
  const [bd, setBd] = useState<Awaited<
    ReturnType<typeof import("../../lib/usageTracker").getMonthlyBreakdown>
  > | null>(null);
  const [entryCount, setEntryCount] = useState<number>(0);

  useEffect(() => {
    import("../../lib/usageTracker").then((m) => setBd(m.getMonthlyBreakdown()));

    // Estimate Supabase data from cached entries
    try {
      const cached = localStorage.getItem(KEYS.ENTRIES_CACHE);
      if (cached) {
        const arr = JSON.parse(cached);
        if (Array.isArray(arr)) setEntryCount(arr.length);
      }
    } catch (err) {
      console.error("[StorageTab]", err);
    }
  }, []);

  // Supabase size estimate: ~3 KB embedding + ~2 KB content per entry
  const supabaseEstimateBytes = entryCount * 5 * 1024;

  const providers = bd ? Object.keys(bd.llm.byProvider) : [];
  const txProviders = bd ? Object.keys(bd.transcription.byProvider) : [];
  const embProviders = bd ? Object.keys(bd.embedding.byProvider) : [];

  return (
    <div
      className="space-y-4 rounded-2xl border p-4"
      style={{
        background: "var(--color-surface-container)",
        borderColor: "var(--color-outline-variant)",
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-on-surface text-sm font-semibold">Usage this month</p>
        <button
          onClick={() => {
            import("../../lib/usageTracker").then((m) => {
              m.clearUsage();
              setBd(m.getMonthlyBreakdown());
            });
          }}
          className="rounded-lg px-2 text-xs"
          style={{
            color: "var(--color-on-surface-variant)",
            border: "1px solid var(--color-outline-variant)",
            minHeight: 32,
          }}
        >
          Clear
        </button>
      </div>

      {bd && (
        <div className="space-y-4">
          {/* LLM */}
          <Section title="LLM tokens">
            <Row name="Input" value={fmt(bd.llm.inputTokens)} />
            <Row name="Output" value={fmt(bd.llm.outputTokens)} />
            {providers.map((p) => {
              const s = bd.llm.byProvider[p];
              const cost = fmtUsd(s.estimatedUsd);
              return (
                <Row
                  key={p}
                  name={`  ${label(p)}`}
                  value={`${fmt(s.inputTokens)} in / ${fmt(s.outputTokens)} out`}
                  sub={cost ?? undefined}
                />
              );
            })}
            {fmtUsd(bd.llm.estimatedUsd) && (
              <Row name="Est. cost" value={fmtUsd(bd.llm.estimatedUsd)!} sub="(estimate only)" />
            )}
          </Section>

          {/* Transcription */}
          {(bd.transcription.calls > 0 || txProviders.length > 0) && (
            <Section title="Voice transcription">
              <Row name="Sessions" value={fmt(bd.transcription.calls)} />
              <Row name="Audio processed" value={fmtBytes(bd.transcription.audioBytes)} />
              {txProviders.map((p) => {
                const s = bd.transcription.byProvider[p];
                const cost = fmtUsd(s.estimatedUsd);
                return (
                  <Row
                    key={p}
                    name={`  ${label(p)}`}
                    value={`${fmt(s.calls)} sessions, ${fmtBytes(s.audioBytes)}`}
                    sub={cost}
                  />
                );
              })}
              {fmtUsd(bd.transcription.estimatedUsd) && (
                <Row
                  name="Est. cost"
                  value={fmtUsd(bd.transcription.estimatedUsd)!}
                  sub="(estimate only)"
                />
              )}
            </Section>
          )}

          {/* Embeddings */}
          {(bd.embedding.calls > 0 || embProviders.length > 0) && (
            <Section title="Embeddings">
              <Row name="Total calls" value={fmt(bd.embedding.calls)} />
              {embProviders.map((p) => (
                <Row
                  key={p}
                  name={`  ${label(p)}`}
                  value={`${fmt(bd.embedding.byProvider[p].calls)} calls`}
                  sub="(free tier / low cost)"
                />
              ))}
            </Section>
          )}

          {/* Supabase */}
          <Section title="Supabase data (active brain)">
            <Row name="Entries cached" value={fmt(entryCount)} />
            <Row name="Est. DB size" value={fmtBytes(supabaseEstimateBytes)} sub="(~5 KB/entry)" />
          </Section>
        </div>
      )}
    </div>
  );
}

interface Props {
  activeBrain?: Brain;
}

async function reEmbedAll(brainId: string, onStatus: (s: string) => void) {
  onStatus("Re-embedding all entries…");
  try {
    const res = await authFetch("/api/capture?action=embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch: true, brain_id: brainId, force: true }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unknown error");
    onStatus(`Done — ${data.processed ?? "?"} embedded, ${data.failed ?? 0} failed.`);
  } catch (e: any) {
    onStatus(`Error: ${e.message}`);
  }
}


export default function StorageTab({ activeBrain }: Props) {
  const [showTrash, setShowTrash] = useState(false);
  const [embedStatus, setEmbedStatus] = useState("");
  const [embedBusy, setEmbedBusy] = useState(false);
  const [graphStatus, setGraphStatus] = useState("");
  const [graphBusy, setGraphBusy] = useState(false);

  return (
    <>
      <UsagePanel />

      <div
        className="space-y-3 rounded-2xl border p-4"
        style={{
          background: "var(--color-surface-container-high)",
          borderColor: "var(--color-outline-variant)",
        }}
      >
        <p className="text-on-surface text-sm font-semibold">Data & Storage</p>
        <button
          onClick={() => setShowTrash((s) => !s)}
          className="rounded-xl px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
          style={{
            background:
              "color-mix(in oklch, var(--color-error) 10%, var(--color-surface-container))",
            color: "var(--color-error)",
            minHeight: 44,
          }}
        >
          {showTrash ? "Hide Trash" : "View Trash"}
        </button>
        {showTrash && (
          <div className="mt-2">
            <TrashView brainId={activeBrain?.id} />
          </div>
        )}
      </div>

      <div
        className="space-y-3 rounded-2xl border p-4"
        style={{
          background: "var(--color-surface-container-high)",
          borderColor: "var(--color-outline-variant)",
        }}
      >
        <p className="text-on-surface text-sm font-semibold">Help & Onboarding</p>
        <button
          onClick={() => {
            localStorage.removeItem("openbrain_onboarded");
            window.dispatchEvent(new CustomEvent("openbrain:restart-onboarding"));
          }}
          className="rounded-xl px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
          style={{
            background: "var(--color-primary-container)",
            color: "var(--color-primary)",
            minHeight: 44,
          }}
        >
          Restart Onboarding
        </button>
      </div>

      <div
        className="space-y-3 rounded-2xl border p-4"
        style={{
          background: "var(--color-surface-container-high)",
          borderColor: "var(--color-outline-variant)",
        }}
      >
        <p className="text-on-surface text-sm font-semibold">Advanced Brain</p>
        <p className="text-on-surface-variant text-xs">
          Re-embed all entries with pgvector for semantic search. Build brain connections
          to surface concepts and relationships across your knowledge.
        </p>

        <button
          disabled={embedBusy || !activeBrain?.id}
          onClick={async () => {
            if (!activeBrain?.id) return;
            setEmbedBusy(true);
            await reEmbedAll(activeBrain.id, setEmbedStatus);
            setEmbedBusy(false);
          }}
          className="rounded-xl px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{
            background: "var(--color-secondary-container)",
            color: "var(--color-on-secondary-container)",
            minHeight: 44,
          }}
        >
          {embedBusy ? "Embedding…" : "Re-embed All Entries"}
        </button>
        {embedStatus && (
          <p className="text-on-surface-variant text-xs">{embedStatus}</p>
        )}

        <button
          disabled={graphBusy || !activeBrain?.id}
          onClick={async () => {
            if (!activeBrain?.id) return;
            setGraphBusy(true);
            await buildBrainConnections(activeBrain.id, setGraphStatus);
            setGraphBusy(false);
          }}
          className="rounded-xl px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{
            background: "var(--color-primary-container)",
            color: "var(--color-primary)",
            minHeight: 44,
          }}
        >
          {graphBusy ? "Building…" : "Build Brain Connections"}
        </button>
        {graphStatus && (
          <p className="text-on-surface-variant text-xs">{graphStatus}</p>
        )}
      </div>
    </>
  );
}
