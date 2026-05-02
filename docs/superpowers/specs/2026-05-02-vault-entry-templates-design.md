# Vault Entry Templates

**Date:** 2026-05-02
**Status:** Approved (brainstorm 2026-05-02)
**Tracker:** `EML/LAUNCH_CHECKLIST.md` line 1035 — "Vault entry templates"
**Sub-project:** 1 of 5 in the EML "Vault — beyond V3 narrow scope" decomposition. Sequence: **templates (this) → offline decryption tool → PIN+biometric+auto-lock → app-level re-auth → browser-extension autofill.**

---

## Goal

Replace today's free-form vault add-secret form with pre-shaped templates: **Password / Card / Recovery Code / PIN / Seed Phrase**, plus **Freeform** for back-compat.

Sets up future autofill (sub-project 5) by giving vault entries a stable, parseable structure. Improves UX today by guiding users to the right field shape per secret type.

Behind feature flag `VITE_FEATURE_VAULT_TEMPLATES`. Off by default. One-line flip to enable.

---

## Non-Goals

- Database migration. Schema unchanged.
- API change. `/api/vault-entries` unchanged.
- Crypto change. `lib/crypto.ts` unchanged. Same AES-256-GCM, same PBKDF2-310k, same key lifecycle.
- "Apply template to existing freeform entry" affordance. Existing entries stay freeform forever.
- Template badges in the vault grid.
- Auto-detection / classifier of existing entries.
- Server-side template counts or analytics. Template type is encrypted — server can't see it.
- Browser-extension autofill consumption. That's sub-project 5.

---

## Data model

No migration. `vault_entries` schema (from `supabase/migrations/021_vault_entries.sql`) stays:

```
id UUID, user_id UUID, title TEXT (plaintext),
content TEXT (encrypted blob), metadata TEXT (encrypted JSON blob),
tags TEXT[], brain_id UUID, created_at, updated_at, deleted_at
```

Templates ride on top of `metadata`:

- New key `template_type: "password" | "card" | "recovery_code" | "pin" | "seed_phrase" | "freeform"` lives inside the **encrypted** metadata JSON.
- Per-template structured fields live as named keys in the same encrypted metadata object (e.g., `username`, `url`, `cardholder`, `expiry`, `cvv`, `billing_zip`, `hint`, `service_url`, `wallet_type`, `optional_passphrase`, `notes`).
- Primary secret (the thing that needs strongest reveal-and-copy treatment) stays in `content`.

**Back-compat:** existing entries with no `template_type` key in their decrypted metadata render as `freeform`. Zero impact on legacy data.

### Per-template field map

