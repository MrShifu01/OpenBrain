const SHIMMER_KEYFRAMES = `
  @keyframes skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

function SingleSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="bg-ob-surface border-ob-border overflow-hidden rounded-xl border px-5 py-4"
    >
      {/* Title line */}
      <div
        data-testid="skeleton-line"
        className="bg-ob-border mb-3 h-3.5 w-[60%] animate-[skeleton-shimmer_1.5s_ease-in-out_infinite] rounded-md bg-[length:200%_100%]"
      />
      {/* Content line 1 */}
      <div
        data-testid="skeleton-line"
        className="bg-ob-border mb-2 h-2.5 w-[90%] animate-[skeleton-shimmer_1.5s_ease-in-out_infinite] rounded bg-[length:200%_100%]"
      />
      {/* Content line 2 */}
      <div
        data-testid="skeleton-line"
        className="bg-ob-border mb-2 h-2.5 w-[75%] animate-[skeleton-shimmer_1.5s_ease-in-out_infinite] rounded bg-[length:200%_100%]"
      />
      {/* Tags line */}
      <div
        data-testid="skeleton-line"
        className="bg-ob-border mt-3 h-2 w-[40%] animate-[skeleton-shimmer_1.5s_ease-in-out_infinite] rounded bg-[length:200%_100%]"
      />
      <style>{SHIMMER_KEYFRAMES}</style>
    </div>
  );
}

interface SkeletonCardProps {
  count?: number;
}

export default function SkeletonCard({ count = 1 }: SkeletonCardProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SingleSkeleton key={i} />
      ))}
    </>
  );
}
