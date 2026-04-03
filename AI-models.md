# AI Model Configuration — Per-Task Model Selection

Allow users to assign different models to different tasks. Casual users see one default model; power users can override per task.

---

## Phase 1 — Data layer: per-task model storage

**Goal:** Store task-specific model choices so both the app and the Telegram edge function can read them.

### Database (`supabase/migrations/007_task_models.sql`)
- `ALTER TABLE user_ai_settings` to add nullable columns:
  - `model_capture TEXT` — parsing raw text into structured entries
  - `model_questions TEXT` — Fill Brain AI-generated questions
  - `model_vision TEXT` — image understanding (must be vision-capable)
  - `model_refine TEXT` — Refine entry audit + link discovery
  - `model_chat TEXT` — memory retrieval / brain chat
- All nullable; NULL = "use the global default model"

### `src/lib/aiFetch.js` helpers
- `getModelForTask(task)` — reads `openbrain_{userId}_task_{task}` from localStorage, falls back to global model getter
- `setModelForTask(task, model)` — writes to localStorage AND upserts the matching column to `user_ai_settings`
- `loadTaskModels(userId, settingsRow)` — called on app startup after fetching `user_ai_settings`; populates localStorage from the DB row so helpers work offline

---

## Phase 2 — Route task calls through the right model

**Goal:** Every AI call picks up its task-specific model automatically.

### `src/lib/ai.js` — `callAI()`
- Add optional `task` param: `callAI({ messages, system, max_tokens, memoryGuide, task })`
- When `task` is provided, resolve model via `getModelForTask(task)` instead of the global getter

### Call site wiring

The following calls use `aiFetch("/api/anthropic", ...)` directly and must be migrated to `callAI()`:

| File | Line | Task string | Note |
|---|---|---|---|
| `OpenBrain.jsx` | 39 | `"links"` | Auto-link discovery on capture |
| `OpenBrain.jsx` | 415 | `"capture"` | Quick Capture text parsing |
| `OpenBrain.jsx` | 1153 | `"chat"` | Proactive nudges |
| `OpenBrain.jsx` | 1294 | `"chat"` | `handleChat` brain chat |
| `OpenBrain.jsx` | 1557 | `"capture"` | Fill Brain batch entry parsing (also has model hardcoded to `claude-haiku-4-5-20251001`) |

These already use `callAI()` and only need the `task` param added:

| File | Line | Task string |
|---|---|---|
| `SuggestionsView.jsx` | 139 | `"questions"` |
| `SuggestionsView.jsx` | 168 | `"vision"` |
| `SuggestionsView.jsx` | 207 | `"capture"` |
| `RefineView.jsx` | (entry audit) | `"refine"` |
| `RefineView.jsx` | (link discovery) | `"refine"` |

### Telegram edge function (`supabase/functions/telegram-webhook/`)
- Read `model_chat` from `user_ai_settings` when answering brain queries (instead of hardcoded model)
- Falls back to `openrouter_model` if `model_chat` is null

---

## Phase 3 — Settings UI: per-task model pickers

**Goal:** Users can see and change task models without being overwhelmed.

### Layout
- Existing global provider/model picker stays as-is (the fallback)
- Add a collapsible **"Advanced: per-task models"** section below it
- Only render this section when `provider === "openrouter"` (Anthropic/OpenAI users have fewer model choices — the single global model is sufficient)

### Per-task rows
One row per task:

| Label | Description | Task key |
|---|---|---|
| Entry capture | Parsing text into structured entries | `capture` |
| Fill Brain questions | Generating personalised questions | `questions` |
| Image reading | Extracting text from photos | `vision` |
| Refine collection | Auditing all entries + finding links | `refine` |
| Brain chat | Answering questions from memory | `chat` |

### Row behaviour
- Each dropdown: top option is **"Same as global default"** (saves NULL), followed by a filtered model list
- On change: `setModelForTask(task, value === "default" ? null : value)`
- Values loaded from `user_ai_settings` on settings mount (extend the existing Supabase fetch)

### Model filtering per task
`fetchOrModels` currently stores `{ id, name, pricing }`. Add `modality: m.architecture?.modality ?? "text->text"` to that mapping so the full architecture info is available.

Each task dropdown then filters the model list:

| Task | Filter | Dropdown label |
|---|---|---|
| `vision` | `modality.includes("image")` (e.g. `"text+image->text"`) | "Vision-capable models only" |
| `capture` | all text models | — |
| `questions` | all text models | — |
| `refine` | all text models | — |
| `chat` | all text models | — |

The `vision` dropdown will naturally surface GPT-4o, Gemini Flash, Claude 3.5 Sonnet — and hide Llama, Mistral, and other text-only models. No manual allowlist needed.

### Pricing tier badge
Each model option in the dropdown shows a small badge next to the name based on `pricing.prompt` (USD per token):

| Badge | Colour | Threshold |
|---|---|---|
| Free | green | `prompt == "0"` or `"0.0"` |
| Cheap | teal | `prompt < 0.000001` (< $1 / 1M tokens) |
| Normal | grey | `prompt < 0.000010` (< $10 / 1M tokens) |
| Expensive | orange | `prompt >= 0.000010` |

Helper:
```js
function priceTier(pricing) {
  const p = parseFloat(pricing?.prompt ?? 1);
  if (p === 0)        return { label: "Free",      color: "#22c55e" };
  if (p < 0.000001)   return { label: "Cheap",     color: "#4ECDC4" };
  if (p < 0.000010)   return { label: "Normal",    color: "#888" };
  return               { label: "Expensive",  color: "#FF6B35" };
}
```

Render as a small pill inline: `gemini-2.0-flash-exp  [Free]`, `gpt-4o  [Expensive]`. Same helper applies to the global model picker — add badges there too for consistency.

> **Voice (Phase 4):** Whisper is a transcription API, not a chat completion — it will not appear in the OpenRouter model list. The voice task gets its own separate API key + model picker (`whisper-1`, `whisper-large-v3`) that calls OpenAI's transcription endpoint directly.

---

## Phase 4 — Voice transcription (deferred)

**Goal:** Add Whisper-based voice input as a separate transcription pipeline.

- Voice is a transcription API (Whisper), not a chat completion — completely separate from OpenRouter
- Requires a new `/api/transcribe` server route (OpenAI Whisper endpoint)
- New setting: `whisper_key` (OpenAI key, separate from chat key)
- New `model_voice` column in `user_ai_settings`
- Wire into Fill Brain answer input and Quick Capture as a mic button
- Settings: "Voice transcription" section with API key + model picker (`whisper-1`, `whisper-large-v3`)

---

## Notes

- Task models only apply when provider is OpenRouter. Anthropic and OpenAI providers use their existing single model setting.
- The `normalizeMessages` function in `ai.js` already handles image format conversion between Anthropic and OpenAI/OpenRouter — vision tasks work across all providers as long as the selected model supports vision.
- Per-task models feed into the Telegram bot automatically once Phase 2 is done — the edge function already reads from `user_ai_settings`.
- `links` discovery and entry quality audit share the `refine` task key — they use the same batch analysis style and benefit from the same model choice.
