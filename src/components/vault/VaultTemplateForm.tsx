// Shaped form driven by a vault-template schema. Renders title + primary
// secret + per-template structured fields. Validates client-side before
// allowing save. Mask/reveal/copy per field schema.
//
// Spec: docs/superpowers/specs/2026-05-02-vault-entry-templates-design.md

import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import {
  getTemplate,
  maskMmYy,
  seedPhraseWarning,
  validateTemplatePayload,
  type TemplateId,
  type VaultTemplateField,
} from "../../lib/vaultTemplates";

interface Props {
  templateId: TemplateId;
  busy: boolean;
  error: string;
  onSubmit: (payload: {
    templateId: TemplateId;
    title: string;
    content: string;
    metadataObj: Record<string, string>;
    tags: string[];
  }) => void;
  onBack: () => void;
}

export function VaultTemplateForm({ templateId, busy, error, onSubmit, onBack }: Props) {
  const template = getTemplate(templateId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [metadataObj, setMetadataObj] = useState<Record<string, string>>({});
  const [tagsRaw, setTagsRaw] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const validation = useMemo(
    () => validateTemplatePayload(templateId, title, content, metadataObj),
    [templateId, title, content, metadataObj],
  );
  const seedWarning = templateId === "seed_phrase" ? seedPhraseWarning(content) : null;

  const setField = (key: string, value: string) =>
    setMetadataObj((prev) => ({ ...prev, [key]: value }));

  const toggleReveal = (key: string) => setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));

  const copyValue = (value: string, label: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopyMsg(`${label} copied`);
      setTimeout(() => setCopyMsg(null), 1500);
    });
  };

  const submit = () => {
    if (validation || busy) return;
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSubmit({ templateId, title: title.trim(), content, metadataObj, tags });
  };

  return (
    <div className="space-y-3">
      {/* Selected-template pill — tap to go back to picker */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="press inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold"
          style={{
            borderColor: "var(--ember)",
            background: "var(--ember-wash)",
            color: "var(--ember)",
          }}
        >
          <span aria-hidden="true">{template.icon}</span>
          <span>{template.label}</span>
          <span aria-hidden="true" style={{ marginLeft: 4 }}>
            ✕
          </span>
        </button>
        {copyMsg && (
          <span className="text-[11px]" style={{ color: "var(--ember)" }}>
            {copyMsg}
          </span>
        )}
      </div>

      {/* Title — always */}
      <FieldShell label="Title">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Display name (e.g. Gmail)"
          className="text-on-surface placeholder:text-on-surface-variant w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm transition-colors outline-none"
          style={{ borderColor: "var(--color-outline-variant)" }}
          onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--color-outline-variant)")}
        />
      </FieldShell>

      {/* Primary secret */}
      <FieldShell label={template.primarySecretLabel}>
        <PrimarySecretInput
          value={content}
          onChange={setContent}
          template={template}
          revealed={!!revealed.__content}
          onToggleReveal={() => toggleReveal("__content")}
        />
        {seedWarning && (
          <p className="text-[11px]" style={{ color: "var(--color-on-surface-variant)" }}>
            {seedWarning}
          </p>
        )}
      </FieldShell>

      {/* Per-template structured fields */}
      {template.fields.map((field) => (
        <StructuredField
          key={field.key}
          field={field}
          value={metadataObj[field.key] ?? ""}
          revealed={!!revealed[field.key]}
          onChange={(v) => setField(field.key, v)}
          onToggleReveal={() => toggleReveal(field.key)}
          onCopy={(v) => copyValue(v, field.label)}
        />
      ))}

      {/* Tags */}
      <FieldShell label="Tags (comma separated)">
        <input
          type="text"
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="work, banking, 2fa"
          className="text-on-surface placeholder:text-on-surface-variant w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm transition-colors outline-none"
          style={{ borderColor: "var(--color-outline-variant)" }}
          onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--color-outline-variant)")}
        />
      </FieldShell>

      {error && (
        <p className="text-xs" style={{ color: "var(--color-error)" }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button variant="outline" size="lg" onClick={onBack} disabled={busy} className="flex-1">
          Back
        </Button>
        <Button
          size="lg"
          onClick={submit}
          disabled={busy || !!validation}
          className="flex-1"
          title={validation ?? undefined}
        >
          {busy ? "Encrypting…" : "🔒 Save secret"}
        </Button>
      </div>
    </div>
  );
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label
        className="text-[11px] font-medium tracking-wide uppercase"
        style={{ color: "var(--color-on-surface-variant)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function PrimarySecretInput({
  value,
  onChange,
  template,
  revealed,
  onToggleReveal,
}: {
  value: string;
  onChange: (v: string) => void;
  template: ReturnType<typeof getTemplate>;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  const inputType = template.primarySecretMasked && !revealed ? "password" : "text";
  const baseStyle = { borderColor: "var(--color-outline-variant)" };
  const className =
    "text-on-surface placeholder:text-on-surface-variant w-full rounded-xl border bg-transparent px-3 py-2.5 font-mono text-sm transition-colors outline-none";

  if (template.primarySecretMultiline) {
    return (
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={template.primarySecretPlaceholder}
          className={`${className} resize-none ${
            template.primarySecretMasked && !revealed ? "[-webkit-text-security:disc]" : ""
          }`}
          style={baseStyle}
          onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--color-outline-variant)")}
        />
        {template.primarySecretMasked && (
          <RevealButton revealed={revealed} onClick={onToggleReveal} />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={template.primarySecretPlaceholder}
        className={`${className} ${template.primarySecretMasked ? "pr-16" : ""}`}
        style={baseStyle}
        onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--color-outline-variant)")}
      />
      {template.primarySecretMasked && (
        <RevealButton revealed={revealed} onClick={onToggleReveal} />
      )}
    </div>
  );
}

function StructuredField({
  field,
  value,
  revealed,
  onChange,
  onToggleReveal,
  onCopy,
}: {
  field: VaultTemplateField;
  value: string;
  revealed: boolean;
  onChange: (v: string) => void;
  onToggleReveal: () => void;
  onCopy: (v: string) => void;
}) {
  const handleChange = (raw: string) => {
    if (field.mask === "mm-yy") onChange(maskMmYy(raw));
    else onChange(raw);
  };

  const inputType =
    field.masked && !revealed ? "password" : field.inputType === "password" ? "text" : "text";
  const baseStyle = { borderColor: "var(--color-outline-variant)" };
  const className =
    "text-on-surface placeholder:text-on-surface-variant w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm transition-colors outline-none";

  return (
    <FieldShell label={field.label + (field.required ? " *" : "")}>
      <div className="flex items-start gap-2">
        <div className="relative flex-1">
          {field.inputType === "textarea" ? (
            <textarea
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              rows={2}
              placeholder={field.placeholder}
              className={`${className} resize-none`}
              style={baseStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-outline-variant)")}
            />
          ) : (
            <input
              type={inputType}
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={field.placeholder}
              className={`${className} ${field.masked ? "pr-16" : ""}`}
              style={baseStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-outline-variant)")}
            />
          )}
          {field.masked && field.inputType !== "textarea" && (
            <RevealButton revealed={revealed} onClick={onToggleReveal} />
          )}
        </div>
        {field.copyable && (
          <button
            type="button"
            onClick={() => onCopy(value)}
            disabled={!value}
            className="press shrink-0 rounded-xl border px-3 py-2 text-xs font-medium disabled:opacity-40"
            style={{ borderColor: "var(--color-outline-variant)", color: "var(--ink-soft)" }}
            aria-label={`Copy ${field.label}`}
          >
            📋
          </button>
        )}
      </div>
    </FieldShell>
  );
}

function RevealButton({ revealed, onClick }: { revealed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press absolute top-1/2 right-2 -translate-y-1/2 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
      style={{ color: "var(--color-primary)", background: "transparent" }}
      aria-label={revealed ? "Hide" : "Reveal"}
    >
      {revealed ? "Hide" : "Show"}
    </button>
  );
}
