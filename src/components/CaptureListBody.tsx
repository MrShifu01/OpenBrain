/**
 * CaptureListBody — list-creation panel rendered inside the capture sheet
 * when the user picks "list" from the Capture-as pill. Mirrors the form UI
 * of CreateListPanel (the standalone modal opened from the Lists view) so
 * users see the same affordance regardless of where they start the list.
 *
 * Layout: brain pill + type pill row at top, then a name input, then a
 * paste/items textarea with a live "N items detected" preview. Save button
 * at the bottom — same Capture button position as CaptureEntryBody so the
 * footer feels consistent across modes.
 */
import { useMemo, useRef, type ReactNode } from "react";
import { Button } from "./ui/button";
import { IconSend } from "./captureIcons";
import { parseListText, MAX_ITEMS_PER_PARSE } from "../lib/listParser";

interface CaptureListBodyProps {
  text: string;
  onTextChange: (v: string) => void;
  loading: boolean;
  canSave: boolean;
  brainPill?: ReactNode;
  typePill?: ReactNode;
  onSave: () => void;
}

export default function CaptureListBody({
  text,
  onTextChange,
  loading,
  canSave,
  brainPill,
  typePill,
  onSave,
}: CaptureListBodyProps) {
  // First non-empty line is the implicit list name. The parser runs on the
  // remaining lines so the live preview matches what's actually saved.
  const { name, items } = useMemo(() => {
    const trimmed = text.trim();
    const firstNL = trimmed.indexOf("\n");
    const computedName = (firstNL > 0 ? trimmed.slice(0, firstNL) : trimmed).trim();
    const itemsText = firstNL > 0 ? trimmed.slice(firstNL + 1) : "";
    return { name: computedName, items: parseListText(itemsText) };
  }, [text]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <>
      {(brainPill || typePill) && (
        <div
          style={{
            padding: "16px 24px 0",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          {brainPill}
          {typePill}
        </div>
      )}

      <div
        style={{
          padding: "16px 24px 10px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 200,
          gap: 16,
        }}
      >
        <div>
          <label
            className="f-sans"
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--ink-faint)",
              marginBottom: 6,
            }}
          >
            list name (first line)
          </label>
          <div
            className="f-serif"
            style={{
              fontSize: 17,
              padding: "8px 0",
              color: name ? "var(--ink)" : "var(--ink-faint)",
              borderBottom: "1px solid var(--line)",
              fontStyle: name ? "normal" : "italic",
              wordBreak: "break-word",
              minHeight: 28,
            }}
          >
            {name || "type a name on the first line below…"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <label
            className="f-sans"
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--ink-faint)",
              marginBottom: 6,
            }}
          >
            paste or type — first line is the name, rest become items
          </label>
          <textarea
            ref={textareaRef}
            autoFocus
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSave && !loading) {
                e.preventDefault();
                onSave();
              }
            }}
            disabled={loading}
            placeholder={`Groceries\nmilk\neggs\nbread`}
            rows={8}
            className="f-sans"
            style={{
              flex: 1,
              minHeight: 160,
              fontSize: 14,
              lineHeight: 1.5,
              resize: "none",
              padding: "10px 12px",
              color: "var(--ink)",
              background: "var(--surface-low)",
              border: "1px solid var(--line-soft)",
              borderRadius: 8,
              outline: "none",
              fontFamily: "var(--f-mono, ui-monospace, monospace)",
            }}
          />
          <div
            className="f-sans"
            style={{
              fontSize: 12,
              color: items.length ? "var(--ink-soft)" : "var(--ink-faint)",
              marginTop: 8,
              fontStyle: "italic",
            }}
          >
            {items.length === 0
              ? name
                ? "no items yet — that's fine, you can add items inside the list later"
                : "type a list name and (optionally) items below"
              : items.length === MAX_ITEMS_PER_PARSE
                ? `${MAX_ITEMS_PER_PARSE} items detected (max — extra lines truncated)`
                : `${items.length} item${items.length === 1 ? "" : "s"} detected`}
          </div>
        </div>
      </div>

      {/* Footer matches CaptureEntryBody's footer position so the modal
          height + Capture-button location stay constant across modes. */}
      <div
        style={{
          padding: "10px 16px 16px",
          borderTop: "1px solid var(--line-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 12,
        }}
      >
        <Button onClick={onSave} disabled={!canSave || loading}>
          {IconSend}
          {loading ? "Saving…" : "Capture list"}
        </Button>
      </div>
    </>
  );
}
