import { useState, useRef } from "react";
import { authFetch } from "../../lib/authFetch";

export interface ScanResultItem {
  entryId: string;
  title: string;
  summary: string;
  from: string;
  subject: string;
  emailType: string;
  urgency: string;
  amount?: string | null;
  dueDate?: string | null;
}

interface Props {
  items: ScanResultItem[];
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  "invoices":             "Invoice",
  "action-required":      "Action required",
  "subscription-renewal": "Subscription",
  "appointment":          "Appointment",
  "deadline":             "Deadline",
  "delivery":             "Delivery",
  "signing-requests":     "Signing",
};

const URGENCY_COLORS: Record<string, string> = {
  high:   "var(--blood)",
  medium: "var(--ember)",
  low:    "var(--ink-faint)",
};

const SWIPE_THRESHOLD = 85;

export default function GmailScanReviewModal({ items, onClose }: Props) {
  const capped = items.slice(0, 10);
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const [done, setDone] = useState(false);
  const [rulesAdded, setRulesAdded] = useState(0);

  const startX = useRef(0);
  const dragging = useRef(false);
  const rulesRef = useRef(0);

  const current = capped[index];
  const next = capped[index + 1];

  function advance(capturedIdx: number) {
    setExiting(null);
    setDragX(0);
    setTransitioning(false);
    if (capturedIdx >= capped.length - 1) {
      setDone(true);
      setRulesAdded(rulesRef.current);
    } else {
      setIndex(capturedIdx + 1);
    }
  }

  function triggerAccept(capturedIdx: number) {
    setTransitioning(true);
    setExiting("right");
    setDragX(700);
    setTimeout(() => advance(capturedIdx), 300);
  }

  function triggerReject(capturedIdx: number) {
    const item = capped[capturedIdx];
    authFetch("/api/gmail?action=ignore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: item.subject,
        from: item.from,
        email_type: item.emailType,
        content_preview: item.summary,
      }),
    }).then(() => { rulesRef.current++; }).catch(() => {});
    setTransitioning(true);
    setExiting("left");
    setDragX(-700);
    setTimeout(() => advance(capturedIdx), 300);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (exiting || done) return;
    startX.current = e.clientX;
    dragging.current = true;
    setTransitioning(false);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current || exiting) return;
    setDragX(e.clientX - startX.current);
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    const dx = dragX;
    setTransitioning(true);
    if (dx > SWIPE_THRESHOLD) {
      triggerAccept(index);
    } else if (dx < -SWIPE_THRESHOLD) {
      triggerReject(index);
    } else {
      setDragX(0);
    }
  }

  const keepOpacity = Math.min(Math.max(dragX / 100, 0), 1);
  const skipOpacity = Math.min(Math.max(-dragX / 100, 0), 1);
  const backScale = 0.94 + Math.min(Math.abs(dragX) / 800, 0.06);
  const backY = 10 - Math.min(Math.abs(dragX) / 50, 10);

  const cardTransition = transitioning
    ? exiting ? "transform 300ms ease-in" : "transform 350ms cubic-bezier(0.34,1.56,0.64,1)"
    : "none";

  if (done) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      >
        <div
          style={{
            background: "var(--bg)",
            borderRadius: 24,
            padding: "48px 32px 40px",
            maxWidth: 360,
            width: "calc(100% - 48px)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <h3 className="f-serif" style={{ fontSize: 22, fontWeight: 450, color: "var(--ink)", margin: "0 0 10px" }}>
            All reviewed
          </h3>
          <p className="f-serif" style={{ fontSize: 14, color: "var(--ink-faint)", fontStyle: "italic", lineHeight: 1.6, margin: "0 0 28px" }}>
            {rulesAdded > 0
              ? `${rulesAdded} exclusion rule${rulesAdded !== 1 ? "s" : ""} added to your preferences — future scans will be smarter.`
              : "No changes made — your preferences are unchanged."}
          </p>
          <button
            onClick={onClose}
            className="press f-sans"
            style={{
              width: "100%",
              height: 44,
              borderRadius: 12,
              border: "none",
              background: "var(--ember)",
              color: "var(--ember-ink)",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-end"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          height: "88vh",
          display: "flex",
          flexDirection: "column",
          padding: "20px 20px 32px",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4" style={{ flexShrink: 0 }}>
          <div>
            <h3 className="f-serif" style={{ margin: 0, fontSize: 19, fontWeight: 450, color: "#fff" }}>
              Review captures
            </h3>
            <p className="f-sans" style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
              Keep what's useful · skip the rest
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="f-sans" style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
              {index + 1} / {capped.length}
            </span>
            <button
              onClick={onClose}
              className="f-sans"
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "none",
                borderRadius: 999,
                color: "rgba(255,255,255,0.7)",
                fontSize: 13,
                fontWeight: 500,
                padding: "5px 12px",
                cursor: "pointer",
              }}
            >
              Skip all
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, borderRadius: 999, background: "rgba(255,255,255,0.15)", marginBottom: 16, flexShrink: 0 }}>
          <div
            style={{
              height: "100%",
              borderRadius: 999,
              background: "var(--ember)",
              width: `${((index) / capped.length) * 100}%`,
              transition: "width 300ms ease-out",
            }}
          />
        </div>

        {/* Card stack */}
        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>

          {/* Back card */}
          {next && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 20,
                background: "var(--surface)",
                border: "1px solid var(--line-soft)",
                transform: `scale(${backScale}) translateY(${backY}px)`,
                transition: transitioning ? "transform 300ms ease-out" : "none",
                transformOrigin: "bottom center",
                overflow: "hidden",
                padding: "28px 24px",
                boxSizing: "border-box",
              }}
            >
              <CardContent item={next} dragX={0} />
            </div>
          )}

          {/* Front card — draggable */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 20,
              background: "var(--bg)",
              border: "1px solid var(--line-soft)",
              transform: `translateX(${dragX}px) rotate(${dragX * 0.03}deg)`,
              transition: cardTransition,
              transformOrigin: "bottom center",
              overflow: "hidden",
              padding: "28px 24px",
              boxSizing: "border-box",
              cursor: exiting ? "default" : "grab",
              userSelect: "none",
              touchAction: "none",
            }}
          >
            {/* KEEP label */}
            <div
              style={{
                position: "absolute",
                top: 28,
                left: 20,
                opacity: keepOpacity,
                transform: "rotate(-12deg)",
                border: "2.5px solid var(--moss)",
                borderRadius: 6,
                padding: "3px 10px",
                color: "var(--moss)",
                fontFamily: "var(--f-sans)",
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "0.06em",
                pointerEvents: "none",
                zIndex: 2,
              }}
            >
              KEEP
            </div>

            {/* SKIP label */}
            <div
              style={{
                position: "absolute",
                top: 28,
                right: 20,
                opacity: skipOpacity,
                transform: "rotate(12deg)",
                border: "2.5px solid var(--blood)",
                borderRadius: 6,
                padding: "3px 10px",
                color: "var(--blood)",
                fontFamily: "var(--f-sans)",
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "0.06em",
                pointerEvents: "none",
                zIndex: 2,
              }}
            >
              SKIP
            </div>

            <CardContent item={current} dragX={dragX} />
          </div>
        </div>

        {/* Hint text */}
        <p
          className="f-sans"
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "rgba(255,255,255,0.4)",
            margin: "14px 0 16px",
            flexShrink: 0,
          }}
        >
          ← skip this type &nbsp;·&nbsp; keep it →
        </p>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-10" style={{ flexShrink: 0 }}>
          <button
            onClick={() => { setTransitioning(true); triggerReject(index); }}
            disabled={!!exiting}
            className="press"
            style={{
              width: 62,
              height: 62,
              borderRadius: "50%",
              border: "2px solid var(--blood)",
              background: "rgba(0,0,0,0.3)",
              color: "var(--blood)",
              fontSize: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              backdropFilter: "blur(8px)",
              transition: "transform 120ms, background 120ms",
            }}
            aria-label="Skip this type"
          >
            ✕
          </button>

          <button
            onClick={() => { setTransitioning(true); triggerAccept(index); }}
            disabled={!!exiting}
            className="press"
            style={{
              width: 62,
              height: 62,
              borderRadius: "50%",
              border: "2px solid var(--moss)",
              background: "rgba(0,0,0,0.3)",
              color: "var(--moss)",
              fontSize: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              backdropFilter: "blur(8px)",
              transition: "transform 120ms, background 120ms",
            }}
            aria-label="Keep this type"
          >
            ✓
          </button>
        </div>
      </div>
    </div>
  );
}

