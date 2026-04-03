import { useState, useMemo, useRef, useEffect, lazy, Suspense } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { authFetch } from "./lib/authFetch";
import { supabase } from "./lib/supabase";
import { TC, PC, fmtD, MODEL, INITIAL_ENTRIES, LINKS } from "./data/constants";

const SuggestionsView = lazy(() => import("./views/SuggestionsView"));
const CalendarView    = lazy(() => import("./views/CalendarView"));
const TodoView        = lazy(() => import("./views/TodoView"));
const GraphView       = lazy(() => import("./views/GraphView"));
const DetailModal     = lazy(() => import("./views/DetailModal"));

const Loader = () => <div style={{ padding: 40, textAlign: "center", color: "#555", fontSize: 13 }}>Loading…</div>;

/* ─── AI Connection Discovery ─── */
async function findConnections(newEntry, existingEntries, existingLinks) {
  const candidates = existingEntries
    .filter(e => e.id !== newEntry.id)
    .slice(0, 50)
    .map(e => ({ id: e.id, title: e.title, type: e.type, tags: e.tags, content: (e.content || "").slice(0, 120) }));
  if (candidates.length === 0) return [];
  const existingKeys = new Set(existingLinks.map(l => `${l.from}-${l.to}`));
  try {
    const res = await authFetch("/api/anthropic", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 600,
        system: `You are a knowledge-graph builder. Given a NEW entry and EXISTING entries, find meaningful connections.\nRULES:\n- Only connect where a real, specific relationship exists (supplier→business, person→place, idea→business, etc.)\n- "rel" label: short phrase 2-4 words describing the relationship\n- Do NOT connect entries just because they share a type\n- Return 0–5 connections. Quality over quantity.\n- "from" = new entry ID. "to" = existing entry ID.\n- Return ONLY valid JSON array: [{\"from\":\"...\",\"to\":\"...\",\"rel\":\"...\"}]\n- If no connections: []`,
        messages: [{ role: "user", content: `NEW ENTRY:\n${JSON.stringify({ id: newEntry.id, title: newEntry.title, type: newEntry.type, content: newEntry.content, tags: newEntry.tags })}\n\nEXISTING ENTRIES:\n${JSON.stringify(candidates)}` }]
      })
    });
    const data = await res.json();
    const raw = (data.content?.[0]?.text || "[]").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(l =>
      l.from && l.to && l.rel &&
      candidates.some(c => c.id === l.to) &&
      !existingKeys.has(`${l.from}-${l.to}`) &&
      !existingKeys.has(`${l.to}-${l.from}`)
    );
  } catch { return []; }
}

/* ═══════════════════════════════════════════════════════════════
   QUICK CAPTURE BAR
   ═══════════════════════════════════════════════════════════════ */
