import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { authFetch } from "../lib/authFetch";
import { callAI } from "../lib/ai";
import { SUGGESTIONS } from "../data/personalSuggestions";
import { FAMILY_SUGGESTIONS } from "../data/familySuggestions";
import { BUSINESS_SUGGESTIONS } from "../data/businessSuggestions";
import { TC, PC, MODEL } from "../data/constants";
import { useTheme } from "../ThemeContext";
import { PROMPTS } from "../config/prompts";
import { aiFetch, getUserModel, getEmbedHeaders, getGroqKey, getUserApiKey } from "../lib/aiFetch";
import { isSupportedFile, isTextFile, readTextFile, readFileAsBase64 } from "../lib/fileParser";
import type { Entry, Brain, Suggestion, Priority } from "../types";

interface SuggestionsViewProps {
  entries: Entry[];
  setEntries: React.Dispatch<React.SetStateAction<Entry[]>>;
  activeBrain: Brain | null;
  brains: Brain[];
}

interface AiQuestion {
  q: string;
  cat: string;
  p: string;
  ai?: boolean;
}

interface SavedItem {
  q: string;
  a: string;
  cat: string;
  db: boolean;
  brain: Brain | null;
}

/* ─── Brain-type → question set ─── */
function getSuggestionsForType(type: string | undefined): Suggestion[] {
  if (type === "family") return FAMILY_SUGGESTIONS;
  if (type === "business") return BUSINESS_SUGGESTIONS;
  return SUGGESTIONS;
}

/* ─── Brain type label/icon ─── */
const BRAIN_META = {
  personal: { emoji: "🧠", label: "Personal" },
  family: { emoji: "🏠", label: "Family" },
  business: { emoji: "🏪", label: "Business" },
};

