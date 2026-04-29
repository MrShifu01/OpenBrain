import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { Button } from "./components/ui/button";

// Detect chunk-load / dynamic-import failures caused by a stale Service
// Worker serving HTML that references chunk hashes from a previous build.
// Browsers expose this with a few different surfaces; match all of them.
function isStaleBundleError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message || "";
  const name = error.name || "";
  return (
    name === "ChunkLoadError" ||
    /Loading chunk \d+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

async function hardRecoverFromStaleBundle(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch {
    // best-effort; reload anyway
  }
  // Cache-bust the document URL so we don't get a 304 from intermediaries.
  const url = new URL(window.location.href);
  url.searchParams.set("_sw", Date.now().toString(36));
  window.location.replace(url.toString());
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Optional view-scoped fallback. When set, rendering errors in `children`
   * show this instead of the full-screen "Something went wrong" view, so a
   * crash inside e.g. ChatView doesn't blow away the surrounding shell.
   * The function receives the captured error and a reset callback that
   * clears the boundary's error state.
   */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /**
   * Sentry tag — helps filter "errors in ChatView" vs "errors in VaultView"
   * vs the global app-shell boundary in dashboards.
   */
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const tag = this.props.name ?? "root";
    console.error(`OpenBrain error [${tag}]:`, error, info.componentStack);
    Sentry.captureException(error, {
      tags: { boundary: tag, staleBundle: isStaleBundleError(error) },
      extra: { componentStack: info.componentStack },
    });
    // Auto-recover stale-bundle errors once per page load. The flag is on
    // sessionStorage so we don't loop if the recovery itself somehow fails.
    if (isStaleBundleError(error)) {
      try {
        const KEY = "everion:sw-recovered";
        if (!sessionStorage.getItem(KEY)) {
          sessionStorage.setItem(KEY, "1");
          void hardRecoverFromStaleBundle();
        }
      } catch {
        void hardRecoverFromStaleBundle();
      }
    }
  }

  reset = () => {
    // If this looks like a stale-bundle error (PWA service worker holding an
    // old index.html that references chunk hashes from a previous deploy),
    // a plain re-render won't help — the same import will fail again. Force
    // a clean reload: unregister the SW, drop all caches, then reload from
    // the network so the user picks up the current build.
    if (isStaleBundleError(this.state.error)) {
      void hardRecoverFromStaleBundle();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // View-scoped boundary — render the caller's fallback inside the
      // surrounding shell so the rest of the app keeps working.
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div
          className="flex min-h-screen items-center justify-center p-10"
          style={{ background: "var(--color-background)", color: "var(--color-on-surface)" }}
        >
          <div className="max-w-[400px] text-center">
            <div className="mb-4 flex justify-center" aria-hidden="true">
              <svg
                width={48}
                height={48}
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8.5 3a3.5 3.5 0 0 0-3.5 3.5c-1.5.5-2.5 2-2.5 3.5 0 1 .5 2 1.5 2.5-.5.8-.5 2 0 3 .3.6.8 1 1.5 1.3-.2.9.1 2 .8 2.7.8.7 2 1 3 .5.3 1 1.3 2 2.7 2A2.5 2.5 0 0 0 14.5 20V4.5A1.5 1.5 0 0 0 13 3M15.5 3A3.5 3.5 0 0 1 19 6.5c1.5.5 2.5 2 2.5 3.5 0 1-.5 2-1.5 2.5.5.8.5 2 0 3-.3.6-.8 1-1.5 1.3.2.9-.1 2-.8 2.7-.8.7-2 1-3 .5-.3 1-1.3 2-2.7 2A2.5 2.5 0 0 1 9.5 20V4.5A1.5 1.5 0 0 1 11 3" />
              </svg>
            </div>
            <h2 className="m-0 mb-3 text-xl font-bold" style={{ color: "var(--color-primary)" }}>
              Something went wrong
            </h2>
            <p
              className="m-0 mb-6 text-sm leading-relaxed"
              style={{ color: "var(--color-on-surface-variant)" }}
            >
              Everion hit an unexpected error. Your data is safe in the database.
            </p>
            <p
              className="m-0 mb-6 rounded-lg p-3 text-left font-mono text-xs break-all"
              style={{
                background: "var(--color-surface-container)",
                color: "var(--color-on-surface-variant)",
              }}
            >
              {this.state.error?.message || "Unknown error"}
            </p>
            <Button
              size="lg"
              onClick={this.reset}
              className="rounded-xl px-8 font-bold"
              style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}
            >
              Try again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
