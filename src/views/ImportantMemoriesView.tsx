import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/authFetch";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import {
  IMPORTANT_MEMORY_TYPES,
  IMPORTANT_MEMORY_TYPE_LABEL,
  generateMemoryKey,
  type ImportantMemory,
  type ImportantMemoryType,
} from "../lib/importantMemory";
import { Button } from "../components/ui/button";

interface ImportantMemoriesViewProps {
  brainId: string | undefined;
}

type Filter = "all" | ImportantMemoryType | "retired";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "fact", label: "Facts" },
  { id: "preference", label: "Preferences" },
  { id: "decision", label: "Decisions" },
  { id: "obligation", label: "Obligations" },
  { id: "retired", label: "Retired" },
];

export default function ImportantMemoriesView({ brainId }: ImportantMemoriesViewProps) {
  useDocumentMeta({
    title: "Important Memories — Everion",
    description:
      "User-curated durable facts Everion always trusts. Promote any entry to a memory and Everion will recall it reliably.",
  });
  const [memories, setMemories] = useState<ImportantMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Load active + retired together so filter chip switches don't refetch.
  // Memory volume is small (user-curated, dozens not thousands).
  useEffect(() => {
    if (!brainId) {
      setMemories([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    authFetch(`/api/important-memories?brain_id=${encodeURIComponent(brainId)}&status=all`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as ImportantMemory[];
      })
      .then((rows) => {
        if (cancelled) return;
        setMemories(rows);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brainId]);

  const visible = useMemo(() => {
    if (filter === "all") return memories.filter((m) => m.status === "active");
    if (filter === "retired") return memories.filter((m) => m.status === "retired");
    return memories.filter((m) => m.status === "active" && m.memory_type === filter);
  }, [memories, filter]);

  const counts = useMemo(() => {
    const active = memories.filter((m) => m.status === "active");
    return {
      all: active.length,
      fact: active.filter((m) => m.memory_type === "fact").length,
      preference: active.filter((m) => m.memory_type === "preference").length,
      decision: active.filter((m) => m.memory_type === "decision").length,
      obligation: active.filter((m) => m.memory_type === "obligation").length,
      retired: memories.filter((m) => m.status === "retired").length,
    } satisfies Record<Filter, number>;
  }, [memories]);

  async function createMemory(input: {
    title: string;
    summary: string;
    memory_type: ImportantMemoryType;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!brainId) return { ok: false, error: "No active brain" };
    let memory_key: string;
    try {
      memory_key = generateMemoryKey(input.memory_type, input.title);
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Invalid title" };
    }
    const res = await authFetch("/api/important-memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brain_id: brainId, memory_key, ...input }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { ok: false, error: detail.error ?? "Failed to create" };
    }
    const row: ImportantMemory = await res.json();
    setMemories((prev) => [row, ...prev]);
    return { ok: true };
  }

  async function updateMemory(
    id: string,
    patch: { title?: string; summary?: string; memory_type?: ImportantMemoryType },
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const body: Record<string, unknown> = { ...patch };
    if (patch.title && patch.memory_type) {
      try {
        body.memory_key = generateMemoryKey(patch.memory_type, patch.title);
      } catch {
        // server will reject — fine
      }
    }
    const res = await authFetch(`/api/important-memories?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { ok: false, error: detail.error ?? "Failed to update" };
    }
    const row: ImportantMemory = await res.json();
    setMemories((prev) => prev.map((m) => (m.id === id ? row : m)));
    return { ok: true };
  }

  async function setStatus(id: string, action: "retire" | "restore") {
    const res = await authFetch(
      `/api/important-memories?id=${encodeURIComponent(id)}&action=${action}`,
      { method: "PATCH" },
    );
    if (!res.ok) return;
    const row: ImportantMemory = await res.json();
    setMemories((prev) => prev.map((m) => (m.id === id ? row : m)));
  }

  return (
    <div
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "24px 20px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1
          className="f-serif"
          style={{
            fontSize: 32,
            lineHeight: 1.1,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          Important Memories
        </h1>
        <p
          className="f-serif"
          style={{
            margin: 0,
            color: "var(--ink-soft)",
            fontStyle: "italic",
            fontSize: 15,
            lineHeight: 1.5,
          }}
        >
          The facts you want Everion to always trust. Promote an entry from the detail view, or add
          one here.
        </p>
      </header>

      {/* Filter chips */}
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
        role="tablist"
        aria-label="Filter important memories"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count = counts[f.id];
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className="press"
              style={{
                height: 28,
                padding: "0 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                border: "1px solid",
                borderColor: active ? "var(--ember)" : "var(--line-soft)",
                background: active ? "var(--ember-wash)" : "var(--surface)",
                color: active ? "var(--ember)" : "var(--ink-soft)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {f.label}
              <span
                style={{
                  fontSize: 11,
                  opacity: 0.7,
                  fontWeight: 500,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        {!composing && (
          <Button size="sm" onClick={() => setComposing(true)} disabled={!brainId}>
            + New memory
          </Button>
        )}
      </div>

      {composing && (
        <MemoryEditor
          mode="create"
          onCancel={() => setComposing(false)}
          onSave={async (input) => {
            const r = await createMemory(input);
            if (r.ok) setComposing(false);
            return r;
          }}
        />
      )}

      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--danger)",
            background: "var(--danger-wash, var(--surface))",
            color: "var(--danger)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {loading && <p style={{ color: "var(--ink-soft)" }}>Loading…</p>}

      {!loading && !visible.length && (
        <div
          style={{
            padding: "32px 20px",
            border: "1px dashed var(--line-soft)",
            borderRadius: 16,
            textAlign: "center",
            color: "var(--ink-soft)",
            fontSize: 14,
            fontStyle: "italic",
          }}
        >
          {filter === "retired"
            ? "Nothing retired yet."
            : filter === "all"
              ? "No important memories yet. Add one — or promote any entry from its detail view."
              : `No ${filter}s yet.`}
        </div>
      )}

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {visible.map((m) =>
          editingId === m.id ? (
            <li key={m.id}>
              <MemoryEditor
                mode="edit"
                initial={{ title: m.title, summary: m.summary, memory_type: m.memory_type }}
                onCancel={() => setEditingId(null)}
                onSave={async (input) => {
                  const r = await updateMemory(m.id, input);
                  if (r.ok) setEditingId(null);
                  return r;
                }}
              />
            </li>
          ) : (
            <li key={m.id}>
              <MemoryCard
                memory={m}
                onEdit={() => setEditingId(m.id)}
                onRetire={() => setStatus(m.id, "retire")}
                onRestore={() => setStatus(m.id, "restore")}
              />
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function MemoryCard({
  memory,
  onEdit,
  onRetire,
  onRestore,
}: {
  memory: ImportantMemory;
  onEdit: () => void;
  onRetire: () => void;
  onRestore: () => void;
}) {
  const retired = memory.status === "retired";
  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line-soft)",
        borderRadius: 16,
        padding: "16px 18px",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        opacity: retired ? 0.6 : 1,
      }}
    >
      <span
        className="f-sans"
        style={{
          flex: "0 0 auto",
          height: 22,
          padding: "0 10px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          color: "var(--ember)",
          background: "var(--ember-wash)",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        {IMPORTANT_MEMORY_TYPE_LABEL[memory.memory_type]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3
          className="f-serif"
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 600,
            color: "var(--ink)",
            lineHeight: 1.3,
          }}
        >
          {memory.title}
        </h3>
        <p
          className="f-serif"
          style={{
            margin: "4px 0 0",
            fontSize: 14,
            lineHeight: 1.5,
            color: "var(--ink-soft)",
          }}
        >
          {memory.summary}
        </p>
        {memory.source_entry_ids.length > 0 && (
          <p
            className="f-sans"
            style={{
              margin: "6px 0 0",
              fontSize: 11,
              color: "var(--ink-faint)",
              fontStyle: "italic",
            }}
          >
            from {memory.source_entry_ids.length}{" "}
            {memory.source_entry_ids.length === 1 ? "entry" : "entries"}
          </p>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
        {!retired && (
          <button onClick={onEdit} className="press" style={smallBtn}>
            Edit
          </button>
        )}
        {retired ? (
          <button onClick={onRestore} className="press" style={smallBtn}>
            Restore
          </button>
        ) : (
          <button onClick={onRetire} className="press" style={smallBtn}>
            Retire
          </button>
        )}
      </div>
    </article>
  );
}

const smallBtn: React.CSSProperties = {
  height: 28,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid var(--line-soft)",
  background: "var(--surface)",
  color: "var(--ink-soft)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

function MemoryEditor({
  mode,
  initial,
  onCancel,
  onSave,
}: {
  mode: "create" | "edit";
  initial?: { title: string; summary: string; memory_type: ImportantMemoryType };
  onCancel: () => void;
  onSave: (input: {
    title: string;
    summary: string;
    memory_type: ImportantMemoryType;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [type, setType] = useState<ImportantMemoryType>(initial?.memory_type ?? "fact");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSave = !!title.trim() && !!summary.trim() && !busy;

  async function submit() {
    if (!canSave) return;
    setBusy(true);
    setErr(null);
    const r = await onSave({
      title: title.trim(),
      summary: summary.trim(),
      memory_type: type,
    });
    setBusy(false);
    if (!r.ok) setErr(r.error);
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        role="radiogroup"
        aria-label="Memory type"
      >
        {IMPORTANT_MEMORY_TYPES.map((t) => {
          const active = type === t;
          return (
            <button
              key={t}
              role="radio"
              aria-checked={active}
              onClick={() => setType(t)}
              className="press"
              style={{
                height: 28,
                padding: "0 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                border: "1px solid",
                borderColor: active ? "var(--ember)" : "var(--line-soft)",
                background: active ? "var(--ember-wash)" : "var(--surface)",
                color: active ? "var(--ember)" : "var(--ink-soft)",
                cursor: "pointer",
              }}
            >
              {IMPORTANT_MEMORY_TYPE_LABEL[t]}
            </button>
          );
        })}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title — what is this memory about?"
        maxLength={200}
        className="f-serif"
        style={{
          height: 40,
          padding: "0 14px",
          borderRadius: 12,
          border: "1px solid var(--line-soft)",
          background: "var(--surface)",
          color: "var(--ink)",
          fontSize: 16,
          outline: "none",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ember)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line-soft)")}
      />

      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Summary — the fact Everion should trust"
        maxLength={1000}
        rows={3}
        className="f-serif"
        style={{
          padding: 12,
          borderRadius: 12,
          border: "1px solid var(--line-soft)",
          background: "var(--surface)",
          color: "var(--ink)",
          fontSize: 15,
          lineHeight: 1.5,
          resize: "vertical",
          outline: "none",
          fontFamily: "inherit",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ember)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line-soft)")}
      />

      {err && <p style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>{err}</p>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} className="press" style={smallBtn}>
          Cancel
        </button>
        <Button size="sm" onClick={submit} disabled={!canSave}>
          {mode === "create" ? "Save memory" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
