import { useState, useRef, useEffect, type JSX } from "react";
import CreateBrainModal from "./CreateBrainModal";
import type { Brain } from "../types";

/**
 * BrainSwitcher — header dropdown to switch between brains,
 * create a new shared brain, or manage the current one.
 */

interface BrainSwitcherProps {
  brains: Brain[];
  activeBrain: Brain | null;
  onSwitch: (brain: Brain) => void;
  onBrainCreated: (brain: Brain) => Promise<void>;
  onBrainDeleted: (brainId: string) => void;
  onBrainTip?: (brain: Brain) => void;
}

export default function BrainSwitcher({
  brains,
  activeBrain,
  onSwitch,
  onBrainCreated,
  onBrainDeleted,
  onBrainTip,
}: BrainSwitcherProps): JSX.Element {
  const [open, setOpen] = useState<boolean>(false);
  const [showCreate, setShowCreate] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // UX-4: Close dropdown on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const personalBrains = brains.filter((b) => b.type === "personal");
  const sharedBrains = brains.filter((b) => b.type !== "personal");

  function select(brain: Brain): void {
    onSwitch(brain);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative inline-block">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Switch brain"
        className="flex max-w-[200px] cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg border border-white/15 bg-white/[0.08] px-2.5 py-[5px] text-[13px] font-medium text-ellipsis whitespace-nowrap text-[#e8e8e8]"
      >
        <span className="text-[15px]">
          {activeBrain?.type === "personal" ? "🧠" : activeBrain?.type === "business" ? "🏪" : "🏠"}
        </span>
        <span className="overflow-hidden text-ellipsis">{activeBrain?.name || "Select Brain"}</span>
        {activeBrain?.myRole === "viewer" && (
          <span className="rounded-[10px] bg-[#88888820] px-1.5 py-px text-[9px] text-[#888]">
            view
          </span>
        )}
        <span className="ml-0.5 text-[10px] opacity-60">{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-[999] max-w-[calc(100vw-24px)] min-w-[200px] overflow-hidden rounded-[10px] border border-white/[0.12] bg-[#1e1e2e] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          {/* Personal brains */}
          {personalBrains.length > 0 && (
            <div className="pt-1.5 pb-0.5 pl-3 text-[10px] tracking-[1px] text-[#888] uppercase">
              Personal
            </div>
          )}
          {personalBrains.map((b) => (
            <BrainItem
              key={b.id}
              brain={b}
              active={activeBrain?.id === b.id}
              onSelect={select}
              emoji="🧠"
            />
          ))}

          {/* Shared brains */}
          {sharedBrains.length > 0 && (
            <div className="pt-2 pb-0.5 pl-3 text-[10px] tracking-[1px] text-[#888] uppercase">
              Shared
            </div>
          )}
          {sharedBrains.map((b) => (
            <BrainItem
              key={b.id}
              brain={b}
              active={activeBrain?.id === b.id}
              onSelect={select}
              emoji={b.type === "business" ? "🏪" : "🏠"}
              role={b.myRole}
              canDelete={b.myRole === "owner"}
              onDelete={() => {
                onBrainDeleted(b.id);
                setOpen(false);
              }}
            />
          ))}

          <div className="my-1 border-t border-white/[0.08]" />

          {/* Create new shared brain */}
          <button
            onClick={() => {
              setOpen(false);
              setShowCreate(true);
            }}
            className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-[14px] py-[9px] text-left text-[13px] text-[#7c8ff0]"
          >
            <span>+</span> New shared brain
          </button>
        </div>
      )}

      {showCreate && (
        <CreateBrainModal
          onClose={() => setShowCreate(false)}
          onCreate={async (brain, brainType) => {
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

function BrainItem({
  brain,
  active,
  onSelect,
  emoji,
  role,
  canDelete,
  onDelete,
}: BrainItemProps): JSX.Element {
  const [hovered, setHovered] = useState<boolean>(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(brain)}
      className={`flex cursor-pointer items-center gap-2 px-[14px] py-2 ${
        active ? "bg-[rgba(124,143,240,0.15)]" : hovered ? "bg-white/[0.04]" : "bg-transparent"
      }`}
    >
      <span className="flex flex-1 items-center gap-2">
        <span>{emoji}</span>
        <span
          className={`text-[13px] ${active ? "font-semibold text-[#a5b4fc]" : "font-normal text-[#d4d4d8]"}`}
        >
          {brain.name}
        </span>
        {role && role !== "owner" && (
          <span className="rounded bg-white/[0.06] px-[5px] py-px text-[10px] text-[#666]">
            {role}
          </span>
        )}
        {active && <span className="ml-auto text-xs text-[#7c8ff0]">✓</span>}
      </span>
      {canDelete && hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          title="Delete brain"
          aria-label="Delete brain"
          className="cursor-pointer border-none bg-transparent px-0.5 py-0 text-[13px] leading-none text-red-400"
        >
          ×
        </button>
      )}
    </div>
  );
}
