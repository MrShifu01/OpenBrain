// ============================================================
// Google Keep / Takeout import panel
// ============================================================
//
// Pipeline: zip → parse → hash → import (batched) → enrich (waved).
//
// Each phase has visible progress, the user can cancel at any point, and
// if the run is interrupted (close tab / network blip) a resume token in
// localStorage offers to pick up where it left off. Re-uploading the same
// Takeout zip is a no-op because every note carries an `import_hash` and
// the server dedupes on it.
//
// Yields to the browser's event loop between parse chunks so a 10 K-note
// zip doesn't freeze the main thread. A Web Worker would be an option for
// even larger imports — for the volumes Keep produces, chunked yielding
// keeps the UI smooth without the separate-bundle complexity.

import { useState, useRef, useEffect, useCallback } from "react";
import JSZip from "jszip";
import { authFetch } from "../../lib/authFetch";
import { SettingsButton } from "./SettingsRow";

// ── Types ──────────────────────────────────────────────────────────────────

interface KeepAttachment {
  filePath?: string;
  mimetype?: string;
}

interface KeepNote {
  title?: string;
  textContent?: string;
  listContent?: Array<{ text: string; isChecked: boolean }>;
  labels?: Array<{ name: string }>;
  attachments?: KeepAttachment[];
  isTrashed?: boolean;
  isArchived?: boolean;
  userEditedTimestampUsec?: number;
  createdTimestampUsec?: number;
}

interface ImportEntry {
  title: string;
  content: string;
  type: string;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at?: string;
}

type Phase = "idle" | "parsing" | "importing" | "enriching" | "done" | "error" | "cancelled";

interface Progress {
  phase: Phase;
  current: number;
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  enriched: number;
  pendingEnrichment: number;
  startedAt: number;
  detail?: string;
}

interface ResumeState {
  brainId: string;
  importedCount: number;
  totalCount: number;
  startedAt: number;
  hashes: string[]; // hashes already imported in the prior run — server dedup handles re-sends, but client also short-circuits
}

// ── Constants ──────────────────────────────────────────────────────────────

const BATCH_SIZE = 500; // notes per /api/import call — well under 25 MB body
const PARSE_CHUNK = 200; // yield to UI every N parsed notes
const ENRICH_BATCH = 30; // entries per /api/entries?action=enrich-batch poll
const ENRICH_PAUSE_MS = 600; // pause between enrich polls — prevents throttle, lets DB breathe
const RESUME_TTL_MS = 30 * 60 * 1000; // discard resume tokens older than 30 min
const RESUME_KEY_PREFIX = "keep_import_resume_";

// ── Helpers ────────────────────────────────────────────────────────────────

/** 16-char hex slice of SHA-256 over a stable note signature. Collisions
 *  are negligible for 10 K-note imports (~1 in 2^32 per pair). */
