// 6-chip template picker — first step of the new add-secret flow.
//
// Spec: docs/superpowers/specs/2026-05-02-vault-entry-templates-design.md
// Pattern: mirrors CaptureSheet's pick-type-first idiom.

import { VAULT_TEMPLATES, type TemplateId } from "../../lib/vaultTemplates";

export function VaultTemplatePicker({ onPick }: { onPick: (id: TemplateId) => void }) {
  return (
    <div className="space-y-3">
      <p
        className="text-[11px] font-medium tracking-wide uppercase"
        style={{ color: "var(--color-on-surface-variant)" }}
      >
        Pick a template
      </p>
      <div className="flex flex-wrap gap-2">
        {VAULT_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.id)}
            className="press inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors"
            style={{
              borderColor: "var(--line-soft)",
              background: "var(--surface)",
              color: "var(--ink)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--ember)";
              e.currentTarget.style.color = "var(--ember)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--line-soft)";
              e.currentTarget.style.color = "var(--ink)";
            }}
          >
            <span aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
        Each template shapes the fields. Pick Free-form for anything else.
      </p>
    </div>
  );
}
