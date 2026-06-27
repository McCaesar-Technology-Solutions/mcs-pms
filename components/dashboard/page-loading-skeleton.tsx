interface PageLoadingSkeletonProps {
  variant?: 'dashboard' | 'table' | 'complaints'
}

function Shimmer({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gradient-to-r bg-[length:200%_100%] ${
        dark
          ? 'from-white/5 via-white/10 to-white/5'
          : 'from-muted/50 via-muted/70 to-muted/50'
      } ${className ?? ''}`}
      style={{ animation: 'shimmer 1.8s ease-in-out infinite' }}
    />
  )
}

export function PageLoadingSkeleton({ variant = 'dashboard' }: PageLoadingSkeletonProps) {
  if (variant === 'complaints') {
    return (
      <div className="page-shell space-y-6">
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
      <div className="page-shell space-y-6">
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
    <>
      <div className="dark-surface-band dark-surface-band--ops px-4 py-6 sm:px-6">
        <div className="page-shell space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <Shimmer dark className="h-3 w-28 rounded-md" />
              <Shimmer dark className="h-8 w-36 rounded-lg" />
              <Shimmer dark className="h-4 w-44 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:max-w-[42rem] lg:flex-1">
              {[1, 2, 3, 4].map((i) => (
                <Shimmer key={i} dark className="h-[5.5rem] rounded-xl" />
              ))}
            </div>
          </div>
          <Shimmer dark className="h-14 rounded-xl" />
        </div>
      </div>

      <div className="page-shell space-y-5 py-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Shimmer className="h-44 rounded-2xl bg-[#1a0f3d]/20 lg:col-span-3" />
          <Shimmer className="h-44 rounded-2xl lg:col-span-2" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      <div className="dark-surface-band dark-surface-band--depth px-4 py-8 sm:px-6">
        <div className="page-shell space-y-6">
          <Shimmer dark className="h-56 rounded-2xl" />
          <Shimmer dark className="h-48 rounded-2xl" />
        </div>
      </div>
    </>
  )
}
