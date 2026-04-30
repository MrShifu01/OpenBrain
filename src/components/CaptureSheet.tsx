import { useState, useRef, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { useCaptureSheetParse } from "../hooks/useCaptureSheetParse";
import { useBrain as useBrainCtx } from "../context/BrainContext";
import type { Brain, Entry } from "../types";
import CapturePreviewPanel, { type PreviewState } from "./CapturePreviewPanel";
import CaptureSecretPanel, { type SecretForm } from "./CaptureSecretPanel";
import CaptureEntryBody from "./CaptureEntryBody";
import { isFeatureEnabled } from "../lib/featureFlags";
import { useAdminDevMode } from "../hooks/useAdminDevMode";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface CaptureSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (entry: Entry) => void;
  brainId?: string;
  cryptoKey?: CryptoKey | null;
  isOnline?: boolean;
  initialText?: string;
  onBackgroundFiles?: (files: File[]) => void;
  onBackgroundSave?: (entry: {
    title: string;
    content: string;
    type: string;
    tags: string[];
    metadata: Record<string, unknown>;
    rawContent?: string;
  }) => void;
  onNavigate?: (id: string) => void;
  /** Power-feature: when true, show the Someday toggle in the action bar.
   *  When the user toggles it on, Capture skips AI classification and stores
   *  the raw text as type="someday" — a no-date GTD inbox item. */
  somedayEnabled?: boolean;
}

