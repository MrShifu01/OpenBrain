function SingleSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div>
        <div data-testid="skeleton-line" />
        <div>
          <div data-testid="skeleton-line" />
          <div data-testid="skeleton-line" />
        </div>
      </div>
      <div>
        <div data-testid="skeleton-line" />
        <div data-testid="skeleton-line" />
        <div data-testid="skeleton-line" />
      </div>
      <div>
        <div data-testid="skeleton-line" />
        <div data-testid="skeleton-line" />
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
