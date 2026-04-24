import { useState } from "react";
import type { ReactNode } from "react";
import ProvidersTab from "./ProvidersTab";
import SettingsRow from "./SettingsRow";
import { SettingsButton } from "./SettingsRow";
import type { Brain } from "../../types";

interface Props {
  activeBrain?: Brain;
  isAdmin?: boolean;
}

function StatusDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: on ? "var(--moss)" : "var(--ink-ghost)",
        flexShrink: 0,
      }}
    />
  );
}

function Section({
  label,
  defaultOpen = true,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          padding: "0 0 16px 0",
          cursor: "pointer",
          gap: 8,
        }}
      >
        <div className="micro">{label}</div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          style={{
            transition: "transform 200ms",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            color: "var(--ink-ghost)",
            flexShrink: 0,
          }}
        >
          <path
            d="M3 5l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && children}
    </div>
  );
}

export default function AITab({ activeBrain, isAdmin = false }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <Section label="Everion Provided AI">
        <SettingsRow
          label="Google Gemini"
          hint="powers enrichment, chat, and parsing — provided and managed by Everion."
          last
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatusDot on />
            <SettingsButton disabled>Managed</SettingsButton>
          </div>
        </SettingsRow>
      </Section>

      <Section label="BYOK" defaultOpen={false}>
        <ProvidersTab activeBrain={activeBrain} />
      </Section>

      <Section label="Enrichment">
        <p className="f-sans" style={{ fontSize: 13, color: "var(--ink-ghost)", margin: 0, lineHeight: 1.5 }}>
          Entries are enriched automatically by the server after capture. Cards show a pulsing dot while processing.
        </p>
      </Section>
    </div>
  );
}
