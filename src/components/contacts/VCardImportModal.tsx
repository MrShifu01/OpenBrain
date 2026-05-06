import { useRef, useState } from "react";
import type { Entry } from "../../types";
import { authFetch } from "../../lib/authFetch";
import { parseVCardFile, type ParsedContact } from "../../lib/vcard";
import { Button } from "../ui/button";

interface VCardImportModalProps {
  brainId: string | undefined;
  onClose: () => void;
  onImported: (created: Entry[]) => void;
}

// Two-step import: drop a .vcf file → preview every contact (all unticked) →
// user picks which to keep → POST one /api/capture per ticked contact. The
// shape mirrors the lists feature (paste-driven preview with checkboxes) so
// the UX feels native to the app.
export default function VCardImportModal({ brainId, onClose, onImported }: VCardImportModalProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function toggle(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(contacts.map((c) => c.uid)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function handleFile(file: File) {
    setParseError(null);
    setSelected(new Set());
    setContacts([]);
    try {
      const text = await file.text();
      const parsed = parseVCardFile(text);
      if (parsed.length === 0) {
        setParseError("No contacts found in this file.");
        return;
      }
      setContacts(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Couldn't read file");
    }
  }

  async function handleImport() {
    if (selected.size === 0 || importing) return;
    setImporting(true);
    setImportError(null);
    const picks = contacts.filter((c) => selected.has(c.uid));
    const created: Entry[] = [];
    setProgress({ done: 0, total: picks.length });
    for (let i = 0; i < picks.length; i++) {
      const c = picks[i];
      const metadata: Record<string, unknown> = {
        contact_v: 1,
        // Top-level scalars match what the rest of the app already reads
        // for entries with single phone/email values (see ContactsView's
        // looksLikeContact filter).
        phone: c.phones[0],
        email: c.emails[0],
        phones: c.phones,
        emails: c.emails,
      };
      if (c.org) metadata.organization = c.org;
      if (c.title) metadata.title = c.title;
      if (c.birthday) metadata.birthday = c.birthday;
      if (c.address) metadata.address = c.address;
      if (c.note) metadata.note = c.note;

      try {
        const res = await authFetch("/api/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            p_title: c.name,
            p_content: c.rawSummary || c.name,
            p_type: "contact",
            p_metadata: metadata,
            p_tags: ["contact", "vcard"],
            p_brain_id: brainId,
          }),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => null)) as { entry?: Entry } | null;
          if (data?.entry) created.push(data.entry);
        } else {
          const detail = await res.text().catch(() => "");
          console.error("[vcard] capture failed", res.status, detail);
        }
      } catch (err) {
        console.error("[vcard] capture exception", err);
      }
      setProgress({ done: i + 1, total: picks.length });
    }
    setImporting(false);
    if (created.length === 0) {
      setImportError(
        "Couldn't save any contacts. Check your connection and try again, or pick fewer.",
      );
      return;
    }
    onImported(created);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import vCard"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 80,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "85vh",
          background: "var(--surface-high)",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--lift-3)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--line-soft)",
          }}
        >
          <div>
            <div className="f-serif" style={{ fontSize: 18, color: "var(--ink)" }}>
              Import vCard
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
              {contacts.length === 0
                ? "Drop a .vcf file to preview contacts."
                : `${selected.size} of ${contacts.length} selected`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              fontSize: 20,
              color: "var(--ink-faint)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {contacts.length === 0 ? (
            <div
              style={{
                border: "1px dashed var(--line-soft)",
                borderRadius: 12,
                padding: "32px 16px",
                textAlign: "center",
              }}
            >
              <Button type="button" onClick={() => fileInput.current?.click()} disabled={importing}>
                Choose .vcf file
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".vcf,text/vcard,text/x-vcard"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
                style={{ display: "none" }}
              />
              {parseError && (
                <div style={{ marginTop: 12, color: "var(--blood)", fontSize: 12 }}>
                  {parseError}
                </div>
              )}
              <div style={{ marginTop: 12, fontSize: 11, color: "var(--ink-faint)" }}>
                Export contacts from your phone or address book as a .vcf file.
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 12,
                  fontSize: 12,
                }}
              >
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={importing}
                  style={selectorBtnStyle}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={importing}
                  style={selectorBtnStyle}
                >
                  Clear
                </button>
              </div>

              <div
                style={{
                  border: "1px solid var(--line-soft)",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "var(--surface)",
                }}
              >
                {contacts.map((c, i) => {
                  const checked = selected.has(c.uid);
                  return (
                    <label
                      key={c.uid}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "10px 14px",
                        borderBottom: i < contacts.length - 1 ? "1px solid var(--line-soft)" : 0,
                        cursor: importing ? "default" : "pointer",
                        opacity: importing ? 0.6 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={importing}
                        onChange={() => toggle(c.uid)}
                        style={{ marginTop: 3, accentColor: "var(--ember)" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            color: "var(--ink)",
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.name}
                          {c.org && (
                            <span
                              style={{ marginLeft: 6, fontSize: 11, color: "var(--ink-faint)" }}
                            >
                              · {c.org}
                            </span>
                          )}
                        </div>
                        {(c.phones.length > 0 || c.emails.length > 0) && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--ink-faint)",
                              marginTop: 2,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {[c.phones[0], c.emails[0]].filter(Boolean).join(" · ")}
                            {c.phones.length + c.emails.length > 2 && (
                              <span style={{ color: "var(--ink-faint)", marginLeft: 4 }}>
                                +{c.phones.length + c.emails.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {importError && (
                <div style={{ marginTop: 12, color: "var(--blood)", fontSize: 12 }}>
                  {importError}
                </div>
              )}
            </>
          )}
        </div>

        {contacts.length > 0 && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--line-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
              {progress
                ? `Saving ${progress.done} of ${progress.total}…`
                : `${selected.size} selected`}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button type="button" variant="outline" onClick={onClose} disabled={importing}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={importing || selected.size === 0}
              >
                {importing ? "Saving…" : `Save ${selected.size}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const selectorBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--line-soft)",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  color: "var(--ink)",
  cursor: "pointer",
};
