import { LogIn, LogOut, Percent, Users } from 'lucide-react'
import type { OccupancyToday } from '@/lib/data/occupancy'
import type { TodayOperations } from '@/lib/data/overview'

interface DashboardToolbarProps {
  occupancy?: OccupancyToday
  today: TodayOperations
  title?: string
  eyebrow?: string
}

function StatChip({
  icon: Icon,
  label,
  value,
  detail,
  progress,
}: {
  icon: typeof Percent
  label: string
  value: string
  detail?: string
  progress?: number
}) {
  return (
    <div className="stat-chip min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-white/40" strokeWidth={2} aria-hidden />
        <span className="text-[11px] font-medium text-white/50">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums leading-none tracking-tight text-white sm:text-[2rem]">
        {value}
      </p>
      {progress != null && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--brand-gold)] transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {detail && <p className="mt-1.5 truncate text-[11px] text-white/45">{detail}</p>}
    </div>
  )
}

export function DashboardToolbar({
  occupancy,
  today,
  title = 'Dashboard',
  eyebrow = 'Today',
}: DashboardToolbarProps) {
  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })

  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-gold-light)]">
            {eyebrow}
          </p>
          <h1 className="font-display mt-1.5 text-[1.75rem] font-semibold tracking-tight text-white sm:text-[2.1rem]">
            {title}
          </h1>
          <p className="mt-1 text-sm text-white/50">{dateLabel}</p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-[38rem] lg:flex-1">
          <StatChip
            icon={Percent}
            label="Occupancy"
            value={occupancy ? `${occupancy.percent}%` : '—'}
            detail={occupancy ? `${occupancy.occupied} of ${occupancy.total} rooms` : undefined}
            progress={occupancy?.percent}
          />
          <StatChip
            icon={Users}
            label="In house"
            value={String(today.guestsInHouse)}
            detail="Guests checked in"
          />
          <StatChip
            icon={LogIn}
            label="Arrivals"
            value={String(today.arrivalsToday)}
            detail="Checking in today"
          />
          <StatChip
            icon={LogOut}
            label="Departures"
            value={String(today.departuresToday)}
            detail="Checking out today"
          />
        </div>
      </div>
    </header>
  )
}
