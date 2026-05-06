const ADMIN_FLAGS_KEY = "openbrain_admin_flags";

export const FEATURE_FLAGS = {
  chat: { label: "Chat", icon: "💬", prodEnabled: import.meta.env.VITE_FEATURE_CHAT === "true" },
  graph: {
    label: "Knowledge Graph",
    icon: "✦",
    prodEnabled: import.meta.env.VITE_FEATURE_GRAPH === "true",
  },
  todos: {
    label: "Schedule",
    icon: "✓",
    prodEnabled: import.meta.env.VITE_FEATURE_TODOS === "true",
  },
  timeline: {
    label: "Timeline",
    icon: "◷",
    prodEnabled: import.meta.env.VITE_FEATURE_TIMELINE === "true",
  },
  vault: { label: "Vault", icon: "🔐", prodEnabled: import.meta.env.VITE_FEATURE_VAULT === "true" },
  importantMemories: {
    label: "Important Memories",
    icon: "★",
    prodEnabled: import.meta.env.VITE_FEATURE_IMPORTANT_MEMORIES === "true",
  },
  someday: {
    label: "Someday list",
    icon: "∞",
    prodEnabled: import.meta.env.VITE_FEATURE_SOMEDAY === "true",
  },
  multiBrain: {
    label: "Multi-brain",
    icon: "🧠",
    // Ungated 2026-05-05 — shared brains are now a first-class feature for
    // every user. Brain switcher in headers, Brain settings tab, brain pill
    // in capture sheet, Move-to-Brain in DetailModal all rely on this flag.
    // `as boolean` keeps the type identical to other (env-var-derived)
    // entries so test mocks that walk FEATURE_FLAGS keep type-checking.
    prodEnabled: true as boolean,
  },
  lists: {
    label: "Lists",
    icon: "≡",
    prodEnabled: import.meta.env.VITE_FEATURE_LISTS === "true",
  },
  contacts: {
    label: "Contacts",
    icon: "👤",
    prodEnabled: import.meta.env.VITE_FEATURE_CONTACTS === "true",
  },
  vaultTemplates: {
    label: "Vault entry templates",
    icon: "🗂",
    prodEnabled: import.meta.env.VITE_FEATURE_VAULT_TEMPLATES === "true",
  },
  vaultPinBiometric: {
    label: "Vault PIN + biometric unlock",
    icon: "🔓",
    prodEnabled: import.meta.env.VITE_FEATURE_VAULT_PIN_BIOMETRIC === "true",
  },
  appLock: {
    label: "App-level biometric re-auth",
    icon: "📱",
    prodEnabled: import.meta.env.VITE_FEATURE_APP_LOCK === "true",
  },
  extraThemes: {
    label: "Extra themes (Aurora, Atelier, Blueprint, Botanical, Newsprint, Zine)",
    icon: "🎨",
    prodEnabled: import.meta.env.VITE_FEATURE_EXTRA_THEMES === "true",
  },
} as const satisfies Record<string, { label: string; icon: string; prodEnabled: boolean }>;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export function getAdminFlags(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_FLAGS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function setAdminFlag(key: string, val: boolean): void {
  const flags = getAdminFlags();
  flags[key] = val;
  localStorage.setItem(ADMIN_FLAGS_KEY, JSON.stringify(flags));
}

export function isFeatureEnabled(
  key: FeatureFlagKey,
  adminFlags: Record<string, boolean>,
): boolean {
  return FEATURE_FLAGS[key].prodEnabled || (adminFlags[key] ?? false);
}
