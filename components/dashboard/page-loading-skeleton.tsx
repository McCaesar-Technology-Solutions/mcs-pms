interface PageLoadingSkeletonProps {
  variant?: 'dashboard' | 'table' | 'complaints'
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gradient-to-r from-muted/50 via-muted/70 to-muted/50 bg-[length:200%_100%] ${className ?? ''}`}
      style={{ animation: 'shimmer 1.8s ease-in-out infinite' }}
    />
  )
}

export function PageLoadingSkeleton({ variant = 'dashboard' }: PageLoadingSkeletonProps) {
  if (variant === 'complaints') {
    return (
      <div className="page-shell page-content-stack">
        <Shimmer className="h-24 rounded-2xl" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Shimmer key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Shimmer key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className="page-shell page-content-stack">
        <Shimmer className="h-24 rounded-2xl" />
        <Shimmer className="h-64 rounded-2xl" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Shimmer key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell page-content-stack pb-10">
      <Shimmer className="h-52 rounded-2xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Shimmer key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Shimmer className="h-52 rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Shimmer className="h-56 rounded-2xl" />
        <Shimmer className="h-56 rounded-2xl" />
      </div>
    </div>
  )
}
