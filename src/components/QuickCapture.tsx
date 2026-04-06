// @ts-nocheck
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { useTheme } from "../ThemeContext";
import { callAI } from "../lib/ai";
import { aiFetch, getUserModel, getUserApiKey, getGroqKey, getEmbedHeaders } from "../lib/aiFetch";
import { encryptEntry } from "../lib/crypto";
import { authFetch } from "../lib/authFetch";
import { enqueue } from "../lib/offlineQueue";
import { findConnections, scoreTitle } from "../lib/connectionFinder";
import { TC } from "../data/constants";
import { PROMPTS } from "../config/prompts";
import { isSupportedFile, isTextFile, readTextFile, readFileAsBase64 } from "../lib/fileParser";
import { shouldSplitContent, buildSplitPrompt, parseAISplitResponse } from "../lib/fileSplitter";

const BRAIN_META_QC = {
  personal: { emoji: "🧠" },
  family: { emoji: "🏠" },
  business: { emoji: "🏪" },
};

function PreviewModal({ preview, entries, onSave, onUpdate, onCancel }) {
  const { t } = useTheme();
  const [title, setTitle] = useState(preview.title || "");
  const [type, setType] = useState(preview.type || "note");
  const [tags, setTags] = useState((preview.tags || []).join(", "));
  const inp =
    "w-full box-border px-3 py-2 bg-ob-bg border border-ob-accent-border rounded-lg text-ob-text-soft text-[13px] outline-none font-[inherit]";
  const dupes = useMemo(() => {
    if (!title.trim()) return [];
    return entries.filter((e) => scoreTitle(title, e.title) > 50).slice(0, 3);
  }, [title, entries]);
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
            className="mt-3.5 rounded-[10px]"
            style={{ padding: "10px 14px", background: "#FFEAA710", border: "1px solid #FFEAA730" }}
          >
            <p className="text-yellow m-0 mb-2 text-[11px] font-bold">
              ⚠ Similar entries found — update one instead?
            </p>
            {dupes.map((d) => (
              <div key={d.id} className="mb-1 flex items-center justify-between">
                <span className="text-ob-text-mid text-xs">• {d.title}</span>
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
                  className="text-yellow cursor-pointer rounded-md px-2 py-[3px] text-[11px]"
                  style={{ background: "#FFEAA720", border: "1px solid #FFEAA750" }}
                >
                  Update this
                </button>
              </div>
            ))}
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
  const { t } = useTheme();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [listening, setListening] = useState(false);
  // Multi-brain: which brains to capture into (primary = first element)
  const [selectedBrainIds, setSelectedBrainIds] = useState(() => (brainId ? [brainId] : []));
  const [multiPreview, setMultiPreview] = useState(null); // array of parsed entries from file split
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!isOnline) {
      setStatus("offline-image");
      setTimeout(() => setStatus(null), 3000);
      return;
    }
    if (!isSupportedFile(file)) {
      setStatus("unsupported-file");
      setTimeout(() => setStatus(null), 3000);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatus("file-too-large");
      setTimeout(() => setStatus(null), 3000);
      return;
    }
    setLoading(true);
    setStatus("reading-file");

    try {
      let extractedText = "";

      if (isTextFile(file)) {
        // Text files: read directly
        extractedText = await readTextFile(file);
      } else {
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
        extractedText = data.content?.[0]?.text?.trim() || "";
      }

      if (!extractedText) {
        setStatus("file-empty");
        setTimeout(() => setStatus(null), 3000);
        setLoading(false);
        return;
      }

      // Check if content should be split into multiple entries
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
        const entries = parseAISplitResponse(raw);

        if (entries.length > 1) {
          // Show multi-entry preview
          setLoading(false);
          setStatus(null);
          setMultiPreview(entries);
          return;
        } else if (entries.length === 1) {
          // Single entry — show normal preview
          setLoading(false);
          setStatus(null);
          setPreview({ ...entries[0], _raw: extractedText });
          return;
        }
      }

      // Fallback: use normal capture flow with extracted text
      setText(extractedText);
    } catch (err) {
      console.error("[fileUpload] error:", err);
      setStatus("error");
    }
    setLoading(false);
    setTimeout(() => setStatus(null), 3000);
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
      const res = await callAI({
        system: PROMPTS.CAPTURE,
        max_tokens: 800,
        messages: [{ role: "user", content: input }],
      });
      const data = await res.json();
      let parsed = {};
      try {
        parsed = JSON.parse((data.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim());
      } catch {}
      if (parsed.title) {
        setLoading(false);
        setStatus(null);
        setPreview({ ...parsed, _raw: input });
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
          ref={fileRef}
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && capture()}
          disabled={loading}
          placeholder={
            listening
              ? "Listening..."
              : loading
                ? "Processing..."
                : "Quick capture — just type anything..."
          }
          style={{
            flex: 1,
            minWidth: 0,
            padding: "10px 14px",
            background: listening ? "#1a2e1a" : t.surface,
            border: `1px solid ${listening ? "#25D36640" : t.border}`,
            borderRadius: 10,
            color: t.textSoft,
            fontSize: 14,
            outline: "none",
            fontFamily: "inherit",
            opacity: loading ? 0.5 : 1,
          }}
        />
        <button
          onClick={startVoice}
          disabled={loading}
          title="Voice capture"
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: listening ? "#25D36620" : t.surface,
            border: `1px solid ${listening ? "#25D36640" : t.border}`,
            borderRadius: 10,
            color: listening ? "#25D366" : t.textMuted,
            cursor: loading ? "default" : "pointer",
            fontSize: 16,
            padding: 0,
          }}
        >
          🎤
        </button>
        <button
          onClick={() => imgRef.current?.click()}
          disabled={loading}
          title="Photo capture"
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            color: loading ? t.textDim : t.textMuted,
            cursor: loading ? "default" : "pointer",
            fontSize: 16,
            padding: 0,
          }}
        >
          📷
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          title="Upload file (PDF, Word, MD, TXT)"
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            color: loading ? t.textDim : t.textMuted,
            cursor: loading ? "default" : "pointer",
            fontSize: 16,
            padding: 0,
          }}
        >
          📄
        </button>
        <button
          onClick={capture}
          disabled={loading || !text.trim()}
          title={`Save to ${(BRAIN_META_QC[brains[0]?.type] || BRAIN_META_QC.personal).emoji} ${brains[0]?.name || "brain"}`}
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              text.trim() && !loading ? "linear-gradient(135deg, #4ECDC4, #45B7D1)" : t.surface,
            border: "none",
            borderRadius: 10,
            color: text.trim() && !loading ? "#0f0f23" : t.textFaint,
            fontWeight: 700,
            cursor: text.trim() && !loading ? "pointer" : "default",
            fontSize: 18,
            padding: 0,
          }}
        >
          +
        </button>
      </div>
      {status && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 0 4px" }}>
          <p
            style={{
              fontSize: 11,
              color:
                status === "vault-needed"
                  ? "#FF4757"
                  : status.includes("error")
                    ? "#FF6B35"
                    : "#4ECDC4",
              margin: 0,
            }}
          >
            {statusMsg[status]}
          </p>
          {status === "vault-needed" && onNavigate && (
            <button
              onClick={() => {
                onNavigate("vault");
                setStatus(null);
              }}
              style={{
                fontSize: 11,
                padding: "3px 10px",
                background: "#FF475720",
                border: "1px solid #FF475740",
                borderRadius: 6,
                color: "#FF4757",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Open Vault
            </button>
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

QuickCapture.propTypes = {
  entries: PropTypes.array.isRequired,
  setEntries: PropTypes.func.isRequired,
  links: PropTypes.array,
  addLinks: PropTypes.func,
  onCreated: PropTypes.func,
  onUpdate: PropTypes.func,
  isOnline: PropTypes.bool,
  refreshCount: PropTypes.func,
  brainId: PropTypes.string,
  brains: PropTypes.array,
  canWrite: PropTypes.bool,
};
