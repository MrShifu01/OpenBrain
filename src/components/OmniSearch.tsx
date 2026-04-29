import { useState, useEffect } from "react";
import type { Entry } from "../types";
import { scoreEntry } from "../lib/searchIndex";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "./ui/command";

interface ConceptLike {
  id?: string;
  label: string;
  count?: number;
  /** Array of source entry ids, if the caller has them */
  source_entries?: string[];
}

interface OmniSearchProps {
  entries: Entry[];
  onSelect: (entry: Entry) => void;
  onNavigate: (view: string) => void;
  concepts?: ConceptLike[];
  showGraph?: boolean;
}

// Line-art entry-type glyph — 1.5px stroke, rounded joins.
function TypeGlyph({ type }: { type?: string }) {
  const common = {
    width: 14,
    height: 14,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
  };
  switch (type) {
    case "link":
      return (
        <svg {...common}>
          <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
          <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
        </svg>
      );
    case "reminder":
      return (
        <svg {...common}>
          <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case "idea":
      return (
        <svg {...common}>
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V15h7v-1.1A6 6 0 0 0 12 3z" />
        </svg>
      );
    case "contact":
    case "person":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
        </svg>
      );
    case "file":
    case "document":
      return (
        <svg {...common}>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v4h4" />
        </svg>
      );
    case "secret":
      return (
        <svg {...common}>
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M5 4h10l4 4v12H5z" />
          <path d="M15 4v4h4M8 12h8M8 16h6" />
        </svg>
      );
  }
}

const MOD = typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘" : "Ctrl";

const COMMANDS: { label: string; view: string; kbd: string }[] = [
  { label: "Capture something", view: "capture", kbd: "N" },
  { label: "Go to chat", view: "chat", kbd: "J" },
  { label: "Go to graph", view: "graph", kbd: "G" },
  { label: "Open schedule", view: "todos", kbd: "T" },
];

export default function OmniSearch({
  entries,
  onSelect,
  onNavigate,
  concepts = [],
  showGraph = false,
}: OmniSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isMobile =
    typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl+/ for search — moved off Cmd+K so the floating capture
      // button's "CTRL K" hint actually opens capture. "/" is the same
      // shortcut GitHub, GitLab, and Slack use for search.
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Compute results — cmdk does its own filtering via `value`, but scoreEntry
  // is a real ranker (substring + tag + content boost) so keep it as the
  // ordering source of truth and feed cmdk the prefiltered list.
  const trimmed = query.trim();
  const results = trimmed
    ? entries
        .map((e) => ({ entry: e, score: scoreEntry(e, trimmed) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(({ entry }) => entry)
    : [];

  const conceptResults = trimmed
    ? concepts.filter((c) => c.label.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 6)
    : [];

  const commandResults = trimmed
    ? COMMANDS.filter((c) => c.label.toLowerCase().includes(trimmed.toLowerCase()))
    : COMMANDS;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
      title="Search"
      description="Search entries, concepts, and commands"
    >
      <CommandInput value={query} onValueChange={setQuery} placeholder="search everything…" />
      <CommandList>
        <CommandEmpty>nothing here yet. try a looser word.</CommandEmpty>

        {results.length > 0 && (
          <CommandGroup heading="entries">
            {results.map((entry) => (
              <CommandItem
                key={entry.id}
                value={`entry-${entry.id}-${entry.title}`}
                onSelect={() => {
                  onSelect(entry);
                  setOpen(false);
                }}
              >
                <span style={{ color: "var(--ink-faint)", display: "inline-flex" }}>
                  <TypeGlyph type={entry.type} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    className="f-serif truncate"
                    style={{
                      fontSize: 14,
                      fontWeight: 450,
                      color: "var(--ink)",
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {entry.title}
                  </div>
                  {(entry.tags || []).length > 0 ? (
                    <div
                      className="f-serif truncate"
                      style={{
                        fontSize: 11,
                        color: "var(--ink-faint)",
                        fontStyle: "italic",
                      }}
                    >
                      {(entry.tags || []).slice(0, 3).join(" · ")}
                    </div>
                  ) : entry.content ? (
                    <div
                      className="f-serif truncate"
                      style={{
                        fontSize: 11,
                        color: "var(--ink-faint)",
                        fontStyle: "italic",
                      }}
                    >
                      {entry.content.slice(0, 80)}
                    </div>
                  ) : null}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showGraph && conceptResults.length > 0 && (
          <CommandGroup heading="concepts">
            {conceptResults.map((c) => (
              <CommandItem
                key={c.id ?? c.label}
                value={`concept-${c.id ?? c.label}`}
                onSelect={() => {
                  onNavigate("graph");
                  setOpen(false);
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--ember)",
                    flexShrink: 0,
                  }}
                />
                <span
                  className="f-serif"
                  style={{ fontSize: 13, fontStyle: "italic", color: "var(--ink)" }}
                >
                  {c.label}
                </span>
                {(c.count != null || (c.source_entries && c.source_entries.length > 0)) && (
                  <span
                    className="f-sans"
                    style={{ fontSize: 11, color: "var(--ink-faint)", marginLeft: "auto" }}
                  >
                    {c.count ?? c.source_entries?.length ?? 0} entries
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!isMobile && commandResults.length > 0 && (
          <CommandGroup heading="commands">
            {commandResults.map((c) => (
              <CommandItem
                key={c.label}
                value={`command-${c.view}-${c.label}`}
                onSelect={() => {
                  onNavigate(c.view);
                  setOpen(false);
                }}
              >
                <span className="f-sans" style={{ fontSize: 13, color: "var(--ink)" }}>
                  {c.label}
                </span>
                <CommandShortcut>
                  {MOD} {c.kbd}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
