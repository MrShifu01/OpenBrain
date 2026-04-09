import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { clearAISettingsCache } from "../../lib/aiSettings";
import { authFetch } from "../../lib/authFetch";

interface Props {
  email: string;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AccountTab({ email }: Props) {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSigningOut(true);
    setError(null);
    clearAISettingsCache();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
      setSigningOut(false);
    }
  };

  async function fetchAllEntries() {
    const r = await authFetch("/api/entries");
    if (!r.ok) throw new Error("Failed to fetch entries");
    const data = await r.json();
    return Array.isArray(data) ? data : (data?.entries ?? []);
  }

  async function handleExportJSON() {
    setExporting(true);
    setExportError(null);
    try {
      const entries = await fetchAllEntries();
      const json = JSON.stringify(entries, null, 2);
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(json, `everion-export-${date}.json`, "application/json");
    } catch (e: any) {
      setExportError(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportCSV() {
    setExporting(true);
    setExportError(null);
    try {
      const entries = await fetchAllEntries();
      if (!entries.length) {
        setExportError("No entries to export.");
        return;
      }
      const cols = ["id", "title", "type", "content", "tags", "created_at", "updated_at"];
      const rows = [
        cols.join(","),
        ...entries.map((e: any) =>
          cols
            .map((c) => {
              const val = c === "tags" ? (e[c] || []).join("; ") : (e[c] ?? "");
              return `"${String(val).replace(/"/g, '""')}"`;
            })
            .join(","),
        ),
      ];
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(rows.join("\n"), `everion-export-${date}.csv`, "text/csv");
    } catch (e: any) {
      setExportError(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportVCard() {
    setExporting(true);
    setExportError(null);
    try {
      const entries = await fetchAllEntries();
      const contacts = entries.filter((e: any) =>
        ["person", "contact"].includes(e.type?.toLowerCase()),
      );
      if (!contacts.length) {
        setExportError("No person/contact entries to export.");
        setExporting(false);
        return;
      }
      const vcards = contacts.map((e: any) => {
        const meta = e.metadata || {};
        const lines = [
          "BEGIN:VCARD",
          "VERSION:3.0",
          `FN:${e.title}`,
          meta.email ? `EMAIL:${meta.email}` : "",
          meta.phone ? `TEL:${meta.phone}` : "",
          e.content ? `NOTE:${e.content.replace(/\n/g, "\\n")}` : "",
          "END:VCARD",
        ].filter(Boolean);
        return lines.join("\r\n");
      });
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(vcards.join("\r\n"), `everion-contacts-${date}.vcf`, "text/vcard");
    } catch (e: any) {
      setExportError(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Account info */}
      <div
        className="rounded-2xl border p-4"
        style={{
          background: "var(--color-surface-container-high)",
          borderColor: "var(--color-outline-variant)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-on-surface text-sm font-semibold">Account</p>
            <p className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
              {email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5 disabled:opacity-40"
            style={{
              color: "var(--color-error)",
              borderColor: "color-mix(in oklch, var(--color-error) 30%, transparent)",
            }}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs" style={{ color: "var(--color-error)" }}>
            {error}
          </p>
        )}
      </div>

      {/* Data Export */}
      <div
        className="rounded-2xl border p-4"
        style={{
          background: "var(--color-surface-container-high)",
          borderColor: "var(--color-outline-variant)",
        }}
      >
        <p className="text-on-surface mb-1 text-sm font-semibold">Export Your Data</p>
        <p className="mb-3 text-xs" style={{ color: "var(--color-on-surface-variant)" }}>
          Download all your memories. Your data is always yours.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportJSON}
            disabled={exporting}
            className="rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
            style={{
              borderColor: "var(--color-outline-variant)",
              color: "var(--color-on-surface-variant)",
            }}
          >
            {exporting ? "Exporting…" : "JSON"}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
            style={{
              borderColor: "var(--color-outline-variant)",
              color: "var(--color-on-surface-variant)",
            }}
          >
            CSV
          </button>
          <button
            onClick={handleExportVCard}
            disabled={exporting}
            className="rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
            style={{
              borderColor: "var(--color-outline-variant)",
              color: "var(--color-on-surface-variant)",
            }}
          >
            vCard (contacts)
          </button>
        </div>
        {exportError && (
          <p className="mt-2 text-xs" style={{ color: "var(--color-error)" }}>
            {exportError}
          </p>
        )}
      </div>
    </div>
  );
}
