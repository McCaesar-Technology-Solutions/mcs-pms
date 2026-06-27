interface PageLoadingSkeletonProps {
  variant?: 'dashboard' | 'table' | 'complaints'
}

export function PageLoadingSkeleton({ variant = 'dashboard' }: PageLoadingSkeletonProps) {
  if (variant === 'complaints') {
    return (
      <div className="page-shell animate-pulse space-y-6">
        <div className="h-24 rounded-2xl bg-muted/60" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-24 rounded-full bg-muted/60" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted/50" />
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className="page-shell animate-pulse space-y-6">
        <div className="h-24 rounded-2xl bg-muted/60" />
        <div className="h-64 rounded-2xl bg-muted/40" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-muted/50" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell animate-pulse space-y-8">
      <div className="h-28 rounded-2xl bg-gradient-to-r from-muted/70 via-muted/50 to-muted/70" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-muted/50 ring-1 ring-primary/5" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-56 rounded-2xl bg-muted/40 ring-1 ring-primary/5" />
        <div className="h-56 rounded-2xl bg-muted/40 ring-1 ring-primary/5" />
      </div>
    </div>
  )
}