function QuickCapture({ apiKey, sbKey, entries, setEntries, links, addLinks }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const imgRef = useRef(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = ""; setLoading(true); setStatus("thinking");
    try {
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
      const apiRes = await authFetch("/api/anthropic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: 600, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: file.type, data: base64 } }, { type: "text", text: "Extract all text from this image. Output just the extracted content, clean and readable. If it's a business card, document, label, or receipt — preserve structure. No commentary." }] }] }) });
      const data = await apiRes.json();
      const extracted = data.content?.[0]?.text?.trim() || "";
      if (extracted) setText(extracted);
    } catch (err) { console.error(err); }
    setLoading(false); setStatus(null);
  };

  const capture = async () => {
    if (!text.trim()) return;
    const input = text.trim(); setText(""); setLoading(true); setStatus("thinking");
    try {
      if (apiKey) {
        const res = await authFetch("/api/anthropic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: 800, system: "You classify and structure a raw text capture into an OpenBrain entry. Return ONLY valid JSON.\nFormat: {\"title\":\"...\",\"content\":\"...\",\"type\":\"...\",\"metadata\":{},\"tags\":[]}\n\nTYPE RULES (pick the BEST match):\n- person, contact, place, document, reminder, idea, decision, color, note\n\nEXTRACTION RULES:\n- Put phone numbers, dates, IDs into metadata\n- Title: max 60 chars\n- Content: 1-2 sentence description", messages: [{ role: "user", content: input }] }) });
        const data = await res.json();
        let parsed = {};
        try { parsed = JSON.parse((data.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim()); } catch {}
        if (sbKey && parsed.title) {
          setStatus("saving");
          const rpcRes = await authFetch("/api/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p_title: parsed.title, p_content: parsed.content || input, p_type: parsed.type || "note", p_metadata: parsed.metadata || {}, p_tags: parsed.tags || [] }) });
          if (rpcRes.ok) {
            const result = await rpcRes.json();
            const newEntry = { id: result?.id || Date.now().toString(), title: parsed.title, content: parsed.content || input, type: parsed.type || "note", metadata: parsed.metadata || {}, pinned: false, importance: 0, tags: parsed.tags || [], created_at: new Date().toISOString() };
            setEntries(prev => [newEntry, ...prev]);
            setStatus("saved-db");
            // Discover + save connections in the background
            findConnections(newEntry, entries, links || []).then(newLinks => {
              if (newLinks.length === 0) return;
              addLinks?.(newLinks);
              authFetch("/api/save-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ links: newLinks }) }).catch(() => {});
            });
          } else {
            setEntries(prev => [{ id: Date.now().toString(), ...parsed, pinned: false, importance: 0, tags: parsed.tags || [], created_at: new Date().toISOString() }, ...prev]);
            setStatus("saved-local");
          }
        } else {
          setEntries(prev => [{ id: Date.now().toString(), ...parsed, pinned: false, importance: 0, tags: parsed.tags || [], created_at: new Date().toISOString() }, ...prev]);
          setStatus("saved-local");
        }
      } else {
        setEntries(prev => [{ id: Date.now().toString(), title: input.slice(0, 60), content: input, type: "note", metadata: {}, pinned: false, importance: 0, tags: [], created_at: new Date().toISOString() }, ...prev]);
        setStatus("saved-raw");
      }
    } catch (e) {
      console.error(e);
      setEntries(prev => [{ id: Date.now().toString(), title: input.slice(0, 60), content: input, type: "note", metadata: {}, pinned: false, importance: 0, tags: [], created_at: new Date().toISOString() }, ...prev]);
      setStatus("error");
    }
    setLoading(false); setTimeout(() => setStatus(null), 3000);
  };

  const statusMsg = { thinking: "🤖 Parsing...", saving: "💾 Saving to DB...", "saved-db": "✅ Saved to OpenBrain!", "saved-local": "✅ Saved locally", "saved-raw": "📝 Saved (no AI)", error: "⚠️ Saved locally (DB error)" };

  return (
    <div style={{ padding: "0 24px 16px" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="file" accept="image/*" ref={imgRef} onChange={handleImageUpload} style={{ display: "none" }} />
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && capture()} disabled={loading} placeholder={loading ? "Processing..." : "Quick capture — just type anything..."} style={{ flex: 1, padding: "12px 16px", background: "#1a1a2e", border: "1px solid #4ECDC440", borderRadius: 12, color: "#ddd", fontSize: 14, outline: "none", fontFamily: "inherit", opacity: loading ? 0.5 : 1 }} />
        <button onClick={() => imgRef.current?.click()} disabled={loading} style={{ padding: "12px 14px", background: "#1a1a2e", border: "1px solid #4ECDC440", borderRadius: 12, color: loading ? "#444" : "#4ECDC4", cursor: loading ? "default" : "pointer", fontSize: 16 }}>📷</button>
        <button onClick={capture} disabled={loading || !text.trim()} style={{ padding: "12px 18px", background: text.trim() && !loading ? "linear-gradient(135deg, #4ECDC4, #45B7D1)" : "#1a1a2e", border: "none", borderRadius: 12, color: text.trim() && !loading ? "#0f0f23" : "#555", fontWeight: 700, cursor: text.trim() && !loading ? "pointer" : "default", fontSize: 16 }}>+</button>
      </div>
      {status && <p style={{ fontSize: 11, color: status.includes("error") ? "#FF6B35" : "#4ECDC4", margin: "6px 0 0 4px" }}>{statusMsg[status]}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════════════════════════════ */
function SettingsView() {
  const [testStatus, setTestStatus] = useState(null);
  const [email, setEmail] = useState("");
  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email || "")); }, []);
  const testAI = async () => {
    setTestStatus("testing-ai");
    try { const res = await authFetch("/api/anthropic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: 10, messages: [{ role: "user", content: "Say ok" }] }) }); setTestStatus(res.ok ? "ai-success" : "ai-fail"); }
    catch { setTestStatus("ai-fail"); }
    setTimeout(() => setTestStatus(null), 3000);
  };
  const testDB = async () => {
    setTestStatus("testing");
    try { const res = await authFetch("/api/health"); setTestStatus(res.ok ? "success" : "fail"); }
    catch { setTestStatus("fail"); }
    setTimeout(() => setTestStatus(null), 3000);
  };
  const btn = { padding: "10px 20px", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" };
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: "#EAEAEA" }}>Settings</h2>
      <p style={{ fontSize: 12, color: "#666", margin: "0 0 24px" }}>All API keys are managed server-side.</p>
      <div style={{ background: "#1a1a2e", borderRadius: 14, padding: "20px 24px", marginBottom: 16, border: "1px solid #2a2a4a" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#ddd" }}>Signed in as</p><p style={{ margin: "4px 0 0", fontSize: 12, color: "#888" }}>{email}</p></div>
          <button onClick={() => supabase.auth.signOut()} style={{ ...btn, background: "#FF6B3520", color: "#FF6B35" }}>Sign out</button>
        </div>
      </div>
      <div style={{ background: "#1a1a2e", borderRadius: 14, padding: "20px 24px", marginBottom: 16, border: "1px solid #2a2a4a" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#ddd" }}>Claude AI (Haiku)</p><p style={{ margin: "4px 0 0", fontSize: 11, color: "#666" }}>AI parsing and chat</p></div>
          <button onClick={testAI} style={{ ...btn, background: "#4ECDC420", color: "#4ECDC4" }}>{testStatus === "testing-ai" ? "Testing…" : testStatus === "ai-success" ? "✓ Connected" : testStatus === "ai-fail" ? "✗ Failed" : "Test"}</button>
        </div>
      </div>
      <div style={{ background: "#1a1a2e", borderRadius: 14, padding: "20px 24px", border: "1px solid #2a2a4a" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#ddd" }}>Supabase Database</p><p style={{ margin: "4px 0 0", fontSize: 11, color: "#666" }}>Memory storage</p></div>
          <button onClick={testDB} style={{ ...btn, background: "#4ECDC420", color: "#4ECDC4" }}>{testStatus === "testing" ? "Testing…" : testStatus === "success" ? "✓ Connected" : testStatus === "fail" ? "✗ Failed" : "Test"}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ENTRY CARD
   ═══════════════════════════════════════════════════════════════ */
function EntryCard({ entry: e, onSelect }) {
  const cfg = TC[e.type] || TC.note;
  const imp = { 1: "Important", 2: "Critical" }[e.importance];
  return (
    <div onClick={() => onSelect(e)} style={{ background: "#1a1a2e", border: `1px solid ${e.pinned ? cfg.c + "80" : "#2a2a4a"}`, borderRadius: 12, padding: "16px 20px", cursor: "pointer", position: "relative", overflow: "hidden" }}
      onMouseEnter={ev => { ev.currentTarget.style.borderColor = cfg.c; ev.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={ev => { ev.currentTarget.style.borderColor = e.pinned ? cfg.c + "80" : "#2a2a4a"; ev.currentTarget.style.transform = "none"; }}>
      {e.pinned && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${cfg.c},transparent)` }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{cfg.i}</span>
        <span style={{ fontSize: 10, color: cfg.c, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>{e.type}</span>
        {e.pinned && <span style={{ fontSize: 10 }}>📌</span>}
        {imp && <span style={{ fontSize: 9, background: e.importance === 2 ? "#FF6B3530" : "#FFEAA720", color: e.importance === 2 ? "#FF6B35" : "#FFEAA7", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>{imp}</span>}
      </div>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#EAEAEA", lineHeight: 1.3 }}>{e.title}</h3>
      <p style={{ margin: "8px 0 0", fontSize: 13, color: "#999", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.content}</p>
      {e.tags?.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10 }}>
        {e.tags.slice(0, 4).map(t => <span key={t} style={{ fontSize: 10, color: "#777", background: "#ffffff08", padding: "2px 8px", borderRadius: 20 }}>{t}</span>)}
        {e.tags.length > 4 && <span style={{ fontSize: 10, color: "#555" }}>+{e.tags.length - 4}</span>}
      </div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VIRTUALISED GRID
   ═══════════════════════════════════════════════════════════════ */
function VirtualGrid({ filtered, setSelected }) {
  const COLS = typeof window !== "undefined" && window.innerWidth >= 640 ? 2 : 1;
  const rows = useMemo(() => { const r = []; for (let i = 0; i < filtered.length; i += COLS) r.push(filtered.slice(i, i + COLS)); return r; }, [filtered, COLS]);
  const listRef = useRef(null);
  const virtualizer = useWindowVirtualizer({ count: rows.length, estimateSize: () => 172, overscan: 4, scrollMargin: listRef.current?.offsetTop ?? 0 });
  return (
    <div ref={listRef}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map(vRow => (
          <div key={vRow.index} style={{ position: "absolute", top: vRow.start - virtualizer.options.scrollMargin, left: 0, right: 0, display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 12, paddingBottom: 12 }}>
            {rows[vRow.index].map(e => <EntryCard key={e.id} entry={e} onSelect={setSelected} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VIRTUALISED TIMELINE
   ═══════════════════════════════════════════════════════════════ */
function VirtualTimeline({ sorted, setSelected }) {
  const listRef = useRef(null);
  const virtualizer = useWindowVirtualizer({ count: sorted.length, estimateSize: () => 64, overscan: 5, scrollMargin: listRef.current?.offsetTop ?? 0 });
  return (
    <div ref={listRef} style={{ position: "relative", paddingLeft: 24 }}>
      <div style={{ position: "absolute", left: 10, top: 0, bottom: 0, width: 2, background: "linear-gradient(180deg,#4ECDC4,#FF6B35,#A29BFE)" }} />
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map(vItem => {
          const e = sorted[vItem.index]; const cfg = TC[e.type] || TC.note;
          return (
            <div key={e.id} style={{ position: "absolute", top: vItem.start - virtualizer.options.scrollMargin, left: 0, right: 0, paddingLeft: 20, paddingBottom: 16, cursor: "pointer" }} onClick={() => setSelected(e)}>
              <div style={{ position: "absolute", left: -3, top: 6, width: 12, height: 12, borderRadius: "50%", background: cfg.c, border: "2px solid #0f0f23" }} />
              <p style={{ fontSize: 10, color: "#666", margin: "0 0 2px" }}>{fmtD(e.created_at)}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 14 }}>{cfg.i}</span><span style={{ fontSize: 14, color: "#ddd", fontWeight: 500 }}>{e.title}</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════ */
export default function OpenBrain() {
  const [entries, setEntries] = useState(() => {
    try {
      const cached = localStorage.getItem("openbrain_entries");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.every(e => e && typeof e.id === "string" && typeof e.title === "string")) return parsed;
      }
    } catch {}
    return INITIAL_ENTRIES;
  });
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [view, setView] = useState("grid");
  const [selected, setSelected] = useState(null);
  const [links, setLinks] = useState(LINKS);
  const addLinks = (newLinks) => setLinks(prev => [...prev, ...newLinks]);
  const [apiKey] = useState("configured");
  const [sbKey] = useState("configured");
  const [chatInput, setChatInput] = useState("");
  const [chatMsgs, setChatMsgs] = useState([{ role: "assistant", content: "Hey Chris. Ask me about your memories — \"What's my ID number?\", \"Who are my suppliers?\", etc." }]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const searchDebounceRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  useEffect(() => {
    authFetch("/api/entries")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setEntries(data);
          try { localStorage.setItem("openbrain_entries", JSON.stringify(data)); } catch {}
        }
        setEntriesLoaded(true);
      })
      .catch(() => setEntriesLoaded(true));
  }, []);

  useEffect(() => {
    if (entriesLoaded) { try { localStorage.setItem("openbrain_entries", JSON.stringify(entries)); } catch {} }
  }, [entries, entriesLoaded]);

  const types = useMemo(() => { const t = {}; entries.forEach(e => { t[e.type] = (t[e.type] || 0) + 1; }); return t; }, [entries]);
  const filtered = useMemo(() => {
    let r = entries;
    if (typeFilter !== "all") r = r.filter(e => e.type === typeFilter);
    if (search) { const q = search.toLowerCase(); r = r.filter(e => e.title.toLowerCase().includes(q) || (e.content || "").toLowerCase().includes(q) || e.tags?.some(t => t.includes(q)) || JSON.stringify(e.metadata).toLowerCase().includes(q)); }
    return r;
  }, [search, typeFilter, entries]);
  const sortedTimeline = useMemo(() => [...filtered].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)), [filtered]);

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim(); setChatInput(""); setChatMsgs(p => [...p, { role: "user", content: msg }]); setChatLoading(true);
    try {
      const res = await authFetch("/api/anthropic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: 1000, system: `You are OpenBrain, Chris's memory assistant. Be concise.\n\nMEMORIES:\n${JSON.stringify(entries.slice(0, 100))}\n\nLINKS:\n${JSON.stringify(links)}`, messages: [{ role: "user", content: msg }] }) });
      const data = await res.json();
      setChatMsgs(p => [...p, { role: "assistant", content: data.content?.map(c => c.text || "").join("") || "Couldn't process." }]);
    } catch { setChatMsgs(p => [...p, { role: "assistant", content: "Connection error." }]); }
    setChatLoading(false);
  };

  const navViews = [
    { id: "grid", l: "Grid", ic: "▦" }, { id: "suggest", l: "Fill Brain", ic: "✦" },
    { id: "calendar", l: "Calendar", ic: "📅" }, { id: "todos", l: "Todos", ic: "✓" },
    { id: "timeline", l: "Timeline", ic: "◔" }, { id: "graph", l: "Graph", ic: "◉" },
    { id: "chat", l: "Ask", ic: "◈" }, { id: "settings", l: "Settings", ic: "⚙" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f23", color: "#EAEAEA", fontFamily: "'Söhne', system-ui, -apple-system, sans-serif" }}>
      <div style={{ padding: "20px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #4ECDC4, #45B7D1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧠</div>
          <div><h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>OpenBrain</h1><p style={{ margin: 0, fontSize: 11, color: "#666" }}>Your eternal memory</p></div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <span style={{ fontSize: 11, color: "#555" }}>{entries.length} memories</span>
            {apiKey && <span style={{ display: "block", fontSize: 9, color: "#4ECDC4" }}>AI active</span>}
          </div>
        </div>
      </div>

      <QuickCapture apiKey={apiKey} sbKey={sbKey} entries={entries} setEntries={setEntries} links={links} addLinks={addLinks} />

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1a1a2e", overflowX: "auto", scrollbarWidth: "none" }}>
        {navViews.map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{ flexShrink: 0, minWidth: 72, padding: "10px 8px", border: "none", borderBottom: view === v.id ? "2px solid #4ECDC4" : "2px solid transparent", background: "none", color: view === v.id ? "#4ECDC4" : "#555", fontSize: 10, fontWeight: 600, cursor: "pointer", position: "relative" }}>
            {v.ic} {v.l}
            {v.id === "suggest" && <span style={{ position: "absolute", top: 2, right: "calc(50% - 24px)", width: 5, height: 5, borderRadius: "50%", background: "#FF6B35" }} />}
          </button>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        {view === "grid" && <>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#555" }}>⌕</span>
            <input value={searchInput} onChange={e => { setSearchInput(e.target.value); clearTimeout(searchDebounceRef.current); searchDebounceRef.current = setTimeout(() => setSearch(e.target.value), 200); }} placeholder="Search..." style={{ width: "100%", boxSizing: "border-box", padding: "12px 16px 12px 38px", background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 10, color: "#ddd", fontSize: 14, outline: "none" }} />
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, scrollbarWidth: "none" }}>
            <button onClick={() => setTypeFilter("all")} style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", background: typeFilter === "all" ? "#4ECDC4" : "#1a1a2e", color: typeFilter === "all" ? "#0f0f23" : "#888" }}>All ({entries.length})</button>
            {Object.entries(types).map(([t, n]) => { const c = TC[t] || TC.note; return <button key={t} onClick={() => setTypeFilter(t)} style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", background: typeFilter === t ? c.c : "#1a1a2e", color: typeFilter === t ? "#0f0f23" : "#888" }}>{c.i} {t} ({n})</button>; })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {[{ l: "Memories", v: entries.length, c: "#4ECDC4" }, { l: "Pinned", v: entries.filter(e => e.pinned).length, c: "#FFD700" }, { l: "Types", v: Object.keys(types).length, c: "#A29BFE" }, { l: "Links", v: links.length, c: "#FF6B35" }].map(s =>
              <div key={s.l} style={{ background: "#1a1a2e", borderRadius: 12, padding: "14px 12px", textAlign: "center", border: "1px solid #2a2a4a" }}><div style={{ fontSize: 26, fontWeight: 800, color: s.c }}>{s.v}</div><div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>{s.l}</div></div>
            )}
          </div>
          {filtered.length > 0 ? <VirtualGrid filtered={filtered} setSelected={setSelected} /> : <p style={{ textAlign: "center", color: "#555", marginTop: 40 }}>No memories match.</p>}
        </>}

        {view === "suggest" && <Suspense fallback={<Loader />}><SuggestionsView apiKey={apiKey} sbKey={sbKey} entries={entries} setEntries={setEntries} /></Suspense>}
        {view === "calendar" && <Suspense fallback={<Loader />}><CalendarView entries={entries} /></Suspense>}
        {view === "todos" && <Suspense fallback={<Loader />}><TodoView /></Suspense>}
        {view === "timeline" && <VirtualTimeline sorted={sortedTimeline} setSelected={setSelected} />}
        {view === "graph" && <Suspense fallback={<Loader />}><p style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>Knowledge graph — click nodes to view</p><GraphView onSelect={setSelected} /></Suspense>}

        {view === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 240px)" }}>
            <div style={{ flex: 1, overflow: "auto", marginBottom: 12 }}>
              {chatMsgs.map((m, i) => (
                <div key={i} style={{ marginBottom: 12, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "85%", padding: "12px 16px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? "#4ECDC4" : "#1a1a2e", color: m.role === "user" ? "#0f0f23" : "#ccc", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.content}</div>
                </div>
              ))}
              {chatLoading && <div style={{ display: "flex" }}><div style={{ padding: "12px 16px", borderRadius: "16px 16px 16px 4px", background: "#1a1a2e", color: "#666" }}>Thinking...</div></div>}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleChat()} placeholder="Ask about your memories..." style={{ flex: 1, padding: "12px 16px", background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 12, color: "#ddd", fontSize: 14, outline: "none" }} />
              <button onClick={handleChat} disabled={chatLoading || !apiKey} style={{ padding: "12px 20px", background: apiKey ? "#4ECDC4" : "#1a1a2e", border: "none", borderRadius: 12, color: apiKey ? "#0f0f23" : "#555", fontWeight: 700, cursor: apiKey ? "pointer" : "default", opacity: chatLoading ? 0.5 : 1 }}>→</button>
            </div>
          </div>
        )}

        {view === "settings" && <SettingsView />}
      </div>

      <Suspense fallback={null}>
        <DetailModal entry={selected} onClose={() => setSelected(null)}
          onDelete={async (id) => {
            try { await authFetch("/api/delete-entry", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); } catch {}
            setEntries(prev => prev.filter(e => e.id !== id));
            setSelected(null);
          }}
          onUpdate={async (id, changes) => {
            try {
              const res = await authFetch("/api/update-entry", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...changes }) });
              const data = await res.json().catch(() => null);
              if (!res.ok) throw new Error((data?.message || data?.error) ?? `HTTP ${res.status}`);
              if (Array.isArray(data) && data.length === 0) throw new Error(`No row matched id=${id}`);
            } catch (e) { alert(`Save failed: ${e.message}`); return; }
            setEntries(prev => prev.map(e => e.id === id ? { ...e, ...changes } : e));
            setSelected(prev => prev?.id === id ? { ...prev, ...changes } : prev);
          }}
        />
      </Suspense>
    </div>
  );
}
