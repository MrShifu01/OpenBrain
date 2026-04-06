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
    <div ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Switch brain"
      >
        <span>
          {activeBrain?.type === "personal" ? "🧠" : activeBrain?.type === "business" ? "🏪" : "🏠"}
        </span>
        <span>{activeBrain?.name || "Select Brain"}</span>
        {activeBrain?.myRole === "viewer" && (
          <span>view</span>
        )}
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div>
          {/* Personal brains */}
          {personalBrains.length > 0 && (
            <div>Personal</div>
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
            <div>Shared</div>
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

          <div />

          {/* Create new shared brain */}
          <button
            onClick={() => {
              setOpen(false);
              setShowCreate(true);
            }}
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
    >
      <span>
        <span>{emoji}</span>
        <span>{brain.name}</span>
        {role && role !== "owner" && (
          <span>{role}</span>
        )}
        {active && <span>✓</span>}
      </span>
      {canDelete && hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          title="Delete brain"
          aria-label="Delete brain"
        >
          ×
        </button>
      )}
    </div>
  );
}
