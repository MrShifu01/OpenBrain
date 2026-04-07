interface NudgeBannerProps {
  nudge: string;
  onDismiss: () => void;
}

export function NudgeBanner({ nudge, onDismiss }: NudgeBannerProps) {
  if (!nudge) return null;
  return (
    <div
      className="flex items-start gap-3 p-4 rounded-2xl mb-4 border"
      style={{
        background: "rgba(213,117,255,0.06)",
        borderColor: "rgba(213,117,255,0.15)",
      }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
        style={{ background: "rgba(213,117,255,0.12)" }}
      >
        💡
      </div>
      <p className="flex-1 text-sm text-on-surface-variant leading-relaxed">{nudge}</p>
      <button
        onClick={onDismiss}
        className="text-on-surface-variant/50 hover:text-on-surface transition-colors flex-shrink-0 mt-0.5 press-scale"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
