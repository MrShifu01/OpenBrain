// @ts-nocheck
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { callAI } from "../lib/ai";
import { aiFetch, getUserModel, getUserApiKey, getGroqKey, getEmbedHeaders } from "../lib/aiFetch";
import { encryptEntry } from "../lib/crypto";
import { authFetch } from "../lib/authFetch";
import { enqueue } from "../lib/offlineQueue";
import { findConnections } from "../lib/connectionFinder";
import { findCandidateMatches } from "../lib/duplicateDetection";
import { TC } from "../data/constants";
import { PROMPTS } from "../config/prompts";
import { isSupportedFile, isTextFile, readTextFile, readFileAsBase64, isCsvFile, parseCsvTransactions } from "../lib/fileParser";
import { shouldSplitContent, buildSplitPrompt, parseAISplitResponse } from "../lib/fileSplitter";

const BRAIN_META_QC = {
  personal: { emoji: "🧠" },
  family: { emoji: "🏠" },
  business: { emoji: "🏪" },
};

// Detects sensitive content that should bypass AI
const SENSITIVE_RE =
  /\b(password|passcode|passphrase|credentials|wifi\s*(key|password)|network\s*key|bank\s*(account|pin|number|detail)|id\s*number|passport\s*number|secret\s*key|secret\s*word|pin\s*number|access\s*code|credit\s*card|cvv|api\s*key|private\s*key|2fa|backup\s*code)\b/i;

