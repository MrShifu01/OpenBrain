import { useState, useRef, useEffect } from "react";
import { authFetch } from "../lib/authFetch";
import { getEmbedHeaders } from "../lib/aiSettings";
import { supabase } from "../lib/supabase";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface OnboardingModalProps {
  onComplete: (opts?: { nextAction?: "vault" | "import" }) => void;
  brainId?: string;
}

type Step = "capture" | "processing" | "ask" | "answer";

interface CapturedEntry {
  id?: string;
  title: string;
  content: string;
}

const EXAMPLES = [
  {
    label: "a customer call insight",
    text: "the customer kept saying 'we just need it to not break during month-end' — that's the real pitch",
  },
  {
    label: "the gate code",
    text: "gate code for Mom's place is 4471 · alarm panic word 'rooibos'",
  },
  {
    label: "a renewal date",
    text: "driver's licence expires 14 March next year — testing centre at Sea Point",
  },
  {
    label: "a half-formed idea",
    text: "what if onboarding asks one question instead of seven — measure activation week over week",
  },
];

const SAMPLE_ENTRIES: CapturedEntry[] = [
  {
    title: "Northwind discovery call",
    content:
      "the head of ops at Northwind kept saying 'we just need it to not break during month-end' — that's the real pitch",
  },
  {
    title: "Gate code for Mom's place",
    content:
      "gate code 4471 · alarm panic word 'rooibos' · spare key taped to back of geyser cupboard photo",
  },
  {
    title: "Driver's licence renewal",
    content: "expires 14 March next year — Sea Point testing centre, slot opens 60 days before",
  },
  {
    title: "Onboarding experiment",
    content:
      "what if onboarding asks one question instead of seven — measure activation week over week",
  },
];

// localStorage is the fast path; DB is the cross-device source of truth.
// Old code wrote `openbrain_onboarded`; clean it up on first new write.
function markOnboarded() {
  try {
    localStorage.setItem("everion_onboarded", "1");
    localStorage.removeItem("openbrain_onboarded");
  } catch {
    /* SSR / private mode */
  }
  void supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;
    void supabase
      .from("user_profiles")
      .upsert({ id: user.id, onboarded_at: new Date().toISOString() }, { onConflict: "id" });
  });
}

// Crude noun-anchor extraction so the suggested query references something
// from the user's actual entry. Generic "what's in my brain?" is the fallback.
function deriveQuery(captures: CapturedEntry[]): string {
  if (!captures.length) return "What's in my brain?";
  const first = captures[0];
  const text = `${first.title} ${first.content}`.toLowerCase();
  const stopwords = new Set([
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "to",
    "for",
    "and",
    "of",
    "in",
    "on",
    "at",
    "with",
    "from",
    "that",
    "this",
    "it",
    "i",
    "me",
    "my",
    "we",
    "us",
    "our",
    "you",
    "your",
    "what",
    "when",
    "where",
    "how",
    "but",
    "kept",
    "said",
    "saying",
  ]);
  const words = text
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopwords.has(w));
  const anchor = words[0];
  if (!anchor) return "What did I just save?";
  return `What did I save about ${anchor}?`;
}

