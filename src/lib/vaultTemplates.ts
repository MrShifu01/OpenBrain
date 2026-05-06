// Vault entry templates — single source of truth for the 6 shapes.
//
// Spec: docs/superpowers/specs/2026-05-02-vault-entry-templates-design.md
//
// `template_type` lives inside the encrypted `metadata` JSON of each
// vault_entry. Per-template structured fields live as named keys in the
// same encrypted metadata object. The primary secret stays in `content`.
//
// Existing entries with no `template_type` (or with an unknown value)
// render as `freeform` — back-compat is automatic.

export type TemplateId = "password" | "card" | "recovery_code" | "pin" | "seed_phrase" | "freeform";

export const TEMPLATE_IDS: TemplateId[] = [
  "password",
  "card",
  "recovery_code",
  "pin",
  "seed_phrase",
  "freeform",
];

export interface VaultTemplateField {
  key: string;
  label: string;
  inputType: "text" | "password" | "textarea";
  masked: boolean;
  copyable: boolean;
  perLineCopyable?: boolean;
  mask?: "mm-yy";
  placeholder?: string;
  required?: boolean;
}

export interface VaultTemplate {
  id: TemplateId;
  label: string;
  icon: string;
  primarySecretLabel: string;
  primarySecretMultiline: boolean;
  primarySecretMasked: boolean;
  primarySecretPlaceholder?: string;
  // Structured extras — saved into encrypted metadata under each `key`.
  fields: VaultTemplateField[];
}

export const VAULT_TEMPLATES: VaultTemplate[] = [
  {
    id: "password",
    label: "Password",
    icon: "🔑",
    primarySecretLabel: "Password",
    primarySecretMultiline: false,
    primarySecretMasked: true,
    primarySecretPlaceholder: "the password",
    fields: [
      {
        key: "username",
        label: "Username",
        inputType: "text",
        masked: false,
        copyable: true,
        placeholder: "you@example.com",
      },
      {
        key: "url",
        label: "URL",
        inputType: "text",
        masked: false,
        copyable: true,
        placeholder: "https://…",
      },
      { key: "notes", label: "Notes", inputType: "textarea", masked: false, copyable: false },
    ],
  },
  {
    id: "card",
    label: "Card",
    icon: "💳",
    primarySecretLabel: "Card number",
    primarySecretMultiline: false,
    primarySecretMasked: true,
    primarySecretPlaceholder: "•••• •••• •••• ••••",
    fields: [
      {
        key: "cardholder",
        label: "Cardholder",
        inputType: "text",
        masked: false,
        copyable: true,
        required: true,
        placeholder: "Name on card",
      },
      {
        key: "expiry",
        label: "Expiry (MM/YY)",
        inputType: "text",
        masked: false,
        copyable: false,
        mask: "mm-yy",
        required: true,
        placeholder: "MM/YY",
      },
      {
        key: "cvv",
        label: "CVV",
        inputType: "password",
        masked: true,
        copyable: true,
        placeholder: "•••",
      },
      {
        key: "billing_zip",
        label: "Billing ZIP / postcode",
        inputType: "text",
        masked: false,
        copyable: true,
      },
      { key: "notes", label: "Notes", inputType: "textarea", masked: false, copyable: false },
    ],
  },
  {
    id: "recovery_code",
    label: "Recovery Code",
    icon: "🛟",
    primarySecretLabel: "Codes (one per line)",
    primarySecretMultiline: true,
    primarySecretMasked: true,
    primarySecretPlaceholder: "abcd-efgh-ijkl\nmnop-qrst-uvwx\n…",
    fields: [
      {
        key: "service_url",
        label: "Service URL",
        inputType: "text",
        masked: false,
        copyable: true,
        placeholder: "https://…",
      },
      { key: "notes", label: "Notes", inputType: "textarea", masked: false, copyable: false },
    ],
  },
  {
    id: "pin",
    label: "PIN",
    icon: "#",
    primarySecretLabel: "PIN",
    primarySecretMultiline: false,
    primarySecretMasked: true,
    primarySecretPlaceholder: "••••",
    fields: [
      {
        key: "hint",
        label: "Hint",
        inputType: "text",
        masked: false,
        copyable: false,
        placeholder: "What this PIN is for",
      },
      { key: "notes", label: "Notes", inputType: "textarea", masked: false, copyable: false },
    ],
  },
  {
    id: "seed_phrase",
    label: "Seed Phrase",
    icon: "🌱",
    primarySecretLabel: "Seed phrase",
    primarySecretMultiline: true,
    primarySecretMasked: true,
    primarySecretPlaceholder: "twelve or twenty-four words separated by spaces",
    fields: [
      {
        key: "wallet_type",
        label: "Wallet type",
        inputType: "text",
        masked: false,
        copyable: false,
        placeholder: "MetaMask / Ledger / …",
      },
      {
        key: "optional_passphrase",
        label: "Optional passphrase",
        inputType: "password",
        masked: true,
        copyable: true,
      },
      { key: "notes", label: "Notes", inputType: "textarea", masked: false, copyable: false },
    ],
  },
  {
    id: "freeform",
    label: "Free-form",
    icon: "✏️",
    primarySecretLabel: "Secret value",
    primarySecretMultiline: true,
    primarySecretMasked: true,
    primarySecretPlaceholder: "Anything you'd rather not have in plaintext.",
    fields: [],
  },
];