export default function SuggestionsView({
  entries,
  setEntries,
  activeBrain,
  brains,
}: SuggestionsViewProps) {
  // Multi-select: which brains to pull questions from (default = [activeBrain])
  const [selectedBrainIds, setSelectedBrainIds] = useState<string[]>(() =>
    activeBrain?.id ? [activeBrain.id] : [],
  );

  const toggleBrain = (id: string) => {
    setSelectedBrainIds((prev) => {
      if (prev.includes(id)) {
        // Don't allow deselecting the last brain
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  // First selected brain = save target
  const targetBrain = useMemo((): Brain | null => {
    if (!brains?.length) return activeBrain;
    return brains.find((b: Brain) => b.id === selectedBrainIds[0]) || activeBrain;
  }, [selectedBrainIds, brains, activeBrain]);

  // Merged & deduplicated question set from all selected brain types
  const questionSet = useMemo((): Suggestion[] => {
    const selectedBrains = brains?.length
      ? brains.filter((b: Brain) => selectedBrainIds.includes(b.id))
      : [activeBrain];
    const seen = new Set<string>();
    const merged: Suggestion[] = [];
    for (const b of selectedBrains) {
      for (const s of getSuggestionsForType(b?.type || "personal")) {
        if (!seen.has(s.q)) {
          seen.add(s.q);
          merged.push(s);
        }
      }
    }
    return merged;
  }, [selectedBrainIds, brains, activeBrain]);

  // brainType used only for AI context — use first selected brain's type
  const brainType = targetBrain?.type || "personal";

  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answered, setAnswered] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [filterCat, setFilterCat] = useState("all");
  const [anim, setAnim] = useState("");
  const [saving, setSaving] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [aiQuestion, setAiQuestion] = useState<AiQuestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Answered tracking — shared key merges all brain types
  const answeredKey = "openbrain_answered_qs";
  const [answeredQs, setAnsweredQs] = useState<Set<string>>(() => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(answeredKey) || "[]"));
    } catch {
      return new Set<string>();
    }
  });

  // Reset position when selected brains change
  useEffect(() => {
    setIdx(0);
    setFilterCat("all");
    setAiQuestion(null);
    setAnswered(0);
    setSkipped(0);
  }, [selectedBrainIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const imgRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Skipped onboarding questions — load once, stay at top of queue
  const [onboardingSkipped] = useState<Suggestion[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("openbrain_onboarding_skipped") || "[]");
    } catch {
      return [];
    }
  });

  const position = answered + skipped;
  const cats = useMemo(() => {
    const c: Record<string, number> = {};
    questionSet.forEach((s: Suggestion) => {
      c[s.cat] = (c[s.cat] || 0) + 1;
    });
    onboardingSkipped.forEach((s: Suggestion) => {
      c[s.cat] = (c[s.cat] || 0) + 1;
    });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [questionSet, onboardingSkipped]);

  const view = useMemo((): Suggestion[] => {
    // Skipped onboarding questions come first (if not yet answered and matching category filter)
    const skippedPriority = onboardingSkipped.filter(
      (s: Suggestion) => !answeredQs.has(s.q) && (filterCat === "all" || s.cat === filterCat),
    );
    const base =
      filterCat === "all"
        ? questionSet
        : questionSet.filter((s: Suggestion) => s.cat === filterCat);
    const rest = base.filter(
      (s: Suggestion) =>
        !answeredQs.has(s.q) && !skippedPriority.find((sp: Suggestion) => sp.q === s.q), // avoid duplicates if already in set
    );
    return [...skippedPriority, ...rest];
  }, [filterCat, answeredQs, questionSet, onboardingSkipped]);

  const total = view.length;
  const poolEmpty = total === 0;
  const isAiSlot = poolEmpty || position % 5 === 4;
  const current: AiQuestion | Suggestion | null = isAiSlot
    ? aiLoading
      ? null
      : aiQuestion
    : view[idx % total];

  useEffect(() => {
    if (!isAiSlot || aiQuestion || aiLoading) return;
    setAiLoading(true);
    const ctx = entries
      .slice(0, 30)
      .map((e: Entry) => `- ${e.title}: ${(e.content || "").slice(0, 100)}`)
      .join("\n");
    const brainContext =
      brainType === "family"
        ? "family shared knowledge base (household, family members, emergencies, finances)"
        : brainType === "business"
          ? "business knowledge base (suppliers, staff, SOPs, costs, licences, equipment)"
          : "personal knowledge base";
    callAI({
      max_tokens: 200,
      system: PROMPTS.FILL_BRAIN.replace("{{BRAIN_CONTEXT}}", brainContext),
      brainId: targetBrain?.id,
      messages: [
        {
          role: "user",
          content: `What they have captured so far:\n${ctx}\n\nWhat important gap should they fill next?`,
        },
      ],
    })
      .then((r) => r.json())
      .then((data) => {
        const raw = (data.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim();
        let parsed: any = {};
        try {
          parsed = JSON.parse(raw);
        } catch {}
        setAiQuestion(
          parsed.q
            ? { q: parsed.q, cat: parsed.cat || "✨ AI", p: parsed.p || "medium", ai: true }
            : {
                q: "What's one important thing you haven't captured yet?",
                cat: "✨ AI",
                p: "medium",
                ai: true,
              },
        );
      })
      .catch(() =>
        setAiQuestion({
          q: "What's one important thing you haven't captured yet?",
          cat: "✨ AI",
          p: "medium",
          ai: true,
        }),
      )
      .finally(() => setAiLoading(false));
  }, [isAiSlot, aiQuestion, aiLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 4 * 1024 * 1024) {
      setImgError("Photo too large — try a smaller image");
      setTimeout(() => setImgError(null), 3000);
      return;
    }
    setImgLoading(true);
    setImgError(null);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
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
                  text: "Extract all text from this image relevant to the question. Output just the extracted content, clean and readable. If it's a document, card, or label — preserve structure. No commentary.",
                },
              ],
            },
          ],
        }),
      });
      const data = await apiRes.json();
      const extracted = data.content?.[0]?.text?.trim() || "";
      if (extracted) {
        setAnswer(extracted);
      } else {
        setImgError("Could not extract text — try a clearer photo");
        setTimeout(() => setImgError(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setImgError("Photo upload failed — check your connection");
      setTimeout(() => setImgError(null), 3000);
    }
    setImgLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!isSupportedFile(file)) {
      setImgError("Unsupported file — use .txt, .md, .csv, .pdf, or .docx");
      setTimeout(() => setImgError(null), 3000);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImgError("File too large — max 10MB");
      setTimeout(() => setImgError(null), 3000);
      return;
    }
    setImgLoading(true);
    setImgError(null);
    try {
      let extractedText = "";
      if (isTextFile(file)) {
        extractedText = await readTextFile(file);
      } else {
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
                    text: "Extract ALL text from this document relevant to the question. Preserve structure. No commentary.",
                  },
                ],
              },
            ],
          }),
        });
        const data = await apiRes.json();
        extractedText = data.content?.[0]?.text?.trim() || "";
      }
      if (extractedText) {
        setAnswer(extractedText);
      } else {
        setImgError("Could not extract text from file");
        setTimeout(() => setImgError(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setImgError("File upload failed — check your connection");
      setTimeout(() => setImgError(null), 3000);
    }
    setImgLoading(false);
  };

  const startVoice = useCallback(async () => {
    // If already recording, stop
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const groqKey = getGroqKey();
    const openAIKey = getUserApiKey();
    const hasTranscription = !!groqKey || !!openAIKey;

    if (!hasTranscription) {
      // Fall back to browser SpeechRecognition
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) {
        setMicError("Voice not supported in this browser");
        setTimeout(() => setMicError(null), 3000);
        return;
      }
      const recognition = new SR();
      recognition.lang = "en-ZA";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognitionRef.current = recognition;
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join("");
        setAnswer(transcript);
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
      return;
    }

    // Use MediaRecorder + Whisper/Groq
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = "audio/mp4";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus"))
        mimeType = "audio/webm;codecs=opus";
      else if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";

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
        stream.getTracks().forEach((t) => t.stop());
        setListening(false);
        const actualMime = recorder.mimeType || mimeType;
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        if (blob.size < 1000) return;

        setImgLoading(true);
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const transcribeHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (groqKey) transcribeHeaders["X-Groq-Api-Key"] = groqKey;
          if (openAIKey) transcribeHeaders["X-User-Api-Key"] = openAIKey;
          const transcribeRes = await authFetch("/api/transcribe", {
            method: "POST",
            headers: transcribeHeaders,
            body: JSON.stringify({ audio: base64, mimeType: actualMime, language: "en" }),
          });
          if (transcribeRes.ok) {
            const { text } = await transcribeRes.json();
            if (text?.trim()) setAnswer((prev) => (prev ? `${prev} ${text.trim()}` : text.trim()));
          } else {
            setMicError("Transcription failed — try again");
            setTimeout(() => setMicError(null), 3000);
          }
        } catch (err) {
          console.error("[Voice] error:", err);
          setMicError("Voice error — check console");
          setTimeout(() => setMicError(null), 3000);
        }
        setImgLoading(false);
      };

      recorder.start(1000);
      setListening(true);
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setMicError("Microphone access denied — check settings");
        setTimeout(() => setMicError(null), 3000);
      } else {
        setMicError("Microphone not available");
        setTimeout(() => setMicError(null), 3000);
      }
    }
  }, [listening]);

  const next = useCallback(
    (dir: string) => {
      setAnim(dir);
      setTimeout(() => {
        setAnswer("");
        setShowInput(false);
        setAnim("");
        if (isAiSlot) {
          setAiQuestion(null);
        } else if (total > 0) {
          setIdx((p) => (p + 1) % total);
        }
      }, 200);
    },
    [isAiSlot, total],
  );

  const handleSave = async () => {
    if (!answer.trim()) return;
    const a = answer.trim();
    setSaving(true);
    try {
      const res = await callAI({
        max_tokens: 800,
        system: PROMPTS.QA_PARSE,
        brainId: targetBrain?.id,
        messages: [{ role: "user", content: `Question: ${current!.q}\nAnswer: ${a}` }],
      });
      const data = await res.json();
      let parsed: any = {};
      try {
        parsed = JSON.parse((data.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim());
      } catch {}
      if (parsed.title) {
        const rpcRes = await authFetch("/api/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(getEmbedHeaders() || {}) },
          body: JSON.stringify({
            p_title: parsed.title,
            p_content: parsed.content || a,
            p_type: parsed.type || "note",
            p_metadata: parsed.metadata || {},
            p_tags: parsed.tags || [],
            p_brain_id: targetBrain?.id,
          }),
        });
        const savedToDB = rpcRes.ok;
        const newEntry: Entry = {
          id: Date.now().toString(),
          ...parsed,
          pinned: false,
          importance: 0,
          tags: parsed.tags || [],
          created_at: new Date().toISOString(),
        };
        setEntries((prev: Entry[]) => [newEntry, ...prev]);
        setSaved((prev: SavedItem[]) => [
          { q: current!.q, a, cat: current!.cat, db: savedToDB, brain: targetBrain },
          ...prev,
        ]);
      }
    } catch {
      setSaved((prev: SavedItem[]) => [
        { q: current!.q, a, cat: current!.cat, db: false, brain: targetBrain },
        ...prev,
      ]);
    }

    if (!isAiSlot && current?.q) {
      setAnsweredQs((prev) => {
        const updated = new Set(prev);
        updated.add(current.q);
        try {
          localStorage.setItem(answeredKey, JSON.stringify([...updated]));
        } catch {}
        return updated;
      });
      // Remove from skipped onboarding list if it was there
      try {
        const skipped = JSON.parse(localStorage.getItem("openbrain_onboarding_skipped") || "[]");
        const updated = skipped.filter((s: any) => s.q !== current!.q);
        localStorage.setItem("openbrain_onboarding_skipped", JSON.stringify(updated));
      } catch {}
    }

    setSaving(false);
    setAnswered((n) => n + 1);
    next("save");
  };

  const copyAll = () => {
    const text = saved
      .map((s: SavedItem) => `**${s.cat}**\nQ: ${s.q}\nA: ${s.a}`)
      .join("\n\n---\n\n");
    navigator.clipboard
      .writeText(text)
      .catch((err) => console.error("[SuggestionsView:copyAll] Failed to copy text", err));
  };

  const pc = current ? PC[current.p as Priority] || PC.medium : PC.medium;
  const bm = BRAIN_META[brainType as keyof typeof BRAIN_META] || BRAIN_META.personal;

  return (
    <div>
      {/* Brain selector chips — multi-select */}
      {brains?.length > 0 && (
        <div>
          <p>
            Fill which brain{brains.length > 1 ? "s" : ""}?
          </p>
          {brains.length > 1 ? (
            <div>
              {brains.map((b: Brain) => {
                const bmt =
                  BRAIN_META[(b.type || "personal") as keyof typeof BRAIN_META] ||
                  BRAIN_META.personal;
                const active = selectedBrainIds.includes(b.id);
                return (
                  <button
                    key={b.id}
                    onClick={() => toggleBrain(b.id)}
                  >
                    <span>{bmt.emoji}</span>
                    <span>{b.name}</span>
                    {active && selectedBrainIds.length > 1 && selectedBrainIds[0] === b.id && (
                      <span>✓ saves here</span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <span>
              {bm.emoji} {targetBrain?.name || bm.label}
            </span>
          )}
          <p>
            {selectedBrainIds.length > 1 ? (
              <>
                Showing merged questions · saves go to{" "}
                <strong>
                  {bm.emoji} {targetBrain?.name || bm.label}
                </strong>
              </>
            ) : (
              <>
                Showing questions for{" "}
                <strong>
                  {bm.emoji} {targetBrain?.name || bm.label}
                </strong>
              </>
            )}
          </p>
        </div>
      )}

      <div>
        {[
          { l: "Answered", v: answered },
          { l: "Skipped", v: skipped },
          { l: "Remaining", v: Math.max(0, total - (idx % Math.max(total, 1))) },
        ].map((s) => (
          <div key={s.l}>
            <div>{s.v}</div>
            <div>{s.l}</div>
          </div>
        ))}
      </div>

      <div>
        <div
          style={{
            width: `${Math.min(total > 0 ? ((answered + skipped) / total) * 100 : 0, 100)}%`,
          }}
        />
      </div>

      <div>
        <button
          onClick={() => {
            setFilterCat("all");
            setIdx(0);
          }}
        >
          All
        </button>
        {cats.map(([c, n]: [string, number]) => (
          <button
            key={c}
            onClick={() => {
              setFilterCat(c);
              setIdx(0);
            }}
          >
            {c} ({n})
          </button>
        ))}
      </div>

      {poolEmpty && (
        <div>
          <span>
            ✨ All {answeredQs.size} static questions answered — AI is now driving
          </span>
        </div>
      )}
      {isAiSlot && aiLoading && (
        <div>
          <div>✨</div>
          <p>AI is generating a personalised question…</p>
        </div>
      )}
      {current && !aiLoading && (
        <div>
          <div>
            <span>{pc.l}</span>
            <span>{current.cat}</span>
            {isAiSlot && (
              <span>✨ AI</span>
            )}
            {!isAiSlot &&
              current &&
              onboardingSkipped.find((s: Suggestion) => s.q === current.q) && (
                <span>↩ From onboarding</span>
              )}
            <span>#{idx + 1}/{total}</span>
          </div>
          <p>{current.q}</p>
        </div>
      )}

      {!showInput ? (
        <div>
          <button
            onClick={() => {
              setSkipped((s) => s + 1);
              next("skip");
            }}
            disabled={aiLoading}
          >
            Skip →
          </button>
          <button
            onClick={() => setShowInput(true)}
            disabled={!current || aiLoading}
          >
            Answer this
          </button>
        </div>
      ) : (
        <div>
          <input
            type="file"
            accept="image/*"
            ref={imgRef}
            onChange={handleImageUpload}
          />
          <input
            type="file"
            accept=".txt,.md,.csv,.pdf,.docx,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ref={fileRef}
            onChange={handleFileUpload}
          />
          {imgError && <p>{imgError}</p>}
          {micError && <p>{micError}</p>}
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={listening ? "Listening..." : "Type your answer..."}
            autoFocus
          />
          <div>
            <button
              onClick={() => {
                setShowInput(false);
                setAnswer("");
                setListening(false);
                recognitionRef.current?.stop();
                mediaRecorderRef.current?.state !== "inactive" && mediaRecorderRef.current?.stop();
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setSkipped((s) => s + 1);
                next("skip");
              }}
            >
              Skip
            </button>
            <button
              onClick={startVoice}
              disabled={imgLoading || saving}
              title="Voice input"
            >
              {listening ? "⏹" : "🎤"}
            </button>
            <button
              onClick={() => imgRef.current?.click()}
              disabled={imgLoading || saving}
              title="Upload photo"
            >
              📷
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={imgLoading || saving}
              title="Upload file (PDF, Word, MD, TXT)"
            >
              📄
            </button>
            <button
              onClick={handleSave}
              disabled={!answer.trim() || saving || imgLoading}
            >
              {saving
                ? "Saving..."
                : imgLoading
                  ? "Processing..."
                  : listening
                    ? "Listening..."
                    : `Save to ${bm.emoji} ${targetBrain?.name || bm.label}`}
            </button>
          </div>
        </div>
      )}

      {saved.length > 0 && (
        <div>
          <div>
            <p>
              This session ({saved.length})
            </p>
            <button onClick={copyAll}>
              📋 Copy All for Claude
            </button>
          </div>
          {saved.map((s, i) => (
            <div key={i}>
              <div>
                <span>{s.cat}</span>
                {s.brain && (
                  <span>
                    {BRAIN_META[(s.brain.type || "personal") as keyof typeof BRAIN_META]?.emoji}{" "}
                    {s.brain.name}
                  </span>
                )}
                {s.db && (
                  <span>Saved to DB</span>
                )}
              </div>
              <p>
                {s.a.slice(0, 120)}
                {s.a.length > 120 ? "…" : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