| Template | `title` (plaintext display name) | `content` (encrypted, primary secret) | `metadata` keys (encrypted extras) | Required to save |
|---|---|---|---|---|
| **Password** | `"Gmail"` | the password | `username`, `url`, `notes` | `title`, `content` |
| **Card** | `"Visa Debit"` | card number | `cardholder`, `expiry` (MM/YY), `cvv`, `billing_zip`, `notes` | `title`, `content`, `cardholder`, `expiry` |
| **Recovery Code** | `"GitHub backup codes"` | codes (multi-line, one per line) | `service_url`, `notes` | `title`, `content` (≥ 1 non-empty line) |
| **PIN** | `"ATM card PIN"` | the PIN | `hint`, `notes` | `title`, `content` |
| **Seed Phrase** | `"MetaMask main"` | the seed phrase (multi-line) | `wallet_type`, `optional_passphrase`, `notes` | `title`, `content` (warn if < 12 whitespace tokens; do not block) |
| **Freeform** | display name | free text | arbitrary user-defined key/value rows (today's behavior) | `title`, `content` |

Every saved entry gets `template_type` injected into the metadata object before encryption, including freeform.

---

## File touch list

### New files

- **`src/lib/vaultTemplates.ts`** — single source of truth.
  - Exports `VAULT_TEMPLATES`: array of `VaultTemplate` records `{ id, label, icon, primarySecretLabel, primarySecretMultiline, fields: VaultTemplateField[], requiredMetadataKeys: string[] }`.
  - `VaultTemplateField` shape: `{ key, label, inputType: "text" | "password" | "textarea", masked: boolean, copyable: boolean, perLineCopyable?: boolean, mask?: "mm-yy" }`.
  - Pure data + a couple of small helpers: `getTemplate(id)`, `getTemplateOrFreeform(metadata)`. No React.

- **`src/components/vault/VaultTemplatePicker.tsx`** — inline 6-chip panel.
  - Props: `{ onPick(templateId), onCancel() }`.
  - Renders a row of 6 chips using `--ember`/`--ink-soft`/`--surface`/`--line-soft` tokens. Each chip is pill-shaped (radius 999), 28px height, 12px font, 600 weight, `press` class.
  - Uses the same icon library/style as the rest of the project (lucide-react if that's what's already in use; check `VaultUnlocked.tsx` imports and match).

- **`src/components/vault/VaultTemplateForm.tsx`** — renders a shaped form from a template schema.
  - Props: `{ templateId, onSubmit({ title, content, metadataObj }), onCancel(), busy, error }`.
  - Renders: title input (always), primary-secret input (textarea if `primarySecretMultiline`), then one input per `template.fields[]`. Masked fields have eye-icon reveal, copyable fields have copy buttons. Card expiry uses MM/YY-masked text input — no native date picker.
  - Save button disabled until all required fields non-empty.
  - All UI uses project tokens. No `window.confirm`, no native pickers, no native `<select>` chevron.

### Edits

- **`src/views/vault/VaultUnlocked.tsx`** — replace today's monolithic add-secret form with: picker step → form step. State: `addStep: "picker" | "form"`, `addTemplateId: TemplateId | null`. When user picks a template, render `<VaultTemplateForm templateId={addTemplateId} ... />`. Cancel → close panel. Save → call existing `handleAddSecret` from `useVaultOps` with the new structured payload.

  Read side: when rendering an entry's revealed/detail view, switch on `metadata.template_type`. For non-freeform templates, render labelled rows from the template schema (label → masked-or-revealed value → copy button). For freeform/missing, render today's flat content + arbitrary metadata-rows view.

- **`src/hooks/useVaultOps.ts`** — `handleAddSecret` signature updated. New shape:
  ```ts
  handleAddSecret({
    templateId: TemplateId;
    title: string;
    content: string;
    metadataObj: Record<string, string>; // structured fields per template
  })
  ```
  Inside, build the encrypted metadata as `{ template_type: templateId, ...metadataObj }`. Call `encryptEntry(...)` exactly as today. POST to `/api/vault-entries` exactly as today. Existing free-form code path stays — it just becomes the `freeform` template (`metadataObj` is the arbitrary key/value rows the user typed).

  Existing `addTitle / addContent / addTags / addMetaRows` state in this hook gets removed — that state moves into `VaultTemplateForm` (and the freeform variant of it). The hook keeps `showAddSecret`, `addBusy`, `addError`, `startAddSecret`, `handleAddSecret`, `resetAddForm`.

### Untouched

- `vault_entries` table, RLS, indexes.
- `/api/vault-entries` and `/api/vault` handlers.
- `src/lib/crypto.ts`.
- `src/lib/vaultEntriesCache.ts` — cache shape doesn't change (it stores encrypted blobs).

---

## UX flow

Mirrors the existing CaptureSheet pattern (pick a type → render shaped body) so the mental model is already familiar to project users.

1. User taps **Add a secret** → inline panel opens inside the existing add-secret slot in `VaultUnlocked`.
2. Panel renders `<VaultTemplatePicker />`: a row of 6 pill-shaped chips: 🔑 Password · 💳 Card · 🛟 Recovery Code · # PIN · 🌱 Seed Phrase · ✏️ Free-form.
3. User taps a chip → picker collapses to a single "Password ✕" pill (tap ✕ to go back to the chip row); `<VaultTemplateForm templateId="password" />` renders below.
4. Form: client-side required-field validation. Save button stays disabled until required fields are non-empty. Mask/reveal/copy behavior per the field schema. Card expiry input is text with MM/YY masking — no native date picker.
5. Save → encrypts and POSTs via existing `useVaultOps.handleAddSecret`. On success, panel closes, vault entries refresh, new entry shows up in the grid.
6. Cancel at any step closes the panel without saving. Switching templates mid-entry is **not** supported in this sub-project — the user must cancel and restart. (Avoids the "where did my typed values go" footgun.)

---

## Read-side render

In `VaultUnlocked.tsx`, the existing entry-render path becomes:

```ts
const template = getTemplateOrFreeform(decryptedEntry.metadata);
if (template.id === "freeform") {
  // existing render path: title + content + arbitrary metadata rows
} else {
  // labelled-row render: for each field in template.fields,
  //   show label + masked-or-revealed value + copy button (if copyable)
  // primary secret (content) renders first, with primarySecretLabel
}
```

The vault grid (one card per entry, before reveal) is **unchanged** — same icon, title, tags. No template badge. Per Q4 decision: keep grid flat in this sub-project; revisit post-launch when there's real template usage to scan.

---

## Validation rules

Client-side, in `VaultTemplateForm`:

- All templates: `title` and `content` non-empty.
- **Card**: also requires `cardholder` and `expiry` non-empty. `expiry` matches `^\d{2}/\d{2}$` (MM/YY).
- **Recovery Code**: `content` must contain at least one non-whitespace line.
- **Seed Phrase**: if `content.split(/\s+/).filter(Boolean).length < 12`, show a non-blocking warning ("Most seed phrases are 12 or 24 words — double-check?"). User can save anyway.
- All other fields optional.

Server-side validation does not change. Existing `/api/vault-entries` accepts any encrypted blob.

---

## Feature flag

`VITE_FEATURE_VAULT_TEMPLATES` — Vite env var, read at build time. Pattern matches existing `VITE_FEATURE_LISTS` flag (commit `6563ecf`).

When **off** (default): vault add-secret form renders as today (the existing free-form form). Read side renders entries the same as today regardless of `template_type` content (i.e., even if a template-tagged entry exists, render flat). This makes flag-on/flag-off symmetric for read.

When **on**: picker + shaped forms ship; read side renders shaped labelled rows for non-freeform `template_type`.

Default off until smoke-tested in preview deploy. Flip to on once: picker renders, all 6 templates save successfully, all 6 templates render correctly on reveal, e2e green.

---

## Testing

Per project's bug-driven coverage philosophy (memory `feedback_e2e_philosophy.md`).

### Unit (vitest)

- **`src/lib/vaultTemplates.ts`** — schema integrity test:
  - Every template has a non-empty `id`, `label`, at least one field OR a primary secret.
  - Required-fields list only references keys that exist in the template's `fields[]` (or are `title` / `content`).
  - Field `inputType` is one of the allowed enum values.

- **`src/hooks/useVaultOps.ts` — `handleAddSecret`**:
  - Given each of the 6 templates with a representative payload, asserts the encrypted-metadata input to `encryptEntry` includes `template_type` and the structured keys.
  - Mocks `encryptEntry` and `authFetch`; asserts the POST body shape.

### E2E (Playwright via the `playwright-everion` skill — invoke before writing the test)

- Extend `e2e/specs/vault.spec.ts` with one canonical Password-template flow:
  - Pick Password template → fill `title`, `username`, `url`, `password`, `notes` → save → expand entry → assert `username` row visible, click reveal on password, click copy on `username` and assert clipboard wrote.

- Other 5 templates are covered by unit tests (encrypted-metadata shape) — adding e2e for each would be 6× the test surface for marginal additional confidence.

### Manual smoke (preview deploy, before flipping flag on in prod)

- Each of 6 templates: pick → fill → save → reload → expand → reveal → copy. Confirm no console errors.
- Existing freeform entries (if any) render flat as today.

---

## Estimate

~250-350 LOC across 3 new files + 2 edits. Smaller than a casual reading of the checklist suggests because we're not changing crypto, API, schema, or grid render — purely shaping the add-form and the per-entry detail render on top of existing encrypted metadata.

---

## Risks

- **Template-key collision with future fields.** If sub-project 5 (autofill) decides it needs a different metadata schema, the keys defined here become legacy. Mitigation: keep `vaultTemplates.ts` as the single source of truth; future migration would map old keys → new in one place.
- **Existing entries' metadata might already contain a `template_type`-named key by accident** (free-form lets users name keys whatever). Mitigation: `getTemplateOrFreeform` only treats `template_type` as authoritative if the value matches a known enum value; otherwise → freeform.
- **Card expiry MM/YY masking** is a fiddly input control. Mitigation: text input + on-blur regex check; don't fight the user with aggressive on-keystroke masking.
- **Seed-phrase non-blocking warning** could be ignored — but blocking would frustrate users with non-standard wallets. Mitigation: warn-only is intentional; document in code comment.

---

## Out of scope (parked for follow-on sub-projects)

- Sub-project 2 (offline decryption tool): standalone HTML that decrypts an exported vault blob. Templates above will be visible to that tool through the same metadata shape — no work needed here to support it.
- Sub-project 3 (PIN + biometric + auto-lock): unrelated to template shape; lives in `lib/crypto.ts` + new `lib/biometric.ts`.
- Sub-project 4 (app-level biometric re-auth): depends on sub-project 3.
- Sub-project 5 (browser-extension autofill): consumes `template_type` + structured fields shipped here.
