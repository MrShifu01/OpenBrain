/**
 * feedbackLearning.ts — Tracks user corrections to AI suggestions,
 * distills patterns into learning rules, and maintains a lean memory
 * section that makes the AI smarter over time.
 *
 * Integration points:
 *   - QuickCapture: when user edits AI-parsed title/type/tags before saving
 *   - RefineView:   when user accepts, edits, or rejects a suggestion
 *   - SuggestionsView: when user provides an answer (optional tracking)
 *
 * Memory is stored in the user's memory guide under [Learned Preferences].
 */

/* ─── Types ─── */

export const FEEDBACK_TYPES = {
  CAPTURE_EDIT:   "CAPTURE_EDIT",
  REFINE_ACCEPT:  "REFINE_ACCEPT",
  REFINE_EDIT:    "REFINE_EDIT",
  REFINE_REJECT:  "REFINE_REJECT",
  QA_EDIT:        "QA_EDIT",
} as const;

export type FeedbackType = typeof FEEDBACK_TYPES[keyof typeof FEEDBACK_TYPES];

export interface FeedbackEvent {
  type: FeedbackType;
  timestamp: string;
  field?: string;
  aiValue?: string;
  userValue?: string;
  rawInput?: string;
  suggestionType?: string;
  suggestedValue?: string;
  currentValue?: string;
  entryTitle?: string;
  fromTitle?: string;
  toTitle?: string;
  rel?: string;
}

interface CaptureSnapshot {
  title: string;
  type: string;
  tags?: string[];
}

interface AICallOptions {
  system: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens: number;
}

interface AIResponse {
  json(): Promise<{ content?: Array<{ type: string; text: string }> }>;
}

type CallAIFn = (opts: AICallOptions) => Promise<AIResponse>;
type GetMemoryFn = () => Promise<string>;
type SaveMemoryFn = (content: string) => Promise<void>;

/* ─── Constants ─── */

const VALID_TYPES = new Set<string>(Object.values(FEEDBACK_TYPES));

export const DISTILL_THRESHOLD = 5;
export const MAX_LEARNING_RULES = 20;
export const LEARNING_SECTION_HEADER = "[Learned Preferences]";

const BUFFER_KEY = "openbrain_feedback_buffer";
const MAX_BUFFER = 50;

/* ─── Feedback event creation ─── */

export function createFeedbackEvent(type: string, details: Record<string, unknown> = {}): FeedbackEvent {
  if (!VALID_TYPES.has(type)) {
    throw new Error(`Unknown feedback type: ${type}`);
  }
  return {
    type: type as FeedbackType,
    timestamp: new Date().toISOString(),
    ...details,
  } as FeedbackEvent;
}

/* ─── Feedback buffer (localStorage) ─── */

