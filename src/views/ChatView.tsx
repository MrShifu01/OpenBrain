import { useRef, useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useChat } from "../hooks/useChat";
import { useAdminDevMode } from "../hooks/useAdminDevMode";
import { useEntries } from "../context/EntriesContext";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import {
  useHasAIAccess,
  readSuggestionsCache,
  writeSuggestionsCache,
  derivePrompts,
} from "./chatUtils";
import ChatComposer from "./ChatComposer";
import ChatMessageList from "./ChatMessageList";
import { Button } from "../components/ui/button";

interface ChatViewProps {
  brainId: string | undefined;
  onNavigate?: (view: string) => void;
}

export default function ChatView({ brainId, onNavigate }: ChatViewProps) {
  const aiAvailable = useHasAIAccess();
  const { isAdmin } = useAdminDevMode();
  const { messages, loading, pendingAction, send, confirm, cancel, clearHistory } =
    useChat(brainId);
  const { entries, entriesLoaded } = useEntries();
  const [noMemoryToast, setNoMemoryToast] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(
    () => readSuggestionsCache(brainId) ?? [],
  );

  useEffect(() => {
    if (!entriesLoaded || entries.length === 0) return;
    if (readSuggestionsCache(brainId) !== null) return; // still fresh
    const fresh = derivePrompts(entries);
    writeSuggestionsCache(brainId, fresh);
    setSuggestions(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally NOT depending on `entries` so suggestions stay stable while typing.
  }, [entriesLoaded, brainId]);

  const [input, setInput] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [sharedIdx, setSharedIdx] = useState<number | null>(null);
  const [_voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { listening, startVoice } = useVoiceRecorder({
    onTranscript: (t) => {
      setInput((prev) => (prev ? `${prev} ${t}` : t));
      setVoiceStatus(null);
    },
    onStatus: setVoiceStatus,
    onError: (msg) => {
      setVoiceError(msg);
      setTimeout(() => setVoiceError(null), 4000);
    },
    onLoading: setVoiceLoading,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || loading || voiceLoading) return;
    // Chat needs the LLM proxy; bail with a calm message and KEEP the typed
    // text so reconnect lets the user send without retyping.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast("You're offline · Chat needs internet. We'll keep your message ready.", {
        id: "chat-offline",
        duration: 4000,
      });
      return;
    }
    if (entriesLoaded && entries.length === 0) {
      setNoMemoryToast(true);
      setTimeout(() => setNoMemoryToast(false), 3000);
      return;
    }
    setInput("");
    send(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- voiceLoading is read but the callback should NOT be recreated on every voice-loading transition (causes the textarea-bound onKeyDown to remount and lose composition state).
  }, [input, loading, send, entries, entriesLoaded]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleExampleClick = useCallback(
    (prompt: string) => {
      send(prompt);
    },
    [send],
  );

  const handleCopy = useCallback((text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  }, []);

  const handleShare = useCallback(async (text: string, idx: number) => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        return;
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
    setSharedIdx(idx);
    setTimeout(() => setSharedIdx(null), 1500);
  }, []);

  const noMemory = entriesLoaded && entries.length === 0;

  if (!aiAvailable) {
    const goSettings = (tab: "ai" | "billing") => {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
      onNavigate?.("settings");
    };
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          background: "var(--bg)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 460,
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            borderRadius: 16,
            padding: 28,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div>
            <p
              className="f-serif"
              style={{
                fontSize: 22,
                fontStyle: "italic",
                color: "var(--ink)",
                lineHeight: 1.3,
                margin: 0,
              }}
            >
              Chat needs an AI provider.
            </p>
            <p
              className="f-sans"
              style={{
                fontSize: 13,
                color: "var(--ink-soft)",
                margin: "8px 0 0",
                lineHeight: 1.55,
              }}
            >
              Two ways to turn it on.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: "16px 16px 18px",
              border: "1px solid var(--line-soft)",
              borderRadius: 12,
              background: "var(--bg)",
            }}
          >
            <div className="f-sans" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              Bring your own key — free
            </div>
            <div
              className="f-sans"
              style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.55, margin: 0 }}
            >
              Paste a Gemini, OpenAI, Anthropic, or Groq key. We never see it.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goSettings("ai")}
              style={{ alignSelf: "flex-start", marginTop: 4 }}
            >
              Add an API key →
            </Button>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: "16px 16px 18px",
              border: "1px solid var(--ember-soft, var(--ember))",
              borderRadius: 12,
              background: "var(--bg)",
            }}
          >
            <div className="f-sans" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              Use ours — Starter $4.99/mo · Pro $9.99/mo
            </div>
            <div
              className="f-sans"
              style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.55, margin: 0 }}
            >
              Hosted Gemini Flash on Starter, Claude Sonnet on Pro. Cancel any time.
            </div>
            <Button
              size="sm"
              onClick={() => goSettings("billing")}
              style={{ alignSelf: "flex-start", marginTop: 4 }}
            >
              See plans →
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const composer = (
    <ChatComposer
      input={input}
      listening={listening}
      voiceLoading={voiceLoading}
      voiceError={voiceError}
      noMemory={noMemory}
      loading={loading}
      textareaRef={textareaRef}
      onInputChange={setInput}
      onKeyDown={handleKeyDown}
      onSend={handleSend}
      onStartVoice={startVoice}
    />
  );

  return (
    <div
      className="chat-root"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: "var(--bg)",
      }}
    >
      {noMemoryToast && (
        <div
          className="f-serif anim-fade-in-design"
          style={{
            position: "fixed",
            bottom: 110,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--surface-high)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "10px 20px",
            zIndex: "var(--z-toast)",
            fontSize: 14,
            fontStyle: "italic",
            color: "var(--ink-soft)",
            boxShadow: "var(--lift-2)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          add memories before chatting.
        </div>
      )}
      {/* ── Top bar ── */}
      <header
        className="chat-topbar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--line-soft)",
          gap: 20,
        }}
      >
        <div>
          <h1
            className="f-serif"
            style={{
              fontSize: 28,
              fontWeight: 450,
              letterSpacing: "-0.015em",
              lineHeight: 1.1,
              margin: 0,
              color: "var(--ink)",
            }}
          >
            Chat
          </h1>
          <div
            className="f-serif"
            style={{ fontSize: 14, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 4 }}
          >
            a conversation with your memory
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div
            className="chat-topbar-search"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 10px 0 14px",
              height: 40,
              minWidth: 280,
              background: "var(--surface)",
              border: "1px solid var(--line-soft)",
              borderRadius: 8,
              cursor: "pointer",
            }}
            onClick={() =>
              // OmniSearch listens on Cmd/Ctrl+/ since capture moved to Cmd+K.
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "/", metaKey: true, bubbles: true }),
              )
            }
          >
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
              style={{ color: "var(--ink-faint)", flexShrink: 0 }}
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span className="f-sans flex-1" style={{ fontSize: 13, color: "var(--ink-faint)" }}>
              Search everything
            </span>
            <span style={{ display: "inline-flex", gap: 2, flexShrink: 0 }}>
              <kbd
                className="f-sans"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  background: "var(--surface-low)",
                  border: "1px solid var(--line)",
                  borderRadius: 4,
                  fontSize: 11,
                  color: "var(--ink-faint)",
                  fontWeight: 500,
                }}
              >
                Ctrl
              </kbd>
              <kbd
                className="f-sans"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  background: "var(--surface-low)",
                  border: "1px solid var(--line)",
                  borderRadius: 4,
                  fontSize: 11,
                  color: "var(--ink-faint)",
                  fontWeight: 500,
                }}
              >
                /
              </kbd>
            </span>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              clear
            </Button>
          )}
        </div>
      </header>

      {messages.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex flex-1 flex-col" style={{ minHeight: 0, alignItems: "center" }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              padding: "40px 24px",
              maxWidth: 560,
              width: "100%",
              textAlign: "center",
            }}
          >
            {noMemory ? (
              <div className="flex flex-col items-center gap-4">
                <h2
                  className="f-serif"
                  style={{
                    fontSize: 24,
                    fontWeight: 400,
                    letterSpacing: "-0.01em",
                    color: "var(--ink)",
                    margin: 0,
                  }}
                >
                  Nothing to chat about yet.
                </h2>
                <p
                  className="f-serif"
                  style={{
                    fontSize: 15,
                    fontStyle: "italic",
                    color: "var(--ink-soft)",
                    margin: 0,
                    maxWidth: 360,
                    lineHeight: 1.5,
                  }}
                >
                  Capture a few thoughts first — chat draws on your own memories, not the open web.
                </p>
                <Button onClick={() => onNavigate?.("capture")} className="mt-1">
                  Capture a thought
                </Button>
              </div>
            ) : (
              <>
                <p
                  className="f-serif"
                  style={{
                    fontSize: 22,
                    fontStyle: "italic",
                    color: "var(--ink-soft)",
                    lineHeight: 1.4,
                    margin: 0,
                    letterSpacing: "-0.005em",
                  }}
                >
                  Ask me anything about what you've written down.
                </p>

                {suggestions.length > 0 && (
                  <div
                    style={{
                      marginTop: 40,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      width: "100%",
                    }}
                  >
                    {suggestions.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleExampleClick(prompt)}
                        disabled={loading}
                        className="press"
                        style={{
                          textAlign: "left",
                          padding: "12px 16px",
                          borderRadius: 10,
                          background: "var(--surface)",
                          border: "1px solid var(--line-soft)",
                          color: "var(--ink-soft)",
                          fontFamily: "var(--f-serif)",
                          fontSize: 14,
                          lineHeight: 1,
                          fontStyle: "italic",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          transition: "background 180ms, border-color 180ms, color 180ms",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--surface-high)";
                          e.currentTarget.style.color = "var(--ink)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "var(--surface)";
                          e.currentTarget.style.color = "var(--ink-soft)";
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {composer}
        </div>
      ) : (
        <>
          <ChatMessageList
            messages={messages}
            loading={loading}
            pendingAction={pendingAction}
            isAdmin={isAdmin}
            copiedIdx={copiedIdx}
            sharedIdx={sharedIdx}
            endRef={endRef}
            onCopy={handleCopy}
            onShare={handleShare}
            onConfirm={confirm}
            onCancel={cancel}
            onOpenVault={onNavigate ? () => onNavigate("vault") : undefined}
          />
          {composer}
        </>
      )}
    </div>
  );
}
