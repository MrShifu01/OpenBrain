import { useState, useRef, useEffect } from "react";
import { TIERS, type TierId } from "../lib/tiers";

export default function TierPreviewToggle() {
  const [selected, setSelected] = useState<TierId | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setSelected(null);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [selected]);

  const tier = TIERS.find((t) => t.id === selected);

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", alignItems: "center", gap: 2 }}>
      {TIERS.map((t) => (
        <button
          key={t.id}
          onClick={() => setSelected(selected === t.id ? null : t.id)}
          className="press f-sans"
          style={{
            height: 26,
            padding: "0 7px",
            borderRadius: 6,
            border: selected === t.id ? "none" : "1px solid var(--line-soft)",
            background: selected === t.id ? "var(--ember)" : "transparent",
            color: selected === t.id ? "var(--ember-ink)" : "var(--ink-faint)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.02em",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {t.label}
        </button>
      ))}

      {tier && (
        <div
          style={{
            position: "fixed",
            top: 64,
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(300px, calc(100vw - 32px))",
            background: "var(--surface-high)",
            border: "1px solid var(--line-soft)",
            borderRadius: 14,
            boxShadow: "var(--lift-3)",
            zIndex: 300,
            padding: "16px 18px 18px",
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <div className="f-serif" style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", margin: 0 }}>
              {tier.label}
            </div>
            <div className="f-sans" style={{ fontSize: 12, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 2 }}>
              {tier.subtitle}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: tier.missing.length > 0 ? 12 : 0 }}>
            <div className="f-sans" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--moss)", marginBottom: 4 }}>
              Included
            </div>
            {tier.included.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                <span className="f-sans" style={{ fontSize: 12, color: "var(--moss)", flexShrink: 0, lineHeight: "18px" }}>✓</span>
                <span className="f-sans" style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: "18px" }}>{f}</span>
              </div>
            ))}
          </div>

          {tier.missing.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div className="f-sans" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-ghost)", marginBottom: 4 }}>
                Not included
              </div>
              {tier.missing.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                  <span className="f-sans" style={{ fontSize: 12, color: "var(--ink-ghost)", flexShrink: 0, lineHeight: "18px" }}>–</span>
                  <span className="f-sans" style={{ fontSize: 12, color: "var(--ink-ghost)", lineHeight: "18px" }}>{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