function CardContent({ item, dragX }: { item: ScanResultItem; dragX: number }) {
  const senderName = item.from.replace(/<.*>/, "").trim() || item.from;
  const urgencyColor = URGENCY_COLORS[item.urgency] ?? "var(--ink-faint)";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Category badge */}
      <div style={{ marginBottom: 20 }}>
        <span
          className="f-sans"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            padding: "4px 10px",
            borderRadius: 999,
            background: "var(--ember-wash)",
            color: "var(--ember)",
          }}
        >
          {TYPE_LABELS[item.emailType] ?? item.emailType}
        </span>
        {item.urgency === "high" && (
          <span
            className="f-sans"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "4px 10px",
              borderRadius: 999,
              background: "var(--blood-wash)",
              color: "var(--blood)",
              marginLeft: 6,
            }}
          >
            Urgent
          </span>
        )}
      </div>

      {/* Title */}
      <h2
        className="f-serif"
        style={{
          fontSize: 22,
          fontWeight: 500,
          color: "var(--ink)",
          margin: "0 0 8px",
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
        }}
      >
        {item.title}
      </h2>

      {/* Sender */}
      <p
        className="f-serif"
        style={{
          fontSize: 13,
          color: "var(--ink-faint)",
          fontStyle: "italic",
          margin: "0 0 20px",
          lineHeight: 1.4,
        }}
      >
        {senderName}
      </p>

      {/* Summary */}
      {item.summary && (
        <p
          className="f-sans"
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            lineHeight: 1.6,
            margin: "0 0 20px",
          }}
        >
          {item.summary}
        </p>
      )}

      {/* Amount / due date chips */}
      {(item.amount || item.dueDate) && (
        <div className="flex gap-2 flex-wrap" style={{ marginBottom: 20 }}>
          {item.amount && (
            <span
              className="f-sans"
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 999,
                background: "var(--surface-high)",
                color: "var(--ink)",
                border: "1px solid var(--line-soft)",
              }}
            >
              {item.amount}
            </span>
          )}
          {item.dueDate && (
            <span
              className="f-sans"
              style={{
                fontSize: 13,
                fontWeight: 500,
                padding: "5px 12px",
                borderRadius: 999,
                background: "var(--surface-high)",
                color: urgencyColor,
                border: `1px solid ${urgencyColor}`,
              }}
            >
              Due {new Date(item.dueDate).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      )}

      {/* Drag hint on first card — shown only when not dragging */}
      <div style={{ flex: 1 }} />
      <div
        style={{
          borderTop: "1px solid var(--line-soft)",
          paddingTop: 14,
          display: "flex",
          justifyContent: "center",
          gap: 6,
          opacity: Math.max(0, 1 - Math.abs(dragX) / 40),
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "var(--ink-ghost)",
              display: "block",
            }}
          />
        ))}
      </div>
    </div>
  );
}
