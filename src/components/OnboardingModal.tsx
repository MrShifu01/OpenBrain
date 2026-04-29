import { useState, useRef, useEffect } from "react";
import FocusTrap from "focus-trap-react";
import { authFetch } from "../lib/authFetch";
import { getEmbedHeaders } from "../lib/aiSettings";
import MemoryImportPanel from "./MemoryImportPanel";
import { supabase } from "../lib/supabase";
import { Button } from "./ui/button";

interface OnboardingModalProps {
  onComplete: (
    selected?: string[],
    answered?: never[],
    skipped?: { q: string; cat: string; p: string }[],
  ) => void;
  brainId?: string;
}

type Step =
  | "welcome"
  | "name"
  | "capture"
  | "processing"
  | "query"
  | "response"
  | "celebration"
  | "import";

export default function OnboardingModal({ onComplete, brainId }: OnboardingModalProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [userName, setUserName] = useState("");
  const [thoughts, setThoughts] = useState("");
  const [query, setQuery] = useState("What patterns do you see?");
  const [aiResponse, setAiResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === "capture" && textareaRef.current) textareaRef.current.focus();
  }, [step]);

  function skip() {
    localStorage.setItem("openbrain_onboarded", "1");
    onComplete([], [], []);
  }

  async function handleBulkCapture() {
    const lines = thoughts
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    setStep("processing");
    setLoading(true);

    for (const line of lines) {
      try {
        await authFetch("/api/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(getEmbedHeaders() || {}) },
          body: JSON.stringify({
            p_title: line.slice(0, 80),
            p_content: line,
            p_type: "note",
            p_metadata: {},
            p_tags: [],
            p_brain_id: brainId,
          }),
        });
      } catch (err) {
        console.error("[onboarding] capture failed", err);
      }
    }

    setLoading(false);
    setStep("query");
  }

  async function handleQuery() {
    setStep("response");
    setLoading(true);

    try {
      const r = await authFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(getEmbedHeaders() || {}) },
        body: JSON.stringify({
          message: query,
          brain_id: brainId,
          history: [],
          provider: "google",
        }),
      });
      const data = await r.json();
      setAiResponse(
        data.content ||
          data.text ||
          "Your brain is still learning. Add more thoughts and try again!",
      );
    } catch (err) {
      console.error("[onboarding] query failed", err);
      setAiResponse("Something went wrong. You can try asking your brain later from the Ask tab.");
    }

    setLoading(false);
  }

  function finish() {
    localStorage.setItem("openbrain_onboarded", "1");
    onComplete([], [], []);
  }

  const steps: Step[] = [
    "welcome",
    "name",
    "capture",
    "processing",
    "query",
    "response",
    "celebration",
    "import",
  ];
  const stepIdx = steps.indexOf(step);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "var(--scrim)", padding: 16 }}
    >
      <FocusTrap
        focusTrapOptions={{
          // Don't escape-deactivate — onboarding has its own Skip control,
          // and we don't want a stray Escape to drop a brand-new user back
          // into an empty Memory tab without explanation.
          escapeDeactivates: false,
          allowOutsideClick: true,
          // jsdom reports zero-dimension buttons as non-tabbable at mount,
          // which makes focus-trap throw. The dialog itself is tabIndex=-1 so
          // it can hold focus when no tabbable child has been laid out yet.
          fallbackFocus: () => dialogRef.current!,
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Onboarding"
          tabIndex={-1}
          className="anim-scale-in-design relative"
          style={{
            width: "100%",
            maxWidth: "min(520px, calc(100vw - 32px))",
            maxHeight: "calc(100vh - 32px)",
            overflowY: "auto",
            padding: "40px 36px 28px",
            background: "var(--surface-high)",
            border: "1px solid var(--line-soft)",
            borderRadius: 18,
            boxShadow: "var(--lift-3)",
          }}
        >
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
                gap: 4,
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {steps.map((_, i) => (
                <span
                  key={i}
                  style={{
                    flex: "1 1 0",
                    maxWidth: 22,
                    minWidth: 4,
                    height: 2,
                    borderRadius: 2,
                    background: i <= stepIdx ? "var(--ember)" : "var(--line)",
                    transition: "background 300ms",
                  }}
                />
              ))}
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

          {step === "welcome" && (
            <div>
              <div className="micro" style={{ marginBottom: 20 }}>
                step {stepIdx + 1} of {steps.length}
              </div>
              <h2 style={titleSerif}>welcome in.</h2>
              <p style={subtitleSerif}>let's get you a room.</p>
              <Button onClick={() => setStep("name")} size="lg" className="w-full">
                begin
              </Button>
            </div>
          )}

          {step === "name" && (
            <div>
              <div className="micro" style={{ marginBottom: 20 }}>
                step {stepIdx + 1} of {steps.length}
              </div>
              <h2 style={titleSerif}>what should we call you?</h2>
              <p style={subtitleSerif}>just a first name is fine. this is private.</p>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && userName.trim()) {
                    supabase.auth.updateUser({ data: { display_name: userName.trim() } });
                    setStep("capture");
                  }
                }}
                placeholder="your name"
                autoFocus
                className="f-serif"
                style={{
                  width: "100%",
                  fontSize: 22,
                  lineHeight: 1.4,
                  padding: "8px 0 12px",
                  color: "var(--ink)",
                  background: "transparent",
                  border: 0,
                  borderBottom: "1px solid var(--line)",
                  borderRadius: 0,
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
                <Button variant="ghost" size="sm" onClick={() => setStep("welcome")}>
                  back
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (userName.trim())
                      supabase.auth.updateUser({ data: { display_name: userName.trim() } });
                    setStep("capture");
                  }}
                >
                  {userName.trim() ? "next" : "skip"}
                </Button>
              </div>
            </div>
          )}

          {step === "capture" && (
            <div>
              <div className="micro" style={{ marginBottom: 20 }}>
                step {stepIdx + 1} of {steps.length}
              </div>
              <h2 style={titleSerif}>what's on your mind?</h2>
              <p style={subtitleSerif}>
                type 5–10 thoughts, one per line. they become your first entries.
              </p>
              <textarea
                ref={textareaRef}
                value={thoughts}
                onChange={(e) => setThoughts(e.target.value)}
                rows={6}
                placeholder={
                  "call supplier about delivery\nidea: loyalty card system\nreminder: renew licence\n…"
                }
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
                  fontStyle: thoughts ? "normal" : "italic",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
                <Button variant="ghost" size="sm" onClick={() => setStep("name")}>
                  back
                </Button>
                <Button onClick={handleBulkCapture} disabled={!thoughts.trim()}>
                  teach my brain
                </Button>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: "40px 0",
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
              <p
                className="f-serif"
                style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic", margin: 0 }}
              >
                processing {thoughts.split("\n").filter(Boolean).length} thoughts
              </p>
            </div>
          )}

          {step === "query" && (
            <div>
              <div className="micro" style={{ marginBottom: 20 }}>
                step {stepIdx + 1} of {steps.length}
              </div>
              <h2 style={titleSerif}>now ask your brain something hard.</h2>
              <p style={subtitleSerif}>see what everion can do with what you just taught it.</p>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                className="f-serif"
                style={{
                  width: "100%",
                  fontSize: 20,
                  padding: "8px 0 12px",
                  color: "var(--ink)",
                  background: "transparent",
                  border: 0,
                  borderBottom: "1px solid var(--line)",
                  borderRadius: 0,
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
                <Button variant="ghost" size="sm" onClick={() => setStep("capture")}>
                  back
                </Button>
                <Button onClick={handleQuery} disabled={!query.trim()}>
                  ask my brain
                </Button>
              </div>
            </div>
          )}

          {step === "response" && (
            <div>
              {loading ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                    padding: "40px 0",
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
                  <Button onClick={() => setStep("celebration")} size="lg" className="mt-8 w-full">
                    continue
                  </Button>
                </>
              )}
            </div>
          )}

          {step === "celebration" && (
            <div>
              <div className="micro" style={{ marginBottom: 20 }}>
                step {stepIdx + 1} of {steps.length}
              </div>
              <h2 style={titleSerif}>that's your brain working.</h2>
              <p style={subtitleSerif}>imagine what it can do with six months of data.</p>
              <Button onClick={() => setStep("import")} size="lg" className="w-full">
                start exploring
              </Button>
            </div>
          )}

          {step === "import" && (
            <div>
              <div className="micro" style={{ marginBottom: 20 }}>
                step {stepIdx + 1} of {steps.length}
              </div>
              <h2 style={titleSerif}>bring your memories in.</h2>
              <p style={subtitleSerif}>
                if claude or chatgpt already knows you, import now. you can do this later in
                settings.
              </p>
              <MemoryImportPanel brainId={brainId} onImported={() => finish()} />
              <Button variant="ghost" size="sm" onClick={finish} className="mt-4 w-full">
                i'll do this later
              </Button>
            </div>
          )}
        </div>
      </FocusTrap>
    </div>
  );
}
