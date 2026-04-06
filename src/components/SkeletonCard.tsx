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
      className="overflow-hidden rounded-2xl border px-5 py-4"
      style={{ background: "#1a1919", borderColor: "rgba(72,72,71,0.15)" }}
    >
      <style>{SHIMMER_KEYFRAMES}</style>
      <div className="mb-4 flex items-center gap-3">
        <div
          data-testid="skeleton-line"
          className="h-8 w-8 rounded-xl animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] bg-[length:200%_100%]"
          style={{ background: "linear-gradient(90deg, #262626 25%, #2c2c2c 50%, #262626 75%)" }}
        />
        <div className="flex-1 space-y-1.5">
          <div
            data-testid="skeleton-line"
            className="h-3 w-[45%] rounded-full animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] bg-[length:200%_100%]"
            style={{ background: "linear-gradient(90deg, #262626 25%, #2c2c2c 50%, #262626 75%)" }}
          />
          <div
            data-testid="skeleton-line"
            className="h-2.5 w-[30%] rounded-full animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] bg-[length:200%_100%]"
            style={{ background: "linear-gradient(90deg, #262626 25%, #2c2c2c 50%, #262626 75%)" }}
          />
        </div>
      </div>
      <div className="space-y-2">
        <div
          data-testid="skeleton-line"
          className="h-5 w-[75%] rounded-lg animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] bg-[length:200%_100%]"
          style={{ background: "linear-gradient(90deg, #262626 25%, #2c2c2c 50%, #262626 75%)" }}
        />
        <div
          data-testid="skeleton-line"
          className="h-3 w-full rounded-full animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] bg-[length:200%_100%]"
          style={{ background: "linear-gradient(90deg, #262626 25%, #2c2c2c 50%, #262626 75%)" }}
        />
        <div
          data-testid="skeleton-line"
          className="h-3 w-[80%] rounded-full animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] bg-[length:200%_100%]"
          style={{ background: "linear-gradient(90deg, #262626 25%, #2c2c2c 50%, #262626 75%)" }}
        />
      </div>
      <div className="mt-4 flex gap-2">
        <div
          data-testid="skeleton-line"
          className="h-5 w-14 rounded-full animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] bg-[length:200%_100%]"
          style={{ background: "linear-gradient(90deg, #262626 25%, #2c2c2c 50%, #262626 75%)" }}
        />
        <div
          data-testid="skeleton-line"
          className="h-5 w-16 rounded-full animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] bg-[length:200%_100%]"
          style={{ background: "linear-gradient(90deg, #262626 25%, #2c2c2c 50%, #262626 75%)" }}
        />
      </div>
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