async function noteHash(note: KeepNote): Promise<string> {
  const ts = note.userEditedTimestampUsec ?? note.createdTimestampUsec ?? 0;
  const sig = `${note.title ?? ""}|${(note.textContent ?? "").slice(0, 200)}|${ts}`;
  const enc = new TextEncoder().encode(sig);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function usecToIso(usec?: number): string | undefined {
  if (!usec || !Number.isFinite(usec)) return undefined;
  // Keep timestamps are microseconds since epoch.
  const ms = Math.floor(usec / 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

async function convertNote(note: KeepNote): Promise<ImportEntry | null> {
  if (note.isTrashed) return null;
  const content = note.listContent?.length
    ? note.listContent.map((it) => `- [${it.isChecked ? "x" : " "}] ${it.text}`).join("\n")
    : (note.textContent ?? "");
  const title = note.title?.trim() || content.slice(0, 80);
  if (!title) return null;
  const tags = note.labels?.map((l) => l.name).filter(Boolean) ?? [];
  const hash = await noteHash(note);
  const createdAt = usecToIso(note.createdTimestampUsec);
  const editedAt = usecToIso(note.userEditedTimestampUsec);
  const attachments = Array.isArray(note.attachments) ? note.attachments : [];

  const metadata: Record<string, unknown> = {
    import_hash: hash,
    import_source: "google_keep",
    ...(editedAt ? { original_edited_at: editedAt } : {}),
    ...(note.isArchived ? { keep_archived: true } : {}),
    // Track dropped attachments so the user can find them in the Takeout
    // zip later. Filenames are kept; binary content stays with the source.
    ...(attachments.length > 0
      ? {
          attachments_dropped: attachments.length,
          attachment_files: attachments
            .map((a) => a.filePath || "")
            .filter(Boolean)
            .slice(0, 10),
        }
      : {}),
  };

  return {
    title,
    content,
    type: "note",
    tags,
    metadata,
    ...(createdAt ? { created_at: createdAt } : {}),
  };
}

async function parseFiles(
  files: FileList,
  onProgress: (current: number, total: number, detail?: string) => void,
  signal: AbortSignal,
): Promise<ImportEntry[]> {
  // Phase 1: open all archives, build a flat list of "note tasks" (zip
  // entries or standalone JSON files) so we can show a real total.
  type NoteTask =
    | { kind: "zip"; zf: JSZip.JSZipObject }
    | { kind: "file"; file: File };

  const tasks: NoteTask[] = [];
  for (const file of Array.from(files)) {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (file.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(file);
      for (const zf of Object.values(zip.files)) {
        if (zf.dir) continue;
        if (!zf.name.toLowerCase().endsWith(".json")) continue;
        // Takeout puts Keep notes under "Takeout/Keep/<title>.json".
        // Also tolerate plain "Keep/" or root-level json files.
        if (!/(?:^|\/)keep\//i.test(zf.name) && !/^[^/]+\.json$/i.test(zf.name)) {
          // Skip non-Keep JSONs from a multi-product Takeout export.
          continue;
        }
        tasks.push({ kind: "zip", zf });
      }
    } else if (file.name.toLowerCase().endsWith(".json")) {
      tasks.push({ kind: "file", file });
    }
  }

  // Phase 2: parse + convert in chunks, yielding to the event loop so the
  // UI thread stays responsive on huge zips.
  const out: ImportEntry[] = [];
  let processed = 0;
  for (const task of tasks) {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    try {
      const text =
        task.kind === "zip" ? await task.zf.async("text") : await task.file.text();
      const note: KeepNote = JSON.parse(text);
      const entry = await convertNote(note);
      if (entry) out.push(entry);
    } catch {
      // Malformed JSON or unexpected shape — skip silently.
    }
    processed++;
    if (processed % PARSE_CHUNK === 0) {
      onProgress(processed, tasks.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  onProgress(tasks.length, tasks.length);
  return out;
}

function formatEta(elapsedMs: number, current: number, total: number): string {
  if (current <= 0 || total <= current) return "";
  const rate = current / elapsedMs;
  const remainingMs = (total - current) / rate;
  const s = Math.round(remainingMs / 1000);
  if (s < 60) return `~${s} s`;
  if (s < 3600) return `~${Math.round(s / 60)} min`;
  return `~${Math.round(s / 3600)} h`;
}

function loadResume(brainId: string): ResumeState | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY_PREFIX + brainId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResumeState;
    if (Date.now() - parsed.startedAt > RESUME_TTL_MS) {
      localStorage.removeItem(RESUME_KEY_PREFIX + brainId);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveResume(brainId: string, state: ResumeState): void {
  try {
    localStorage.setItem(RESUME_KEY_PREFIX + brainId, JSON.stringify(state));
  } catch {
    /* quota — non-fatal */
  }
}

function clearResume(brainId: string): void {
  try {
    localStorage.removeItem(RESUME_KEY_PREFIX + brainId);
  } catch {
    /* non-fatal */
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function GoogleKeepImportPanel({ brainId }: { brainId: string }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [resume, setResume] = useState<ResumeState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!brainId) return;
    setResume(loadResume(brainId));
  }, [brainId]);

  const updateProgress = useCallback((patch: Partial<Progress>) => {
    setProgress((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const runImport = useCallback(
    async (files: FileList) => {
      const ac = new AbortController();
      abortRef.current = ac;
      const startedAt = Date.now();
      setProgress({
        phase: "parsing",
        current: 0,
        total: 0,
        imported: 0,
        skipped: 0,
        failed: 0,
        enriched: 0,
        pendingEnrichment: 0,
        startedAt,
        detail: "Reading archive…",
      });

      let entries: ImportEntry[] = [];
      try {
        entries = await parseFiles(
          files,
          (current, total, detail) =>
            updateProgress({ phase: "parsing", current, total, detail }),
          ac.signal,
        );
      } catch (e: any) {
        if (e?.name === "AbortError") {
          setProgress((p) => (p ? { ...p, phase: "cancelled" } : p));
        } else {
          console.error("[keep:parse]", e);
          setProgress((p) =>
            p ? { ...p, phase: "error", detail: e?.message || "Could not read the archive" } : p,
          );
        }
        return;
      }

      if (entries.length === 0) {
        setProgress((p) =>
          p ? { ...p, phase: "error", detail: "No valid Keep notes found" } : p,
        );
        return;
      }

      // ── Import phase ──
      setProgress((p) =>
        p ? { ...p, phase: "importing", current: 0, total: entries.length, detail: undefined } : p,
      );

      let imported = 0;
      let skipped = 0;
      let failed = 0;
      const sentHashes: string[] = [];

      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        if (ac.signal.aborted) {
          setProgress((p) => (p ? { ...p, phase: "cancelled" } : p));
          saveResume(brainId, {
            brainId,
            importedCount: imported,
            totalCount: entries.length,
            startedAt,
            hashes: sentHashes,
          });
          return;
        }
        const batch = entries.slice(i, i + BATCH_SIZE);
        try {
          const res = await authFetch("/api/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brain_id: brainId, entries: batch }),
            signal: ac.signal,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          imported += data.imported ?? 0;
          skipped += data.skipped ?? 0;
          failed += data.failed ?? 0;
          for (const e of batch) {
            const h = e.metadata?.import_hash;
            if (typeof h === "string") sentHashes.push(h);
          }
        } catch (e: any) {
          if (e?.name === "AbortError") {
            setProgress((p) => (p ? { ...p, phase: "cancelled" } : p));
            saveResume(brainId, {
              brainId,
              importedCount: imported,
              totalCount: entries.length,
              startedAt,
              hashes: sentHashes,
            });
            return;
          }
          failed += batch.length;
          console.error("[keep:import] batch failed", e);
        }

        updateProgress({
          current: Math.min(i + BATCH_SIZE, entries.length),
          imported,
          skipped,
          failed,
        });
      }

      // ── Enrichment phase (waved) ──
      setProgress((p) =>
        p
          ? {
              ...p,
              phase: "enriching",
              current: 0,
              total: imported, // approximate ceiling — server reports remaining live
              pendingEnrichment: imported,
              detail: undefined,
            }
          : p,
      );

      let enriched = 0;
      let stuckIterations = 0;
      while (true) {
        if (ac.signal.aborted) {
          setProgress((p) => (p ? { ...p, phase: "cancelled" } : p));
          return;
        }
        let processed = 0;
        let remaining = 0;
        try {
          const res = await authFetch("/api/entries?action=enrich-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brain_id: brainId, batch_size: ENRICH_BATCH }),
            signal: ac.signal,
          });
          if (!res.ok) break;
          const data = await res.json();
          processed = data.processed ?? 0;
          remaining = data.remaining ?? 0;
        } catch (e: any) {
          if (e?.name === "AbortError") {
            setProgress((p) => (p ? { ...p, phase: "cancelled" } : p));
            return;
          }
          console.warn("[keep:enrich] poll failed", e);
          break;
        }

        enriched += processed;
        updateProgress({
          enriched,
          pendingEnrichment: remaining,
          current: enriched,
          // Total is enriched + remaining; if remaining shrinks faster than
          // expected (other paths enriching too) we keep total accurate.
          total: enriched + remaining,
        });

        if (remaining === 0) break;
        // Guard against pathological "no progress" loops — three idle
        // rounds ends the polling so we don't spin forever.
        if (processed === 0) {
          stuckIterations++;
          if (stuckIterations >= 3) break;
        } else {
          stuckIterations = 0;
        }
        await new Promise((r) => setTimeout(r, ENRICH_PAUSE_MS));
      }

      setProgress((p) => (p ? { ...p, phase: "done" } : p));
      clearResume(brainId);
      setResume(null);
    },
    [brainId, updateProgress],
  );

  const handleFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      e.target.value = "";
      void runImport(files);
    },
    [runImport],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleClearResume = useCallback(() => {
    clearResume(brainId);
    setResume(null);
  }, [brainId]);

  const inFlight =
    progress?.phase === "parsing" ||
    progress?.phase === "importing" ||
    progress?.phase === "enriching";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div className="micro" style={{ marginBottom: 4 }}>
          Google Keep
        </div>
        <p
          className="f-serif"
          style={{ fontSize: 13, color: "var(--ink-faint)", fontStyle: "italic", margin: 0 }}
        >
          Upload a Google Takeout{" "}
          <strong style={{ fontStyle: "normal", color: "var(--ink-soft)" }}>.zip</strong> or
          individual Keep{" "}
          <strong style={{ fontStyle: "normal", color: "var(--ink-soft)" }}>.json</strong> files.
          Trashed notes are skipped. Re-importing the same archive is safe — duplicates are
          dropped on the server.
        </p>
      </div>

      <input
        type="file"
        accept=".zip,.json"
        multiple
        ref={fileRef}
        onChange={handleFiles}
        className="hidden"
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <SettingsButton onClick={() => fileRef.current?.click()} disabled={inFlight}>
          {inFlight ? "Working…" : "Import Keep notes"}
        </SettingsButton>
        {inFlight && <SettingsButton onClick={handleCancel}>Cancel</SettingsButton>}
      </div>

      {progress && <ProgressBlock progress={progress} />}

      {resume && !inFlight && (
        <div
          className="f-sans"
          style={{
            fontSize: 12,
            color: "var(--ink-faint)",
            border: "1px solid var(--line-soft)",
            borderRadius: 8,
            padding: "8px 12px",
            background: "var(--surface-low)",
          }}
        >
          A previous import was interrupted at {resume.importedCount} / {resume.totalCount}.
          Re-uploading the same archive will resume safely (duplicates dropped automatically).{" "}
          <button
            onClick={handleClearResume}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--ink-soft)",
              textDecoration: "underline",
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
              fontSize: "inherit",
            }}
          >
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// ── Progress block ─────────────────────────────────────────────────────────

function ProgressBlock({ progress }: { progress: Progress }) {
  const { phase, current, total, imported, skipped, failed, enriched, pendingEnrichment } =
    progress;
  const elapsed = Date.now() - progress.startedAt;
  const eta =
    phase === "parsing" || phase === "importing" || phase === "enriching"
      ? formatEta(elapsed, current, total)
      : "";

  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  const headline =
    phase === "parsing"
      ? `Parsing ${current.toLocaleString()} / ${total.toLocaleString()}`
      : phase === "importing"
        ? `Importing ${current.toLocaleString()} / ${total.toLocaleString()}`
        : phase === "enriching"
          ? `Enriching ${enriched.toLocaleString()} / ${(enriched + pendingEnrichment).toLocaleString()}`
          : phase === "done"
            ? `Imported ${imported.toLocaleString()}, enriched ${enriched.toLocaleString()}${
                skipped ? `, ${skipped.toLocaleString()} duplicates skipped` : ""
              }${failed ? `, ${failed.toLocaleString()} failed` : ""}`
            : phase === "cancelled"
              ? `Cancelled — ${imported.toLocaleString()} imported so far`
              : phase === "error"
                ? progress.detail || "Import failed"
                : "";

  const statusColor =
    phase === "done"
      ? "var(--moss)"
      : phase === "error"
        ? "var(--blood)"
        : phase === "cancelled"
          ? "var(--ink-faint)"
          : "var(--ink-soft)";

  return (
    <div
      className="f-sans"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 12px",
        border: "1px solid var(--line-soft)",
        borderRadius: 8,
        background: "var(--surface-low)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
        <span style={{ color: statusColor }}>{headline}</span>
        {eta && <span style={{ color: "var(--ink-faint)" }}>{eta}</span>}
      </div>
      {(phase === "parsing" || phase === "importing" || phase === "enriching") && (
        <div
          style={{
            height: 4,
            background: "var(--surface-high)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "var(--ember)",
              transition: "width 200ms ease",
            }}
          />
        </div>
      )}
      {progress.detail && phase !== "error" && (
        <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{progress.detail}</span>
      )}
    </div>
  );
}