export default function CaptureSheet({
  isOpen,
  onClose,
  onCreated,
  brainId,
  cryptoKey,
  isOnline = true,
  initialText,
  onBackgroundFiles: _onBackgroundFiles,
  onBackgroundSave,
  onNavigate,
  somedayEnabled = false,
}: CaptureSheetProps) {
  const [text, setText] = useState("");
  const [activeTab, setActiveTab] = useState<"entry" | "secret">("entry");
  const [somedayActive, setSomedayActive] = useState(false);
  const [secretForm, setSecretForm] = useState<SecretForm>({ title: "", content: "" });
  const [secretSaving, setSecretSaving] = useState(false);
  const [secretError, setSecretError] = useState("");

  const brainCtx = useBrainCtx(); // keep context subscription warm + give pill access
  const { adminFlags } = useAdminDevMode();
  const showBrainPill = isFeatureEnabled("multiBrain", adminFlags);
  // Per-capture brain override — does NOT change app-wide active brain.
  const [captureBrain, setCaptureBrain] = useState<Brain | null>(null);
  const effectiveBrainId = captureBrain?.id ?? brainId;
  const [showSavedWhisper, setShowSavedWhisper] = useState(false);

  // Drag-to-close + entrance animation
  const [dragY, setDragY] = useState(0);
  const [visible, setVisible] = useState(false);

  const {
    loading,
    setLoading,
    extracting,
    status,
    setStatus,
    errorDetail,
    setErrorDetail,
    fileParseError,
    setFileParseError,
    retryLastFile,
    preview,
    setPreview,
    previewTitle,
    setPreviewTitle,
    previewTags,
    setPreviewTags,
    previewType,
    setPreviewType,
    uploadedFiles,
    removeUploadedFile,
    resetState,
    capture,
    doSave,
    confirmSave,
    handleImageFile,
    handleDocFiles,
  } = useCaptureSheetParse({
    brainId: effectiveBrainId,
    isOnline,
    cryptoKey,
    onCreated,
    onClose,
    onBackgroundSave,
  });

  const { listening, startVoice, resetListening } = useVoiceRecorder({
    onTranscript: (t) => setText((prev) => (prev ? `${prev} ${t}` : t)),
    onStatus: setStatus,
    onError: setErrorDetail,
    onLoading: setLoading,
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialText) setText(initialText);
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      requestAnimationFrame(() => {
        setVisible(true);
        requestAnimationFrame(() => textareaRef.current?.focus());
      });
      return () => {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        window.scrollTo(0, scrollY);
      };
    } else {
      setVisible(false);
      setText("");
      setActiveTab("entry");
      setSomedayActive(false);
      setSecretForm({ title: "", content: "" });
      setSecretError("");
      setCaptureBrain(null);
      resetState();
      setLoading(false);
      resetListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialText/resetState/setLoading are stable across renders by design (parent-owned); adding them would re-run the open/close branch every render and stomp on user typing.
  }, [isOpen, resetListening]);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle || !isOpen) return;
    let startY = 0;
    let tracking = false;
    const onStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      tracking = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        e.preventDefault();
        // Rubber-band resistance past 200px so the throw feels weighty
        // instead of running away to the bottom of the screen.
        const eased = dy < 200 ? dy : 200 + (dy - 200) * 0.4;
        setDragY(eased);
      } else if (dy < -8) {
        // Reverse swipe cancels the gesture cleanly.
        tracking = false;
        setDragY(0);
      }
    };
    const onEnd = () => {
      tracking = false;
      setDragY((prev) => {
        if (prev > 80) {
          setVisible(false);
          setTimeout(onClose, 360);
        }
        return 0;
      });
    };
    handle.addEventListener("touchstart", onStart, { passive: true });
    handle.addEventListener("touchmove", onMove, { passive: false });
    handle.addEventListener("touchend", onEnd, { passive: true });
    handle.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      handle.removeEventListener("touchstart", onStart);
      handle.removeEventListener("touchmove", onMove);
      handle.removeEventListener("touchend", onEnd);
      handle.removeEventListener("touchcancel", onEnd);
    };
  }, [isOpen, onClose]);

  // Tab focus + Escape handled by Radix Dialog primitive below.
  // Preview-aware Escape (back-to-typing instead of close) goes through
  // onEscapeKeyDown on Content.

  // Flash a serif italic "saved." for 900ms after a successful save.
  useEffect(() => {
    if (status === "saved") {
      setShowSavedWhisper(true);
      const t = setTimeout(() => setShowSavedWhisper(false), 900);
      return () => clearTimeout(t);
    }
  }, [status]);

  if (!isOpen && !visible) return null;

  const statusLabel: Record<string, string> = {
    thinking: "reading your entry…",
    saving: "saving…",
    saved: "saved.",
    reading: "reading image…",
    transcribing: "transcribing…",
    splitting: "splitting document into entries…",
  };

  // ── render ────────────────────────────────────────────────────────────────
  const canSave =
    activeTab === "entry"
      ? text.trim().length > 0 || uploadedFiles.length > 0
      : secretForm.title.trim().length > 0 && secretForm.content.trim().length > 0;

  const handleSave = () => {
    if (activeTab !== "entry") return;
    if (somedayActive) {
      // Skip AI classification — raw text saved verbatim as GTD-inbox item.
      // Someday entries have no date; Schedule action in TodoView later flips
      // them to type="todo" with metadata.due_date.
      const t = text.trim();
      if (!t) return;
      const title = t.length > 60 ? t.slice(0, 57) + "…" : t;
      doSave({ title, content: t, type: "someday", tags: [], metadata: {} }, t);
      setText("");
      return;
    }
    capture(text, () => setText(""));
  };

  const toggleSomeday = () => {
    if (!somedayEnabled) return;
    setSomedayActive((v) => !v);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const toggleVault = () => {
    if (activeTab === "entry") {
      if (!cryptoKey) {
        if (onNavigate) onNavigate("vault");
        return;
      }
      setActiveTab("secret");
    } else {
      setActiveTab("entry");
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  // Bridge between PreviewState object and hook's individual state setters
  const previewStateObj: PreviewState = {
    title: previewTitle,
    tags: previewTags,
    type: previewType,
  };

  const handlePreviewChange = (next: PreviewState) => {
    setPreviewTitle(next.title);
    setPreviewTags(next.tags);
    setPreviewType(next.type);
  };

  return (
    <DialogPrimitive.Root
      open={isOpen || visible}
      onOpenChange={(o) => {
        if (o) return;
        // Escape (Radix-driven close): preview-aware path goes back to
        // typing instead of closing.
        if (preview) {
          setPreview(null);
          setText(preview._raw || "");
          return;
        }
        // Run our exit animation, then tell parent to unmount.
        setVisible(false);
        setTimeout(onClose, 360);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50"
          style={{
            background: "var(--scrim)",
            opacity: visible ? Math.max(0, 1 - dragY / 350) : 0,
            transition: dragY > 0 ? "none" : "opacity 0.32s ease",
          }}
        />
        <DialogPrimitive.Content
          ref={sheetRef}
          aria-modal="true"
          aria-label={preview ? "Confirm entry" : "Capture something"}
          className="capture-sheet"
          onEscapeKeyDown={(e) => {
            // Preview-aware: keep the preview→typing path. Radix's
            // onOpenChange already handles the regular case.
            if (preview) {
              e.preventDefault();
              setPreview(null);
              setText(preview._raw || "");
            }
          }}
          onPointerDownOutside={(e) => {
            // Preview-aware: don't dismiss while reviewing.
            if (preview) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (preview) e.preventDefault();
          }}
          style={{
            background: "var(--surface-high)",
            border: "1px solid var(--line)",
            boxShadow: "var(--lift-3)",
            ["--capture-y" as string]: dragY > 0 ? `${dragY}px` : visible ? "0px" : "100%",
            transition:
              dragY > 0
                ? "none"
                : "--capture-y 0.36s cubic-bezier(0.22, 1, 0.36, 1), transform 0.36s cubic-bezier(0.22, 1, 0.36, 1)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {preview ? "Confirm entry" : "Capture something"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Quickly capture a thought, image, document, or voice note.
          </DialogPrimitive.Description>
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {loading ? "Processing your entry…" : (status ?? "")}
          </div>

          {/* Top strip — drag handle (mobile only, centered) + per-capture
              brain pill (right-aligned, only when multi-brain). The whole
              strip is the swipe-to-close grab region so users don't have
              to hit the tiny pill. */}
          <div
            ref={handleRef}
            className="touch-none lg:touch-auto"
            style={{
              position: "relative",
              minHeight: 36,
              paddingTop: 10,
              paddingBottom: 6,
            }}
          >
            <div
              className="lg:hidden"
              style={{
                position: "absolute",
                left: "50%",
                top: 10,
                transform: "translateX(-50%)",
                width: 40,
                height: 5,
                borderRadius: 999,
                background: "var(--line)",
                pointerEvents: "none",
              }}
              aria-hidden="true"
            />
          </div>

          {/* Body */}
          {preview ? (
            <CapturePreviewPanel
              preview={previewStateObj}
              onPreviewChange={handlePreviewChange}
              onBack={() => {
                setPreview(null);
                setText(preview._raw || "");
              }}
              onConfirm={confirmSave}
              loading={loading}
              errorDetail={errorDetail}
            />
          ) : activeTab === "secret" ? (
            <CaptureSecretPanel
              form={secretForm}
              onFormChange={setSecretForm}
              saving={secretSaving}
              error={secretError}
              onBack={toggleVault}
              onSave={async () => {
                if (!secretForm.title.trim() || !secretForm.content.trim()) return;
                setSecretSaving(true);
                setSecretError("");
                await doSave({
                  title: secretForm.title.trim(),
                  content: secretForm.content,
                  type: "secret",
                  tags: [],
                  metadata: {},
                });
                setSecretSaving(false);
                if (errorDetail) setSecretError(errorDetail);
                else setSecretForm({ title: "", content: "" });
              }}
            />
          ) : (
            <CaptureEntryBody
              text={text}
              onTextChange={setText}
              uploadedFiles={uploadedFiles}
              listening={listening}
              loading={loading}
              extracting={extracting}
              showSavedWhisper={showSavedWhisper}
              canSave={canSave}
              cryptoKey={cryptoKey}
              activeTab={activeTab}
              somedayEnabled={somedayEnabled}
              somedayActive={somedayActive}
              brainPill={
                showBrainPill && brainCtx.brains.length > 1 ? (
                  <CaptureBrainPill
                    brains={brainCtx.brains}
                    activeBrain={brainCtx.activeBrain}
                    captureBrain={captureBrain}
                    onPick={(b) => setCaptureBrain(b.id === brainCtx.activeBrain?.id ? null : b)}
                  />
                ) : undefined
              }
              statusInfo={{
                status,
                errorDetail,
                fileParseError,
                statusLabel,
              }}
              handlers={{
                onSave: handleSave,
                onStartVoice: startVoice,
                onToggleVault: toggleVault,
                onToggleSomeday: toggleSomeday,
                onRemoveFile: removeUploadedFile,
                onAttachFiles: (files) => {
                  handleDocFiles(files).catch((err) => console.error("[docInput]", err));
                },
                onImageFile: handleImageFile,
                onRetryFile: retryLastFile,
                onManualFill: () => {
                  setFileParseError(null);
                  setErrorDetail(null);
                  setPreview({ title: "", content: "", type: "note", tags: [] });
                  setPreviewTitle("");
                  setPreviewTags("");
                  setPreviewType("note");
                },
              }}
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ── Per-capture brain override pill ────────────────────────────────────────
// Lightweight inline picker. Doesn't change the app-wide active brain.
// Resets each time the sheet closes.

interface CaptureBrainPillProps {
  brains: Brain[];
  activeBrain: Brain | null;
  captureBrain: Brain | null;
  onPick: (b: Brain) => void;
}

function CaptureBrainPill({ brains, activeBrain, captureBrain, onPick }: CaptureBrainPillProps) {
  const target = captureBrain ?? activeBrain;
  if (!target) return null;
  const personal = brains.find((b) => b.is_personal);
  const others = brains.filter((b) => !b.is_personal).sort((a, b) => a.name.localeCompare(b.name));
  const sorted = personal ? [personal, ...others] : others;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Capture into ${target.name} — change brain`}
        className="press"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 6px",
          margin: "0 -6px",
          background: "transparent",
          border: 0,
          borderRadius: 6,
          color: "var(--ink-soft)",
          fontFamily: "var(--f-sans)",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          maxWidth: 240,
        }}
      >
        <span style={{ opacity: 0.7 }}>Capturing to&nbsp;</span>
        <span
          style={{
            color: captureBrain ? "var(--ember)" : "var(--ink)",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {target.name}
        </span>
        <svg
          aria-hidden="true"
          width="11"
          height="11"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
          style={{ flexShrink: 0, opacity: 0.55, marginLeft: 1 }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        {sorted.map((b) => {
          const selected = b.id === target.id;
          return (
            <DropdownMenuItem
              key={b.id}
              onSelect={() => onPick(b)}
              style={{ background: selected ? "var(--ember-wash)" : undefined }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {b.name}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