export default function OnboardingModal({ onComplete, brainId }: OnboardingModalProps) {
  const [step, setStep] = useState<Step>("capture");
  const [input, setInput] = useState("");
  const [captures, setCaptures] = useState<CapturedEntry[]>([]);
  const [query, setQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [citations, setCitations] = useState<{ title: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === "capture") inputRef.current?.focus();
  }, [step]);

  // Auto-grow textarea so a long capture isn't squashed.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [input]);

  function skip() {
    markOnboarded();
    onComplete();
  }

  async function saveCapture(content: string): Promise<CapturedEntry | null> {
    if (!content.trim() || !brainId) return null;
    const title = content.split("\n")[0].slice(0, 80);
    try {
      const r = await authFetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getEmbedHeaders() || {}) },
        body: JSON.stringify({
          p_title: title,
          p_content: content,
          p_type: "note",
          p_metadata: {},
          p_tags: [],
          p_brain_id: brainId,
        }),
      });
      const data = await r.json().catch(() => ({}));
      return { id: data?.id, title, content };
    } catch (err) {
      console.error("[onboarding] capture failed", err);
      return null;
    }
  }

  async function handleSaveAndContinue() {
    if (!input.trim()) return;
    setStep("processing");
    setLoading(true);
    const saved = await saveCapture(input);
    if (saved) {
      const next = [...captures, saved];
      setCaptures(next);
      setQuery(deriveQuery(next));
    }
    setInput("");
    setLoading(false);
    setStep("ask");
  }

  async function handleAddAnother(text: string) {
    if (!text.trim()) return;
    const saved = await saveCapture(text);
    if (saved) {
      const next = [...captures, saved];
      setCaptures(next);
      // Don't re-derive query; user has already seen / edited it.
    }
  }

  async function handleSampleData() {
    setStep("processing");
    setLoading(true);
    const saved: CapturedEntry[] = [];
    for (const sample of SAMPLE_ENTRIES) {
      const s = await saveCapture(sample.content);
      if (s) saved.push(s);
    }
    setCaptures(saved);
    setQuery("What did the Northwind team say on the call?");
    setLoading(false);
    setStep("ask");
  }

  async function handleAsk() {
    if (!query.trim()) return;
    setStep("answer");
    setLoading(true);
    setAiResponse("");
    setCitations([]);
    try {
      const r = await authFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getEmbedHeaders() || {}) },
        body: JSON.stringify({
          message: query,
          brain_id: brainId,
          history: [],
          // Project default per CLAUDE.md is Gemini. BYO-key users still get
          // their key respected through getEmbedHeaders → server side.
          provider: "google",
        }),
      });
      const data = await r.json();
      const text =
        data.content ||
        data.text ||
        "Your brain is still learning. Add a couple more thoughts and try again.";
      setAiResponse(text);
      // Best-effort citation surface — many backends return cited entries; if
      // not present we fall back to the most-recently saved captures so the
      // visitor sees what fed the answer.
      const cited: { title: string }[] = Array.isArray(data?.citations)
        ? data.citations.map((c: { title?: string }) => ({ title: c?.title || "entry" }))
        : Array.isArray(data?.sources)
          ? data.sources.map((c: { title?: string }) => ({ title: c?.title || "entry" }))
          : captures.slice(0, 2).map((c) => ({ title: c.title }));
      setCitations(cited);
    } catch (err) {
      console.error("[onboarding] query failed", err);
      setAiResponse(
        "Something went wrong. You can ask later from the Ask tab — your captures are saved.",
      );
    }
    setLoading(false);
  }

  function finishToApp() {
    markOnboarded();
    onComplete();
  }

  function finishToVault() {
    markOnboarded();
    onComplete({ nextAction: "vault" });
  }

  const titleSerif: React.CSSProperties = {
    fontFamily: "var(--f-serif)",
    fontSize: 32,
    fontWeight: 400,
    letterSpacing: "-0.02em",
    lineHeight: 1.15,
    color: "var(--ink)",
    margin: 0,
  };
  const subtitleSerif: React.CSSProperties = {
    fontFamily: "var(--f-serif)",
    fontSize: 16,
    lineHeight: 1.5,
    color: "var(--ink-soft)",
    fontStyle: "italic",
    margin: "10px 0 28px",
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        ref={dialogRef}
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        aria-label="Onboarding"
        className="anim-scale-in-design relative max-h-[calc(100vh-32px)] !max-w-[min(560px,calc(100vw-32px))] overflow-y-auto !rounded-[18px]"
        style={{
          padding: "40px 36px 28px",
          background: "var(--surface-high)",
          borderColor: "var(--line-soft)",
          boxShadow: "var(--lift-3)",
        }}
      >
        <VisuallyHidden>
          <DialogTitle>Onboarding</DialogTitle>
        </VisuallyHidden>
        <div className="contents">
          {/* Top row: brand + progress + skip */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 24, gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span
                className="f-serif"
                style={{
                  fontSize: 18,
                  fontWeight: 450,
                  letterSpacing: "-0.01em",
                  color: "var(--ink)",
                }}
              >
                Everion
              </span>
              <span
                aria-hidden="true"
                style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--ember)" }}
              />
            </div>
            <div
              aria-hidden="true"
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: 6,
                justifyContent: "center",
              }}
            >
              {[0, 1, 2].map((i) => {
                const active =
                  step === "capture"
                    ? i <= 0
                    : step === "processing" || step === "ask"
                      ? i <= 1
                      : i <= 2;
                return (
                  <span
                    key={i}
                    style={{
                      flex: "1 1 0",
                      maxWidth: 28,
                      minWidth: 6,
                      height: 2,
                      borderRadius: 2,
                      background: active ? "var(--ember)" : "var(--line)",
                      transition: "background 300ms",
                    }}
                  />
                );
              })}
            </div>
            <Button
              variant="link"
              size="xs"
              onClick={skip}
              className="h-auto shrink-0 p-0"
              style={{ color: "var(--ink-faint)" }}
            >
              Skip
            </Button>
          </div>

          {/* ─── STEP 1 — CAPTURE ─── */}
          {step === "capture" && (
            <div>
              <div className="micro" style={{ marginBottom: 20 }}>
                step 1 of 3
              </div>
              <h2 style={titleSerif}>let's give your brain its first thing to remember.</h2>
              <p style={subtitleSerif}>
                anything — a note, a fact, a half-formed idea. tap an example to start.
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => {
                      setInput(ex.text);
                      inputRef.current?.focus();
                    }}
                    className="design-chip f-sans press"
                    style={{ fontSize: 12, cursor: "pointer" }}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleSaveAndContinue();
                  }
                }}
                rows={2}
                placeholder="type the first thing…"
                className="f-serif"
                style={{
                  width: "100%",
                  fontSize: 17,
                  lineHeight: 1.55,
                  resize: "none",
                  padding: "8px 0",
                  color: "var(--ink)",
                  background: "transparent",
                  border: 0,
                  borderBottom: "1px solid var(--line)",
                  borderRadius: 0,
                  outline: "none",
                  fontStyle: input ? "normal" : "italic",
                }}
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 32,
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleSampleData}
                  style={{ color: "var(--ink-faint)" }}
                >
                  show me with sample data
                </Button>
                <Button onClick={handleSaveAndContinue} disabled={!input.trim() || loading}>
                  save & continue
                </Button>
              </div>
            </div>
          )}

          {/* ─── TRANSITION — PROCESSING ─── */}
          {step === "processing" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: "60px 0",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "var(--ember)",
                  animation: "design-breathe 2.5s ease-in-out infinite",
                }}
              />
              <p
                className="f-serif"
                style={{ fontSize: 18, fontStyle: "italic", color: "var(--ink-soft)", margin: 0 }}
              >
                teaching your brain…
              </p>
            </div>
          )}

          {/* ─── STEP 2 — ASK ─── */}
          {step === "ask" && (
            <div>
              <div className="micro" style={{ marginBottom: 20 }}>
                step 2 of 3
              </div>
              <h2 style={titleSerif}>now ask your brain something.</h2>
              <p style={subtitleSerif}>
                we suggested a question based on what you just saved — change it if you like.
              </p>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                className="f-serif"
                style={{
                  width: "100%",
                  fontSize: 18,
                  padding: "8px 0 12px",
                  color: "var(--ink)",
                  background: "transparent",
                  border: 0,
                  borderBottom: "1px solid var(--line)",
                  borderRadius: 0,
                  outline: "none",
                }}
              />

              {captures.length < 3 && (
                <AddAnother onSave={handleAddAnother} count={captures.length} />
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 32,
                  alignItems: "center",
                }}
              >
                <span
                  className="f-sans"
                  style={{ fontSize: 12, color: "var(--ink-faint)", fontStyle: "italic" }}
                >
                  {captures.length} {captures.length === 1 ? "thought" : "thoughts"} saved
                </span>
                <Button onClick={handleAsk} disabled={!query.trim()}>
                  ask
                </Button>
              </div>
            </div>
          )}

          {/* ─── STEP 3 — ANSWER ─── */}
          {step === "answer" && (
            <div>
              {loading ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                    padding: "60px 0",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "var(--ember)",
                      animation: "design-breathe 2.5s ease-in-out infinite",
                    }}
                  />
                  <p
                    className="f-serif"
                    style={{
                      fontSize: 16,
                      fontStyle: "italic",
                      color: "var(--ink-soft)",
                      margin: 0,
                    }}
                  >
                    thinking…
                  </p>
                </div>
              ) : (
                <>
                  <div className="micro" style={{ marginBottom: 14 }}>
                    your brain says
                  </div>
                  <p
                    className="f-serif"
                    style={{
                      fontSize: 17,
                      lineHeight: 1.65,
                      color: "var(--ink)",
                      whiteSpace: "pre-wrap",
                      margin: 0,
                    }}
                  >
                    {aiResponse}
                  </p>

                  {citations.length > 0 && (
                    <div
                      style={{
                        marginTop: 16,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      <span className="micro" style={{ marginRight: 4, color: "var(--ink-faint)" }}>
                        from
                      </span>
                      {citations.map((c, i) => (
                        <span key={i} className="design-chip f-sans" style={{ fontSize: 12 }}>
                          {c.title}
                        </span>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: 28,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                    className="onboarding-next-cards"
                  >
                    <NextCard
                      title="Add more thoughts"
                      body="The more in there, the better the recall."
                      onClick={finishToApp}
                    />
                    <NextCard
                      title="Set up your vault"
                      body="For the high-stakes stuff — IDs, gate codes, bank details."
                      onClick={finishToVault}
                      featured
                    />
                  </div>

                  <Button
                    variant="link"
                    size="sm"
                    onClick={finishToApp}
                    className="mt-4 w-full"
                    style={{ color: "var(--ink-faint)" }}
                  >
                    or just show me around →
                  </Button>
                </>
              )}
            </div>
          )}

          <style>{`
            @media (max-width: 480px) {
              .onboarding-next-cards { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddAnother({
  onSave,
  count,
}: {
  onSave: (text: string) => void | Promise<void>;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="f-sans press"
        style={{
          marginTop: 12,
          background: "transparent",
          border: 0,
          color: "var(--ink-faint)",
          fontSize: 12,
          fontStyle: "italic",
          cursor: "pointer",
          padding: 0,
        }}
      >
        + add another (optional, {3 - count} more)
      </button>
    );
  }

  return (
    <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
      <input
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) {
            void onSave(text);
            setText("");
            setOpen(false);
          }
        }}
        placeholder="another thought…"
        className="f-serif"
        style={{
          flex: 1,
          fontSize: 14,
          padding: "6px 0",
          color: "var(--ink)",
          background: "transparent",
          border: 0,
          borderBottom: "1px solid var(--line-soft)",
          outline: "none",
        }}
      />
      <Button
        size="xs"
        onClick={() => {
          if (text.trim()) {
            void onSave(text);
            setText("");
            setOpen(false);
          }
        }}
        disabled={!text.trim()}
      >
        save
      </Button>
    </div>
  );
}

function NextCard({
  title,
  body,
  onClick,
  featured,
}: {
  title: string;
  body: string;
  onClick: () => void;
  featured?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press"
      style={{
        textAlign: "left",
        padding: 16,
        background: featured ? "var(--surface-high)" : "var(--surface)",
        border: `1px solid ${featured ? "var(--ember)" : "var(--line-soft)"}`,
        borderRadius: 14,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div className="f-serif" style={{ fontSize: 15, fontWeight: 450, color: "var(--ink)" }}>
        {title}
      </div>
      <div
        className="f-serif"
        style={{
          fontSize: 13,
          color: "var(--ink-soft)",
          fontStyle: "italic",
          lineHeight: 1.4,
        }}
      >
        {body}
      </div>
    </button>
  );
}
