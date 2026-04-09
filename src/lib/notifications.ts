import type { ToastEvent, ToastListener } from "../types";

const listeners = new Set<ToastListener>();

export function showToast(message: string, type: ToastEvent["type"] = "info"): void {
  listeners.forEach((fn) => fn({ message, type, id: Date.now() }));
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

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: "Bad request — check the data and try again.",
  401: "Not signed in — please refresh and sign in again.",
  403: "You don't have permission to do this.",
  404: "Not found — it may have been deleted.",
  408: "Request timed out — check your connection and try again.",
  409: "Conflict — this may have already been saved.",
  429: "Too many requests — wait a moment and try again.",
  500: "Server error — try again in a moment.",
  502: "Server unavailable — try again shortly.",
  503: "Service unavailable — try again in a moment.",
};

/** Translate an HTTP status code into a user-friendly message. */
export function translateHttpError(status: number, fallback?: string): string {
  return HTTP_ERROR_MESSAGES[status] ?? fallback ?? `Something went wrong (${status}). Try again.`;
}
