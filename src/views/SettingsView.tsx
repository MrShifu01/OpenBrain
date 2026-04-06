import { useState, useEffect, useRef } from "react";
import { useTheme } from "../ThemeContext";
import { authFetch } from "../lib/authFetch";
import {
  aiFetch,
  getUserApiKey,
  getUserModel,
  setUserApiKey,
  setUserModel,
  getUserProvider,
  setUserProvider,
  getOpenRouterKey,
  setOpenRouterKey,
  getOpenRouterModel,
  setOpenRouterModel,
  getEmbedProvider,
  setEmbedProvider,
  getEmbedOpenAIKey,
  setEmbedOpenAIKey,
  getGeminiKey,
  setGeminiKey,
  getGroqKey,
  setGroqKey,
} from "../lib/aiFetch";
import { callAI } from "../lib/ai";
import { supabase } from "../lib/supabase";
import NotificationSettings from "../components/NotificationSettings";
import { PinGate, getStoredPinHash, removePin } from "../lib/pin";
import { MODELS } from "../config/models";
import { useBrain } from "../context/BrainContext";
import type { Brain } from "../types";

interface BrainMember {
  user_id: string;
  role: string;
}

interface ORModel {
  id: string;
  name: string;
  pricing?: { prompt?: string };
}

/* ─── Telegram Panel ─── */
function TelegramPanel({ activeBrain }: { activeBrain: Brain }) {
  const [code, setCode] = useState(null);
  const [generating, setGenerating] = useState(false);

  const generateCode = async () => {
    setGenerating(true);
    try {
      const res = await authFetch("/api/brains?action=telegram-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brain_id: activeBrain.id }),
      });
      if (res.ok) {
        const d = await res.json();
        setCode(d.code);
      }
    } catch {}
    setGenerating(false);
  };

  return (
    <div>
      <p>Telegram</p>
      <p>
        Connect Telegram to save entries by messaging the bot.
      </p>
      {code ? (
        <div>
          <p>
            Send this code to <strong>@TheOneAndOnlyOpenBrainBot</strong> on Telegram:
          </p>
          <p>{code}</p>
          <p>Expires in 10 minutes</p>
        </div>
      ) : (
        <button
          onClick={generateCode}
          disabled={generating}
        >
          {generating ? "Generating…" : "Connect Telegram"}
        </button>
      )}
    </div>
  );
}

/* ─── Memory Editor ─── */
function MemoryEditor({ activeBrain }: { activeBrain?: any }) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const MAX = 8000;
  useEffect(() => {
    authFetch("/api/memory")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: any) => setContent(d.content || ""))
      .catch((err) =>
        console.error("[SettingsView:MemoryEditor] Failed to load memory content", err),
      );
  }, []);
  const save = async () => {
    setSaving(true);
    const res = await authFetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setStatus(res.ok ? "saved" : "error");
    setSaving(false);
    setTimeout(() => setStatus(null), 3000);
  };
  return (
    <div>
      <p>AI Memory Guide</p>
      <p>
        Markdown guide injected into every AI call for context. Do not include IDs or bank details.
      </p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX))}
        rows={8}
        placeholder={
          "# OpenBrain Classification Guide\n\n## Business Context\n- ...\n\n## Personal Context\n- ..."
        }
      />
      <div>
        <span>
          {content.length}/{MAX}
        </span>
        <button
          onClick={save}
          disabled={saving}
        >
          {saving
            ? "Saving…"
            : status === "saved"
              ? "✓ Saved"
              : status === "error"
                ? "✗ Failed"
                : "Save"}
        </button>
      </div>
    </div>
  );
}