function PreviewModal({ preview, entries, onSave, onUpdate, onCancel }) {
  const [title, setTitle] = useState(preview.title || "");
  const [type, setType] = useState(preview.type || "note");
  const [tags, setTags] = useState((preview.tags || []).join(", "));
  const inp =
    "w-full box-border px-3 py-2 bg-ob-bg border border-ob-accent-border rounded-lg text-ob-text-soft text-[13px] outline-none font-[inherit]";
  const dupes = useMemo(() => {
    if (!title.trim()) return [];
    return findCandidateMatches(
      { title, content: preview.content, tags: preview.tags },
      entries,
      40,
    );
  }, [title, entries, preview.content, preview.tags]);
  return (
    <div
      className="fixed inset-0 z-[900] flex items-end justify-center bg-black/80"
      onClick={onCancel}
    >
      <div
        className="bg-ob-surface2 border-ob-accent-border w-full max-w-[600px] rounded-t-[20px] border"
        style={{ padding: "24px 24px 36px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-ob-text-soft text-sm font-bold">Preview before saving</span>
          <button
            onClick={onCancel}
            className="text-ob-text-faint cursor-pointer border-0 bg-transparent text-xl"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-ob-text-dim mb-1 block text-[10px] tracking-widest uppercase">
              Title
            </label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="text-ob-text-dim mb-1 block text-[10px] tracking-widest uppercase">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={`${inp} cursor-pointer`}
            >
              {Object.keys(TC).map((t) => (
                <option key={t} value={t}>
                  {TC[t].i} {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-ob-text-dim mb-1 block text-[10px] tracking-widest uppercase">
              Tags{" "}
              <span className="text-ob-text-faint font-normal normal-case">(comma separated)</span>
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className={inp}
              placeholder="tag1, tag2"
            />
          </div>
        </div>
        {dupes.length > 0 && (
          <div
            className="mt-3.5 rounded-xl border border-[#FFEAA7]/30 bg-[#FFEAA7]/[0.08] p-3.5"
          >
            <p className="text-yellow m-0 mb-1 text-[12px] font-bold">
              Similar entries found — update instead?
            </p>
            <p className="text-ob-text-dim m-0 mb-2.5 text-[11px]">
              This might be an update to an existing entry. Tap "Update" to merge, or scroll down to save as new.
            </p>
            {dupes.map(({ entry: d, score }) => {
              const isAISuggested = preview._suggestedUpdateId === d.id;
              return (
              <div key={d.id} className={`mb-2 flex items-center gap-2 rounded-lg px-3 py-2 ${isAISuggested ? "border-2 border-[#4ECDC4]/50 bg-[#4ECDC4]/[0.08]" : "border border-[#FFEAA7]/20 bg-[#FFEAA7]/[0.04]"}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{TC[d.type]?.i || "📝"}</span>
                    <span className="text-ob-text-mid truncate text-[13px] font-semibold">{d.title}</span>
                    {isAISuggested && (
                      <span className="rounded-full bg-[#4ECDC4]/20 px-1.5 py-px text-[9px] font-bold text-[#4ECDC4]">AI suggested</span>
                    )}
                  </div>
                  {d.content && (
                    <p className="text-ob-text-dim m-0 mt-0.5 truncate text-[11px]">{d.content.slice(0, 80)}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`text-[10px] ${isAISuggested ? "text-[#4ECDC4]" : "text-[#FFEAA7]"}`}>{score}% match</span>
                  <button
                    onClick={() => {
                      onUpdate(d.id, {
                        title: title.trim(),
                        type,
                        tags: tags
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                        content: preview.content,
                        metadata: preview.metadata,
                      });
                      onCancel();
                    }}
                    className={`cursor-pointer rounded-lg px-3 py-1.5 text-[12px] font-bold ${isAISuggested ? "border border-[#4ECDC4]/50 bg-[#4ECDC4]/20 text-[#4ECDC4]" : "border border-[#FFEAA7]/50 bg-[#FFEAA7]/20 text-[#FFEAA7]"}`}
                  >
                    Update
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        )}
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={onCancel}
            className="bg-ob-surface border-ob-border text-ob-text-muted flex-1 cursor-pointer rounded-[10px] border p-3 text-[13px]"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onSave({
                ...preview,
                title: title.trim(),
                type,
                tags: tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
            disabled={!title.trim()}
            className="flex-2 rounded-[10px] border-0 p-3 text-[13px] font-bold"
            style={{
              background: title.trim() ? "linear-gradient(135deg, #4ECDC4, #45B7D1)" : undefined,
              color: title.trim() ? "#0f0f23" : undefined,
              cursor: title.trim() ? "pointer" : "default",
            }}
          >
            Save to OpenBrain
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QuickCapture({
  entries,
  setEntries,
  links,
  addLinks,
  onCreated,
  onUpdate,
  isOnline = true,
  refreshCount,
  brainId,
  brains = [],
  canWrite = true,
  cryptoKey = null,
  onNavigate = null,
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [listening, setListening] = useState(false);
  // Multi-brain: which brains to capture into (primary = first element)
  const [selectedBrainIds, setSelectedBrainIds] = useState(() => (brainId ? [brainId] : []));
  const [multiPreview, setMultiPreview] = useState(null); // array of parsed entries from file split
  const [directMode, setDirectMode] = useState(false); // bypass AI for secrets
  const [directTitle, setDirectTitle] = useState("");
  const [directTags, setDirectTags] = useState("");
  const [fileProgress, setFileProgress] = useState(null); // { current, total, name }
  const imgRef = useRef(null);
  const fileRef = useRef(null);
  const recognitionRef = useRef(null);
  const connectionsTimerRef = useRef(null);
  const lastConnectionsLengthRef = useRef(entries ? entries.length : 0);

  // Keep selection in sync when active brain changes
  useEffect(() => {
    if (brainId) setSelectedBrainIds((prev) => (prev.includes(brainId) ? prev : [brainId]));
  }, [brainId]);

  function toggleBrain(id) {
    setSelectedBrainIds((prev) => {
      if (prev.includes(id)) return prev.length > 1 ? prev.filter((x) => x !== id) : prev;
      return [...prev, id];
    });
  }

  const primaryBrainId = selectedBrainIds[0] || brainId;
  const extraBrainIds = selectedBrainIds.slice(1);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!isOnline) {
      setStatus("offline-image");
      setTimeout(() => setStatus(null), 3000);
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setStatus("img-too-large");
      setTimeout(() => setStatus(null), 3000);
      return;
    }
    setLoading(true);
    setStatus("thinking");
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      // CODE-8: intentional — direct call needed for vision/image processing (multipart content array not supported by callAI wrapper)
      const apiRes = await aiFetch("/api/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: getUserModel(),
          max_tokens: 600,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: file.type, data: base64 } },
                {
                  type: "text",
                  text: "Extract all text from this image. Output just the extracted content, clean and readable. If it's a business card, document, label, or receipt — preserve structure. No commentary.",
                },
              ],
            },
          ],
        }),
      });
      const data = await apiRes.json();
      const extracted = data.content?.[0]?.text?.trim() || "";
      if (extracted) setText(extracted);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
    setStatus(null);
  };

  // Process a single file and return extracted text
  const extractFileText = async (file) => {
    if (isTextFile(file)) {
      return await readTextFile(file);
    }
    // PDF/DOCX: send to AI for text extraction
    const { base64, mimeType } = await readFileAsBase64(file);
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    const contentBlock = isPdf
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        }
      : { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } };

    const apiRes = await aiFetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: getUserModel(),
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              contentBlock,
              {
                type: "text",
                text: "Extract ALL text from this document. Preserve structure, headings, lists. Output just the extracted content, clean and readable. No commentary.",
              },
            ],
          },
        ],
      }),
    });
    const data = await apiRes.json();
    return data.content?.[0]?.text?.trim() || "";
  };

  // Process a single file through the split/capture pipeline, returning parsed entries
  const processFileToEntries = async (file) => {
    // CSV bank statement detection
    if (isCsvFile(file)) {
      const csvText = await readTextFile(file);
      const transactions = parseCsvTransactions(csvText);
      if (transactions.length > 0) {
        // Convert transactions to entries — use AI to batch-categorize
        const txSummary = transactions.slice(0, 50).map((tx) =>
          `${tx.date} | ${tx.description} | ${tx.amount}`
        ).join("\n");

        try {
          const catRes = await callAI({
            system: `You categorize bank transactions. Given a list of transactions (date | description | amount), return a JSON array with one category per transaction. Categories: groceries, dining, transport, utilities, entertainment, health, shopping, salary, transfer, fees, insurance, rent, other. Return ONLY a JSON array of strings, same length as input. Example: ["groceries","dining","transport"]`,
            max_tokens: 1000,
            messages: [{ role: "user", content: txSummary }],
          });
          const catData = await catRes.json();
          let categories = [];
          try {
            categories = JSON.parse((catData.content?.[0]?.text || "[]").replace(/```json|```/g, "").trim());
          } catch {}

          return transactions.slice(0, 50).map((tx, i) => ({
            title: tx.description.slice(0, 60) || `Transaction ${tx.date}`,
            content: `${tx.date} — ${tx.description}. Amount: ${tx.amount}${tx.balance ? `. Balance: ${tx.balance}` : ""}`,
            type: "note",
            tags: [categories[i] || "uncategorized", "finance", "transaction"],
            metadata: {
              amount: tx.amount,
              transaction_date: tx.date,
              category: categories[i] || "uncategorized",
            },
          }));
        } catch {
          // Fallback: no AI categorization
          return transactions.slice(0, 50).map((tx) => ({
            title: tx.description.slice(0, 60) || `Transaction ${tx.date}`,
            content: `${tx.date} — ${tx.description}. Amount: ${tx.amount}${tx.balance ? `. Balance: ${tx.balance}` : ""}`,
            type: "note",
            tags: ["finance", "transaction"],
            metadata: { amount: tx.amount, transaction_date: tx.date },
          }));
        }
      }
      // Not a bank statement CSV — fall through to normal text processing
    }

    const extractedText = await extractFileText(file);
    if (!extractedText) return [];

    if (shouldSplitContent(extractedText)) {
      const brainType = brains.find((b) => b.id === primaryBrainId)?.type || "personal";
      const splitRes = await callAI({
        max_tokens: 4000,
        system: PROMPTS.FILE_SPLIT,
        messages: [{ role: "user", content: buildSplitPrompt(extractedText, brainType) }],
      });
      const splitData = await splitRes.json();
      const raw = splitData.content?.[0]?.text || "[]";
      const parsedEntries = parseAISplitResponse(raw);
      if (parsedEntries.length > 0) return parsedEntries;
    }

    // Single entry fallback: classify via AI
    const res = await callAI({
      system: PROMPTS.CAPTURE,
      max_tokens: 800,
      messages: [{ role: "user", content: extractedText }],
    });
    const data = await res.json();
    try {
      const parsed = JSON.parse((data.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim());
      if (parsed.title) return [parsed];
    } catch {}
    return [{ title: file.name.replace(/\.[^.]+$/, ""), content: extractedText, type: "note", tags: [], metadata: {} }];
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";

    if (!isOnline) {
      setStatus("offline-image");
      setTimeout(() => setStatus(null), 3000);
      return;
    }

    // Validate all files
    const unsupported = files.filter((f) => !isSupportedFile(f));
    if (unsupported.length === files.length) {
      setStatus("unsupported-file");
      setTimeout(() => setStatus(null), 3000);
      return;
    }
    const tooLarge = files.filter((f) => f.size > 10 * 1024 * 1024);
    if (tooLarge.length > 0) {
      setStatus("file-too-large");
      setTimeout(() => setStatus(null), 3000);
      return;
    }

    const validFiles = files.filter((f) => isSupportedFile(f) && f.size <= 10 * 1024 * 1024);

    // Single file: use original flow (show preview)
    if (validFiles.length === 1) {
      const file = validFiles[0];
      setLoading(true);
      setStatus("reading-file");

      // CSV bank statement: parse and show multi-entry preview
      if (isCsvFile(file)) {
        try {
          const parsed = await processFileToEntries(file);
          setLoading(false);
          if (parsed.length > 0) {
            setStatus(null);
            setMultiPreview(parsed);
          } else {
            setStatus("file-empty");
            setTimeout(() => setStatus(null), 3000);
          }
        } catch (err) {
          console.error("[csvUpload] error:", err);
          setStatus("error");
          setLoading(false);
          setTimeout(() => setStatus(null), 3000);
        }
        return;
      }

      try {
        const extractedText = await extractFileText(file);
        if (!extractedText) {
          setStatus("file-empty");
          setTimeout(() => setStatus(null), 3000);
          setLoading(false);
          return;
        }
        if (shouldSplitContent(extractedText)) {
          setStatus("splitting");
          const brainType = brains.find((b) => b.id === primaryBrainId)?.type || "personal";
          const splitRes = await callAI({
            max_tokens: 4000,
            system: PROMPTS.FILE_SPLIT,
            messages: [{ role: "user", content: buildSplitPrompt(extractedText, brainType) }],
          });
          const splitData = await splitRes.json();
          const raw = splitData.content?.[0]?.text || "[]";
          const parsedEntries = parseAISplitResponse(raw);
          if (parsedEntries.length > 1) {
            setLoading(false);
            setStatus(null);
            setMultiPreview(parsedEntries);
            return;
          } else if (parsedEntries.length === 1) {
            setLoading(false);
            setStatus(null);
            setPreview({ ...parsedEntries[0], _raw: extractedText });
            return;
          }
        }
        setText(extractedText);
      } catch (err) {
        console.error("[fileUpload] error:", err);
        setStatus("error");
      }
      setLoading(false);
      setTimeout(() => setStatus(null), 3000);
      return;
    }

    // Multi-file: process sequentially, collect all parsed entries, show preview
    setLoading(true);
    const allEntries = [];
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setFileProgress({ current: i + 1, total: validFiles.length, name: file.name });
      setStatus("reading-file");
      try {
        const parsed = await processFileToEntries(file);
        allEntries.push(...parsed);
      } catch (err) {
        console.error(`[multiFileUpload] error on ${file.name}:`, err);
      }
    }
    setFileProgress(null);
    setLoading(false);

    if (allEntries.length > 0) {
      setStatus(null);
      setMultiPreview(allEntries);
    } else {
      setStatus("file-empty");
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const saveMultiEntries = async (entriesToSave) => {
    setMultiPreview(null);
    setLoading(true);
    setStatus("saving");
    let savedCount = 0;
    for (const parsed of entriesToSave) {
      try {
        const captureHeaders = {
          "Content-Type": "application/json",
          ...(parsed.type !== "secret" ? getEmbedHeaders() || {} : {}),
        };
        const rpcRes = await authFetch("/api/capture", {
          method: "POST",
          headers: captureHeaders,
          body: JSON.stringify({
            p_title: parsed.title,
            p_content: parsed.content || "",
            p_type: parsed.type || "note",
            p_metadata: parsed.metadata || {},
            p_tags: parsed.tags || [],
            p_brain_id: primaryBrainId,
            p_extra_brain_ids: extraBrainIds,
          }),
        });
        if (rpcRes.ok) {
          const result = await rpcRes.json();
          const newEntry = {
            id: result?.id || Date.now().toString() + savedCount,
            ...parsed,
            pinned: false,
            importance: 0,
            tags: parsed.tags || [],
            created_at: new Date().toISOString(),
          };
          setEntries((prev) => [newEntry, ...prev]);
          onCreated?.(newEntry);
          savedCount++;
        }
      } catch (err) {
        console.error("[multiSave] error:", err);
      }
    }
    setStatus(savedCount > 0 ? "saved-db" : "error");
    setLoading(false);
    setTimeout(() => setStatus(null), 3000);
  };

  // Whisper recording state
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const _startSpeechRecognitionFallback = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setText((prev) => prev + " [Voice not supported in this browser]");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-ZA";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;
    let silenceTimer = null;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setText(transcript);
      clearTimeout(silenceTimer);
      if (event.results[event.results.length - 1].isFinal) {
        silenceTimer = setTimeout(() => recognition.stop(), 2000);
      }
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.start();
    setListening(true);
  }, [listening]);

  // Stop an active MediaRecorder recording and send to Whisper
  const stopWhisperRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    recorder.stop(); // triggers ondataavailable + onstop
  }, []);

  const startVoice = useCallback(async () => {
    // If already recording with Whisper, stop
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      stopWhisperRecording();
      return;
    }
    // If already using SpeechRecognition, stop
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const groqKey = getGroqKey();
    const openAIKey = getUserApiKey();
    const hasTranscription = !!groqKey || !!openAIKey;

    if (!hasTranscription) {
      // Fall back to browser SpeechRecognition
      _startSpeechRecognitionFallback();
      return;
    }

    // Use MediaRecorder + Whisper/Groq
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine supported MIME type — iOS only supports mp4/m4a
      let mimeType = "audio/mp4"; // safe default for iOS
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus"))
        mimeType = "audio/webm;codecs=opus";
      else if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";
      else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
      else if (MediaRecorder.isTypeSupported("audio/aac")) mimeType = "audio/aac";
      else if (MediaRecorder.isTypeSupported("audio/mpeg")) mimeType = "audio/mpeg";

      const recorder = new MediaRecorder(
        stream,
        mimeType !== "audio/mp4" ? { mimeType } : undefined,
      );
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); // release mic
        setListening(false);

        // Use the recorder's actual mimeType (iOS may override what we requested)
        const actualMime = recorder.mimeType || mimeType;
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;

        if (blob.size < 1000) return; // too short — skip

        setLoading(true);
        setStatus("thinking");
        try {
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const transcribeHeaders = { "Content-Type": "application/json" };
          if (groqKey) transcribeHeaders["X-Groq-Api-Key"] = groqKey;
          if (openAIKey) transcribeHeaders["X-User-Api-Key"] = openAIKey;
          const transcribeRes = await authFetch("/api/transcribe", {
            method: "POST",
            headers: transcribeHeaders,
            body: JSON.stringify({ audio: base64, mimeType: actualMime, language: "en" }),
          });

          if (transcribeRes.ok) {
            const { text } = await transcribeRes.json();
            if (text?.trim()) setText((prev) => (prev ? `${prev} ${text.trim()}` : text.trim()));
          } else {
            console.warn("[Whisper] transcription failed:", transcribeRes.status);
            setText((prev) => prev + " [Transcription failed — try again]");
          }
        } catch (err) {
          console.error("[Whisper] error:", err);
          setText((prev) => prev + " [Voice error — check console]");
        }
        setLoading(false);
        setStatus(null);
      };

      recorder.start(1000); // timeslice 1s — ensures ondataavailable fires on iOS
      setListening(true);
    } catch (err) {
      console.warn("[Voice] mic error:", err.message);
      // Show error to user instead of silently failing
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setText((prev) => (prev ? prev : ""));
        setStatus("mic-denied");
        setTimeout(() => setStatus(null), 3000);
      } else {
        // Try browser speech recognition as last resort
        _startSpeechRecognitionFallback();
      }
    }
  }, [listening, _startSpeechRecognitionFallback, stopWhisperRecording]);

  const doSave = useCallback(
    async (parsed) => {
      setPreview(null);
      setLoading(true);
      setStatus("saving");
      try {
        if (parsed.title) {
          if (!isOnline) {
            const tempId = Date.now().toString();
            const newEntry = {
              id: tempId,
              title: parsed.title,
              content: parsed.content || "",
              type: parsed.type || "note",
              metadata: parsed.metadata || {},
              pinned: false,
              importance: 0,
              tags: parsed.tags || [],
              created_at: new Date().toISOString(),
            };
            await enqueue({
              id: crypto.randomUUID(),
              url: "/api/capture",
              method: "POST",
              body: JSON.stringify({
                p_title: parsed.title,
                p_content: parsed.content || "",
                p_type: parsed.type || "note",
                p_metadata: parsed.metadata || {},
                p_tags: parsed.tags || [],
              }),
              created_at: new Date().toISOString(),
              tempId,
            });
            refreshCount?.();
            setEntries((prev) => [newEntry, ...prev]);
            onCreated?.(newEntry);
            setStatus("saved-local");
          } else {
            // E2E: encrypt content & metadata for secret entries before sending to server
            const isSecret = (parsed.type || "note") === "secret";
            if (isSecret && !cryptoKey) {
              setStatus("vault-needed");
              setLoading(false);
              return;
            }
            let serverContent = parsed.content || "";
            let serverMetadata = parsed.metadata || {};
            if (isSecret && cryptoKey) {
              const encrypted = await encryptEntry(
                { content: serverContent, metadata: serverMetadata },
                cryptoKey,
              );
              serverContent = encrypted.content;
              serverMetadata = encrypted.metadata;
            }
            const captureHeaders = {
              "Content-Type": "application/json",
              ...(isSecret ? {} : getEmbedHeaders() || {}),
            };
            const rpcRes = await authFetch("/api/capture", {
              method: "POST",
              headers: captureHeaders,
              body: JSON.stringify({
                p_title: parsed.title,
                p_content: serverContent,
                p_type: parsed.type || "note",
                p_metadata: serverMetadata,
                p_tags: parsed.tags || [],
                p_brain_id: primaryBrainId,
                p_extra_brain_ids: extraBrainIds,
              }),
            });
            if (rpcRes.ok) {
              const result = await rpcRes.json();
              const newEntry = {
                id: result?.id || Date.now().toString(),
                title: parsed.title,
                content: parsed.content || "",
                type: parsed.type || "note",
                metadata: parsed.metadata || {},
                pinned: false,
                importance: 0,
                tags: parsed.tags || [],
                created_at: new Date().toISOString(),
              };
              setEntries((prev) => [newEntry, ...prev]);
              onCreated?.(newEntry);
              setStatus("saved-db");
              // Embedding now handled server-side in /api/capture
              // PERF-6: debounce findConnections by 5 s; skip during bulk import
              // (heuristic: if entries grew by more than 3 since last run, it's a bulk import)
              const currentLength = entries.length;
              const delta = currentLength - lastConnectionsLengthRef.current;
              lastConnectionsLengthRef.current = currentLength + 1; // +1 for the entry being saved
              if (delta <= 3) {
                clearTimeout(connectionsTimerRef.current);
                const entrySnapshot = newEntry;
                const entriesSnapshot = entries;
                const linksSnapshot = links || [];
                connectionsTimerRef.current = setTimeout(() => {
                  findConnections(
                    entrySnapshot,
                    entriesSnapshot,
                    linksSnapshot,
                    primaryBrainId,
                  ).then((newLinks) => {
                    if (newLinks.length === 0) return;
                    addLinks?.(newLinks);
                    authFetch("/api/save-links", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ links: newLinks }),
                    }).catch((err) =>
                      console.error("[QuickCapture:findConnections] Failed to save links", err),
                    );
                  });
                }, 5000);
              }
            } else {
              console.warn("[doSave] API returned non-ok, queuing for retry:", rpcRes.status);
              const tempId = Date.now().toString();
              const newEntry = {
                id: tempId,
                ...parsed,
                pinned: false,
                importance: 0,
                tags: parsed.tags || [],
                created_at: new Date().toISOString(),
              };
              await enqueue({
                id: crypto.randomUUID(),
                url: "/api/capture",
                method: "POST",
                body: JSON.stringify({
                  p_title: parsed.title,
                  p_content: parsed.content || "",
                  p_type: parsed.type || "note",
                  p_metadata: parsed.metadata || {},
                  p_tags: parsed.tags || [],
                }),
                created_at: new Date().toISOString(),
                tempId,
              });
              refreshCount?.();
              setEntries((prev) => [newEntry, ...prev]);
              onCreated?.(newEntry);
              setStatus("error");
            }
          }
        }
      } catch (e) {
        console.error(e);
        setStatus("error");
      }
      setLoading(false);
      setTimeout(() => setStatus(null), 3000);
    },
    [
      entries,
      links,
      addLinks,
      onCreated,
      setEntries,
      isOnline,
      refreshCount,
      primaryBrainId,
      extraBrainIds,
    ],
  );

  const capture = async () => {
    if (!text.trim()) return;
    const input = text.trim();
    setText("");
    setLoading(true);
    setStatus("thinking");
    if (!isOnline) {
      const tempId = Date.now().toString();
      const newEntry = {
        id: tempId,
        title: input.slice(0, 60),
        content: input,
        type: "note",
        metadata: {},
        pinned: false,
        importance: 0,
        tags: [],
        created_at: new Date().toISOString(),
      };
      await enqueue({
        id: crypto.randomUUID(),
        type: "raw-capture",
        anthropicRequest: {
          model: getUserModel(),
          max_tokens: 800,
          system: PROMPTS.CAPTURE,
          messages: [{ role: "user", content: input }],
        },
        tempId,
        created_at: new Date().toISOString(),
      });
      refreshCount?.();
      setEntries((prev) => [newEntry, ...prev]);
      onCreated?.(newEntry);
      setStatus("saved-local");
      setLoading(false);
      setTimeout(() => setStatus(null), 3000);
      return;
    }
    try {
      // Build context of existing entries so AI can flag updates
      const recentEntries = entries.slice(0, 30).map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        tags: e.tags?.slice(0, 5),
      }));
      const contextSuffix = recentEntries.length > 0
        ? `\n\nEXISTING ENTRIES:\n${JSON.stringify(recentEntries)}`
        : "";

      const res = await callAI({
        system: PROMPTS.CAPTURE,
        max_tokens: 800,
        messages: [{ role: "user", content: input + contextSuffix }],
      });
      const data = await res.json();
      let parsed = {};
      try {
        parsed = JSON.parse((data.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim());
      } catch {}
      if (parsed.title) {
        setLoading(false);
        setStatus(null);
        // If AI flagged an update_id, pre-select that entry in the preview
        setPreview({ ...parsed, _raw: input, _suggestedUpdateId: parsed.update_id || null });
        return;
      }
      const newEntry = {
        id: Date.now().toString(),
        title: input.slice(0, 60),
        content: input,
        type: "note",
        metadata: {},
        pinned: false,
        importance: 0,
        tags: [],
        created_at: new Date().toISOString(),
      };
      setEntries((prev) => [newEntry, ...prev]);
      onCreated?.(newEntry);
      setStatus("saved-raw");
    } catch (e) {
      console.error("[capture] API error, queuing for retry:", e);
      const tempId = Date.now().toString();
      const newEntry = {
        id: tempId,
        title: input.slice(0, 60),
        content: input,
        type: "note",
        metadata: {},
        pinned: false,
        importance: 0,
        tags: [],
        created_at: new Date().toISOString(),
      };
      await enqueue({
        id: crypto.randomUUID(),
        type: "raw-capture",
        anthropicRequest: {
          model: getUserModel(),
          max_tokens: 800,
          system: PROMPTS.CAPTURE,
          messages: [{ role: "user", content: input }],
        },
        tempId,
        created_at: new Date().toISOString(),
      });
      refreshCount?.();
      setEntries((prev) => [newEntry, ...prev]);
      onCreated?.(newEntry);
      setStatus("error");
    }
    setLoading(false);
    setTimeout(() => setStatus(null), 3000);
  };

  const statusMsg = {
    thinking: "🤖 Parsing...",
    saving: "💾 Saving...",
    "saved-db": "✅ Saved & synced!",
    "saved-local": "📡 Saved — will sync when online",
    "saved-raw": "📝 Saved",
    error: "⚠️ Sync failed — queued for retry",
    "offline-image": "📵 Uploads need a connection",
    "img-too-large": "⚠️ Photo too large — try a smaller image",
    "file-too-large": "⚠️ File too large — max 10MB",
    "unsupported-file": "⚠️ Unsupported file type — use .txt, .md, .csv, .pdf, or .docx",
    "reading-file": "📄 Reading file...",
    splitting: "✂️ Splitting into entries...",
    "file-empty": "⚠️ Could not extract text from file",
    "vault-needed": "🔐 Set up your Vault first to save secrets",
    "mic-denied": "🎤 Microphone access denied — check your browser/phone settings",
    "direct-saved": "🛡️ Saved securely — AI never saw this data",
  };

  // Auto-detect sensitive input and suggest direct mode
  const textLooksSensitive = SENSITIVE_RE.test(text);

  const saveDirectEntry = async () => {
    const title = directTitle.trim();
    const content = text.trim();
    if (!title) return;
    setLoading(true);
    setStatus("saving");
    try {
      const parsed = {
        title,
        content,
        type: "secret",
        tags: directTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        metadata: {},
      };
      // Encrypt locally — AI never sees this
      if (!cryptoKey) {
        setStatus("vault-needed");
        setLoading(false);
        return;
      }
      const encrypted = await encryptEntry(
        { content: parsed.content, metadata: parsed.metadata },
        cryptoKey,
      );
      const rpcRes = await authFetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          p_title: parsed.title,
          p_content: encrypted.content,
          p_type: "secret",
          p_metadata: encrypted.metadata,
          p_tags: parsed.tags,
          p_brain_id: primaryBrainId,
          p_extra_brain_ids: extraBrainIds,
        }),
      });
      if (rpcRes.ok) {
        const result = await rpcRes.json();
        const newEntry = {
          id: result?.id || Date.now().toString(),
          ...parsed,
          pinned: false,
          importance: 0,
          created_at: new Date().toISOString(),
        };
        setEntries((prev) => [newEntry, ...prev]);
        onCreated?.(newEntry);
        setText("");
        setDirectTitle("");
        setDirectTags("");
        setDirectMode(false);
        setStatus("direct-saved");
      } else {
        setStatus("error");
      }
    } catch (e) {
      console.error("[directSave]", e);
      setStatus("error");
    }
    setLoading(false);
    setTimeout(() => setStatus(null), 3000);
  };

  if (!canWrite) {
    return (
      <div className="bg-ob-surface border-ob-border mx-3 mb-3 flex items-center gap-2.5 rounded-xl border px-4 py-3">
        <span className="text-lg">🔒</span>
        <span className="text-ob-text-dim text-[13px]">
          You have view-only access to this brain
        </span>
      </div>
    );
  }

  return (
    <div className="px-3 pb-2">
      <div className="flex items-center gap-1.5">
        <input
          type="file"
          accept="image/*"
          ref={imgRef}
          onChange={handleImageUpload}
          className="hidden"
        />
        <input
          type="file"
          accept=".txt,.md,.csv,.pdf,.docx,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          ref={fileRef}
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && capture()}
          disabled={loading}
          aria-label="Quick capture input"
          placeholder={
            listening
              ? "Listening..."
              : loading
                ? "Processing..."
                : "Quick capture — just type anything..."
          }
          className={`min-w-0 flex-1 rounded-[10px] border px-3.5 py-2.5 text-sm font-[inherit] text-ob-text-soft outline-none ${
            listening
              ? "border-whisper/25 bg-[#1a2e1a]"
              : "border-ob-border bg-ob-surface"
          } ${loading ? "opacity-50" : ""}`}
        />
        <button
          onClick={startVoice}
          disabled={loading}
          aria-label="Voice capture"
          title="Voice capture"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border p-0 text-base ${
            listening
              ? "border-whisper/25 bg-whisper/[0.12] text-whisper"
              : "border-ob-border bg-ob-surface text-ob-text-muted"
          } ${loading ? "cursor-default" : "cursor-pointer"}`}
        >
          🎤
        </button>
        <button
          onClick={() => imgRef.current?.click()}
          disabled={loading}
          aria-label="Photo capture"
          title="Photo capture"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-ob-border bg-ob-surface p-0 text-base ${
            loading ? "cursor-default text-ob-text-dim" : "cursor-pointer text-ob-text-muted"
          }`}
        >
          📷
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          aria-label="Upload files"
          title="Upload files (PDF, Word, MD, TXT, CSV — multi-select supported)"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-ob-border bg-ob-surface p-0 text-base ${
            loading ? "cursor-default text-ob-text-dim" : "cursor-pointer text-ob-text-muted"
          }`}
        >
          📄
        </button>
        <button
          onClick={capture}
          disabled={loading || !text.trim()}
          aria-label="Save entry"
          title={`Save to ${(BRAIN_META_QC[brains[0]?.type] || BRAIN_META_QC.personal).emoji} ${brains[0]?.name || "brain"}`}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border-none p-0 text-lg font-bold ${
            text.trim() && !loading
              ? "gradient-accent cursor-pointer text-[#0f0f23]"
              : "bg-ob-surface cursor-default text-ob-text-faint"
          }`}
        >
          +
        </button>
      </div>
      {status && (
        <div className="mt-1.5 ml-1 flex items-center gap-2">
          <p
            className={`m-0 text-[11px] ${
              status === "vault-needed"
                ? "text-red"
                : status.includes("error")
                  ? "text-orange"
                  : "text-teal"
            }`}
          >
            {statusMsg[status]}
          </p>
          {status === "vault-needed" && onNavigate && (
            <button
              onClick={() => {
                onNavigate("vault");
                setStatus(null);
              }}
              className="cursor-pointer rounded-md border border-red/25 bg-red/[0.12] px-2.5 py-0.5 text-[11px] font-semibold text-red"
            >
              Open Vault
            </button>
          )}
        </div>
      )}
      {/* Multi-file progress */}
      {fileProgress && (
        <div className="mx-0 mt-2 flex items-center gap-2 rounded-[10px] border border-[#4ECDC4]/30 bg-[#4ECDC4]/[0.08] px-3 py-2">
          <span className="text-sm">📄</span>
          <span className="text-[11px] text-[#4ECDC4]">
            Processing file {fileProgress.current} of {fileProgress.total}
          </span>
          <span className="text-ob-text-dim truncate text-[11px]">{fileProgress.name}</span>
        </div>
      )}
      {/* Sensitive content banner — suggest direct mode */}
      {textLooksSensitive && !directMode && !loading && text.trim() && (
        <div
          className="mx-0 mt-2 flex items-center gap-2 rounded-[10px] border border-[#FF4757]/30 bg-[#FF4757]/[0.08] px-3 py-2"
        >
          <span className="text-sm">🛡️</span>
          <span className="text-[11px] text-[#FF6B81]">
            This looks sensitive. Save directly without AI?
          </span>
          <button
            onClick={() => setDirectMode(true)}
            className="ml-auto cursor-pointer rounded-md border border-[#FF4757]/40 bg-[#FF4757]/20 px-2.5 py-1 text-[11px] font-semibold text-[#FF4757]"
          >
            Direct Entry
          </button>
        </div>
      )}
      {/* Direct entry form — bypasses AI completely */}
      {directMode && (
        <div className="mt-2 rounded-xl border border-[#FF4757]/25 bg-[#FF4757]/[0.04] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🛡️</span>
              <span className="text-[12px] font-bold text-[#FF4757]">Direct Entry — AI bypassed</span>
            </div>
            <button
              onClick={() => setDirectMode(false)}
              className="text-ob-text-faint cursor-pointer border-none bg-transparent text-sm"
            >
              ✕
            </button>
          </div>
          <p className="text-ob-text-dim m-0 mb-3 text-[11px]">
            This data stays on your device. It will be encrypted and saved without being sent to any AI.
          </p>
          <div className="flex flex-col gap-2.5">
            <input
              value={directTitle}
              onChange={(e) => setDirectTitle(e.target.value)}
              placeholder="Title (e.g. WiFi Password, Bank PIN)"
              className="bg-ob-bg border-ob-border text-ob-text-soft box-border w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Secret content (password, number, etc.)"
              rows={3}
              className="bg-ob-bg border-ob-border text-ob-text-soft box-border w-full resize-none rounded-lg border px-3 py-2 font-mono text-[13px] outline-none"
            />
            <input
              value={directTags}
              onChange={(e) => setDirectTags(e.target.value)}
              placeholder="Tags (comma separated, e.g. wifi, home)"
              className="bg-ob-bg border-ob-border text-ob-text-soft box-border w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                setDirectMode(false);
                setDirectTitle("");
                setDirectTags("");
              }}
              className="bg-ob-surface border-ob-border text-ob-text-muted flex-1 cursor-pointer rounded-[10px] border p-2.5 text-[13px]"
            >
              Cancel
            </button>
            <button
              onClick={saveDirectEntry}
              disabled={loading || !directTitle.trim() || !cryptoKey}
              className="flex-2 cursor-pointer rounded-[10px] border-0 p-2.5 text-[13px] font-bold"
              style={{
                background: directTitle.trim() && cryptoKey ? "linear-gradient(135deg, #FF4757, #FF6B81)" : undefined,
                color: directTitle.trim() && cryptoKey ? "#fff" : undefined,
                opacity: !directTitle.trim() || !cryptoKey ? 0.5 : 1,
              }}
            >
              🔐 Save to Vault
            </button>
          </div>
          {!cryptoKey && (
            <p className="m-0 mt-2 text-[11px] text-[#FF4757]">
              Unlock your vault first to save secrets.
              {onNavigate && (
                <button
                  onClick={() => onNavigate("vault")}
                  className="ml-1 cursor-pointer border-none bg-transparent text-[11px] font-semibold text-[#FF4757] underline"
                >
                  Open Vault
                </button>
              )}
            </p>
          )}
        </div>
      )}
      {preview && (
        <PreviewModal
          preview={preview}
          entries={entries}
          onSave={doSave}
          onUpdate={onUpdate}
          onCancel={() => setPreview(null)}
        />
      )}
      {multiPreview && (
        <div
          className="fixed inset-0 z-[900] flex items-end justify-center bg-black/80"
          onClick={() => setMultiPreview(null)}
        >
          <div
            className="bg-ob-surface2 border-ob-accent-border max-h-[80vh] w-full max-w-[600px] overflow-y-auto rounded-t-[20px] border"
            style={{ padding: "24px 24px 36px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-ob-text-soft text-sm font-bold">
                ✂️ {multiPreview.length} entries found in file
              </span>
              <button
                onClick={() => setMultiPreview(null)}
                className="text-ob-text-faint cursor-pointer border-0 bg-transparent text-xl"
              >
                ✕
              </button>
            </div>
            <p className="text-ob-text-dim m-0 mb-4 text-xs">
              Review the entries extracted from your file. Remove any you don't want, then save all.
            </p>
            {multiPreview.map((entry, i) => (
              <div
                key={i}
                className="bg-ob-bg border-ob-border relative mb-2 rounded-[10px] border px-3.5 py-3"
              >
                <button
                  onClick={() => setMultiPreview((prev) => prev.filter((_, j) => j !== i))}
                  className="text-orange absolute top-2 right-2 cursor-pointer border-0 bg-transparent p-1 text-sm"
                  title="Remove"
                >
                  ✕
                </button>
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-sm">{TC[entry.type]?.i || "📝"}</span>
                  <span className="text-ob-text-soft text-xs font-bold">{entry.title}</span>
                  <span className="text-ob-text-dim bg-ob-surface rounded-lg px-1.5 py-px text-[10px]">
                    {entry.type}
                  </span>
                </div>
                <p className="text-ob-text-muted m-0 text-[11px] leading-snug">
                  {(entry.content || "").slice(0, 150)}
                  {(entry.content || "").length > 150 ? "…" : ""}
                </p>
                {entry.tags?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-teal/5 text-teal rounded-lg px-1.5 py-px text-[9px]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="mt-4 flex gap-2.5">
              <button
                onClick={() => setMultiPreview(null)}
                className="bg-ob-surface border-ob-border text-ob-text-muted flex-1 cursor-pointer rounded-[10px] border p-3 text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMultiEntries(multiPreview)}
                disabled={multiPreview.length === 0}
                className="flex-2 rounded-[10px] border-0 p-3 text-[13px] font-bold"
                style={{
                  background:
                    multiPreview.length > 0
                      ? "linear-gradient(135deg, #4ECDC4, #45B7D1)"
                      : undefined,
                  color: multiPreview.length > 0 ? "#0f0f23" : undefined,
                  cursor: multiPreview.length > 0 ? "pointer" : "default",
                }}
              >
                Save {multiPreview.length} entries to OpenBrain
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

