/**
 * VITE_ENABLE_MULTI_BRAIN — gates multi-brain UI (BrainSwitcher, per-brain context in Ask).
 * Owner: @christian. Expected removal: after multi-brain ships to all users.
 */
export function isMultiBrainEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_MULTI_BRAIN === "true";
}
