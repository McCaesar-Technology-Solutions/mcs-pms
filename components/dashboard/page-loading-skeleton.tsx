import {
  Skeleton,
  SkeletonPageHeader,
  SkeletonTableRows,
} from '@/components/ui/skeleton'

interface PageLoadingSkeletonProps {
  variant?: 'dashboard' | 'manager-dashboard' | 'table' | 'kanban' | 'complaints'
}

function DashboardHeroSkeleton() {
  return (
    <div className="page-header-bleed">
      <section className="dashboard-header-band" aria-hidden>
        <div className="page-shell dashboard-header-band__inner">
          <div className="space-y-4">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-3.5 w-14 rounded-md" />
                <Skeleton className="h-8 w-52 max-w-full sm:h-9" />
                <Skeleton className="h-4 w-40 max-w-full" />
              </div>
              <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4 lg:max-w-[40rem] lg:flex-1">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-[4.75rem] rounded-xl" />
                ))}
              </div>
            </header>
            <Skeleton className="h-[5.5rem] w-full rounded-xl" />
          </div>
        </div>
      </section>
    </div>
  )
}

function SectionHeadingSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className={`h-6 ${wide ? 'w-48' : 'w-36'}`} />
      <Skeleton className="h-4 w-64 max-w-full" />
    </div>
  )
}

function OwnerDashboardBody() {
  return (
    <div className="page-content-stack page-shell--after-hero">
      <section className="space-y-4">
        <SectionHeadingSkeleton wide />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <Skeleton className="h-52 rounded-xl lg:col-span-3" />
          <Skeleton className="h-52 rounded-xl lg:col-span-2" />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeadingSkeleton />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
      </div>

      <Skeleton className="h-44 rounded-xl" />
    </div>
  )
}

function ManagerDashboardBody() {
  return (
    <div className="page-content-stack page-shell--after-hero">
      <div className="flex flex-wrap gap-2 border-b border-[rgba(var(--glow-purple),0.08)] pb-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-lg" />
        ))}
      </div>

      <section className="space-y-3">
        <SectionHeadingSkeleton />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </section>

      <Skeleton className="h-32 rounded-xl" />

      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>

      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}

function TablePageSkeleton({ withTimeline = false }: { withTimeline?: boolean }) {
  return (
    <div className="page-shell page-content-stack">
      <SkeletonPageHeader />

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>

      {withTimeline && <Skeleton className="h-36 rounded-xl" />}

      <div className="surface-card overflow-hidden">
        <div className="surface-card-header space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full max-w-md rounded-xl" />
        </div>
        <SkeletonTableRows rows={8} />
        <div className="border-t border-[rgba(var(--glow-purple),0.08)] px-4 py-3 sm:px-6">
          <Skeleton className="ml-auto h-8 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function KanbanPageSkeleton() {
  return (
    <div className="page-shell page-content-stack">
      <SkeletonPageHeader />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((col) => (
          <div key={col} className="space-y-3 rounded-xl bg-[rgba(var(--glow-purple),0.03)] p-4">
            <Skeleton className="h-5 w-24" />
            <div className="space-y-2.5">
              {[1, 2, 3].map((card) => (
                <Skeleton key={card} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ComplaintsPageSkeleton() {
  return (
    <div className="page-shell page-content-stack">
      <SkeletonPageHeader />

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>

      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3 rounded-xl bg-[rgba(var(--glow-purple),0.03)] p-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5 max-w-xs" />
              <Skeleton className="h-3 w-full max-w-md" />
              <Skeleton className="h-3 w-2/5 max-w-[10rem]" />
            </div>
            <Skeleton className="hidden h-6 w-16 shrink-0 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PageLoadingSkeleton({ variant = 'dashboard' }: PageLoadingSkeletonProps) {
  if (variant === 'complaints') {
    return <ComplaintsPageSkeleton />
  }

  if (variant === 'kanban') {
    return <KanbanPageSkeleton />
  }

  if (variant === 'table') {
    return <TablePageSkeleton withTimeline />
  }

  if (variant === 'manager-dashboard') {
    return (
      <div className="page-shell pb-10">
        <DashboardHeroSkeleton />
        <ManagerDashboardBody />
      </div>
    )
  }

  return (
    <div className="page-shell dashboard-launchpad pb-8">
      <DashboardHeroSkeleton />
      <OwnerDashboardBody />
    </div>
  )
}
