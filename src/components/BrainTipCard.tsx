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
    <div>
      <button onClick={onDismiss}>×</button>

      <div>
        <span>{emoji}</span>
        <span>{brain.name} is ready — start here</span>
      </div>

      <div>
        {tips.map((tip) => (
          <div key={tip}>
            <span>✦</span>
            {tip}
          </div>
        ))}
      </div>

      <button onClick={onFill}>
        Start filling →
      </button>
    </div>
  );
}
