interface QuickCaptureChipsProps {
  onOpenCaptureWith: (initialText: string) => void;
}

const STARTERS = [
  { label: "meeting note", text: "" },
  { label: "fact about a person", text: "" },
  { label: "code or password", text: "" },
  { label: "idea worth keeping", text: "" },
];

export default function QuickCaptureChips({ onOpenCaptureWith }: QuickCaptureChipsProps) {
  return (
    <section>
      <div
        className="f-sans"
        style={{
          fontSize: 12,
          color: "var(--ink-faint)",
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 10,
          padding: "0 2px",
        }}
      >
        quick capture
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {STARTERS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onOpenCaptureWith(s.text)}
            className="design-chip f-sans press"
            style={{ fontSize: 13, padding: "8px 14px", cursor: "pointer" }}
          >
            + {s.label}
          </button>
        ))}
      </div>
    </section>
  );
}
