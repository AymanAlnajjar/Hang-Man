// Loading placeholder that mirrors final card geometry. Pulses gently.
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={["animate-pulse rounded-md bg-muted", className].join(" ")}
      aria-hidden
    />
  );
}

// A card-shaped skeleton block, matching EditorialCard geometry.
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="card p-5" aria-hidden>
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

// A full-screen list of card skeletons for data-driven pages.
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="جارٍ التحميل">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
