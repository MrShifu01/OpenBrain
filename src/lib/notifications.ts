import { toast as sonnerToast } from "sonner";
import type { ToastEvent, ToastListener } from "../types";

// Sonner is the project's canonical toast surface (see <Toaster> in
// Everion.tsx) so showToast() dispatches there directly. The custom
// listener pattern below stayed unsubscribed for months — every call to
// showToast() / showError() in useEntryActions / offlineQueue / etc. was
// silently dropped. Wiring sonner here fixes all of them at once.
//
// Listener API (onToast) is preserved so any existing subscriber (tests,
// future custom surfaces) keeps working.

const listeners = new Set<ToastListener>();

export function showToast(message: string, type: ToastEvent["type"] = "info"): void {
  listeners.forEach((fn) => fn({ message, type, id: Date.now() }));
  if (type === "error") sonnerToast.error(message);
  else if (type === "success") sonnerToast.success(message);
  else sonnerToast(message);
}

export function showError(message: string): void {
  showToast(message, "error");
}
export function showSuccess(message: string): void {
  showToast(message, "success");
}

export function onToast(callback: ToastListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function captureError(err: unknown, context: string = ""): void {
  console.error(`[OpenBrain:${context}]`, err);
}
