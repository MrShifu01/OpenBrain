import { useState } from "react";
import type { Brain } from "../../types";
import SettingsRow, { SettingsToggle, SettingsValue } from "./SettingsRow";
import { authFetch } from "../../lib/authFetch";
import { useBrain } from "../../context/BrainContext";
import { isFeatureEnabled } from "../../lib/featureFlags";
import { useAdminDevMode } from "../../hooks/useAdminDevMode";
import CreateBrainModal from "../CreateBrainModal";

const CONCEPT_KEY = "everion:brain:concept_extraction";
const EMBEDDINGS_KEY = "everion:brain:embeddings";

interface Props {
  activeBrain: Brain;
  onRefreshBrains?: () => void;
}

function loadPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === "true") return true;
    if (v === "false") return false;
  } catch {
    /* ignore */
  }
  return fallback;
}

function savePref(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

export default function BrainTab({ activeBrain, onRefreshBrains }: Props) {
  const [conceptOn, setConceptOn] = useState(() => loadPref(CONCEPT_KEY, true));
  const [embedOn, setEmbedOn] = useState(() => loadPref(EMBEDDINGS_KEY, true));
  const { brains, refresh } = useBrain();
  const { adminFlags } = useAdminDevMode();
  const showMulti = isFeatureEnabled("multiBrain", adminFlags);

  return (
    <div>
      {showMulti && (
        <MultiBrainSection
          brains={brains}
          activeBrain={activeBrain}
          onChanged={async () => {
            await refresh();
            onRefreshBrains?.();
          }}
        />
      )}

      <SettingsRow label="Name">
        <SettingsValue>{activeBrain.name}</SettingsValue>
      </SettingsRow>

      <SettingsRow
        label="Concept extraction"
        hint="extract concepts from new entries automatically."
      >
        <SettingsToggle
          value={conceptOn}
          onChange={(v) => {
            setConceptOn(v);
            savePref(CONCEPT_KEY, v);
          }}
          ariaLabel="Concept extraction"
        />
      </SettingsRow>

      <SettingsRow label="Embeddings" hint="used for semantic search. stored on device." last>
        <SettingsToggle
          value={embedOn}
          onChange={(v) => {
            setEmbedOn(v);
            savePref(EMBEDDINGS_KEY, v);
          }}
          ariaLabel="Embeddings"
        />
      </SettingsRow>
    </div>
  );
}

// ── Multi-brain management section (phase 1) ──────────────────────────────
// Shown above the existing single-brain settings when the multiBrain flag is on.
// Lists every brain owned by the user, supports create / rename / delete.

interface MultiBrainSectionProps {
  brains: Brain[];
  activeBrain: Brain;
  onChanged: () => Promise<void> | void;
}

function MultiBrainSection({ brains, activeBrain, onChanged }: MultiBrainSectionProps) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const personal = brains.find((b) => b.is_personal);
  const others = brains.filter((b) => !b.is_personal).sort((a, b) => a.name.localeCompare(b.name));
  const sorted = personal ? [personal, ...others] : others;

  function beginEdit(b: Brain) {
    setEditingId(b.id);
    setEditName(b.name);
    setEditDesc(b.description ?? "");
    setError(null);
  }

  async function saveEdit(b: Brain) {
    if (!editName.trim() || savingId) return;
    setSavingId(b.id);
    setError(null);
    try {
      const r = await authFetch("/api/brains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: b.id,
          name: editName.trim(),
          description: editDesc.trim() || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error || `HTTP ${r.status}`);
      }
      setEditingId(null);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteBrain(b: Brain) {
    if (b.is_personal) return;
    setSavingId(b.id);
    setError(null);
    try {
      const r = await authFetch(`/api/brains?id=${encodeURIComponent(b.id)}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error || `HTTP ${r.status}`);
      }
      setConfirmDelId(null);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div>
          <div className="f-serif" style={{ fontSize: 18, color: "var(--ink)" }}>
            Your brains
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
            Create separate brains for different parts of your life. Switch between them from the
            header.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="press"
          style={{
            padding: "8px 14px",
            background: "var(--ember)",
            border: 0,
            borderRadius: 8,
            color: "var(--bg)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + New brain
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            fontSize: 12,
            color: "var(--blood)",
            background: "var(--blood-wash)",
            padding: "8px 12px",
            borderRadius: 6,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          border: "1px solid var(--line-soft)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {sorted.map((b, i) => {
          const isEditing = editingId === b.id;
          const isConfirmingDelete = confirmDelId === b.id;
          const isActive = b.id === activeBrain.id;
          return (
            <div
              key={b.id}
              style={{
                display: "flex",
                alignItems: isEditing ? "flex-start" : "center",
                gap: 12,
                padding: "12px 14px",
                borderBottom: i < sorted.length - 1 ? "1px solid var(--line-soft)" : 0,
                background: isActive ? "var(--ember-wash)" : "transparent",
              }}
            >
              {b.is_personal ? (
                <span style={{ color: "var(--ember)", width: 16, textAlign: "center" }}>★</span>
              ) : (
                <span style={{ width: 16 }} />
              )}

              {isEditing ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={60}
                    style={{
                      padding: "6px 8px",
                      background: "var(--surface)",
                      border: "1px solid var(--line-soft)",
                      borderRadius: 6,
                      color: "var(--ink)",
                      fontSize: 13,
                      fontFamily: "var(--f-sans)",
                    }}
                  />
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    maxLength={280}
                    rows={2}
                    placeholder="Description (optional)"
                    style={{
                      padding: "6px 8px",
                      background: "var(--surface)",
                      border: "1px solid var(--line-soft)",
                      borderRadius: 6,
                      color: "var(--ink)",
                      fontSize: 12,
                      fontFamily: "var(--f-sans)",
                      resize: "vertical",
                    }}
                  />
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      disabled={savingId === b.id}
                      style={{
                        padding: "5px 10px",
                        background: "transparent",
                        border: "1px solid var(--line-soft)",
                        borderRadius: 6,
                        color: "var(--ink)",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(b)}
                      disabled={!editName.trim() || savingId === b.id}
                      style={{
                        padding: "5px 10px",
                        background: editName.trim() ? "var(--ember)" : "var(--surface)",
                        border: 0,
                        borderRadius: 6,
                        color: editName.trim() ? "var(--bg)" : "var(--ink-faint)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: editName.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      {savingId === b.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        color: "var(--ink)",
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {b.name}
                      {b.is_personal && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--ink-faint)" }}>
                          Personal
                        </span>
                      )}
                      {isActive && !b.is_personal && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--ember)" }}>
                          Active
                        </span>
                      )}
                    </div>
                    {b.description && (
                      <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
                        {b.description}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => beginEdit(b)}
                    aria-label="Rename"
                    className="press"
                    style={{
                      padding: "5px 10px",
                      background: "transparent",
                      border: "1px solid var(--line-soft)",
                      borderRadius: 6,
                      color: "var(--ink-soft)",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>

                  {!b.is_personal && (
                    <button
                      type="button"
                      onClick={() => (isConfirmingDelete ? deleteBrain(b) : setConfirmDelId(b.id))}
                      onBlur={() => isConfirmingDelete && setConfirmDelId(null)}
                      disabled={savingId === b.id}
                      className="press"
                      style={{
                        padding: "5px 10px",
                        background: isConfirmingDelete ? "var(--blood-wash)" : "transparent",
                        border: `1px solid ${isConfirmingDelete ? "var(--blood)" : "var(--line-soft)"}`,
                        borderRadius: 6,
                        color: "var(--blood)",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {savingId === b.id ? "Deleting…" : isConfirmingDelete ? "Confirm?" : "Delete"}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {creating && (
        <CreateBrainModal
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await onChanged();
          }}
        />
      )}
    </div>
  );
}
