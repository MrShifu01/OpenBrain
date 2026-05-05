// Fullscreen voice capture modal — replaces the inline mic button's
// quick-record behavior with a focused, deliberate capture surface.
// Pattern matches ChatGPT voice mode / WhatsApp lock-mode / Voice Memos:
// fullscreen takeover, dim background, big record button at thumb reach.
//
// Lifecycle:
//   open  → mount + fade/translate in (240ms) + auto-start mic
//   talk  → ember pulse ring around button, big f-serif timer
//   stop  → tap big button → transition to "transcribing…" with spinner
//   done  → onTranscript(text) called, then onClose() — fade/translate out
//   cancel → top-left X drops the recording, no transcript fired
//
// Design tokens used: --ember, --ember-ink, --ink, --ink-soft, --bg,
// --line-soft, --danger, --lift-3. Serif (f-serif) for the timer +
// status; sans defaults elsewhere. Press feedback via the .press class.
//
// Renders via createPortal so it sits at document root and isn't trapped
// inside any ancestor stacking context (same pattern as the Schedule
// drawer + Capture sheet). z-modal-backdrop (70) puts it above the
// bottom nav so the user sees only the recording surface.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onTranscript: (text: string) => void;
}

type Phase = "idle" | "recording" | "transcribing" | "error";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VoiceCaptureModal({ isOpen, onClose, onTranscript }: Props) {
  // Two-stage open/close like the other sheets — separate `mounted`
  // (DOM presence) from `visible` (open state) so the exit fade can
  // run before unmount.
  const [mounted, setMounted] = useState(isOpen);
  const [visible, setVisible] = useState(false);

  // Phase machine. Drives label + button icon + disabled states.
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const transcriptFiredRef = useRef(false);

  const { startVoice, stopRecording, resetListening } = useVoiceRecorder({
    onTranscript: (t) => {
      // Only fire once per session — useVoiceRecorder can synthesize an
      // empty transcript on cancel that we want to ignore.
      if (transcriptFiredRef.current) return;
      transcriptFiredRef.current = true;
      if (t.trim()) onTranscript(t.trim());
      // Animate close.
      setVisible(false);
      window.setTimeout(onClose, 240);
    },
    onStatus: (s) => {
      if (s === "transcribing") setPhase("transcribing");
    },
    onError: (msg) => {
      setPhase("error");
      setErrorMessage(msg);
    },
    onLoading: () => {
      /* phase already covers loading; no-op */
    },
  });

  // Mount/unmount + fade timing.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      transcriptFiredRef.current = false;
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const id = window.setTimeout(() => {
      setMounted(false);
      setPhase("idle");
      setSeconds(0);
      setErrorMessage(null);
    }, 240);
    return () => window.clearTimeout(id);
  }, [isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Auto-start recording once the modal is visible. Wait one tick past
  // `visible` flipping true so iOS doesn't have to fight the fade-in
  // animation while it's prompting for mic permission.
  useEffect(() => {
    if (!visible) return;
    if (phase !== "idle") return;
    const id = window.setTimeout(() => {
      setPhase("recording");
      setSeconds(0);
      startVoice();
    }, 120);
    return () => window.clearTimeout(id);
  }, [visible, phase, startVoice]);

  // Tick the timer while recording.
  useEffect(() => {
    if (phase !== "recording") return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const handleStop = () => {
    if (phase === "recording") {
      stopRecording();
      // useVoiceRecorder fires onStatus("transcribing") → phase flips
      // automatically. If for some reason it doesn't, the button still
      // responds visually because we set transcribing here too.
      setPhase("transcribing");
    }
  };

  const handleCancel = () => {
    transcriptFiredRef.current = true; // suppress any late onTranscript
    if (phase === "recording") {
      stopRecording();
    }
    resetListening();
    setVisible(false);
    window.setTimeout(() => {
      onClose();
    }, 240);
  };

  if (!mounted || typeof document === "undefined") return null;

  const statusLabel =
    phase === "recording"
      ? "listening…"
      : phase === "transcribing"
        ? "transcribing…"
        : phase === "error"
          ? (errorMessage ?? "recording failed")
          : "";

  // Big button visuals. Recording shows a square stop glyph; transcribing
  // shows a spinner; error shows a refresh; idle shows the mic.
  const buttonBg = phase === "error" ? "var(--danger)" : "var(--ember)";
  const buttonDisabled = phase === "transcribing";

  return createPortal(
    <>
      {/* Pulse keyframes inline so this component owns its visual
          contract — no dependency on a class added elsewhere. */}
      <style>{`
        @keyframes voice-pulse-ring {
          0%   { transform: scale(1);   opacity: 0.55; }
          100% { transform: scale(1.6); opacity: 0;    }
        }
        @keyframes voice-spinner {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Voice capture"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: "var(--z-modal-backdrop)",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "space-between",
          padding:
            "calc(20px + env(safe-area-inset-top)) 20px calc(48px + env(safe-area-inset-bottom))",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 240ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Top row — cancel X */}
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <button
            onClick={handleCancel}
            aria-label="Cancel"
            className="press"
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: "transparent",
              border: "1px solid var(--line-soft)",
              color: "var(--ink-soft)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Middle — timer + status text. Kept up here, not next to the
            button, so the user's thumb hovering near the bottom doesn't
            obscure the read-out. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            flex: 1,
            justifyContent: "center",
          }}
        >
          <span
            className="f-serif"
            style={{
              fontSize: 64,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {formatTime(seconds)}
          </span>
          <span
            className="f-serif"
            style={{
              fontSize: 16,
              fontStyle: "italic",
              color: phase === "error" ? "var(--danger)" : "var(--ink-soft)",
              minHeight: "1.4em",
            }}
          >
            {statusLabel}
          </span>
        </div>

        {/* Bottom — big circular record/stop button at thumb reach.
            Pulse rings emanate from underneath while recording. */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
          }}
        >
          {phase === "recording" && (
            <>
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  width: 120,
                  height: 120,
                  borderRadius: 999,
                  background: "var(--ember)",
                  opacity: 0.35,
                  animation: "voice-pulse-ring 1.6s ease-out infinite",
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  width: 120,
                  height: 120,
                  borderRadius: 999,
                  background: "var(--ember)",
                  opacity: 0.25,
                  animation: "voice-pulse-ring 1.6s ease-out infinite 0.6s",
                }}
              />
            </>
          )}
          <button
            onClick={phase === "error" ? handleCancel : handleStop}
            disabled={buttonDisabled}
            aria-label={phase === "recording" ? "Stop recording" : "Cancel"}
            className="press"
            style={{
              position: "relative",
              width: 120,
              height: 120,
              minHeight: 120,
              borderRadius: 999,
              background: buttonBg,
              color: "var(--ember-ink)",
              border: 0,
              cursor: buttonDisabled ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--lift-3)",
              opacity: buttonDisabled ? 0.7 : 1,
              transition: "transform 180ms ease, opacity 180ms ease",
            }}
          >
            {phase === "recording" ? (
              // Square stop glyph
              <span
                aria-hidden="true"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  background: "var(--ember-ink)",
                }}
              />
            ) : phase === "transcribing" ? (
              // Spinner ring
              <span
                aria-hidden="true"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  border: "3px solid color-mix(in oklch, var(--ember-ink) 40%, transparent)",
                  borderTopColor: "var(--ember-ink)",
                  animation: "voice-spinner 0.8s linear infinite",
                }}
              />
            ) : phase === "error" ? (
              // Refresh / retry — but tap goes through to handleCancel
              <svg
                width="36"
                height="36"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              // Idle — mic glyph
              <svg
                width="40"
                height="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <rect x="9" y="3" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
