import { useState, useRef, useEffect, type JSX } from "react";
import CreateBrainModal from "./CreateBrainModal";
import type { Brain } from "../types";
import { cn } from "../lib/cn";

interface BrainSwitcherProps {
  brains: Brain[];
  activeBrain: Brain | null;
  onSwitch: (brain: Brain) => void;
  onBrainCreated: (brain: Brain) => Promise<void>;
  onBrainDeleted: (brainId: string) => void;
  onBrainTip?: (brain: Brain) => void;
}

const BRAIN_EMOJI: Record<string, string> = {
  personal: "🧠",
  business: "🏪",
  family: "🏠",
};

export default function BrainSwitcher({
  brains,
  activeBrain,
  onSwitch,
  onBrainCreated,
  onBrainDeleted,
  onBrainTip,
}: BrainSwitcherProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const personalBrains = brains.filter((b) => b.type === "personal");
  const sharedBrains = brains.filter((b) => b.type !== "personal");

  function select(brain: Brain) {
    onSwitch(brain);
    setOpen(false);
  }

  const emoji = BRAIN_EMOJI[activeBrain?.type ?? "personal"] ?? "🧠";

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Switch brain"
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all press-scale"
        style={{
          background: "rgba(213,117,255,0.08)",
          border: "1px solid rgba(213,117,255,0.12)",
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: "linear-gradient(135deg, rgba(213,117,255,0.2), rgba(152,0,208,0.2))" }}
        >
          {emoji}
        </div>
        <span className="flex-1 text-left text-on-surface font-semibold text-sm truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>
          {activeBrain?.name || "Select Brain"}
        </span>
        {activeBrain?.myRole === "viewer" && (
          <span className="text-[9px] uppercase tracking-widest text-on-surface-variant/60 font-semibold">
            view
          </span>
        )}
        <svg
          className={cn("w-3.5 h-3.5 text-on-surface-variant transition-transform flex-shrink-0", open && "rotate-180")}
          fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full left-0 mt-2 w-64 z-50 rounded-2xl py-2 border"
          style={{
            background: "rgba(26,25,25,0.95)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderColor: "rgba(72,72,71,0.12)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5), 0 0 20px rgba(114,239,245,0.05)",
            animation: "zoom-in-95 0.15s ease-out",
          }}
        >
          {personalBrains.length > 0 && (
            <p className="px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/50 font-semibold">
              Personal
            </p>
          )}
          {personalBrains.map((b) => (
            <BrainItem key={b.id} brain={b} active={activeBrain?.id === b.id} onSelect={select} emoji={BRAIN_EMOJI[b.type] ?? "🧠"} />
          ))}

          {sharedBrains.length > 0 && (
            <p className="px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/50 font-semibold mt-1">
              Shared
            </p>
          )}
          {sharedBrains.map((b) => (
            <BrainItem
              key={b.id} brain={b} active={activeBrain?.id === b.id} onSelect={select}
              emoji={BRAIN_EMOJI[b.type] ?? "🧠"} role={b.myRole}
              canDelete={b.myRole === "owner"}
              onDelete={() => { onBrainDeleted(b.id); setOpen(false); }}
            />
          ))}

          <div className="mx-3 my-2 border-t" style={{ borderColor: "rgba(72,72,71,0.12)" }} />

          <button
            onClick={() => { setOpen(false); setShowCreate(true); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-primary hover:bg-surface-container transition-colors text-sm font-semibold"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create New Brain
          </button>
        </div>
      )}

      {showCreate && (
        <CreateBrainModal
          onClose={() => setShowCreate(false)}
          onCreate={async (brain) => {
            await onBrainCreated(brain);
            onBrainTip?.(brain);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

interface BrainItemProps {
  brain: Brain;
  active: boolean;
  onSelect: (brain: Brain) => void;
  emoji: string;
  role?: string;
  canDelete?: boolean;
  onDelete?: () => void;
}

function BrainItem({ brain, active, onSelect, emoji, role, canDelete, onDelete }: BrainItemProps): JSX.Element {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(brain)}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors",
        hovered ? "bg-surface-container" : ""
      )}
    >
      <span className="text-base">{emoji}</span>
      <span className="flex-1 text-sm text-on-surface font-medium truncate">{brain.name}</span>
      {role && role !== "owner" && (
        <span className="text-[9px] uppercase tracking-widest text-on-surface-variant/60 font-semibold">
          {role}
        </span>
      )}
      {active && (
        <svg className="w-3.5 h-3.5 text-primary flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      )}
      {canDelete && hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          title="Delete brain"
          aria-label="Delete brain"
          className="w-5 h-5 flex items-center justify-center rounded text-error hover:bg-error/10 transition-colors ml-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
