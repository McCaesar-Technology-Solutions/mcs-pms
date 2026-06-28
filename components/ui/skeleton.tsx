import { cn } from '@/lib/utils'

export type SkeletonTone = 'light' | 'dark' | 'sidebar'

interface SkeletonProps {
  className?: string
  tone?: SkeletonTone
}

export function Skeleton({ className, tone = 'light' }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton', tone !== 'light' && `skeleton--${tone}`, className)}
      aria-hidden
    />
  )
}

export function SkeletonPageHeader() {
  return (
    <header className="page-header mb-6 space-y-2">
      <Skeleton className="h-3 w-20 rounded-md" />
      <Skeleton className="h-8 w-56 max-w-full" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </header>
  )
}

export function SkeletonTableRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="data-table-wrap space-y-2 px-4 pb-4 sm:px-6">
      <Skeleton className="mb-3 h-8 w-full rounded-lg opacity-60" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-[3.25rem] w-full rounded-[0.625rem]" />
      ))}
    </div>
  )
}