const TEMPLATE_BY_ID: Record<TemplateId, VaultTemplate> = Object.fromEntries(
  VAULT_TEMPLATES.map((t) => [t.id, t]),
) as Record<TemplateId, VaultTemplate>;

export function getTemplate(id: TemplateId): VaultTemplate {
  return TEMPLATE_BY_ID[id];
}

// Reads `template_type` out of a decrypted metadata object. Falls back to
// `freeform` for missing or unknown values (back-compat with pre-template
// entries and forward-compat if a future client writes an unknown id).
export function getTemplateOrFreeform(
  metadata: Record<string, unknown> | null | undefined,
): VaultTemplate {
  const raw = metadata?.template_type;
  if (typeof raw === "string" && raw in TEMPLATE_BY_ID) {
    return TEMPLATE_BY_ID[raw as TemplateId];
  }
  return TEMPLATE_BY_ID.freeform;
}

// MM/YY masker for the Card.expiry input. Strips non-digits, inserts the
// slash after two digits, caps at 5 chars. Lenient — runs on every keystroke
// but never rejects, so the user can paste / edit naturally.
export function maskMmYy(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function isValidMmYy(value: string): boolean {
  return /^\d{2}\/\d{2}$/.test(value);
}

// Per-template required-fields validation. Returns null if OK, or an error
// string suitable for display. Pure — no side effects.
export function validateTemplatePayload(
  templateId: TemplateId,
  title: string,
  content: string,
  metadataObj: Record<string, string>,
): string | null {
  if (!title.trim()) return "Title is required";
  if (!content.trim()) return "Secret value is required";
  const template = getTemplate(templateId);
  for (const field of template.fields) {
    if (field.required && !(metadataObj[field.key] ?? "").trim()) {
      return `${field.label} is required`;
    }
  }
  if (templateId === "card") {
    const expiry = (metadataObj.expiry ?? "").trim();
    if (expiry && !isValidMmYy(expiry)) return "Expiry must be MM/YY";
  }
  if (templateId === "recovery_code") {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return "At least one recovery code is required";
  }
  return null;
}

// Soft warning for seed-phrase length — never blocks save.
export function seedPhraseWarning(content: string): string | null {
  if (!content.trim()) return null;
  const words = content.trim().split(/\s+/).filter(Boolean);
  if (words.length < 12) {
    return "Most seed phrases are 12 or 24 words — double-check?";
  }
  return null;
}
