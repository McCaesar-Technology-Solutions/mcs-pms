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

function DarkHeroShimmer() {
  return (
    <div className="page-header-bleed overflow-hidden rounded-b-2xl bg-[#14101f] p-5 sm:p-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <Shimmer className="h-3 w-20 bg-white/10" />
          <Shimmer className="h-9 w-56 bg-white/10" />
          <Shimmer className="h-4 w-32 bg-white/10" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Shimmer key={i} className="h-[5.5rem] bg-white/10" />
          ))}
        </div>
        <Shimmer className="h-10 w-full max-w-xl bg-white/10" />
      </div>
    </div>
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
    <div className="page-shell pb-10">
      <DarkHeroShimmer />
      <div className="page-content-stack page-shell--after-hero">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <Shimmer className="h-44 rounded-xl lg:col-span-3" />
          <Shimmer className="h-44 rounded-xl lg:col-span-2" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Shimmer key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Shimmer className="h-52 rounded-2xl" />
      </div>
    </div>
  )
}
