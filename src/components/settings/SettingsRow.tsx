import type { ReactNode } from "react";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";

interface SettingsRowProps {
  label: string;
  hint?: ReactNode;
  children?: ReactNode;
  /** Last row in a group — hides the bottom divider */
  last?: boolean;
}

/**
 * Canonical Settings row from the redesign:
 *   - Serif 16/450 label on the left
 *   - Italic serif hint below the label
 *   - Right-aligned control slot (button, toggle, text, etc.)
 *   - Hairline divider below the row
 */
export default function SettingsRow({ label, hint, children, last }: SettingsRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        padding: "18px 0",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="f-serif"
          style={{
            fontSize: 16,
            fontWeight: 450,
            color: "var(--ink)",
            letterSpacing: "-0.005em",
          }}
        >
          {label}
        </div>
        {hint && (
          <div
            className="f-serif"
            style={{
              fontSize: 13,
              color: "var(--ink-faint)",
              fontStyle: "italic",
              marginTop: 3,
              lineHeight: 1.5,
            }}
          >
            {hint}
          </div>
        )}
      </div>
      {children && <div style={{ flexShrink: 0 }}>{children}</div>}
    </div>
  );
}

/**
 * Canonical inline-expand panel for SettingsRow disclosures. Sits directly below
 * a SettingsRow whose action toggles `open`. Renders the same padding + hairline
 * divider as a row so the visual rhythm continues unbroken.
 *
 * `keepMounted`: when true the children stay mounted while collapsed (hidden via
 * display:none). Use this when the inner panel does its own data fetch on mount
 * and you want it to fire as soon as the surrounding tab is visited — opening
 * "Manage" then feels instant. Default off because the cost of preloading
 * heavier panels (API tokens, OAuth state) isn't worth it if the user never
 * opens them.
 */
export function SettingsExpand({
  open,
  children,
  last,
  keepMounted,
}: {
  open: boolean;
  children: ReactNode;
  last?: boolean;
  keepMounted?: boolean;
}) {
  if (!open && !keepMounted) return null;
  return (
    <div
      style={{
        padding: "0 0 18px",
        borderBottom: last ? "none" : "1px solid var(--line-soft)",
        display: open ? "flex" : "none",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

/** Italic serif value — used for right-side informational text like "Hanno's brain". */
export function SettingsValue({ children }: { children: ReactNode }) {
  return (
    <span
      className="f-serif"
      style={{
        fontSize: 15,
        fontStyle: "italic",
        color: "var(--ink-soft)",
      }}
    >
      {children}
    </span>
  );
}

/** Secondary sans value — used for right-side plain text like "hanno@everion.app". */
export function SettingsText({ children }: { children: ReactNode }) {
  return (
    <span className="f-sans" style={{ fontSize: 14, color: "var(--ink)" }}>
      {children}
    </span>
  );
}

/** Tight secondary button sized for Settings rows. Thin wrapper around the
 *  shared Button primitive so every SettingsRow control matches every
 *  other button in the app. */
export function SettingsButton({
  onClick,
  disabled,
  danger,
  children,
  type = "button",
}: {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
  type?: "button" | "submit";
}) {
  return (
    <Button
      type={type}
      size="sm"
      variant={danger ? "destructive" : "outline"}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

/** Lightweight toggle switch — wraps shadcn Switch so every settings
 *  toggle uses the same primitive. */
export function SettingsToggle({
  value,
  onChange,
  ariaLabel,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
}) {
  return <Switch checked={value} onCheckedChange={onChange} aria-label={ariaLabel} />;
}
