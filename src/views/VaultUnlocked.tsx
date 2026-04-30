// Unlocked vault — main view, secret cards, bulk-delete bar, and the
// inline add-secret modal. State + handlers live in useVaultOps; the
// view-mode toggle (grid / list) is local because it only matters here.
//
// Split out of VaultView.tsx. Accepts the full hook bag so the prop
// surface is one object, not 25 individual fields.

import { useState } from "react";
import { getTypeConfig } from "../data/constants";
import type { useVaultOps } from "../hooks/useVaultOps";
import type { Entry } from "../types";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";

type VaultOps = ReturnType<typeof useVaultOps>;

export function VaultUnlocked({
  ops,
  onSelect,
}: {
  ops: VaultOps;
  onSelect: (entry: Entry) => void;
}) {
  const {
    decryptedSecrets,
    revealedIds,
    copyMsg,
    bulkMode,
    setBulkMode,
    selectedIds,
    setSelectedIds,
    showAddSecret,
    setShowAddSecret,
    addTitle,
    setAddTitle,
    addContent,
    setAddContent,
    addTags,
    setAddTags,
    addMetaRows,
    setAddMetaRows,
    addError,
    setAddError,
    addBusy,
    handleAddSecret,
    bulkDelete,
    toggleReveal,
    copyToClipboard,
    lockVault,
    startAddSecret,
  } = ops;

  // Match the memory grid's grid/list toggle so the unlocked vault feels
  // like the same surface, just filtered to encrypted entries.
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <div
      className="space-y-4 px-4 py-4"
      style={{
        background: "var(--bg)",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "18px 0 14px",
          borderBottom: "1px solid var(--line-soft)",
          marginBottom: 20,
        }}
      >
        <div
          className="vault-header-row"
          style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1
              className="f-serif"
              style={{
                fontSize: 28,
                fontWeight: 450,
                letterSpacing: "-0.015em",
                lineHeight: 1.1,
                margin: 0,
                color: "var(--ink)",
              }}
            >
              Vault
            </h1>
            <div
              className="f-serif"
              style={{ fontSize: 14, color: "var(--ink-faint)", fontStyle: "italic", marginTop: 4 }}
            >
              unlocked · {decryptedSecrets.length} secret
              {decryptedSecrets.length === 1 ? "" : "s"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Grid / List toggle — same visual idiom as the memory grid. */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "list")}>
              <TabsList
                aria-label="View mode"
                className="border border-[var(--line-soft)] bg-[var(--surface-low)]"
              >
                <TabsTrigger value="grid" className="capitalize">
                  grid
                </TabsTrigger>
                <TabsTrigger value="list" className="capitalize">
                  list
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={startAddSecret} size="sm">
              + Add secret
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBulkMode((b) => !b);
                setSelectedIds(new Set());
              }}
              style={{
                color: bulkMode ? "var(--ember)" : undefined,
                borderColor: bulkMode ? "var(--ember)" : undefined,
              }}
            >
              {bulkMode ? "Cancel" : "Select"}
            </Button>
            <Button variant="outline" size="sm" onClick={lockVault}>
              Lock
            </Button>
          </div>
        </div>
      </div>

      {copyMsg && (
        <div
          className="rounded-xl px-3 py-2 text-center text-xs font-medium"
          style={{ color: "var(--color-primary)", background: "var(--color-primary-container)" }}
        >
          {copyMsg}
        </div>
      )}

      {decryptedSecrets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--ember-wash)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
              style={{ color: "var(--ember)" }}
              aria-hidden="true"
            >
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          </div>
          <h2
            className="f-serif"
            style={{
              fontSize: 24,
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            Vault is empty.
          </h2>
          <p
            className="f-serif"
            style={{
              fontSize: 15,
              fontStyle: "italic",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: 360,
              lineHeight: 1.55,
            }}
          >
            Passwords, PINs, recovery codes, anything you don't want in plaintext. Encrypted
            client-side with your master passphrase.
          </p>
          <Button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
              )
            }
            className="mt-1"
          >
            Add a secret
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {decryptedSecrets.map((e) => {
            const revealed = revealedIds.has(e.id);
            return (
              <div
                key={e.id}
                className="overflow-hidden rounded-2xl border"
                style={{
                  background: "var(--color-surface-container)",
                  borderColor: "var(--color-outline-variant)",
                }}
              >
                <div className="flex items-center justify-between p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {bulkMode && (
                      <Checkbox
                        checked={selectedIds.has(e.id)}
                        onCheckedChange={(checked) =>
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(e.id);
                            else next.delete(e.id);
                            return next;
                          })
                        }
                        aria-label={`Select ${e.title}`}
                      />
                    )}
                    <span className="text-base">{getTypeConfig(e.type).i}</span>
                    <span className="text-on-surface truncate text-sm font-medium">{e.title}</span>
                  </div>
                  {!bulkMode && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => toggleReveal(e.id)}
                      style={{
                        color: "var(--color-primary)",
                        borderColor: "var(--color-primary-container)",
                      }}
                    >
                      {revealed ? "Hide" : "Reveal"}
                    </Button>
                  )}
                </div>

                {revealed ? (
                  <div className="space-y-3 px-3 pb-3">
                    <div
                      className="rounded-xl border p-3"
                      style={{
                        background: "var(--color-surface-dim)",
                        borderColor: "var(--color-outline-variant)",
                      }}
                    >
                      <p className="text-on-surface font-mono text-sm break-all">{e.content}</p>
                    </div>
                    <div
                      className="flex items-center gap-2 border-t pt-1"
                      style={{ borderColor: "var(--color-outline-variant)" }}
                    >
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => copyToClipboard(e.content || "", "Content copied")}
                      >
                        📋 Copy content
                      </Button>
                      <Button variant="outline" size="xs" onClick={() => onSelect(e)}>
                        Edit
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 pb-3">
                    <span className="text-on-surface-variant text-sm tracking-widest">
                      ••••••••••••
                    </span>
                    {(e.tags?.length ?? 0) > 0 &&
                      e.tags!.slice(0, 3).map((tag: string) => (
                        <span
                          key={tag}
                          className="rounded-full px-2 py-0.5 text-[10px]"
                          style={{
                            color: "var(--color-on-surface-variant)",
                            background: "var(--color-surface-container)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {bulkMode && selectedIds.size > 0 && (
        <div
          className="fixed right-4 bottom-20 left-4 z-50 flex items-center justify-between rounded-2xl p-3"
          style={{
            background: "var(--color-surface-container-low)",
            borderColor: "var(--color-outline-variant)",
            border: "1px solid",
          }}
        >
          <span className="text-on-surface text-sm">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={bulkDelete}>
              Delete
            </Button>
          </div>
        </div>
      )}

      {showAddSecret && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: "var(--color-scrim)", padding: "12px 12px 0" }}
          onClick={() => !addBusy && setShowAddSecret(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-t-2xl border sm:rounded-2xl"
            style={{
              background: "var(--color-surface-container-low)",
              borderColor: "var(--color-outline-variant)",
              fontFamily: "var(--f-sans)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "calc(100dvh - 12px)",
            }}
          >
            <div
              className="border-b p-4"
              style={{ borderColor: "var(--color-outline-variant)", flexShrink: 0 }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-on-surface text-base font-bold">➕ Add Secret</h3>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => !addBusy && setShowAddSecret(false)}
                  aria-label="Close"
                  style={{ color: "var(--color-on-surface-variant)" }}
                >
                  ✕
                </Button>
              </div>
              <p className="mt-1 text-[11px]" style={{ color: "var(--color-on-surface-variant)" }}>
                Encrypted on this device. AI never sees this entry.
              </p>
            </div>

            <div
              className="space-y-3 p-4"
              style={
                {
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                } as React.CSSProperties
              }
            >
              <div className="space-y-1">
                <label
                  className="text-[11px] font-medium tracking-wide uppercase"
                  style={{ color: "var(--color-on-surface-variant)" }}
                >
                  Title
                </label>
                <input
                  type="text"
                  value={addTitle}
                  onChange={(e) => {
                    setAddTitle(e.target.value);
                    setAddError("");
                  }}
                  placeholder="e.g. Gmail password"
                  className="text-on-surface placeholder:text-on-surface-variant w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm transition-colors outline-none"
                  style={{ borderColor: "var(--color-outline-variant)" }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-outline-variant)")}
                />
              </div>

              <div className="space-y-1">
                <label
                  className="text-[11px] font-medium tracking-wide uppercase"
                  style={{ color: "var(--color-on-surface-variant)" }}
                >
                  Secret value
                </label>
                <textarea
                  value={addContent}
                  onChange={(e) => {
                    setAddContent(e.target.value);
                    setAddError("");
                  }}
                  rows={3}
                  placeholder="Password, key, card number, etc."
                  className="text-on-surface placeholder:text-on-surface-variant w-full resize-none rounded-xl border bg-transparent px-3 py-2.5 font-mono text-sm transition-colors outline-none"
                  style={{ borderColor: "var(--color-outline-variant)" }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-outline-variant)")}
                />
              </div>

              <div className="space-y-1">
                <label
                  className="text-[11px] font-medium tracking-wide uppercase"
                  style={{ color: "var(--color-on-surface-variant)" }}
                >
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={addTags}
                  onChange={(e) => setAddTags(e.target.value)}
                  placeholder="work, banking, 2fa"
                  className="text-on-surface placeholder:text-on-surface-variant w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm transition-colors outline-none"
                  style={{ borderColor: "var(--color-outline-variant)" }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--color-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--color-outline-variant)")}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    className="text-[11px] font-medium tracking-wide uppercase"
                    style={{ color: "var(--color-on-surface-variant)" }}
                  >
                    Extra fields
                  </label>
                  <Button
                    variant="link"
                    size="xs"
                    onClick={() => setAddMetaRows((p) => [...p, { key: "", value: "" }])}
                    className="px-0"
                  >
                    + Add field
                  </Button>
                </div>
                {addMetaRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={row.key}
                      onChange={(e) =>
                        setAddMetaRows((p) =>
                          p.map((r, idx) => (idx === i ? { ...r, key: e.target.value } : r)),
                        )
                      }
                      placeholder="username"
                      className="text-on-surface placeholder:text-on-surface-variant min-w-0 flex-1 rounded-xl border bg-transparent px-2.5 py-2 text-xs outline-none"
                      style={{ borderColor: "var(--color-outline-variant)" }}
                    />
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) =>
                        setAddMetaRows((p) =>
                          p.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r)),
                        )
                      }
                      placeholder="value"
                      className="text-on-surface placeholder:text-on-surface-variant min-w-0 flex-1 rounded-xl border bg-transparent px-2.5 py-2 text-xs outline-none"
                      style={{ borderColor: "var(--color-outline-variant)" }}
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setAddMetaRows((p) => p.filter((_, idx) => idx !== i))}
                      aria-label="Remove field"
                      style={{ color: "var(--color-error)" }}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>

              {addError && (
                <p className="text-xs" style={{ color: "var(--color-error)" }}>
                  {addError}
                </p>
              )}
            </div>

            <div
              className="flex items-center gap-2 border-t p-3"
              style={{
                borderColor: "var(--color-outline-variant)",
                flexShrink: 0,
                paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
              }}
            >
              <Button
                variant="outline"
                size="lg"
                onClick={() => !addBusy && setShowAddSecret(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                size="lg"
                onClick={handleAddSecret}
                disabled={addBusy || !addTitle.trim() || !addContent.trim()}
                className="flex-1"
              >
                {addBusy ? "Encrypting..." : "🔒 Save secret"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