/* ─── Export / Import Panel ─── */
function ExportImportPanel({ activeBrain }: { activeBrain: Brain }) {
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const url = `/api/export?brain_id=${activeBrain.id}`;
    const a = document.createElement("a");
    a.href = url;
    a.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.entries || !Array.isArray(data.entries)) {
        setImportStatus("invalid");
        setTimeout(() => setImportStatus(null), 3000);
        return;
      }
      if (data.entries.length > 500) {
        setImportStatus("toobig");
        setTimeout(() => setImportStatus(null), 3000);
        return;
      }
      setImporting(true);
      const res = await authFetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brain_id: activeBrain.id,
          entries: data.entries,
          options: { skip_duplicates: true },
        }),
      });
      const result = res.ok ? await res.json() : null;
      setImportStatus(result ? `imported:${result.imported}:${result.skipped}` : "error");
    } catch {
      setImportStatus("error");
    }
    setImporting(false);
    setTimeout(() => setImportStatus(null), 5000);
  };

  const statusMsg = importStatus?.startsWith("imported:")
    ? (() => {
        const [, i, s] = importStatus.split(":");
        return `✓ Imported ${i}, skipped ${s} duplicates`;
      })()
    : importStatus === "invalid"
      ? "✗ Invalid file format"
      : importStatus === "toobig"
        ? "✗ Max 500 entries per import"
        : importStatus === "error"
          ? "✗ Import failed"
          : null;

  return (
    <div>
      <p>Export / Import</p>
      <p>
        Export all entries from <strong>{activeBrain.name}</strong> as JSON, or import from a
        previous export.
      </p>
      <div>
        <button onClick={handleExport}>
          ⬇ Export Brain
        </button>
        <input
          type="file"
          accept=".json"
          ref={fileRef}
          onChange={handleImportFile}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
        >
          {importing ? "Importing…" : "⬆ Import"}
        </button>
      </div>
      {statusMsg && (
        <p>
          {statusMsg}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SETTINGS VIEW
   ═══════════════════════════════════════════════════════════════ */
export default function SettingsView() {
  const { activeBrain, canInvite, canManageMembers, refresh: onRefreshBrains } = useBrain();
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [byoKey, setByoKey] = useState(() => getUserApiKey() || "");
  const [byoProvider, setByoProvider] = useState(() => getUserProvider());
  const [byoModel, setByoModel] = useState(() => getUserModel());
  const [orKey, setOrKey] = useState(() => getOpenRouterKey() || "");
  const [orModel, setOrModel] = useState(
    () => getOpenRouterModel() || "google/gemini-2.0-flash-exp:free",
  );
  const [orModels, setOrModels] = useState<ORModel[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [byoTestStatus, setByoTestStatus] = useState<string | null>(null);
  const [pinSet, setPinSet] = useState(() => !!getStoredPinHash());
  const [showPinModal, setShowPinModal] = useState(false);
  // Groq (voice transcription)
  const [groqKeyVal, setGroqKeyVal] = useState(() => getGroqKey() || "");
  const [showGroqKey, setShowGroqKey] = useState(false);
  // Embedding provider
  const [embedProvider, setEmbedProviderState] = useState(() => getEmbedProvider());
  const [embedOpenAIKey, setEmbedOpenAIKeyState] = useState(() => getEmbedOpenAIKey() || "");
  const [geminiKey, setGeminiKeyState] = useState(() => getGeminiKey() || "");
  const [embedStatus, setEmbedStatus] = useState<string | null>(null); // "running" | "done:N:M" | "error"
  const [showEmbedKey, setShowEmbedKey] = useState(false);
  // Advanced section toggle
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Brain members
  const [members, setMembers] = useState<BrainMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email || ""));
  }, []);
  useEffect(() => {
    if (!activeBrain?.id) return;
    authFetch(`/api/brains?action=members&brain_id=${activeBrain.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setMembers)
      .catch((err) =>
        console.error("[SettingsView:BrainMembers] Failed to fetch brain members", err),
      );
  }, [activeBrain?.id]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteStatus("sending");
    try {
      const res = await authFetch("/api/brains?action=invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brain_id: activeBrain.id,
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      if (res.ok) {
        setInviteStatus("sent");
        setInviteEmail("");
        setTimeout(() => setInviteStatus(null), 3000);
      } else {
        setInviteStatus("error");
        setTimeout(() => setInviteStatus(null), 3000);
      }
    } catch {
      setInviteStatus("error");
      setTimeout(() => setInviteStatus(null), 3000);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const res = await authFetch("/api/brains?action=member-role", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brain_id: activeBrain.id, user_id: userId, role: newRole }),
    });
    if (res.ok)
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role: newRole } : m)));
  };

  const handleRemoveMember = async (userId: string) => {
    const res = await authFetch("/api/brains?action=member", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brain_id: activeBrain.id, user_id: userId }),
    });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      if (onRefreshBrains) onRefreshBrains();
    }
  };

  const ANTHROPIC_MODELS = MODELS.ANTHROPIC;
  const OPENAI_MODELS = MODELS.OPENAI;
  const OR_SHORTLIST = MODELS.OPENROUTER;
  const modelOptions = byoProvider === "openai" ? OPENAI_MODELS : ANTHROPIC_MODELS;

  const [keySaved, setKeySaved] = useState(false);
  const saveByoKey = (key: string) => {
    setByoKey(key);
    setKeySaved(false);
  };
  const handleSaveKey = () => {
    setUserApiKey(byoKey || null);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };
  const saveByoProvider = (p: string) => {
    setByoProvider(p);
    setUserProvider(p);
    if (p === "openai") {
      if (!OPENAI_MODELS.includes(byoModel)) {
        setByoModel(OPENAI_MODELS[0]);
        setUserModel(OPENAI_MODELS[0]);
      }
    } else if (p === "anthropic") {
      if (!ANTHROPIC_MODELS.includes(byoModel)) {
        setByoModel(ANTHROPIC_MODELS[0]);
        setUserModel(ANTHROPIC_MODELS[0]);
      }
    } else if (p === "openrouter" && orKey) {
      fetchOrModels(orKey);
    }
  };
  const saveByoModel = (m: string) => {
    setByoModel(m);
    setUserModel(m);
  };
  const saveOrKey = (key: string) => {
    setOrKey(key);
    setOpenRouterKey(key || null);
    if (key) fetchOrModels(key);
  };
  const saveOrModel = (m: string) => {
    setOrModel(m);
    setOpenRouterModel(m);
  };

  const saveEmbedProvider = (p: string) => {
    setEmbedProviderState(p);
    setEmbedProvider(p);
  };
  const saveEmbedOpenAIKey = (k: string) => {
    setEmbedOpenAIKeyState(k);
    setEmbedOpenAIKey(k || null);
  };
  const saveGeminiKey = (k: string) => {
    setGeminiKeyState(k);
    setGeminiKey(k || null);
  };

  const handleReembed = async (force: boolean = false) => {
    if (!activeBrain?.id) return;
    const key = embedProvider === "google" ? geminiKey : embedOpenAIKey;
    if (!key) return;
    setEmbedStatus("running");
    let totalProcessed = 0,
      totalFailed = 0;
    try {
      // Process in small batches (5 entries per request) to avoid Vercel 10s timeout
      for (let i = 0; i < 100; i++) {
        const res = await authFetch("/api/embed", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Embed-Provider": embedProvider,
            "X-Embed-Key": key,
          },
          body: JSON.stringify({ brain_id: activeBrain.id, batch: true, force }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          if (totalProcessed === 0) {
            setEmbedStatus(`error:${errData?.error || res.status}`);
            setTimeout(() => setEmbedStatus(null), 10000);
            return;
          }
          break;
        }
        const data = await res.json();
        totalProcessed += data.processed;
        totalFailed += data.failed ?? 0;
        setEmbedStatus(`running:${totalProcessed}`);
        if ((data.remaining ?? 0) <= 0) break;
      }
      setEmbedStatus(`done:${totalProcessed}:${totalFailed}`);
    } catch (e: any) {
      if (totalProcessed === 0) {
        setEmbedStatus(`error:${e.message || "Network error"}`);
      } else {
        setEmbedStatus(`done:${totalProcessed}:${totalFailed}`);
      }
    }
    setTimeout(() => setEmbedStatus(null), 10000);
  };

  const fetchOrModels = async (key: string) => {
    const cached = sessionStorage.getItem("openbrain_or_models");
    if (cached) {
      try {
        setOrModels(JSON.parse(cached));
        return;
      } catch {}
    }
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        const data = await res.json();
        const models: ORModel[] = (data.data || []).map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          pricing: m.pricing,
        }));
        setOrModels(models);
        sessionStorage.setItem("openbrain_or_models", JSON.stringify(models));
      }
    } catch {}
  };

  const testByoKey = async () => {
    const key = byoProvider === "openrouter" ? orKey : byoKey;
    if (!key) return;
    setByoTestStatus("testing");
    try {
      const endpoint =
        byoProvider === "openai"
          ? "/api/openai"
          : byoProvider === "openrouter"
            ? "/api/openrouter"
            : "/api/anthropic";
      const model = byoProvider === "openrouter" ? orModel : byoModel;
      const body = { model, max_tokens: 10, messages: [{ role: "user", content: "Say ok" }] };
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authH: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Api-Key": key, ...authH },
        body: JSON.stringify(body),
      });
      setByoTestStatus(res.ok ? "ok" : "fail");
    } catch {
      setByoTestStatus("fail");
    }
    setTimeout(() => setByoTestStatus(null), 3000);
  };

  const testAI = async () => {
    setTestStatus("testing-ai");
    try {
      const res = await callAI({ max_tokens: 10, messages: [{ role: "user", content: "Say ok" }] });
      setTestStatus(res.ok ? "ai-success" : "ai-fail");
    } catch {
      setTestStatus("ai-fail");
    }
    setTimeout(() => setTestStatus(null), 3000);
  };
  const testDB = async () => {
    setTestStatus("testing");
    try {
      const res = await authFetch("/api/health");
      setTestStatus(res.ok ? "success" : "fail");
    } catch {
      setTestStatus("fail");
    }
    setTimeout(() => setTestStatus(null), 3000);
  };

  return (
    <div>
      {/* Header */}
      <div>
        <h2>Settings</h2>
        <p>Manage your account and preferences</p>
      </div>

      {/* ── Account ── */}
      <div>
        <div>
          <div>
            <p>Account</p>
            <p>{email}</p>
          </div>
          <button onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>

      {/* ── Connection Status ── */}
      <div>
        <div>
          <div>
            <p>AI Status</p>
            <p>Claude AI (Haiku)</p>
          </div>
          <button onClick={testAI}>
            {testStatus === "testing-ai"
              ? "Testing…"
              : testStatus === "ai-success"
                ? "✓ Connected"
                : testStatus === "ai-fail"
                  ? "✗ Failed"
                  : "Test"}
          </button>
        </div>
        <div />
        <div>
          <div>
            <p>Database</p>
            <p>Supabase</p>
          </div>
          <button onClick={testDB}>
            {testStatus === "testing"
              ? "Testing…"
              : testStatus === "success"
                ? "✓ Connected"
                : testStatus === "fail"
                  ? "✗ Failed"
                  : "Test"}
          </button>
        </div>
      </div>

      {/* ── Security PIN ── */}
      <div>
        <p>Security PIN</p>
        <p>
          {pinSet
            ? "PIN is active — sensitive AI responses are protected."
            : "No PIN set — credentials in AI responses are shown unguarded."}
        </p>
        <div>
          <button onClick={() => setShowPinModal(true)}>
            {pinSet ? "Change PIN" : "Set PIN"}
          </button>
          {pinSet && (
            <button
              onClick={() => {
                removePin();
                setPinSet(false);
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* ── Notifications ── */}
      <div>
        <NotificationSettings />
      </div>

      {/* ── Export / Import ── */}
      {activeBrain && <ExportImportPanel activeBrain={activeBrain} />}

      {/* ── Brain Members ── */}
      {activeBrain && (
        <div>
          <p>
            {activeBrain.name} — Members
          </p>
          {members.length > 0 && (
            <div>
              {members.map((m) => (
                <div key={m.user_id}>
                  <span>
                    {m.user_id.slice(0, 8)}…
                  </span>
                  <span>
                    {m.role}
                  </span>
                  {canManageMembers && (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                      >
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button onClick={() => handleRemoveMember(m.user_id)}>
                        Remove
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {canInvite && (
            <div>
              <p>Invite someone to this brain</p>
              <div>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="their@email.com"
                  type="email"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || inviteStatus === "sending"}
                >
                  {inviteStatus === "sending"
                    ? "…"
                    : inviteStatus === "sent"
                      ? "✓ Sent"
                      : inviteStatus === "error"
                        ? "✗ Failed"
                        : "Invite"}
                </button>
              </div>
            </div>
          )}
          {!canInvite && (
            <p>Only the brain owner can invite members.</p>
          )}
        </div>
      )}

      {/* ── Advanced toggle ── */}
      <button onClick={() => setShowAdvanced((s) => !s)}>
        <div>
          <p>Advanced</p>
          <p>
            AI provider, embeddings, voice, Telegram
          </p>
        </div>
        <span>{showAdvanced ? "▾" : "▸"}</span>
      </button>

      {showAdvanced && <>
      {/* AI Provider / BYO Key */}
      <div>
        <p>AI Provider</p>
        <p>
          Use your own API key — no OpenBrain credits deducted. Leave blank to use the shared key.
        </p>
        <div>
          {["anthropic", "openrouter"].map((p) => (
            <button
              key={p}
              onClick={() => saveByoProvider(p)}
            >
              {p === "openrouter" ? "OpenRouter" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        {byoProvider === "openrouter" ? (
          <>
            <p>
              OpenRouter lets you use hundreds of models with one key.{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
              >
                Get a key →
              </a>
            </p>
            <div>
              <p>
                OpenRouter API Key
              </p>
              <div>
                <input
                  type={showKey ? "text" : "password"}
                  value={orKey}
                  onChange={(e) => saveOrKey(e.target.value)}
                  placeholder="sk-or-..."
                />
                <button onClick={() => setShowKey((s) => !s)}>
                  {showKey ? "Hide" : "Show"}
                </button>
                <button
                  onClick={testByoKey}
                  disabled={!orKey}
                >
                  {byoTestStatus === "testing"
                    ? "…"
                    : byoTestStatus === "ok"
                      ? "✓"
                      : byoTestStatus === "fail"
                        ? "✗"
                        : "Test"}
                </button>
              </div>
            </div>
            <div>
              <p>
                Model{" "}
                {orModels.length > 0 && (
                  <span>
                    ({orModels.length} available)
                  </span>
                )}
              </p>
              <select
                value={orModel}
                onChange={(e) => saveOrModel(e.target.value)}
              >
                {(orModels.length > 0
                  ? orModels.map((m) => ({
                      id: m.id,
                      label: `${m.name}${m.pricing?.prompt ? ` — $${(+m.pricing.prompt * 1e6).toFixed(2)}/1M` : ""}`,
                    }))
                  : OR_SHORTLIST.map((id) => ({ id, label: id }))
                ).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p>
                Tip: choose a model with ZDR (zero data retention) for sensitive entries.
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <p>API Key</p>
              <div>
                <input
                  type={showKey ? "text" : "password"}
                  value={byoKey}
                  onChange={(e) => saveByoKey(e.target.value)}
                  placeholder={byoProvider === "openai" ? "sk-..." : "sk-ant-..."}
                />
                <button onClick={() => setShowKey((s) => !s)}>
                  {showKey ? "Hide" : "Show"}
                </button>
                <button
                  onClick={handleSaveKey}
                  disabled={!byoKey}
                >
                  {keySaved ? "Saved!" : "Save"}
                </button>
                <button
                  onClick={testByoKey}
                  disabled={!byoKey}
                >
                  {byoTestStatus === "testing"
                    ? "…"
                    : byoTestStatus === "ok"
                      ? "✓"
                      : byoTestStatus === "fail"
                        ? "✗"
                        : "Test"}
                </button>
              </div>
            </div>
            <div>
              <p>Model</p>
              <select
                value={byoModel}
                onChange={(e) => saveByoModel(e.target.value)}
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Embedding Provider */}
      <div>
        <p>Semantic Search & RAG</p>
        <p>
          Powers semantic search, RAG chat, and smarter connection discovery. Requires a separate
          embedding API key.
        </p>
        <div>
          {["openai", "google"].map((p) => (
            <button
              key={p}
              onClick={() => saveEmbedProvider(p)}
            >
              {p === "openai" ? "OpenAI" : "Google"}
            </button>
          ))}
        </div>
        {embedProvider === "openai" ? (
          <div>
            <p>
              OpenAI API Key{" "}
              <span>(text-embedding-3-small)</span>
            </p>
            <div>
              <input
                type={showEmbedKey ? "text" : "password"}
                value={embedOpenAIKey}
                onChange={(e) => saveEmbedOpenAIKey(e.target.value)}
                placeholder="sk-..."
              />
              <button onClick={() => setShowEmbedKey((s) => !s)}>
                {showEmbedKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p>
              Google Gemini API Key{" "}
              <span>(text-embedding-004)</span>
            </p>
            <div>
              <input
                type={showEmbedKey ? "text" : "password"}
                value={geminiKey}
                onChange={(e) => saveGeminiKey(e.target.value)}
                placeholder="AIza..."
              />
              <button onClick={() => setShowEmbedKey((s) => !s)}>
                {showEmbedKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        )}
        {activeBrain && (
          <div>
            <button
              onClick={() => handleReembed()}
              disabled={
                embedStatus === "running" ||
                !(embedProvider === "google" ? geminiKey : embedOpenAIKey)
              }
            >
              {embedStatus?.startsWith("running")
                ? `Embedding…${embedStatus.includes(":") ? ` (${embedStatus.split(":")[1]})` : ""}`
                : "Embed new"}
            </button>
            <button
              onClick={() => handleReembed(true)}
              disabled={
                embedStatus?.startsWith("running") ||
                !(embedProvider === "google" ? geminiKey : embedOpenAIKey)
              }
            >
              Re-embed all
            </button>
            {embedStatus && !embedStatus.startsWith("running") && (
              <span>
                {embedStatus.startsWith("error")
                  ? `✗ ${embedStatus.split(":").slice(1).join(":") || "Failed"}`
                  : (() => {
                      const [, n, f] = embedStatus.split(":");
                      return `✓ ${n} embedded${+f > 0 ? `, ${f} failed` : ""}`;
                    })()}
              </span>
            )}
          </div>
        )}
        <p>
          New entries are embedded automatically. Use "Embed all" to backfill or after switching providers.
        </p>
      </div>

      {/* Voice Transcription */}
      <div>
        <p>Voice Transcription</p>
        <p>
          Powers the mic button in Quick Capture. Uses Groq Whisper (fast, free tier).{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
          >
            Get a free key →
          </a>
        </p>
        <div>
          <p>
            Groq API Key{" "}
            <span>(whisper-large-v3-turbo)</span>
          </p>
          <div>
            <input
              type={showGroqKey ? "text" : "password"}
              value={groqKeyVal}
              onChange={(e) => {
                setGroqKeyVal(e.target.value);
                setGroqKey(e.target.value);
              }}
              placeholder="gsk_..."
            />
            <button onClick={() => setShowGroqKey((s) => !s)}>
              {showGroqKey ? "Hide" : "Show"}
            </button>
          </div>
          <p>
            Also works with an OpenAI key (set above) — but Groq is faster and free.
          </p>
        </div>
      </div>

      {/* Telegram */}
      {activeBrain && <TelegramPanel activeBrain={activeBrain} />}

      {/* AI Memory Guide */}
      <MemoryEditor activeBrain={activeBrain} />
      </>}

      {showPinModal && (
        <PinGate
          isSetup
          onSuccess={() => {
            setShowPinModal(false);
            setPinSet(!!getStoredPinHash());
          }}
          onCancel={() => setShowPinModal(false)}
        />
      )}
    </div>
  );
}
