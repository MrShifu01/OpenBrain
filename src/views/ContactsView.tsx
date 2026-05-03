import { useMemo, useState } from "react";
import type { Entry } from "../types";
import { Button } from "../components/ui/button";
import VCardImportModal from "../components/contacts/VCardImportModal";

interface ContactsViewProps {
  entries: Entry[];
  brainId: string | undefined;
  onEntryCreated: (entry: Entry) => void;
  onSelectEntry?: (entry: Entry) => void;
}

// Anything with a phone or email (or explicitly typed "contact") shows up
// here. Catches both proper imports and incidental "X's email is..." notes
// that happened to capture the address into metadata.
function looksLikeContact(e: Entry): boolean {
  const m = e.metadata;
  if (!m) return e.type === "contact";
  return Boolean(m.phone) || Boolean(m.email) || e.type === "contact";
}

function fmtRelative(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function ContactsView({
  entries,
  brainId,
  onEntryCreated,
  onSelectEntry,
}: ContactsViewProps) {
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState("");

  const contacts = useMemo(() => {
    const filtered = entries.filter(looksLikeContact);
    if (!filter.trim()) return filtered;
    const q = filter.toLowerCase();
    return filtered.filter((e) => {
      const t = (e.title ?? "").toLowerCase();
      const c = (e.content ?? "").toLowerCase();
      const phone = String(e.metadata?.phone ?? "").toLowerCase();
      const email = String(e.metadata?.email ?? "").toLowerCase();
      return t.includes(q) || c.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [entries, filter]);

  return (
    <div
      className="mx-auto w-full"
      style={{
        maxWidth: 720,
        padding: "24px 20px calc(96px + env(safe-area-inset-bottom, 0px))",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div className="f-serif" style={{ fontSize: 22, color: "var(--ink)" }}>
            Contacts
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
            Anything with a phone or email — imported, captured, or extracted.
          </div>
        </div>
        <Button type="button" onClick={() => setImporting(true)} size="sm">
          + Import vCard
        </Button>
      </div>

      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search by name, number, email…"
        style={{
          padding: "10px 12px",
          background: "var(--surface)",
          border: "1px solid var(--line-soft)",
          borderRadius: 8,
          color: "var(--ink)",
          fontSize: 14,
          fontFamily: "var(--f-sans)",
        }}
      />

      {contacts.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--line-soft)",
            borderRadius: 12,
            padding: "32px 16px",
            textAlign: "center",
            color: "var(--ink-faint)",
            fontSize: 13,
          }}
        >
          {filter
            ? "No contacts match that search."
            : "No contacts yet. Tap + Import vCard to add some."}
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--line-soft)",
            borderRadius: 12,
            overflow: "hidden",
            background: "var(--surface)",
          }}
        >
          {contacts.map((e, i) => {
            const phone = e.metadata?.phone as string | undefined;
            const email = e.metadata?.email as string | undefined;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelectEntry?.(e)}
                className="press"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  width: "100%",
                  textAlign: "left",
                  background: "transparent",
                  borderBottom: i < contacts.length - 1 ? "1px solid var(--line-soft)" : 0,
                  cursor: "pointer",
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "var(--ember-wash)",
                    color: "var(--ember)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {(e.title ?? "?").slice(0, 1).toUpperCase()}
                </div>
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
                    {e.title || "(unnamed)"}
                  </div>
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
                    {[phone, email].filter(Boolean).join(" · ") || fmtRelative(e.created_at)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {importing && (
        <VCardImportModal
          brainId={brainId}
          onClose={() => setImporting(false)}
          onImported={(created) => {
            for (const entry of created) onEntryCreated(entry);
            setImporting(false);
          }}
        />
      )}
    </div>
  );
}
