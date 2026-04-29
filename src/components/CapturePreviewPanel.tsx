import { useEffect, useRef } from "react";
import { CANONICAL_TYPES } from "../types";
import { IconArrowLeft } from "./captureIcons";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export interface PreviewState {
  title: string;
  tags: string;
  type: string;
}

interface Props {
  preview: PreviewState;
  onPreviewChange: (next: PreviewState) => void;
  onBack: () => void;
  onConfirm: () => void;
  loading: boolean;
  errorDetail: string | null;
}

export default function CapturePreviewPanel({
  preview,
  onPreviewChange,
  onBack,
  onConfirm,
  loading,
  errorDetail,
}: Props) {
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Focus title on mount
  useEffect(() => {
    requestAnimationFrame(() => titleInputRef.current?.focus());
  }, []);

  return (
    <div
      style={{
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        overflowY: "auto",
      }}
    >
      <div className="flex items-center justify-between">
        <h2
          className="f-serif"
          style={{ fontSize: 20, fontWeight: 450, color: "var(--ink)", margin: 0 }}
        >
          before saving
        </h2>
        <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back">
          {IconArrowLeft}
        </Button>
      </div>

      {errorDetail && (
        <p
          style={{
            fontFamily: "var(--f-mono)",
            fontSize: 12,
            color: "var(--blood)",
            wordBreak: "break-all",
            margin: 0,
          }}
        >
          {errorDetail}
        </p>
      )}

      <div>
        <div className="micro" style={{ marginBottom: 6 }}>
          Title
        </div>
        <input
          ref={titleInputRef}
          value={preview.title}
          onChange={(e) => onPreviewChange({ ...preview, title: e.target.value })}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onConfirm();
          }}
          className="design-input f-serif"
          style={{ fontSize: 16 }}
        />
      </div>

      <div>
        <div className="micro" style={{ marginBottom: 6 }}>
          Type
        </div>
        <Select
          value={preview.type}
          onValueChange={(v) => onPreviewChange({ ...preview, type: v })}
        >
          <SelectTrigger className="design-input f-sans w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CANONICAL_TYPES.filter((t) => t !== "secret").map((t) => (
              <SelectItem key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="micro" style={{ marginBottom: 6 }}>
          Tags
        </div>
        <input
          value={preview.tags}
          onChange={(e) => onPreviewChange({ ...preview, tags: e.target.value })}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onConfirm();
          }}
          placeholder="tag1, tag2"
          className="design-input f-sans"
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 4,
          paddingTop: 12,
          borderTop: "1px solid var(--line-soft)",
        }}
      >
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          onClick={onConfirm}
          disabled={!preview.title.trim() || loading}
          className="flex-[2]"
        >
          {loading ? "Saving…" : preview.type === "secret" ? "Save to vault" : "Save"}
        </Button>
      </div>
    </div>
  );
}
