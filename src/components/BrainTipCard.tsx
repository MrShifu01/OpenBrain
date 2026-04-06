import type { JSX } from "react";
import type { Brain } from "../types";

const TIPS: Record<string, string[]> = {
  family: [
    "Emergency contacts for each family member",
    "Medical aid numbers & blood types",
    "School names, contacts & pickup rules",
    "Home insurance policy & emergency numbers",
  ],
  business: [
    "Key supplier contacts & account numbers",
    "Staff names, roles & emergency contacts",
    "Licences, registration numbers & renewal dates",
    "SOPs for your most common tasks",
  ],
};

interface BrainTipCardProps {
  brain: Brain;
  onDismiss: () => void;
  onFill: () => void;
}

export default function BrainTipCard({ brain, onDismiss, onFill }: BrainTipCardProps): JSX.Element {
  const tips = TIPS[brain.type || ""] || [];
  const emoji = brain.type === "business" ? "🏪" : "🏠";

  return (
    <div className="from-teal/[0.08] to-teal-dark/[0.06] border-teal/25 relative mx-5 mb-4 rounded-[14px] border bg-gradient-to-br px-[18px] py-4">
      <button
        onClick={onDismiss}
        className="text-ob-text-faint absolute top-2.5 right-3 cursor-pointer border-none bg-none text-base leading-none"
      >
        ×
      </button>

      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <span className="text-ob-text text-[13px] font-bold">
          {brain.name} is ready — start here
        </span>
      </div>

      <div className="mb-3.5 flex flex-col gap-1.5">
        {tips.map((tip) => (
          <div key={tip} className="text-ob-text-dim flex items-start gap-2 text-xs">
            <span className="text-teal mt-px shrink-0">✦</span>
            {tip}
          </div>
        ))}
      </div>

      <button
        onClick={onFill}
        className="gradient-accent cursor-pointer rounded-lg border-none px-[18px] py-2 text-xs font-bold text-[#0f0f23]"
      >
        Start filling →
      </button>
    </div>
  );
}