export function getBufferedFeedback(): FeedbackEvent[] {
  try {
    const raw = localStorage.getItem(BUFFER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function bufferFeedback(event: FeedbackEvent): void {
  const buf = getBufferedFeedback();
  buf.push(event);
  const capped = buf.length > MAX_BUFFER ? buf.slice(buf.length - MAX_BUFFER) : buf;
  localStorage.setItem(BUFFER_KEY, JSON.stringify(capped));
}

export function clearBuffer(): void {
  localStorage.removeItem(BUFFER_KEY);
}

/* ─── Distillation threshold ─── */

export function shouldDistill(events: FeedbackEvent[]): boolean {
  return Array.isArray(events) && events.length >= DISTILL_THRESHOLD;
}

/* ─── Learning section extraction / merge ─── */

export function extractLearningSection(memoryGuide: string | null | undefined): string {
  if (!memoryGuide) return "";
  const idx = memoryGuide.indexOf(LEARNING_SECTION_HEADER);
  if (idx === -1) return "";

  const afterHeader = memoryGuide.slice(idx + LEARNING_SECTION_HEADER.length);
  const nextSection = afterHeader.search(/\n\[(?!Learned Preferences\])/);
  const sectionContent = nextSection === -1 ? afterHeader : afterHeader.slice(0, nextSection);

  return sectionContent.trim();
}

export function mergeLearningSection(memoryGuide: string | null | undefined, rules: string): string {
  const guide = memoryGuide || "";

  let cleaned = guide;
  const idx = cleaned.indexOf(LEARNING_SECTION_HEADER);
  if (idx !== -1) {
    const before = cleaned.slice(0, idx);
    const afterHeader = cleaned.slice(idx + LEARNING_SECTION_HEADER.length);
    const nextSection = afterHeader.search(/\n\[(?!Learned Preferences\])/);
    const after = nextSection === -1 ? "" : afterHeader.slice(nextSection);
    cleaned = (before + after).trim();
  }

  if (!rules || !rules.trim()) return cleaned;

  const section = `${LEARNING_SECTION_HEADER}\n${rules.trim()}`;
  return cleaned ? `${cleaned}\n\n${section}` : section;
}

/* ─── Distill prompt building ─── */

export function buildDistillPrompt(events: FeedbackEvent[], existingRules: string): string {
  const eventSummary = (events || []).map((e, i) => {
    switch (e.type) {
      case FEEDBACK_TYPES.CAPTURE_EDIT:
        return `${i + 1}. CAPTURE CORRECTION: Field "${e.field}" — AI suggested "${e.aiValue}", user changed to "${e.userValue}"${e.rawInput ? ` (raw input: "${e.rawInput}")` : ""}`;
      case FEEDBACK_TYPES.REFINE_REJECT:
        return `${i + 1}. REFINE REJECTED: ${e.suggestionType} on "${e.entryTitle}" — AI suggested ${e.field}="${e.suggestedValue}", current was "${e.currentValue}". User rejected.`;
      case FEEDBACK_TYPES.REFINE_EDIT:
        return `${i + 1}. REFINE EDITED: ${e.suggestionType} on "${e.entryTitle}" — AI suggested "${e.suggestedValue}", user changed to "${e.userValue}"`;
      case FEEDBACK_TYPES.REFINE_ACCEPT:
        return `${i + 1}. REFINE ACCEPTED: ${e.suggestionType} — "${e.suggestedValue}" applied`;
      case FEEDBACK_TYPES.QA_EDIT:
        return `${i + 1}. QA CORRECTION: Field "${e.field}" — AI parsed "${e.aiValue}", user changed to "${e.userValue}"`;
      default:
        return `${i + 1}. ${e.type}: ${JSON.stringify(e)}`;
    }
  }).join("\n");

  const existingContext = existingRules
    ? `\n\nEXISTING RULES (update/merge/replace as needed):\n${existingRules}`
    : "";

  return `USER FEEDBACK EVENTS:\n${eventSummary || "(none)"}${existingContext}`;
}

/* ─── Parse distill response ─── */

export function parseDistillResponse(text: string): string[] {
  if (!text) return [];
  const cleaned = text.replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*/g, "").trim())
    .replace(/```/g, "")
    .trim();

  const rules = cleaned
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("- ") && line.length > 3)
    .slice(0, MAX_LEARNING_RULES);

  return rules;
}

/* ─── Memory hygiene ─── */

export function applyMemoryHygiene(rules: string[]): string[] {
  if (!Array.isArray(rules)) return [];

  const seen = new Set<string>();
  const clean: string[] = [];

  for (const rule of rules) {
    const trimmed = rule.trim();
    if (!trimmed.startsWith("- ") || trimmed.length <= 2) continue;

    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    clean.push(trimmed);
  }

  return clean.slice(-MAX_LEARNING_RULES);
}

/* ─── Integration helpers ─── */

export function trackCaptureEdits(aiParsed: CaptureSnapshot, userFinal: CaptureSnapshot, rawInput?: string): void {
  if (!aiParsed || !userFinal) return;

  if (aiParsed.title !== userFinal.title) {
    bufferFeedback(createFeedbackEvent(FEEDBACK_TYPES.CAPTURE_EDIT, {
      field: "title",
      aiValue: aiParsed.title,
      userValue: userFinal.title,
      rawInput,
    }));
  }

  if (aiParsed.type !== userFinal.type) {
    bufferFeedback(createFeedbackEvent(FEEDBACK_TYPES.CAPTURE_EDIT, {
      field: "type",
      aiValue: aiParsed.type,
      userValue: userFinal.type,
      rawInput,
    }));
  }

  const aiTags = (aiParsed.tags || []).slice().sort().join(",");
  const userTags = (userFinal.tags || []).slice().sort().join(",");
  if (aiTags !== userTags) {
    bufferFeedback(createFeedbackEvent(FEEDBACK_TYPES.CAPTURE_EDIT, {
      field: "tags",
      aiValue: (aiParsed.tags || []).join(", "),
      userValue: (userFinal.tags || []).join(", "),
      rawInput,
    }));
  }
}

export function trackRefineAction(action: "accept" | "edit" | "reject", details: Record<string, unknown>): void {
  const typeMap: Record<string, FeedbackType> = {
    accept: FEEDBACK_TYPES.REFINE_ACCEPT,
    edit:   FEEDBACK_TYPES.REFINE_EDIT,
    reject: FEEDBACK_TYPES.REFINE_REJECT,
  };
  const feedbackType = typeMap[action];
  if (!feedbackType) return;

  bufferFeedback(createFeedbackEvent(feedbackType, details));
}

/* ─── Full distill-and-update orchestration ─── */

export async function distillAndUpdate(callAIFn: CallAIFn, getMemoryFn: GetMemoryFn, saveMemoryFn: SaveMemoryFn): Promise<boolean> {
  const buffer = getBufferedFeedback();
  if (!shouldDistill(buffer)) return false;

  try {
    const currentMemory = await getMemoryFn();
    const existingRules = extractLearningSection(currentMemory);
    const userMessage = buildDistillPrompt(buffer, existingRules);

    const res = await callAIFn({
      system: DISTILL_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      max_tokens: 800,
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || "";

    const newRules = parseDistillResponse(text);
    if (newRules.length === 0) {
      clearBuffer();
      return true;
    }

    const hygienic = applyMemoryHygiene(newRules);
    const rulesText = hygienic.join("\n");
    const updatedMemory = mergeLearningSection(currentMemory, rulesText);

    await saveMemoryFn(updatedMemory);
    clearBuffer();
    return true;
  } catch {
    return false;
  }
}

/* ─── System prompt for distillation ─── */

export const DISTILL_SYSTEM_PROMPT = `You are a learning system for OpenBrain, a personal knowledge base. You analyze user corrections to AI suggestions and extract lasting preference rules.

TASK: Given a batch of user feedback events (corrections, rejections, edits to AI suggestions), distill them into concise, reusable rules that will prevent the same mistakes.

RULES FOR OUTPUT:
- Return ONLY bullet points starting with "- "
- Each rule must be specific and actionable (not vague)
- Merge overlapping rules into one
- If an existing rule already covers a correction, keep it unchanged
- If a new pattern contradicts an existing rule, replace the old rule with the updated one
- Maximum ${MAX_LEARNING_RULES} rules total
- Focus on PATTERNS, not one-off corrections (need 2+ similar events to create a rule)
- Rules should be about classification, typing, naming, metadata extraction, and relationship preferences
- Be concise: each rule should be one line, under 120 characters

EXAMPLES:
- When input contains a person's name, classify as "person" not "note"
- South African phone numbers (07x/08x) always go in metadata.phone
- Business supplier entries should be typed as "contact" not "person"
- User prefers short titles under 40 characters
- Do not suggest type changes for entries tagged "meeting-notes"

If no clear pattern emerges from the feedback, return an empty response.`;
